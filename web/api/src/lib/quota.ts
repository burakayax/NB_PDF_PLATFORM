import type { Organization, User } from "@prisma/client";
import { prisma } from "./prisma.js";
import { createOrganizationForUser, revertExpiredOverride } from "../modules/organization/organization.service.js";
import { getPlanDefinitionsResolved } from "../modules/subscription/plan-runtime.js";
import { isFeatureKey } from "../modules/subscription/subscription.config.js";
import { PLAN_LIMITS, businessMonthlyOps } from "./plan-catalogue.js";
import { getSavedLimits, type SavedLimits } from "./packages-config.service.js";

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  resetAt?: Date;
  dailyUsed?: number;
  dailyLimit?: number | null;
  monthlyUsed?: number;
  monthlyLimit?: number | null;
  watermarkEnabled?: boolean;
  fileSizeLimitMB?: number;
  batchLimit?: number;
}

/**
 * HAK AĞIRLIĞI ("havuz" sistemi). Günlük/aylık sayaç tek bir ortak havuzdur; çoğu işlem 1 hak
 * sayılır, sunucuyu uzun süre meşgul eden ağır dönüşümler 2 hak sayılır.
 *
 * Ağırlık canlıda ölçülen sürelere dayanır (2026-10-14, 30 sayfalık örnek PDF; sunucu tek işçiyle
 * çalışır, bir işlem bitmeden sıradaki başlamaz): Office→PDF 5-7 sn, sıkıştır 4 sn, PDF→Metin 2 sn,
 * PDF→Word 10 sn, PDF→Excel 6 sn, PDF→JPG 41 sn, PDF→PowerPoint ~100 sn. Burada olmayan araç = 1 hak.
 * Ön yüzdeki kopya: web/frontend/src/lib/operationWeights.ts (test ayrışmayı yakalar).
 *
 * KURAL: havuzda en az 1 hak kaldıysa işlem başlar (ağır işlem 1 hak kalmışken de çalışır);
 * düşüm ağırlık kadardır, yani sayaç limiti en fazla (ağırlık-1) aşabilir. Kullanıcıyı "2 hakkın
 * yok" diye geri çevirmekten daha az sürtünmelidir.
 */
export const OPERATION_WEIGHTS: Readonly<Record<string, number>> = {
  "pdf-to-image": 2,
  "pdf-to-ppt": 3,
};

export function operationWeight(toolType: string): number {
  const w = OPERATION_WEIGHTS[toolType];
  return Number.isInteger(w) && w >= 1 ? w : 1;
}

/**
 * BUSINESS EKİP HAVUZU — etkin limitler (2026-11-16, finans raporu Ek A).
 *
 * Business'ta sunucu işlemi, dosya boyutu ve toplu işlem artık "sınırsız" DEĞİLDİR; sınırlar
 * fiyat kataloğundan (plan-catalogue.ts) okunur ve ek koltukla büyüyen EKİP HAVUZUDUR: sahibi ve
 * tüm ekip üyeleri aynı sayaçtan düşer. Veritabanındaki org satırında eski ("sınırsız") değer
 * kalmış olsa bile Business için katalog geçerlidir — canlı veritabanını elle düzeltmeye gerek yok.
 * Diğer planlarda org satırındaki değerler aynen geçerli kalır.
 */
export type EffectiveOrgLimits = { monthly: number; fileSizeLimitMB: number; batchLimit: number };

export function effectiveOrgLimits(
  org: Pick<Organization, "plan" | "monthlyOperationLimit" | "fileSizeLimitMB" | "batchLimit">,
  extraSeats: number,
  forceBusiness = false,
  saved: SavedLimits | null = null,
): EffectiveOrgLimits {
  // `saved`: yönetim panelinde KAYDEDİLMİŞ limitler (varsa satırdaki/koddaki değeri ezer).
  if (forceBusiness || org.plan === "BUSINESS") {
    const b = saved?.BUSINESS;
    return {
      monthly: businessMonthlyOps(extraSeats, b?.monthlyOperationLimit ?? PLAN_LIMITS.BUSINESS.monthlyOperationLimit),
      fileSizeLimitMB: b?.fileSizeLimitMB ?? PLAN_LIMITS.BUSINESS.fileSizeLimitMB,
      batchLimit: b?.batchLimit ?? PLAN_LIMITS.BUSINESS.batchLimit,
    };
  }
  const p = saved?.[org.plan as keyof SavedLimits];
  return {
    monthly: p?.monthlyOperationLimit ?? org.monthlyOperationLimit,
    fileSizeLimitMB: p?.fileSizeLimitMB ?? org.fileSizeLimitMB,
    batchLimit: p?.batchLimit ?? org.batchLimit,
  };
}

