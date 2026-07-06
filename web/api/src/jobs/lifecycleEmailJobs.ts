import cron from "node-cron";
import type { EmailCampaign } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logError } from "../lib/app-logger.js";
import { logger } from "../lib/file-log.js";
import { readEmailAutomationConfig } from "../modules/marketing/email-automation.js";
import { seedDefaultCampaigns, sendCampaignToUser } from "../modules/email/emailCampaign.service.js";
import { logAutomationEmailAudit } from "../modules/admin/admin-audit.service.js";

/**
 * Admin-yönetimli pazarlama e-postaları (EmailCampaign tablosundan).
 * Her kampanya, kayıttan `triggerDays` gün sonra — plan hâlâ FREE + pazarlama izni
 * VAR + çıkmamışsa — bir kez gönderilir. Mükerrer gönderim AdminAuditLog ile engellenir.
 */

function safeRun(name: string, fn: () => Promise<void>) {
  fn().catch((err) => {
    logError({
      category: "unhandled",
      message: `[cron/${name}] ${err instanceof Error ? err.message : String(err)}`,
      status: 500,
      method: "CRON",
      path: `/${name}`,
    });
  });
}

/** Bugünden `dayOffset` gün önceki takvim gününün [00:00, 23:59:59] penceresi. */
function dayWindow(dayOffset: number): { start: Date; end: Date } {
  const start = new Date();
  start.setDate(start.getDate() - dayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function alreadySent(userId: string, campaignId: string): Promise<boolean> {
  const existing = await prisma.adminAuditLog.findFirst({
    where: { action: `email.campaign.${campaignId}`, targetKey: userId },
    select: { id: true },
  });
  return existing != null;
}

async function runCampaign(c: EmailCampaign): Promise<void> {
  const { start, end } = dayWindow(c.triggerDays);
  const users = await prisma.user.findMany({
    where: {
      plan: "FREE",
      role: "USER",
      isVerified: true,
      createdAt: { gte: start, lte: end },
      teamMembership: { is: null },
      // HUKUKİ: yalnız pazarlama izni VEREN ve çıkmayan kullanıcılara (opt-in).
      marketingConsent: true,
      marketingUnsubscribedAt: null,
    },
    select: { id: true, email: true, firstName: true, lastName: true, name: true, preferredLanguage: true },
  });

  let sent = 0;
  for (const u of users) {
    if (!u.email) continue;
    if (await alreadySent(u.id, c.id)) continue;
    try {
      await sendCampaignToUser(c, u);
      await logAutomationEmailAudit(`email.campaign.${c.id}`, u.id, `Campaign "${c.name}" → ${u.email}`, {
        campaignId: c.id,
      });
      sent += 1;
      await new Promise((r) => setTimeout(r, 400)); // SMTP'yi boğmamak için
    } catch (err) {
      logger.error("lifecycle", `campaign ${c.id} email failed (non-fatal)`, { detail: String(err) });
    }
  }
  if (sent > 0) logger.info("lifecycle", `campaign "${c.name}" sent: ${sent}`);
}

async function runLifecycleDrip(): Promise<void> {
  const cfg = await readEmailAutomationConfig();
  if (!cfg.lifecycleEnabled) return;
  await seedDefaultCampaigns();
  const campaigns = await prisma.emailCampaign.findMany({ where: { enabled: true } });
  for (const c of campaigns) await runCampaign(c);
}

export function registerLifecycleEmailJobs() {
  // Başlangıçta varsayılan kampanyaları oluştur (admin panelde hemen görünsün).
  seedDefaultCampaigns().catch(() => {});
  // Her gün 10:00 — dönüşmeyen FREE kullanıcı drip serisi
  cron.schedule("0 10 * * *", () => {
    safeRun("runLifecycleDrip", runLifecycleDrip);
  });
}
