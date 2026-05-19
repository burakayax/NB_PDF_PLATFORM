import type { Plan, Prisma, UserRole } from "@prisma/client";
import { listBlockedEmails, removeBlockedEmail, upsertBlockedEmail } from "../../lib/blocked-email.js";
import { env } from "../../config/env.js";
import { normalizeEmailForStorage } from "../../lib/email-identity-normalize.js";
import { HttpError } from "../../lib/http-error.js";
import { hashPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import { getResolvedPackagesConfig } from "../../lib/packages-config.service.js";
import { getSetting, setSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";
import type { AdminActor } from "./admin-audit.service.js";
import { auditedPackagesPartial, auditedPatchSetting, logAdminAudit } from "./admin-audit.service.js";
import { isAdminEmail, resolveRoleFromEmail } from "../../lib/role-policy.js";
import { getPaymentPricesTry } from "../payment/payment-pricing.js";
import { featureCatalog } from "../subscription/subscription.config.js";
import { getPlanDefinitionsResolved, invalidatePlanRuntimeCache } from "../subscription/plan-runtime.js";
import { updatePlanConfigAndPropagate } from "../organization/organization.service.js";

function todayKeyUtc() {
  return new Date().toISOString().slice(0, 10);
}

function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/** `usageDate` alanı YYYY-MM-DD dizgesi; aralık için kullanılır. */
function usageDateKeySubtractDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export type AdminOverview = {
  generatedAt: string;
  usageDateUtc: string;
  totalUsers: number;
  activeUsersToday: number;
  todayTotalOperations: number;
  freeUsers: number;
  paidUsers: number;
  usersByPlan: Record<string, number>;
  mostUsedTOOLS: Array<{
    featureKey: string;
    userDayRows: number;
    operationsAttributed: number;
  }>;
  usagePerPackage: Array<{ plan: string; userCount: number }>;
  anonymousSessionsToday: number;
  registeredSessionsToday: number;
  anonymousPageViewsToday: number;
  checkoutsCompleted: number;
  checkoutsPending: number;
  usageByDay: Array<{ date: string; totalOperations: number }>;
  pageViewsByDay: Array<{ date: string; count: number }>;
  pageViewsTodayByHourUtc: Array<{ hour: number; count: number }>;
  conversionFunnel: {
    freeTierEverHitLimit: number;
    usersWithCompletedCheckout: number;
    totalUsers: number;
  };
  /** Son N dakikada en az bir sayfa görüntülemesi olan benzersiz tarayıcı oturumu. */
  presenceWindowMinutes: number;
  distinctSessionsActiveNow: number;
  /** Son N dakikada sayfa görüntüleyen farklı kayıtlı kullanıcı (userId dolu). */
  registeredUsersActiveNow: number;
  /** Son N dakikada sayfa görüntüleyen anonim oturum sayısı (sessionId, userId yok). */
  anonymousSessionsActiveNow: number;
  /** Araç sıralaması son 30 günde veri yoksa tüm zamanlara düşüldü. */
  mostUsedTOOLSAllTimeFallback: boolean;
  /** Geo fields on `User` (optional; filled over time for CRM / analytics). */
  geo: {
    usersWithCountry: number;
    usersWithCity: number;
    topCountries: Array<{ country: string; count: number }>;
    topCities: Array<{ city: string; country: string | null; count: number }>;
  };
  /** Daily new user registrations — last 30 days. */
  registrationsByDay: Array<{ date: string; count: number }>;
  /** Completed subscription checkouts by plan and day — last 30 days. */
  subscriptionSalesByDay: Array<{ date: string; plan: string; count: number }>;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const today = todayKeyUtc();
  const dayStart = startOfTodayUtc();
  const presenceWindowMinutes = 5;
  const activePresenceSince = new Date(Date.now() - presenceWindowMinutes * 60 * 1000);
  const TOOLStatsSince = usageDateKeySubtractDays(30);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [
    totalUsers,
    activeUsersToday,
    planGroups,
    todayAgg,
    anonSessions,
    regSessions,
    anonPv,
    checkoutDone,
    checkoutPending,
    usageByDayRows,
    pageViewsRecent,
    pvsToday,
    freeTierEverHitLimit,
    checkoutUsersDistinct,
    pvsLastPresenceWindow,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.dailyUsage.count({
      where: { usageDate: today, operationsCount: { gt: 0 } },
    }),
    prisma.user.groupBy({
      by: ["plan"],
      _count: { _all: true },
    }),
    prisma.dailyUsage.aggregate({
      where: { usageDate: today },
      _sum: { operationsCount: true },
    }),
    prisma.pageView.groupBy({
      by: ["sessionId"],
      where: { userId: null, createdAt: { gte: dayStart } },
    }),
    prisma.pageView.groupBy({
      by: ["sessionId"],
      where: { userId: { not: null }, createdAt: { gte: dayStart } },
    }),
    prisma.pageView.count({
      where: { userId: null, createdAt: { gte: dayStart } },
    }),
    prisma.paymentCheckout.count({ where: { status: "completed" } }),
    prisma.paymentCheckout.count({ where: { status: "pending" } }),
    prisma.dailyUsage.groupBy({
      by: ["usageDate"],
      _sum: { operationsCount: true },
      orderBy: { usageDate: "desc" },
      take: 30,
    }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: dayStart } },
      select: { createdAt: true },
    }),
    prisma.user.count({ where: { freeLimitFirstExceededAt: { not: null } } }),
    prisma.paymentCheckout.findMany({
      where: { status: "completed" },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: activePresenceSince } },
      select: { userId: true, sessionId: true },
    }),
  ]);

  const registeredUsersActiveNow = new Set(
    pvsLastPresenceWindow.map((p) => p.userId).filter((id): id is string => id != null && id.length > 0),
  ).size;
  const distinctSessionsActiveNow = new Set(pvsLastPresenceWindow.map((p) => p.sessionId)).size;
  const anonymousSessionsActiveNow = new Set(
    pvsLastPresenceWindow.filter((p) => p.userId == null).map((p) => p.sessionId),
  ).size;

  const toolGroups30d = await prisma.dailyUsage.groupBy({
    by: ["lastFeatureKey"],
    where: {
      lastFeatureKey: { not: null },
      usageDate: { gte: TOOLStatsSince },
    },
    _count: { _all: true },
    _sum: { operationsCount: true },
  });
  const mostUsedTOOLSAllTimeFallback = toolGroups30d.length === 0;
  const toolGroups = mostUsedTOOLSAllTimeFallback
    ? await prisma.dailyUsage.groupBy({
        by: ["lastFeatureKey"],
        where: { lastFeatureKey: { not: null } },
        _count: { _all: true },
        _sum: { operationsCount: true },
      })
    : toolGroups30d;

  const usersByPlan: Record<string, number> = { FREE: 0, PLUS: 0, PRO: 0, BUSINESS: 0 };
  for (const row of planGroups) {
    usersByPlan[row.plan] = row._count._all;
  }

  const paidUsers = (usersByPlan.PLUS ?? 0) + (usersByPlan.PRO ?? 0) + (usersByPlan.BUSINESS ?? 0);
  const freeUsers = usersByPlan.FREE ?? 0;

  const mostUsedTOOLS = toolGroups
    .map((row) => ({
      featureKey: row.lastFeatureKey as string,
      userDayRows: row._count._all,
      operationsAttributed: row._sum.operationsCount ?? 0,
    }))
    .sort((a, b) => b.operationsAttributed - a.operationsAttributed)
    .slice(0, 15);

  const usageByDay = [...usageByDayRows]
    .reverse()
    .map((r) => ({
      date: r.usageDate,
      totalOperations: r._sum.operationsCount ?? 0,
    }));

  const pvByDayMap = new Map<string, number>();
  for (const p of pageViewsRecent) {
    const k = p.createdAt.toISOString().slice(0, 10);
    pvByDayMap.set(k, (pvByDayMap.get(k) ?? 0) + 1);
  }
  const pageViewsByDay = [...pvByDayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  const hourCounts = new Array(24).fill(0) as number[];
  for (const p of pvsToday) {
    hourCounts[p.createdAt.getUTCHours()] += 1;
  }
  const pageViewsTodayByHourUtc = hourCounts.map((count, hour) => ({ hour, count }));

  const [usersWithCountry, usersWithCity, countryGroupRows, cityGroupRows, recentRegistrations, recentCheckouts] = await Promise.all([
    prisma.user.count({
      where: { AND: [{ country: { not: null } }, { country: { not: "" } }] },
    }),
    prisma.user.count({
      where: { AND: [{ city: { not: null } }, { city: { not: "" } }] },
    }),
    prisma.user.groupBy({
      by: ["country"],
      where: { AND: [{ country: { not: null } }, { country: { not: "" } }] },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { AND: [{ city: { not: null } }, { city: { not: "" } }] },
      select: { city: true, country: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.paymentCheckout.findMany({
      where: { status: "completed", createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, plan: true },
    }),
  ]);
  const topCountries = countryGroupRows
    .filter((r) => r.country != null && r.country.length > 0)
    .map((r) => ({ country: r.country as string, count: r._count?._all ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const cityCountMap = new Map<string, { city: string; country: string | null; count: number }>();
  for (const r of cityGroupRows) {
    if (!r.city) continue;
    const key = `${r.city}|${r.country ?? ""}`;
    const existing = cityCountMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      cityCountMap.set(key, { city: r.city, country: r.country ?? null, count: 1 });
    }
  }
  const topCities = [...cityCountMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  const regByDayMap = new Map<string, number>();
  for (const u of recentRegistrations) {
    const k = u.createdAt.toISOString().slice(0, 10);
    regByDayMap.set(k, (regByDayMap.get(k) ?? 0) + 1);
  }
  const registrationsByDay = [...regByDayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  const salesByDayPlanMap = new Map<string, number>();
  for (const c of recentCheckouts) {
    const k = `${c.createdAt.toISOString().slice(0, 10)}|${c.plan ?? "UNKNOWN"}`;
    salesByDayPlanMap.set(k, (salesByDayPlanMap.get(k) ?? 0) + 1);
  }
  const subscriptionSalesByDay = [...salesByDayPlanMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => {
      const [date, plan] = key.split("|");
      return { date: date!, plan: plan!, count };
    });

  return {
    generatedAt: new Date().toISOString(),
    usageDateUtc: today,
    totalUsers,
    activeUsersToday,
    todayTotalOperations: todayAgg._sum.operationsCount ?? 0,
    freeUsers,
    paidUsers,
    usersByPlan: usersByPlan as Record<string, number>,
    mostUsedTOOLS,
    usagePerPackage: [
      { plan: "FREE", userCount: usersByPlan["FREE"] ?? 0 },
      { plan: "PLUS", userCount: usersByPlan["PLUS"] ?? 0 },
      { plan: "PRO", userCount: usersByPlan["PRO"] ?? 0 },
      { plan: "BUSINESS", userCount: usersByPlan["BUSINESS"] ?? 0 },
    ],
    anonymousSessionsToday: anonSessions.length,
    registeredSessionsToday: regSessions.length,
    anonymousPageViewsToday: anonPv,
    checkoutsCompleted: checkoutDone,
    checkoutsPending: checkoutPending,
    usageByDay,
    pageViewsByDay,
    pageViewsTodayByHourUtc,
    conversionFunnel: {
      freeTierEverHitLimit,
      usersWithCompletedCheckout: checkoutUsersDistinct.length,
      totalUsers,
    },
    presenceWindowMinutes,
    distinctSessionsActiveNow,
    registeredUsersActiveNow,
    anonymousSessionsActiveNow,
    mostUsedTOOLSAllTimeFallback,
    geo: {
      usersWithCountry,
      usersWithCity,
      topCountries,
      topCities,
    },
    registrationsByDay,
    subscriptionSalesByDay,
  };
}

export async function listUsersForAdmin(params: {
  q?: string;
  page: number;
  pageSize: number;
  sort: "createdAt" | "email" | "plan";
  dir: "asc" | "desc";
  plan?: "FREE" | "PRO" | "BUSINESS" | "all";
  verified?: "all" | "yes" | "no";
}) {
  const { q, page, pageSize, sort, dir, plan: planFilter, verified: verifiedFilter } = params;
  const skip = (page - 1) * pageSize;

  const parts: Prisma.UserWhereInput[] = [];
  // Never show ADMIN accounts in the user list (prevent accidental deletion)
  parts.push({ role: { not: "ADMIN" } });
  if (q?.trim()) {
    parts.push({
      OR: [
        { email: { contains: q.trim() } },
        { firstName: { contains: q.trim() } },
        { lastName: { contains: q.trim() } },
        { name: { contains: q.trim() } },
      ],
    });
  }
  if (planFilter && planFilter !== "all") {
    parts.push({ plan: planFilter });
  }
  if (verifiedFilter === "yes") {
    parts.push({ isVerified: true });
  } else if (verifiedFilter === "no") {
    parts.push({ isVerified: false });
  }
  const where: Prisma.UserWhereInput = { AND: parts };

  const orderBy: Prisma.UserOrderByWithRelationInput =
    sort === "email"
      ? { email: dir }
      : sort === "plan"
        ? { plan: dir }
        : { createdAt: dir };

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        plan: true,
        role: true,
        isVerified: true,
        authProvider: true,
        preferredLanguage: true,
        createdAt: true,
        freeLimitFirstExceededAt: true,
        country: true,
        city: true,
        isTeamMember: true,
        teamOwnerId: true,
        _count: { select: { dailyUsages: true } },
      },
    }),
  ]);

  const usageToday = todayKeyUtc();
  const userIds = rows.map((r) => r.id);
  const todayRows =
    userIds.length === 0
      ? []
      : await prisma.dailyUsage.findMany({
          where: { usageDate: usageToday, userId: { in: userIds } },
          select: { userId: true, operationsCount: true, postLimitExtraOps: true, lastFeatureKey: true },
        });
  const todayByUser = new Map(todayRows.map((r) => [r.userId, r]));

  const items = rows.map((u) => {
    const d = todayByUser.get(u.id);
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      name: u.name,
      plan: u.plan,
      role: u.role,
      isVerified: u.isVerified,
      authProvider: u.authProvider,
      preferredLanguage: u.preferredLanguage,
      createdAt: u.createdAt.toISOString(),
      freeLimitFirstExceededAt: u.freeLimitFirstExceededAt?.toISOString() ?? null,
      country: u.country,
      city: u.city,
      isTeamMember: u.isTeamMember,
      teamOwnerId: u.teamOwnerId,
      _count: u._count,
      usageToday: d
        ? {
            operationsCount: d.operationsCount,
            postLimitExtraOps: d.postLimitExtraOps,
            lastFeatureKey: d.lastFeatureKey,
          }
        : null,
    };
  });

  return { total, page, pageSize, items };
}

export async function updateUserForAdmin(
  userId: string,
  data: {
    firstName?: string | null;
    lastName?: string | null;
    plan?: Plan;
    role?: UserRole;
    isVerified?: boolean;
    subscriptionExpiry?: string | null;
  },
  actor: AdminActor,
) {
  if (userId === actor.userId && data.role === "USER") {
    throw new HttpError(400, "You cannot remove your own admin role from this panel.");
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new HttpError(404, "User not found.");
  }

  const displayName =
    data.firstName !== undefined || data.lastName !== undefined
      ? `${(data.firstName ?? existing.firstName ?? "").trim()} ${(data.lastName ?? existing.lastName ?? "").trim()}`.trim() ||
        null
      : existing.name;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.plan !== undefined ? { plan: data.plan } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.isVerified !== undefined ? { isVerified: data.isVerified } : {}),
      ...(data.firstName !== undefined || data.lastName !== undefined ? { name: displayName } : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      plan: true,
      role: true,
      isVerified: true,
    },
  });
  await logAdminAudit(actor, "user.update", userId, `Kullanıcı güncellendi: ${existing.email}`, {
    fields: Object.keys(data),
  });
  return updated;
}