/** Org'un ekibinin (varsa) ek koltuk sayısı; ek koltuk havuzu büyütür. */
async function extraSeatsForOrg(
  db: Pick<typeof prisma, "team">,
  orgId: string,
): Promise<number> {
  const team = await db.team.findFirst({
    where: { owner: { organizationId: orgId } },
    select: { extraSeats: true },
  });
  return team?.extraSeats ?? 0;
}

/**
 * Aktif ekibin üyesiyse: işlemlerin düşeceği HAVUZ org'u (ekip sahibinin org'u). Üye değilse,
 * ekip aboneliği bitmişse ya da sahibin org'u bulunamazsa null (üye kendi planına bakılır).
 */
async function teamPoolOrg(
  db: Pick<typeof prisma, "team" | "user">,
  user: Pick<User, "isTeamMember" | "teamOwnerId">,
): Promise<Organization | null> {
  if (!user.isTeamMember || !user.teamOwnerId) return null;
  const team = await db.team.findUnique({ where: { ownerId: user.teamOwnerId } });
  if (team?.subscriptionStatus !== "ACTIVE") return null;
  const owner = await db.user.findUnique({
    where: { id: user.teamOwnerId },
    include: { organization: true },
  });
  return owner?.organization ?? null;
}

function getNextMidnightInTimezone(timezone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";

  const year = parseInt(get("year"));
  const month = parseInt(get("month")) - 1;
  const day = parseInt(get("day"));

  const midnightLocal = new Date(Date.UTC(year, month, day + 1, 0, 0, 0));
  const tzOffsetMs = getTimezoneOffsetMs(timezone);
  return new Date(midnightLocal.getTime() - tzOffsetMs);
}

function getTimezoneOffsetMs(timezone: string): number {
  const now = new Date();
  const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = now.toLocaleString("en-US", { timeZone: timezone });
  return new Date(tzStr).getTime() - new Date(utcStr).getTime();
}

function isNewDayInTimezone(lastReset: Date, timezone: string): boolean {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const lastResetDay = formatter.format(lastReset);
  const nowDay = formatter.format(new Date());
  return lastResetDay !== nowDay;
}

function isNewMonthInTimezone(lastReset: Date, timezone: string): boolean {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  });
  const lastResetMonth = formatter.format(lastReset);
  const nowMonth = formatter.format(new Date());
  return lastResetMonth !== nowMonth;
}

async function resetDailyIfNeeded(
  org: Organization,
  timezone: string,
): Promise<Organization> {
  if (isNewDayInTimezone(org.lastDailyReset, timezone)) {
    return prisma.organization.update({
      where: { id: org.id },
      // Bonus (bugünlük admin hediyesi) de yeni günde sıfırlanır.
      data: { currentDayOperations: 0, bonusDailyOperations: 0, lastDailyReset: new Date() },
    });
  }
  return org;
}

/**
 * Geçerli günlük limit: admin'in kullanıcıya özel KALICI limiti (customDailyLimit)
 * varsa plan limitini ezer; üstüne yalnızca bugün geçerli bonus eklenir.
 * `null` → sınırsız (PRO/BUSINESS); bonus uygulanmaz.
 */
