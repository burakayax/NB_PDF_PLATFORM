import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import {
  sendTeamInviteEmail,
  sendInviteReminderEmail,
  sendUsageLimitWarningEmail,
  sendSubscriptionExpiryWarningEmail,
  sendWeeklyTeamSummaryEmail,
} from "../email/teamEmails.js";

const MONTHLY_OP_LIMIT = 1000;

export async function createTeamForOwner(ownerId: string, ownerName: string) {
  const existing = await prisma.team.findUnique({ where: { ownerId } });
  if (existing) return existing;

  return prisma.team.create({
    data: {
      name: `${ownerName} Ekibi`,
      ownerId,
      maxSeats: 5,
      extraSeats: 0,
      subscriptionStatus: "ACTIVE",
    },
  });
}

export async function inviteTeamMember(
  teamId: string,
  inviteEmail: string,
  patronName: string,
  teamName: string,
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: { where: { inviteStatus: { not: "REVOKED" } } },
    },
  });
  if (!team) throw new HttpError(404, "Ekip bulunamadı.");

  const totalSeats = team.maxSeats + team.extraSeats;
  const activeCount = team.members.length;
  if (activeCount >= totalSeats) {
    throw new HttpError(402, "SEAT_LIMIT_REACHED");
  }

  const existing = team.members.find(
    (m) => m.inviteEmail.toLowerCase() === inviteEmail.toLowerCase(),
  );
  if (existing) throw new HttpError(409, "ALREADY_INVITED");

  const token = crypto.randomBytes(32).toString("hex");
  const member = await prisma.teamMember.create({
    data: {
      teamId,
      inviteEmail,
      inviteToken: token,
      inviteStatus: "PENDING",
    },
  });

  const inviteUrl = `${process.env["FRONTEND_ORIGIN"] ?? "https://nbpdf.com"}/team-invite?token=${token}`;
  await sendTeamInviteEmail({ patronName, teamName, inviteUrl, recipientEmail: inviteEmail });

  return member;
}

export async function acceptTeamInvite(token: string, userId: string) {
  const member = await prisma.teamMember.findUnique({
    where: { inviteToken: token },
    include: { team: true },
  });
  if (!member) throw new HttpError(404, "INVITE_NOT_FOUND");
  if (member.inviteStatus !== "PENDING") throw new HttpError(400, "INVITE_ALREADY_USED");
  if (member.team.subscriptionStatus !== "ACTIVE") throw new HttpError(403, "TEAM_SUBSCRIPTION_EXPIRED");

  const updated = await prisma.teamMember.update({
    where: { id: member.id },
    data: {
      userId,
      inviteStatus: "ACCEPTED",
      joinedAt: new Date(),
      inviteToken: null,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      isTeamMember: true,
      teamOwnerId: member.team.ownerId,
      plan: "BUSINESS",
      isVerified: true,
      teamMemberRole: "MEMBER",
    },
  });

  return updated;
}

export async function revokeTeamMember(teamId: string, memberId: string, ownerId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.ownerId !== ownerId) throw new HttpError(403, "UNAUTHORIZED");

  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
  });
  if (!member) throw new HttpError(404, "Üye bulunamadı.");

  await prisma.teamMember.update({
    where: { id: memberId },
    data: { inviteStatus: "REVOKED", revokedAt: new Date() },
  });

  // Üyenin kişisel planı FREE'ye düşürülür ve ekip bağlantısı kesilir.
  // Ancak ekibin ödenen koltuk kapasitesi (extraSeats) DEĞİŞMEZ —
  // o koltuk boşalır ve sahibi başka birini davet edebilir.
  if (member.userId) {
    await prisma.user.update({
      where: { id: member.userId },
      data: { isTeamMember: false, teamOwnerId: null, plan: "FREE", teamMemberRole: null },
    });
  }
}