export async function createUserForAdmin(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  plan: Plan;
  skipEmailVerification: boolean;
}) {
  let email: string;
  try {
    email = normalizeEmailForStorage(input.email);
  } catch {
    throw new HttpError(400, "Invalid email address.");
  }

  if (await prisma.blockedEmail.findUnique({ where: { email } })) {
    throw new HttpError(403, "This email address is blocked from registration.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(input.password);
  const displayName = `${input.firstName} ${input.lastName}`.trim() || null;

  const user = await prisma.user.create({
    data: {
      email,
      firstName: input.firstName || null,
      lastName: input.lastName || null,
      name: displayName,
      passwordHash,
      authProvider: "local",
      role: resolveRoleFromEmail(email),
      isVerified: input.skipEmailVerification,
      verifiedAt: input.skipEmailVerification ? new Date() : null,
      plan: input.plan,
      preferredLanguage: "en",
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      plan: true,
      role: true,
      isVerified: true,
    },
  });

  return user;
}

export async function deleteUserForAdmin(userId: string, actor: AdminActor, blockEmail: boolean) {
  if (userId === actor.userId) {
    throw new HttpError(400, "You cannot delete your own account from the admin panel.");
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    throw new HttpError(404, "User not found.");
  }

  if (isAdminEmail(target.email)) {
    throw new HttpError(400, "Policy administrator accounts cannot be deleted from this panel.");
  }

  if (blockEmail) {
    await upsertBlockedEmail(target.email, "admin_delete_user");
  }

  await prisma.user.delete({ where: { id: userId } });
  await logAdminAudit(actor, "user.delete", userId, `Kullanıcı silindi: ${target.email}`, { blockEmail });
}

export async function adminListBlockedEmails() {
  const rows = await listBlockedEmails();
  return rows.map((r) => ({
    email: r.email,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function adminAddBlockedEmailRaw(email: string, reason?: string | null) {
  let normalized: string;
  try {
    normalized = normalizeEmailForStorage(email);
  } catch {
    throw new HttpError(400, "Invalid email address.");
  }
  await upsertBlockedEmail(normalized, reason ?? null);
}

export async function adminRemoveBlockedEmailRaw(email: string) {
  let normalized: string;
  try {
    normalized = normalizeEmailForStorage(email);
  } catch {
    throw new HttpError(400, "Invalid email address.");
  }
  const ok = await removeBlockedEmail(normalized);
  if (!ok) {
    throw new HttpError(404, "Email is not on the block list.");
  }
}

export async function adminPutPaymentPrices(prices: Record<"PRO" | "BUSINESS", string>, actor: AdminActor) {
  try {
    await auditedPackagesPartial(
      { prices: { PRO: prices.PRO, BUSINESS: prices.BUSINESS } },
      actor,
      "plans.pricing",
      "Ödeme fiyatları güncellendi",
    );
  } catch {
    throw new HttpError(400, "Invalid price values. Use positive numbers (e.g. 199.99).");
  }
}

export async function getAllSiteSettings(): Promise<Record<string, unknown>> {
  const rows = await prisma.siteSetting.findMany();
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value) as unknown;
    } catch {
      out[r.key] = r.value;
    }
  }
  return out;
}

/** Strips deprecated `maintenanceMode` from `global.flags` in admin GET responses — maintenance is env-only. */
export function sanitizeGlobalFlagsForAdminResponse(settings: Record<string, unknown>): void {
  const raw = settings[SITE_SETTING_KEYS.GLOBAL_FLAGS];
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    const { maintenanceMode: _omit, ...rest } = raw as Record<string, unknown>;
    settings[SITE_SETTING_KEYS.GLOBAL_FLAGS] = rest;
  }
}

export async function patchSiteSettings(patches: Record<string, unknown>, actor: AdminActor) {
  for (const [key, value] of Object.entries(patches)) {
    let next = value;
    if (
      key === SITE_SETTING_KEYS.GLOBAL_FLAGS &&
      value != null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const { maintenanceMode: _omit, ...rest } = value as Record<string, unknown>;
      next = rest;
    }
    await auditedPatchSetting(key, next, actor, "settings.patch", `Güncellendi: ${key}`);
  }
}

export async function putPlansOverride(override: unknown, actor: AdminActor) {
  await auditedPackagesPartial({ plansOverride: override }, actor, "plans.override", "Plan override kaydedildi");

  // Propagate dailyLimit changes to PlanConfig + all Organization records
  const PLANS: Plan[] = ["FREE", "PLUS", "PRO", "BUSINESS"];
  if (override && typeof override === "object" && !Array.isArray(override)) {
    const ov = override as Record<string, unknown>;
    for (const plan of PLANS) {
      const patch = ov[plan];
      if (!patch || typeof patch !== "object") continue;
      const p = patch as Record<string, unknown>;
      if ("dailyLimit" in p) {
        const dl = p.dailyLimit === null ? null : typeof p.dailyLimit === "number" ? p.dailyLimit : undefined;
        if (dl !== undefined) {
          await updatePlanConfigAndPropagate(plan, { dailyOperationLimit: dl });
        }
      }
    }
  }
}

const DEFAULT_CMS = {
  homepage: {
    heroTitle: "",
    heroSubtitle: "",
    primaryCta: "",
    secondaryCta: "",
  },
  TOOLSStrip: { headline: "" },
  banner: { text: "", enabled: false },
  modals: { upgradeTeaser: "" },
  /** Shallow merge into `landingTranslations` per language (navbar, hero, footer, finalCta). */
  landing: {
    en: {} as Record<string, unknown>,
    tr: {} as Record<string, unknown>,
  },
  workspace: { bannerEnabled: false, bannerText: "" },
  assets: { heroImageUrl: "", logoUrl: "", screenshot1Url: "", screenshot2Url: "" },
};

function mergeCmsDefaults(parsed: Record<string, unknown>): Record<string, unknown> {
  const landingRaw = (parsed.landing as { en?: Record<string, unknown>; tr?: Record<string, unknown> }) ?? {};
  const defLand = DEFAULT_CMS.landing as { en: Record<string, unknown>; tr: Record<string, unknown> };
  const ws = typeof parsed.workspace === "object" && parsed.workspace !== null ? (parsed.workspace as Record<string, unknown>) : {};
  const ast = typeof parsed.assets === "object" && parsed.assets !== null ? (parsed.assets as Record<string, unknown>) : {};
  return {
    ...DEFAULT_CMS,
    ...parsed,
    landing: {
      en: { ...defLand.en, ...landingRaw.en },
      tr: { ...defLand.tr, ...landingRaw.tr },
    },
    workspace: { ...DEFAULT_CMS.workspace, ...ws },
    assets: { ...DEFAULT_CMS.assets, ...ast },
  };
}

export async function getCmsContent(): Promise<Record<string, unknown>> {
  const parsed = await getSetting(SITE_SETTING_KEYS.CMS_CONTENT);
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...DEFAULT_CMS };
  }
  try {
    return mergeCmsDefaults(parsed as Record<string, unknown>);
  } catch {
    return { ...DEFAULT_CMS };
  }
}