function effectiveDailyLimit(
  org: Pick<
    Organization,
    "plan" | "customDailyLimit" | "dailyOperationLimit" | "bonusDailyOperations"
  >,
  saved: SavedLimits | null = null,
): number | null {
  // Sıra: kullanıcıya özel limit > panelde kayıtlı plan limiti > satırdaki plan limiti.
  const savedPlan = saved?.[org.plan as keyof SavedLimits];
  const planDaily =
    savedPlan && savedPlan.dailyOperationLimit !== undefined ? savedPlan.dailyOperationLimit : org.dailyOperationLimit;
  const base = org.customDailyLimit ?? planDaily;
  if (base === null || base === undefined) {
    return null;
  }
  return base + (org.bonusDailyOperations ?? 0);
}

async function resetMonthlyIfNeeded(
  org: Organization,
  timezone: string,
): Promise<Organization> {
  if (isNewMonthInTimezone(org.lastMonthlyReset, timezone)) {
    return prisma.organization.update({
      where: { id: org.id },
      data: { currentMonthOperations: 0, lastMonthlyReset: new Date() },
    });
  }
  return org;
}

export async function checkQuota(
  userId: string,
  toolType: string,
  fileCount: number,
  totalSizeMB: number,
): Promise<QuotaCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });

  if (!user) {
    return { allowed: false, reason: "user_not_found" };
  }

  // Platform ADMIN bypasses all quotas — sınırsız erişim
  if (user.role === "ADMIN") {
    return {
      allowed: true,
      reason: "admin_bypass",
      fileSizeLimitMB: 999999,
      watermarkEnabled: false,
      batchLimit: 999,
      dailyUsed: 0,
      dailyLimit: null,
      monthlyUsed: 0,
      monthlyLimit: null,
    };
  }

  // Aktif Business ekibinin üyesi: işlemler ekip sahibinin HAVUZUNDAN düşer (Business sınırları
  // geçerlidir; "sınırsız" değil). Ekip aboneliği bitmişse üye kendi planının kotasına döner.
  const poolOrg = await teamPoolOrg(prisma, user);

  let org = poolOrg ?? user.organization;
  if (!org) {
    org = await createOrganizationForUser(userId, user.name ?? user.email, "FREE");
  }

  const timezone = user.timezone || "Europe/Istanbul";

  let currentOrg = await resetDailyIfNeeded(org, timezone);
  currentOrg = await resetMonthlyIfNeeded(currentOrg, timezone);
  const savedLimits = await getSavedLimits();
  const lim = effectiveOrgLimits(
    currentOrg,
    poolOrg || currentOrg.plan === "BUSINESS" ? await extraSeatsForOrg(prisma, currentOrg.id) : 0,
    poolOrg !== null,
    savedLimits,
  );

  // Check allowed tools
  {
    // Araç izni TEK kaynaktan okunur: plan tanımı + yönetim panelindeki "Paket & fiyat" ayarı.
    // Eskiden PlanConfig.allowedTools (seed'den kalma "merge,split,compress") okunuyordu; kod ve panel
    // ücretsiz üyeye Word→PDF / PDF→Word / PDF→JPG'yi açsa bile bu eski sütun indirmede 402 verip
    // "ücretli plana geç" penceresi çıkarıyordu.
    const planDefs = await getPlanDefinitionsResolved();
    const planDef = planDefs[poolOrg ? "BUSINESS" : currentOrg.plan];
    if (planDef && isFeatureKey(toolType) && !planDef.allowedFeatures.includes(toolType)) {
      return {
        allowed: false,
        reason: "tool_not_allowed_on_plan",
      };
    }
  }

  // Check file size
  if (totalSizeMB > lim.fileSizeLimitMB) {
    return {
      allowed: false,
      reason: "file_size_exceeded",
    };
  }

  // Check batch
  if (fileCount > 1) {
    if (lim.batchLimit === 0) {
      return {
        allowed: false,
        reason: "batch_not_allowed_on_plan",
      };
    }
    if (fileCount > lim.batchLimit) {
      return {
        allowed: false,
        reason: "batch_limit_exceeded",
      };
    }
  }

  // Check daily limit (kullanıcıya özel limit + bugünlük bonus dahil)
  const effDailyLimit = effectiveDailyLimit(currentOrg, savedLimits);
  if (effDailyLimit !== null) {
    if (currentOrg.currentDayOperations >= effDailyLimit) {
      const resetAt = getNextMidnightInTimezone(timezone);
      return {
        allowed: false,
        reason: "daily_limit_reached",
        resetAt,
        dailyUsed: currentOrg.currentDayOperations,
        dailyLimit: effDailyLimit,
      };
    }
  }

  // Check monthly limit (999999 = sınırsız; Business'ta artık sınır vardır — ekip havuzu)
  if (lim.monthly < 999999) {
    if (currentOrg.currentMonthOperations >= lim.monthly) {
      return {
        allowed: false,
        reason: "monthly_limit_reached",
        monthlyUsed: currentOrg.currentMonthOperations,
        monthlyLimit: lim.monthly,
      };
    }
  }

  return {
    allowed: true,
    dailyUsed: currentOrg.currentDayOperations,
    dailyLimit: effDailyLimit,
    monthlyUsed: currentOrg.currentMonthOperations,
    monthlyLimit: lim.monthly,
    // Politika: hiçbir planda görünür filigran/footer damgası YOK ("filigransız" markası).
    // DB'de eski org'larda watermarkEnabled=true kalmış olsa bile karar daima false döner.
    watermarkEnabled: false,
    fileSizeLimitMB: lim.fileSizeLimitMB,
  };
}

