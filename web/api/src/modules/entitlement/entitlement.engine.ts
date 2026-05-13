import { prisma } from "../../lib/prisma.js";
import { checkQuota } from "../../lib/quota.js";
import type { QuotaCheckResult } from "../../lib/quota.js";

export async function canExecuteAsFree(
  userId: string,
  toolType: string,
  fileCount: number,
  totalSizeMB: number,
): Promise<QuotaCheckResult> {
  // Temporarily treat the user as if they have no team benefits
  return checkQuota(userId, toolType, fileCount, totalSizeMB);
}

export async function canExecute(
  userId: string,
  toolType: string,
  fileCount: number,
  totalSizeMB: number,
): Promise<QuotaCheckResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, reason: "user_not_found" };

  // 1. Admin bypass
  if (user.role === "ADMIN") {
    return { allowed: true, reason: "admin_bypass" };
  }

  // 2. Team member check
  if (user.isTeamMember && user.teamOwnerId) {
    const team = await prisma.team.findUnique({ where: { ownerId: user.teamOwnerId } });
    if (!team || team.subscriptionStatus !== "ACTIVE") {
      return canExecuteAsFree(userId, toolType, fileCount, totalSizeMB);
    }
    return { allowed: true, reason: "team_member_business" };
  }

  // 3. Fall through to plan-based quota check
  return checkQuota(userId, toolType, fileCount, totalSizeMB);
}