export async function putCmsContent(content: unknown, actor: AdminActor) {
  await auditedPatchSetting(SITE_SETTING_KEYS.CMS_CONTENT, content, actor, "cms.put", "CMS içeriği kaydedildi");
}

export async function getPlansAdminPayload() {
  const defs = await getPlanDefinitionsResolved();
  const plans = Object.values(defs).map((p) => ({
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    dailyLimit: p.dailyLimit,
    allowedFeatures: p.allowedFeatures,
    multiUser: p.multiUser,
  }));

  const pkg = await getResolvedPackagesConfig();
  const plansOverride = pkg.plansOverride;

  const byPlan = await prisma.paymentCheckout.groupBy({
    by: ["plan", "status"],
    _count: { _all: true },
  });

  const checkoutStats: Record<string, { completed: number; pending: number }> = {};
  for (const p of ["FREE", "PRO", "BUSINESS"] as const) {
    checkoutStats[p] = { completed: 0, pending: 0 };
  }
  for (const row of byPlan) {
    const key = row.plan;
    if (!checkoutStats[key]) {
      checkoutStats[key] = { completed: 0, pending: 0 };
    }
    if (row.status === "completed") {
      checkoutStats[key].completed += row._count._all;
    } else if (row.status === "pending") {
      checkoutStats[key].pending += row._count._all;
    }
  }

  const marketingParsed = pkg.marketing;

  const paymentPrices = await getPaymentPricesTry();

  return { plans, checkoutStats, marketing: marketingParsed, plansOverride, paymentPrices };
}