export async function incrementQuota(
  userId: string,
  toolType: string,
  fileCount: number = 1,
  totalFileSizeMB: number = 0,
  processingTimeMs?: number,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });

  if (!user || user.role === "ADMIN") return;
  // Aktif Business ekibinin üyesi: sayaç ekip havuzunda (sahibin org'u) tutulur.
  const countOrg = (await teamPoolOrg(prisma, user)) ?? user.organization;
  if (!countOrg) return;

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: countOrg.id },
      data: {
        currentDayOperations: { increment: operationWeight(toolType) },
        currentMonthOperations: { increment: operationWeight(toolType) },
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { totalOperationsCount: { increment: 1 } },
    }),
    prisma.operationLog.create({
      data: {
        userId,
        organizationId: countOrg.id,
        toolType,
        fileCount,
        totalFileSizeMB,
        isBatch: fileCount > 1,
        status: "SUCCESS",
        processingTimeMs: processingTimeMs ?? null,
      },
    }),
  ]);
}

/**
 * Kota kontrolü ve artırımını tek bir atomik transaction içinde yapar.
 * Eş zamanlı isteklerin kota sınırını aşmasını engeller (race condition fix).
 */
export async function checkAndIncrementQuota(
  userId: string,
  toolType: string,
  fileCount: number,
  totalSizeMB: number,
  processingTimeMs?: number,
): Promise<QuotaCheckResult> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user) return { allowed: false, reason: "user_not_found" };

    if (user.role === "ADMIN") {
      // Yönetici kotadan muaftır AMA işlemi yine de kaydederiz: aksi hâlde
      // yöneticinin kendi hesabıyla yaptığı denemeler hiçbir yerde görünmüyor,
      // yönetim panelindeki "araç kullanımı" ekranı boş kalıyordu.
      if (user.organizationId) {
        await tx.operationLog.create({
          data: {
            userId,
            organizationId: user.organizationId,
            toolType,
            fileCount,
            totalFileSizeMB: totalSizeMB,
            isBatch: fileCount > 1,
            status: "SUCCESS",
            processingTimeMs: processingTimeMs ?? null,
          },
        });
      }
      return { allowed: true, reason: "admin_bypass", fileSizeLimitMB: 999999, watermarkEnabled: false, batchLimit: 999, dailyUsed: 0, dailyLimit: null, monthlyUsed: 0, monthlyLimit: null };
    }

    // Aktif Business ekibinin üyesi: sınırlar ve sayaç ekip sahibinin HAVUZUNDADIR (Business sınırları
    // geçerli; ekip aboneliği bitmişse üye kendi planına döner). Yalnızca ekip sahibinin org kaydı
    // bulunamayan nadir durumda eski davranış (izin) korunur.
    const poolOrg = await teamPoolOrg(tx, user);
    if (user.isTeamMember && user.teamOwnerId && !poolOrg) {
      const t = await tx.team.findUnique({ where: { ownerId: user.teamOwnerId } });
      if (t?.subscriptionStatus === "ACTIVE") return { allowed: true, reason: "team_member_business" };
    }

    let org = poolOrg ?? user.organization;
    if (!org) return { allowed: false, reason: "no_organization" };

    const timezone = user.timezone || "Europe/Istanbul";
    if (isNewDayInTimezone(org.lastDailyReset, timezone)) {
      org = await tx.organization.update({ where: { id: org.id }, data: { currentDayOperations: 0, bonusDailyOperations: 0, lastDailyReset: new Date() } });
    }
    if (isNewMonthInTimezone(org.lastMonthlyReset, timezone)) {
      org = await tx.organization.update({ where: { id: org.id }, data: { currentMonthOperations: 0, lastMonthlyReset: new Date() } });
    }

    const savedLimits = await getSavedLimits();
    const lim = effectiveOrgLimits(
      org,
      poolOrg || org.plan === "BUSINESS" ? await extraSeatsForOrg(tx, org.id) : 0,
      poolOrg !== null,
      savedLimits,
    );

    if (totalSizeMB > lim.fileSizeLimitMB) return { allowed: false, reason: "file_size_exceeded" };

    if (fileCount > 1) {
      if (lim.batchLimit === 0) return { allowed: false, reason: "batch_not_allowed_on_plan" };
      if (fileCount > lim.batchLimit) return { allowed: false, reason: "batch_limit_exceeded" };
    }

    const effDailyLimit = effectiveDailyLimit(org, savedLimits);
    if (effDailyLimit !== null) {
      if (org.currentDayOperations >= effDailyLimit) {
        const resetAt = getNextMidnightInTimezone(timezone);
        return { allowed: false, reason: "daily_limit_reached", resetAt, dailyUsed: org.currentDayOperations, dailyLimit: effDailyLimit };
      }
    }

    if (lim.monthly < 999999) {
      if (org.currentMonthOperations >= lim.monthly) {
        return { allowed: false, reason: "monthly_limit_reached", monthlyUsed: org.currentMonthOperations, monthlyLimit: lim.monthly };
      }
    }

    // Kota uygun — aynı transaction içinde atomik artır
    await tx.organization.update({
      where: { id: org.id },
      data: { currentDayOperations: { increment: operationWeight(toolType) }, currentMonthOperations: { increment: operationWeight(toolType) } },
    });
    await tx.user.update({ where: { id: userId }, data: { totalOperationsCount: { increment: 1 } } });
    await tx.operationLog.create({
      data: { userId, organizationId: org.id, toolType, fileCount, totalFileSizeMB: totalSizeMB, isBatch: fileCount > 1, status: "SUCCESS", processingTimeMs: processingTimeMs ?? null },
    });

    return {
      allowed: true,
      dailyUsed: org.currentDayOperations + operationWeight(toolType),
      dailyLimit: effDailyLimit,
      monthlyUsed: org.currentMonthOperations + operationWeight(toolType),
      monthlyLimit: lim.monthly,
      watermarkEnabled: false, // Politika: filigran tamamen kaldırıldı (tüm planlar)
      fileSizeLimitMB: lim.fileSizeLimitMB,
    };
  });
}