export async function getTeamDashboard(teamId: string, ownerId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              updatedAt: true,
              lastLoginAt: true,
            },
          },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  if (!team) throw new HttpError(404, "Ekip bulunamadı.");
  if (team.ownerId !== ownerId) throw new HttpError(403, "UNAUTHORIZED");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const enrichedMembers = await Promise.all(
    team.members.map(async (m) => {
      const allActivities = await prisma.teamMemberActivity.findMany({
        where: { memberId: m.id },
      });
      const thisMonth = allActivities.filter((a) => a.createdAt >= monthStart);

      const toolCounts: Record<string, { name: string; count: number }> = {};
      for (const a of allActivities) {
        if (!toolCounts[a.toolId]) toolCounts[a.toolId] = { name: a.toolName, count: 0 };
        toolCounts[a.toolId]!.count += 1;
      }
      const toolBreakdown = Object.entries(toolCounts)
        .map(([toolId, { name, count }]) => ({ toolId, toolName: name, count }))
        .sort((a, b) => b.count - a.count);
      const mostUsedTool = toolBreakdown[0]?.toolName ?? null;

      const totalPages = allActivities.reduce((s, a) => s + (a.pageCount ?? 0), 0);
      const totalFileSizeGB =
        Math.round(
          (allActivities.reduce((s, a) => s + (a.fileSizeMB ?? 0), 0) / 1024) * 100,
        ) / 100;
      const lastActivity = allActivities[0]?.createdAt ?? null;

      return {
        ...m,
        stats: {
          totalOps: allActivities.length,
          thisMonthOps: thisMonth.length,
          mostUsedTool,
          totalPagesProcessed: totalPages,
          totalFileSizeGB,
          lastActivity,
          toolBreakdown,
        },
      };
    }),
  );

  const acceptedMembers = enrichedMembers.filter((m) => m.inviteStatus === "ACCEPTED");
  const summary = {
    activeMembers: acceptedMembers.length,
    totalSeats: team.maxSeats + team.extraSeats,
    totalOpsThisMonth: acceptedMembers.reduce((s, m) => s + m.stats.thisMonthOps, 0),
    totalPagesAllTime: acceptedMembers.reduce((s, m) => s + m.stats.totalPagesProcessed, 0),
    totalFileSizeGB:
      Math.round(
        acceptedMembers.reduce((s, m) => s + m.stats.totalFileSizeGB, 0) * 100,
      ) / 100,
  };

  return { ...team, members: enrichedMembers, summary };
}

export async function logMemberActivity(
  userId: string,
  toolId: string,
  toolName: string,
  pageCount: number | null,
  fileSizeMB: number | null,
  durationMs: number | null,
  status: "SUCCESS" | "FAILED",
  ipAddress: string | null,
  compressionResult?: {
    originalSizeMB: number;
    compressedSizeMB: number;
    compressionRatio: number;
  },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isTeamMember) return;

  const member = await prisma.teamMember.findFirst({
    where: { userId, inviteStatus: "ACCEPTED" },
  });
  if (!member) return;

  await prisma.teamMemberActivity.create({
    data: {
      memberId: member.id,
      toolId,
      toolName,
      pageCount,
      fileSizeMB,
      durationMs,
      status,
      ipAddress,
      ...(compressionResult
        ? {
            originalSizeMB: compressionResult.originalSizeMB,
            compressedSizeMB: compressionResult.compressedSizeMB,
            compressionRatio: compressionResult.compressionRatio,
          }
        : {}),
    },
  });
}

export async function setMemberRole(
  teamId: string,
  memberId: string,
  ownerId: string,
  role: "MEMBER" | "MANAGER",
) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.ownerId !== ownerId) throw new HttpError(403, "UNAUTHORIZED");

  const member = await prisma.teamMember.findFirst({ where: { id: memberId, teamId } });
  if (!member) throw new HttpError(404, "Üye bulunamadı.");

  await prisma.teamMember.update({ where: { id: memberId }, data: { role } });

  if (member.userId) {
    await prisma.user.update({ where: { id: member.userId }, data: { teamMemberRole: role } });
  }

  return { ok: true, role };
}

export async function expireTeamSubscription(ownerId: string) {
  await prisma.team.updateMany({
    where: { ownerId },
    data: { subscriptionStatus: "EXPIRED" },
  });
}

export async function checkUsageAndNotify() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const teams = await prisma.team.findMany({
    where: { subscriptionStatus: "ACTIVE" },
    include: {
      owner: { select: { email: true, firstName: true, lastName: true } },
      members: {
        where: { inviteStatus: "ACCEPTED" },
        include: { activities: { where: { createdAt: { gte: monthStart } } } },
      },
    },
  });

  for (const team of teams) {
    const usedOps = team.members.reduce((s, m) => s + m.activities.length, 0);
    const usageRatio = usedOps / MONTHLY_OP_LIMIT;
    if (usageRatio >= 0.8 && usageRatio < 1.0) {
      const patronName = [team.owner.firstName, team.owner.lastName].filter(Boolean).join(" ") || team.owner.email;
      await sendUsageLimitWarningEmail({
        patronEmail: team.owner.email,
        patronName,
        teamName: team.name,
        usedOps,
        totalOps: MONTHLY_OP_LIMIT,
        usagePercent: Math.round(usageRatio * 100),
      });
    }
  }
}