export async function putPackagesMarketing(marketing: unknown, actor: AdminActor) {
  await auditedPackagesPartial({ marketing }, actor, "packages.marketing", "Paket pazarlama metni güncellendi");
}

export async function getTOOLSAdminPayload() {
  const defs = await getPlanDefinitionsResolved();
  const overrides = await getSetting(SITE_SETTING_KEYS.TOOLS_CONFIG);

  const perTool = await prisma.dailyUsage.groupBy({
    by: ["lastFeatureKey"],
    where: { lastFeatureKey: { not: null } },
    _count: { _all: true },
    _sum: { operationsCount: true },
  });

  const usageByTool = Object.fromEntries(
    featureCatalog.map((fk) => {
      const hit = perTool.find((p) => p.lastFeatureKey === fk);
      return [fk, { rows: hit?._count._all ?? 0, operations: hit?._sum.operationsCount ?? 0 }];
    }),
  );

  return {
    catalog: featureCatalog,
    planDefinitions: Object.values(defs).map((p) => ({
      plan: p.name,
      dailyLimit: p.dailyLimit,
      allowedFeatures: p.allowedFeatures,
    })),
    overrides,
    usageByTool,
    postLimitNote:
      "Monetization lives in SiteSetting `TOOLS.config`: `postLimitThrottle` (delaysEnabled, freeOpsBeforeThrottle, delayCapMs, delayFloorMs, delayTiers, featureWeights, fileTiers), `conversion` (upgradeCtaLabel, upgradeCtaSubtitle), and `conversionMessaging` (strong message thresholds). The Araçlar tab exposes these in the Monetization section.",
  };
}