/**
 * Admin: kullanıcıya YALNIZCA BUGÜN için ekstra işlem hakkı ekler.
 * Gün döndüyse önce sıfırlar (eklenen bonusun sonradan reset ile silinmemesi için),
 * sonra bonusu artırır. Gece limit sıfırlanınca bonus da sıfırlanır.
 */
export async function grantBonusOpsToday(userId: string, amount: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });
  if (!user) throw new Error("user not found");
  let org = user.organization;
  if (!org) {
    org = await createOrganizationForUser(userId, user.name ?? user.email, "FREE");
  }
  const timezone = user.timezone || "Europe/Istanbul";
  org = await resetDailyIfNeeded(org, timezone);
  org = await resetMonthlyIfNeeded(org, timezone);

  const bonusBefore = org.bonusDailyOperations ?? 0;
  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: { bonusDailyOperations: { increment: amount } },
  });
  return {
    bonusBefore,
    bonusAfter: updated.bonusDailyOperations,
    usedToday: updated.currentDayOperations,
    effectiveDailyLimit: effectiveDailyLimit(updated, await getSavedLimits()),
  };
}

/**
 * Admin: kullanıcıya özel KALICI günlük limit atar (plan limitini ezer) ya da
 * `null` ile kaldırır (plan limitine döner).
 */
