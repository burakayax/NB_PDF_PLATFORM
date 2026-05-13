import type { Organization, User } from "@prisma/client";
import { prisma } from "./prisma.js";
import { createOrganizationForUser } from "../modules/organization/organization.service.js";

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  resetAt?: Date;
  dailyUsed?: number;
  dailyLimit?: number | null;
  monthlyUsed?: number;
  monthlyLimit?: number;
  watermarkEnabled?: boolean;
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
      data: { currentDayOperations: 0, lastDailyReset: new Date() },
    });
  }
  return org;
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

  // Platform ADMIN bypasses all quotas
  if (user.role === "ADMIN") {
    return { allowed: true, reason: "admin_bypass" };
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

  // Check daily limit
  if (currentOrg.dailyOperationLimit !== null && currentOrg.dailyOperationLimit !== undefined) {
    if (currentOrg.currentDayOperations >= currentOrg.dailyOperationLimit) {
      const resetAt = getNextMidnightInTimezone(timezone);
      return {
        allowed: false,
        reason: "daily_limit_reached",
        resetAt,
        dailyUsed: currentOrg.currentDayOperations,
        dailyLimit: currentOrg.dailyOperationLimit,
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
    dailyLimit: currentOrg.dailyOperationLimit,
    monthlyUsed: currentOrg.currentMonthOperations,
    monthlyLimit: currentOrg.monthlyOperationLimit,
    watermarkEnabled: currentOrg.watermarkEnabled,
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

export async function getQuotaSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });

  if (!user || !user.organization) return null;

  const org = user.organization;
  const timezone = user.timezone || "Europe/Istanbul";
  const resetAt = getNextMidnightInTimezone(timezone);

  return {
    plan: org.plan,
    daily: {
      used: org.currentDayOperations,
      limit: org.dailyOperationLimit,
      resetAt,
    },
    monthly: {
      used: org.currentMonthOperations,
      limit: org.monthlyOperationLimit < 999999 ? org.monthlyOperationLimit : null,
    },
    watermarkEnabled: org.watermarkEnabled,
    batchLimit: org.batchLimit,
    fileSizeLimitMB: org.fileSizeLimitMB,
    isAdmin: user.role === "ADMIN",
  };
}
