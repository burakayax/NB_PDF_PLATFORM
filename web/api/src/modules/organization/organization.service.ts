import type { OrgRole, Plan } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import crypto from "crypto";
import { sendMail } from "../../lib/mailer.js";

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    crypto.randomBytes(3).toString("hex")
  );
}

export async function createOrganizationForUser(
  userId: string,
  orgName: string,
  plan: Plan = "FREE",
) {
  const slug = generateSlug(orgName);

  const planConfig = await prisma.planConfig.findUnique({ where: { plan } });
  const PLAN_DEFAULTS: Record<string, { dailyOperationLimit: number | null; monthlyOperationLimit: number; fileSizeLimitMB: number; batchLimit: number; watermarkEnabled: boolean; queuePriority: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST"; maxSeats: number }> = {
    FREE:     { dailyOperationLimit: 3,    monthlyOperationLimit: 30,     fileSizeLimitMB: 25,     batchLimit: 0,   watermarkEnabled: true,  queuePriority: "LOW",     maxSeats: 1 },
    STARTER:  { dailyOperationLimit: 25,   monthlyOperationLimit: 250,    fileSizeLimitMB: 100,    batchLimit: 2,   watermarkEnabled: true,  queuePriority: "LOW",     maxSeats: 1 },
    PLUS:     { dailyOperationLimit: null, monthlyOperationLimit: 600,    fileSizeLimitMB: 250,    batchLimit: 5,   watermarkEnabled: false, queuePriority: "MEDIUM",  maxSeats: 1 },
    PRO:      { dailyOperationLimit: null, monthlyOperationLimit: 1000,   fileSizeLimitMB: 500,    batchLimit: 25,  watermarkEnabled: false, queuePriority: "HIGH",    maxSeats: 1 },
    BUSINESS: { dailyOperationLimit: null, monthlyOperationLimit: 999999, fileSizeLimitMB: 999999, batchLimit: 999, watermarkEnabled: false, queuePriority: "HIGHEST", maxSeats: 999 },
  };
  const limits = planConfig ?? PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS["FREE"];

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug,
      plan,
      dailyOperationLimit: limits.dailyOperationLimit,
      monthlyOperationLimit: limits.monthlyOperationLimit,
      fileSizeLimitMB: limits.fileSizeLimitMB,
      batchLimit: limits.batchLimit,
      watermarkEnabled: limits.watermarkEnabled,
      queuePriority: limits.queuePriority,
      maxSeats: limits.maxSeats,
      members: { connect: { id: userId } },
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { organizationId: org.id, orgRole: "OWNER" },
  });

  return org;
}

export async function getOrganization(orgId: string) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      members: {
        select: {
          id: true,
          name: true,
          email: true,
          orgRole: true,
          createdAt: true,
          operationLogs: {
            where: {
              createdAt: { gte: new Date(new Date().setDate(1)) },
            },
            select: { id: true },
          },
        },
      },
    },
  });
}

export async function inviteMember(
  orgId: string,
  inviterName: string,
  email: string,
  role: OrgRole,
  frontendOrigin: string,
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { members: true },
  });
  if (!org) throw new Error("Organization not found");

  if (org.plan !== "BUSINESS") {
    throw new Error("Invitations are only available on the Business plan");
  }

  const activeMembers = org.members.length;
  if (activeMembers >= org.maxSeats) {
    throw new Error(`Seat limit reached (${org.maxSeats} seats)`);
  }

  // Expire any existing pending invite for this email
  await prisma.invitation.updateMany({
    where: { organizationId: orgId, email, acceptedAt: null },
    data: { expiresAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await prisma.invitation.create({
    data: { organizationId: orgId, email, role, token, expiresAt },
  });

  const acceptUrl = `${frontendOrigin}/invite/accept?token=${token}`;

  await sendMail({
    to: email,
    subject: `${inviterName} sizi ${org.name} ekibine davet etti`,
    html: `
      <p>Merhaba,</p>
      <p><strong>${inviterName}</strong> sizi <strong>${org.name}</strong> organizasyonuna ${role} olarak katılmaya davet etti.</p>
      <p><a href="${acceptUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Daveti Kabul Et</a></p>
      <p>Bu link 7 gün içinde geçerliliğini yitirecektir.</p>
    `,
    text: `${inviterName} sizi ${org.name} ekibine davet etti.\n\nDaveti kabul etmek için: ${acceptUrl}\n\nBu link 7 gün içinde geçerliliğini yitirecektir.`,
  });

  return invitation;
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: { include: { members: true } } },
  });

  if (!invitation) throw new Error("Invitation not found");
  if (invitation.acceptedAt) throw new Error("Invitation already accepted");
  if (invitation.expiresAt < new Date()) throw new Error("Invitation expired");

  const org = invitation.organization;

  if (org.members.length >= org.maxSeats) {
    throw new Error("Organization seat limit reached");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: org.id,
        orgRole: invitation.role,
        plan: org.plan,
      },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return org;
}