export async function setCustomDailyLimit(userId: string, limit: number | null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });
  if (!user) throw new Error("user not found");
  let org = user.organization;
  if (!org) {
    org = await createOrganizationForUser(userId, user.name ?? user.email, "FREE");
  }
  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: { customDailyLimit: limit },
  });
  return {
    customDailyLimit: updated.customDailyLimit,
    planDailyLimit: updated.dailyOperationLimit,
    effectiveDailyLimit: effectiveDailyLimit(updated, await getSavedLimits()),
    usedToday: updated.currentDayOperations,
  };
}

export async function getQuotaSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });

  if (!user || !user.organization) return null;

  const timezone = user.timezone || "Europe/Istanbul";

  // Günlük/aylık sayaçları okumadan ÖNCE gün/ay sınırı geçtiyse sıfırla.
  // Aksi halde yeni günde ilk girişte navbar dünkü (bayat) sayacı gösterir;
  // sayaç ancak bir işlem (check/consume) DB'yi sıfırladıktan sonra düzelir.
  let org = await resetDailyIfNeeded(user.organization, timezone);
  org = await resetMonthlyIfNeeded(org, timezone);
  // Süreli (geçici) plan bittiyse base plana dön — cron gecikse bile navbar/limitler doğru.
  org = await revertExpiredOverride(org);
  const resetAt = getNextMidnightInTimezone(timezone);

  // Admin → tüm sınırlar kaldırılmış
  if (user.role === "ADMIN") {
    return {
      plan: "BUSINESS" as const,
      daily: { used: 0, limit: null, resetAt },
      monthly: { used: 0, limit: null },
      watermarkEnabled: false,
      batchLimit: 999,
      fileSizeLimitMB: 999999,
      isAdmin: true,
      overrideExpiresAt: null,
      basePlan: null,
    };
  }

  // Aktif Business ekibinin üyesi: ekip sahibinin HAVUZU gösterilir (sayaç ve sınırlar ortak).
  const poolOrg = await teamPoolOrg(prisma, user);
  if (poolOrg) {
    let pool = await resetDailyIfNeeded(poolOrg, timezone);
    pool = await resetMonthlyIfNeeded(pool, timezone);
    const poolLim = effectiveOrgLimits(pool, await extraSeatsForOrg(prisma, pool.id), true, await getSavedLimits());
    return {
      plan: "BUSINESS" as const,
      daily: { used: pool.currentDayOperations, limit: null, resetAt },
      monthly: { used: pool.currentMonthOperations, limit: poolLim.monthly },
      watermarkEnabled: false,
      batchLimit: poolLim.batchLimit,
      fileSizeLimitMB: poolLim.fileSizeLimitMB,
      isAdmin: false,
      overrideExpiresAt: null,
      basePlan: null,
    };
  }

  const savedLimits = await getSavedLimits();
  const lim = effectiveOrgLimits(org, org.plan === "BUSINESS" ? await extraSeatsForOrg(prisma, org.id) : 0, false, savedLimits);

  return {
    plan: org.plan,
    daily: {
      used: org.currentDayOperations,
      limit: effectiveDailyLimit(org, savedLimits),
      resetAt,
    },
    monthly: {
      used: org.currentMonthOperations,
      limit: lim.monthly < 999999 ? lim.monthly : null,
    },
    watermarkEnabled: false, // Politika: filigran tamamen kaldırıldı (tüm planlar)
    batchLimit: lim.batchLimit,
    fileSizeLimitMB: lim.fileSizeLimitMB,
    isAdmin: false,
    // Süreli (geçici) plan aktifse: ne zaman bitip hangi plana döneceği.
    overrideExpiresAt: org.overrideExpiresAt?.toISOString() ?? null,
    basePlan: org.basePlan ?? null,
  };
}
