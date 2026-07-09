import type { Organization, User } from "@prisma/client";
import { prisma } from "./prisma.js";
import { createOrganizationForUser, revertExpiredOverride } from "../modules/organization/organization.service.js";

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
    "customDailyLimit" | "dailyOperationLimit" | "bonusDailyOperations"
  >,
): number | null {
  const base = org.customDailyLimit ?? org.dailyOperationLimit;
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

  // Team member with active patron subscription gets business-level access
  if (user.isTeamMember && user.teamOwnerId) {
    const team = await prisma.team.findUnique({ where: { ownerId: user.teamOwnerId } });
    if (team?.subscriptionStatus === "ACTIVE") {
      return { allowed: true, reason: "team_member_business" };
    }
    // Patron expired — fall through to free-tier quota check below
  }

  let org = user.organization;
  if (!org) {
    org = await createOrganizationForUser(userId, user.name ?? user.email, "FREE");
  }

  const timezone = user.timezone || "Europe/Istanbul";

  let currentOrg = await resetDailyIfNeeded(org, timezone);
  currentOrg = await resetMonthlyIfNeeded(currentOrg, timezone);

  // Check allowed tools
  if (currentOrg.plan !== "BUSINESS" && currentOrg.plan !== "PLUS" && currentOrg.plan !== "PRO") {
    const planConfig = await prisma.planConfig.findUnique({
      where: { plan: currentOrg.plan },
    });
    if (planConfig && planConfig.allowedTools !== "all") {
      const allowed = planConfig.allowedTools.split(",").map((t) => t.trim());
      if (!allowed.includes(toolType)) {
        return {
          allowed: false,
          reason: "tool_not_allowed_on_plan",
        };
      }
    }
  }

  // Check file size
  if (totalSizeMB > currentOrg.fileSizeLimitMB) {
    return {
      allowed: false,
      reason: "file_size_exceeded",
    };
  }

  // Check batch
  if (fileCount > 1) {
    if (currentOrg.batchLimit === 0) {
      return {
        allowed: false,
        reason: "batch_not_allowed_on_plan",
      };
    }
    if (fileCount > currentOrg.batchLimit) {
      return {
        allowed: false,
        reason: "batch_limit_exceeded",
      };
    }
  }

  // Check daily limit (kullanıcıya özel limit + bugünlük bonus dahil)
  const effDailyLimit = effectiveDailyLimit(currentOrg);
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

  // Check monthly limit (unlimited = 999999)
  if (currentOrg.monthlyOperationLimit < 999999) {
    if (currentOrg.currentMonthOperations >= currentOrg.monthlyOperationLimit) {
      return {
        allowed: false,
        reason: "monthly_limit_reached",
        monthlyUsed: currentOrg.currentMonthOperations,
        monthlyLimit: currentOrg.monthlyOperationLimit,
      };
    }
  }

  return {
    allowed: true,
    dailyUsed: currentOrg.currentDayOperations,
    dailyLimit: effDailyLimit,
    monthlyUsed: currentOrg.currentMonthOperations,
    monthlyLimit: currentOrg.monthlyOperationLimit,
    watermarkEnabled: currentOrg.watermarkEnabled,
    fileSizeLimitMB: currentOrg.fileSizeLimitMB,
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

  if (!user || !user.organization || user.role === "ADMIN") return;

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: user.organization.id },
      data: {
        currentDayOperations: { increment: 1 },
        currentMonthOperations: { increment: 1 },
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { totalOperationsCount: { increment: 1 } },
    }),
    prisma.operationLog.create({
      data: {
        userId,
        organizationId: user.organization.id,
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
      return { allowed: true, reason: "admin_bypass", fileSizeLimitMB: 999999, watermarkEnabled: false, batchLimit: 999, dailyUsed: 0, dailyLimit: null, monthlyUsed: 0, monthlyLimit: null };
    }

    if (user.isTeamMember && user.teamOwnerId) {
      const team = await tx.team.findUnique({ where: { ownerId: user.teamOwnerId } });
      if (team?.subscriptionStatus === "ACTIVE") return { allowed: true, reason: "team_member_business" };
    }

    let org = user.organization;
    if (!org) return { allowed: false, reason: "no_organization" };

    const timezone = user.timezone || "Europe/Istanbul";
    if (isNewDayInTimezone(org.lastDailyReset, timezone)) {
      org = await tx.organization.update({ where: { id: org.id }, data: { currentDayOperations: 0, bonusDailyOperations: 0, lastDailyReset: new Date() } });
    }
    if (isNewMonthInTimezone(org.lastMonthlyReset, timezone)) {
      org = await tx.organization.update({ where: { id: org.id }, data: { currentMonthOperations: 0, lastMonthlyReset: new Date() } });
    }

    if (totalSizeMB > org.fileSizeLimitMB) return { allowed: false, reason: "file_size_exceeded" };

    if (fileCount > 1) {
      if (org.batchLimit === 0) return { allowed: false, reason: "batch_not_allowed_on_plan" };
      if (fileCount > org.batchLimit) return { allowed: false, reason: "batch_limit_exceeded" };
    }

    const effDailyLimit = effectiveDailyLimit(org);
    if (effDailyLimit !== null) {
      if (org.currentDayOperations >= effDailyLimit) {
        const resetAt = getNextMidnightInTimezone(timezone);
        return { allowed: false, reason: "daily_limit_reached", resetAt, dailyUsed: org.currentDayOperations, dailyLimit: effDailyLimit };
      }
    }

    if (org.monthlyOperationLimit < 999999) {
      if (org.currentMonthOperations >= org.monthlyOperationLimit) {
        return { allowed: false, reason: "monthly_limit_reached", monthlyUsed: org.currentMonthOperations, monthlyLimit: org.monthlyOperationLimit };
      }
    }

    // Kota uygun — aynı transaction içinde atomik artır
    await tx.organization.update({
      where: { id: org.id },
      data: { currentDayOperations: { increment: 1 }, currentMonthOperations: { increment: 1 } },
    });
    await tx.user.update({ where: { id: userId }, data: { totalOperationsCount: { increment: 1 } } });
    await tx.operationLog.create({
      data: { userId, organizationId: org.id, toolType, fileCount, totalFileSizeMB: totalSizeMB, isBatch: fileCount > 1, status: "SUCCESS", processingTimeMs: processingTimeMs ?? null },
    });

    return {
      allowed: true,
      dailyUsed: org.currentDayOperations + 1,
      dailyLimit: effDailyLimit,
      monthlyUsed: org.currentMonthOperations + 1,
      monthlyLimit: org.monthlyOperationLimit,
      watermarkEnabled: org.watermarkEnabled,
      fileSizeLimitMB: org.fileSizeLimitMB,
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
    effectiveDailyLimit: effectiveDailyLimit(updated),
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
    effectiveDailyLimit: effectiveDailyLimit(updated),
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
    };
  }

  // Team member with active patron → Business-level unlimited display
  if (user.isTeamMember && user.teamOwnerId) {
    const team = await prisma.team.findUnique({ where: { ownerId: user.teamOwnerId } });
    if (team?.subscriptionStatus === "ACTIVE") {
      return {
        plan: "BUSINESS" as const,
        daily: { used: org.currentDayOperations, limit: 999999, resetAt },
        monthly: { used: org.currentMonthOperations, limit: null },
        watermarkEnabled: false,
        batchLimit: 100,
        fileSizeLimitMB: 500,
        isAdmin: false,
      };
    }
  }

  return {
    plan: org.plan,
    daily: {
      used: org.currentDayOperations,
      limit: effectiveDailyLimit(org),
      resetAt,
    },
    monthly: {
      used: org.currentMonthOperations,
      limit: org.monthlyOperationLimit < 999999 ? org.monthlyOperationLimit : null,
    },
    watermarkEnabled: org.watermarkEnabled,
    batchLimit: org.batchLimit,
    fileSizeLimitMB: org.fileSizeLimitMB,
    isAdmin: false,
  };
}