export async function putTOOLSConfig(config: unknown, actor: AdminActor) {
  await auditedPatchSetting(SITE_SETTING_KEYS.TOOLS_CONFIG, config, actor, "TOOLS.config", "Araç yapılandırması kaydedildi");
}

export async function getUsageSeries(days: number) {
  const rows = await prisma.dailyUsage.groupBy({
    by: ["usageDate"],
    _sum: { operationsCount: true },
    orderBy: { usageDate: "desc" },
    take: days,
  });
  return [...rows].reverse().map((r) => ({
    date: r.usageDate,
    totalOperations: r._sum.operationsCount ?? 0,
  }));
}

export async function buildUsageExportCsv(from: string, to: string): Promise<string> {
  const rows = await prisma.dailyUsage.findMany({
    where: {
      usageDate: { gte: from, lte: to },
    },
    include: {
      user: { select: { email: true } },
    },
    orderBy: [{ usageDate: "asc" }, { userId: "asc" }],
  });

  const header = ["usageDate", "userId", "email", "operationsCount", "postLimitExtraOps", "postLimitThrottleCount", "lastFeatureKey"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const cells = [
      r.usageDate,
      r.userId,
      r.user.email,
      String(r.operationsCount),
      String(r.postLimitExtraOps),
      String(r.postLimitThrottleCount),
      r.lastFeatureKey ?? "",
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

const APP_SETTINGS_SINGLETON_ID = 1;

export async function listToolRegistryForAdmin() {
  const rows = await prisma.toolRegistry.findMany({ orderBy: { id: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    toolId: r.id,
    strategy: r.strategy,
    creditCost: 0,
    cost: 0,
    isVisible: r.isVisible,
    isMaintenanceMode: r.isMaintenanceMode,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function updateToolRegistryForAdmin(
  id: string,
  data: { cost?: number; isVisible?: boolean; isMaintenanceMode?: boolean },
  actor: AdminActor,
) {
  const row = await prisma.toolRegistry.findUnique({ where: { id } });
  if (!row) {
    throw new HttpError(404, "Tool not found.");
  }
  const next = await prisma.toolRegistry.update({
    where: { id },
    data: {
      ...(data.isVisible !== undefined ? { isVisible: data.isVisible } : {}),
      ...(data.isMaintenanceMode !== undefined ? { isMaintenanceMode: data.isMaintenanceMode } : {}),
    },
  });
  await logAdminAudit(actor, "tool_registry.update", id, `Tool ${id} configuration updated.`, { ...data });
  return {
    id: next.id,
    toolId: next.id,
    strategy: next.strategy,
    creditCost: 0,
    isVisible: next.isVisible,
    isMaintenanceMode: next.isMaintenanceMode,
    updatedAt: next.updatedAt.toISOString(),
  };
}

export async function getAppSettingsForAdmin() {
  const row = await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_SINGLETON_ID },
    create: { id: APP_SETTINGS_SINGLETON_ID },
    update: {},
  });
  return {
    id: row.id,
    siteName: row.siteName,
    logoUrl: row.logoUrl,
    globalMaintenanceMode: env.maintenanceModeEnabled,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    seoKeywords: row.seoKeywords,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updateAppSettingsForAdmin(
  data: {
    siteName?: string;
    logoUrl?: string | null;
    /** @deprecated Ignored — set `MAINTENANCE_MODE` on the API host and redeploy. */
    globalMaintenanceMode?: boolean;
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoKeywords?: string | null;
  },
  actor: AdminActor,
) {
  const next = await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_SINGLETON_ID },
    create: {
      id: APP_SETTINGS_SINGLETON_ID,
      ...(data.siteName !== undefined ? { siteName: data.siteName } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      ...(data.seoTitle !== undefined ? { seoTitle: data.seoTitle } : {}),
      ...(data.seoDescription !== undefined ? { seoDescription: data.seoDescription } : {}),
      ...(data.seoKeywords !== undefined ? { seoKeywords: data.seoKeywords } : {}),
    },
    update: {
      ...(data.siteName !== undefined ? { siteName: data.siteName } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      ...(data.seoTitle !== undefined ? { seoTitle: data.seoTitle } : {}),
      ...(data.seoDescription !== undefined ? { seoDescription: data.seoDescription } : {}),
      ...(data.seoKeywords !== undefined ? { seoKeywords: data.seoKeywords } : {}),
    },
  });
  await logAdminAudit(actor, "app_settings.update", "app_settings", "AppSettings singleton updated.", {
    fields: Object.keys(data),
  });
  return {
    id: next.id,
    siteName: next.siteName,
    logoUrl: next.logoUrl,
    globalMaintenanceMode: env.maintenanceModeEnabled,
    seoTitle: next.seoTitle,
    seoDescription: next.seoDescription,
    seoKeywords: next.seoKeywords,
    updatedAt: next.updatedAt.toISOString(),
  };
}

/** @deprecated use getAdminOverview */
export async function getAdminDashboardStats() {
  return getAdminOverview();
}