export async function sendInviteReminders() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pending = await prisma.teamMember.findMany({
    where: {
      inviteStatus: "PENDING",
      invitedAt: { lt: cutoff },
      inviteToken: { not: null },
    },
    include: {
      team: {
        include: { owner: { select: { firstName: true, lastName: true, email: true } } },
      },
    },
  });

  for (const m of pending) {
    const patronName =
      [m.team.owner.firstName, m.team.owner.lastName].filter(Boolean).join(" ") ||
      m.team.owner.email;
    const inviteUrl = `${process.env["FRONTEND_ORIGIN"] ?? "https://nbpdf.com"}/team-invite?token=${m.inviteToken}`;
    await sendInviteReminderEmail({
      recipientEmail: m.inviteEmail,
      patronName,
      teamName: m.team.name,
      inviteUrl,
    });
  }
}

export async function sendExpiryWarnings() {
  const windows = [7, 1];

  for (const days of windows) {
    const now = new Date();
    const targetStart = new Date(now);
    targetStart.setDate(now.getDate() + days);
    targetStart.setHours(0, 0, 0, 0);
    const targetEnd = new Date(targetStart);
    targetEnd.setHours(23, 59, 59, 999);

    const teams = await prisma.team.findMany({
      where: {
        subscriptionStatus: "ACTIVE",
        subscriptionEndsAt: { gte: targetStart, lte: targetEnd },
      },
      include: {
        owner: { select: { email: true, firstName: true, lastName: true } },
        members: { where: { inviteStatus: "ACCEPTED" } },
      },
    });

    for (const team of teams) {
      if (!team.subscriptionEndsAt) continue;
      const patronName =
        [team.owner.firstName, team.owner.lastName].filter(Boolean).join(" ") ||
        team.owner.email;
      await sendSubscriptionExpiryWarningEmail({
        patronEmail: team.owner.email,
        patronName,
        teamName: team.name,
        expiresAt: team.subscriptionEndsAt,
        daysRemaining: days,
        activeMemberCount: team.members.length,
      });
    }
  }
}

export async function sendWeeklySummaries() {
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const teams = await prisma.team.findMany({
    where: { subscriptionStatus: "ACTIVE" },
    include: {
      owner: { select: { email: true, firstName: true, lastName: true } },
      members: {
        where: { inviteStatus: "ACCEPTED" },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          activities: { where: { createdAt: { gte: weekStart } } },
        },
      },
    },
  });

  for (const team of teams) {
    const memberBreakdown = team.members.map((m) => {
      const name =
        m.user
          ? [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || m.user.email
          : m.inviteEmail;
      return {
        name,
        operationCount: m.activities.length,
        pageCount: m.activities.reduce((s, a) => s + (a.pageCount ?? 0), 0),
      };
    });

    const totalOps = memberBreakdown.reduce((s, mb) => s + mb.operationCount, 0);
    if (totalOps === 0) continue;

    const totalPages = memberBreakdown.reduce((s, mb) => s + mb.pageCount, 0);

    const toolCounts: Record<string, number> = {};
    for (const m of team.members) {
      for (const a of m.activities) {
        toolCounts[a.toolName] = (toolCounts[a.toolName] ?? 0) + 1;
      }
    }
    const mostUsedTool = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const mostActiveMember =
      memberBreakdown.sort((a, b) => b.operationCount - a.operationCount)[0] ?? null;

    const patronName =
      [team.owner.firstName, team.owner.lastName].filter(Boolean).join(" ") ||
      team.owner.email;

    const now = new Date();
    await sendWeeklyTeamSummaryEmail({
      patronEmail: team.owner.email,
      patronName,
      teamName: team.name,
      weekStart,
      weekEnd: now,
      totalOps,
      totalPages,
      mostUsedTool,
      mostActiveMember: mostActiveMember ?? undefined,
      memberBreakdown,
    });
  }
}