export async function removeMember(orgId: string, targetUserId: string, actorOrgRole: OrgRole) {
  if (actorOrgRole === "MEMBER") throw new Error("Forbidden");

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser || targetUser.organizationId !== orgId) {
    throw new Error("User not in this organization");
  }

  if (targetUser.orgRole === "OWNER") {
    throw new Error("Cannot remove organization owner");
  }

  // Create a personal org for the removed user
  await createOrganizationForUser(targetUserId, targetUser.name ?? targetUser.email, "FREE");
}

/** Update PlanConfig and propagate new limits to all orgs currently on that plan. */
export async function updatePlanConfigAndPropagate(
  plan: Plan,
  data: {
    dailyOperationLimit?: number | null;
    monthlyOperationLimit?: number;
    fileSizeLimitMB?: number;
    batchLimit?: number;
    watermarkEnabled?: boolean;
    queuePriority?: import("@prisma/client").QueuePriority;
    maxSeats?: number;
    monthlyPriceTry?: number;
    monthlyPriceUsd?: number;
    yearlyPriceTry?: number;
    yearlyPriceUsd?: number;
  },
): Promise<void> {
  await prisma.planConfig.upsert({
    where: { plan },
    create: {
      plan,
      dailyOperationLimit: data.dailyOperationLimit ?? null,
      monthlyOperationLimit: data.monthlyOperationLimit ?? 50,
      fileSizeLimitMB: data.fileSizeLimitMB ?? 20,
      batchLimit: data.batchLimit ?? 0,
      watermarkEnabled: data.watermarkEnabled ?? true,
      queuePriority: data.queuePriority ?? "LOW",
      maxSeats: data.maxSeats ?? 1,
      monthlyPriceTry: data.monthlyPriceTry ?? 0,
      monthlyPriceUsd: data.monthlyPriceUsd ?? 0,
      yearlyPriceTry: data.yearlyPriceTry ?? 0,
      yearlyPriceUsd: data.yearlyPriceUsd ?? 0,
    },
    update: {
      ...data,
    },
  });

  // Propagate limit changes to all organizations currently on this plan
  const orgsOnPlan = await prisma.organization.findMany({
    where: { plan },
    select: { id: true },
  });
  for (const org of orgsOnPlan) {
    await applyPlanLimitsToOrg(org.id, plan);
  }
}

export async function applyPlanLimitsToOrg(orgId: string, plan: Plan) {
  const planConfig = await prisma.planConfig.findUnique({ where: { plan } });
  if (!planConfig) throw new Error("Plan config not found");

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      plan,
      dailyOperationLimit: planConfig.dailyOperationLimit,
      monthlyOperationLimit: planConfig.monthlyOperationLimit,
      fileSizeLimitMB: planConfig.fileSizeLimitMB,
      batchLimit: planConfig.batchLimit,
      watermarkEnabled: planConfig.watermarkEnabled,
      queuePriority: planConfig.queuePriority,
      maxSeats: planConfig.maxSeats,
    },
  });

  // Sync plan to all members
  await prisma.user.updateMany({
    where: { organizationId: orgId },
    data: { plan },
  });
}
