import { prisma } from "../../lib/prisma.js";
import { sendMassCampaignEmail } from "../../lib/email-service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";
import { displayNameForEmail, readEmailAutomationConfig, type EmailAutomationConfig } from "../marketing/email-automation.js";
import { auditedPatchSetting, logAdminAudit, type AdminActor } from "./admin-audit.service.js";

export async function getMarketingAdminPayload(): Promise<{ automation: EmailAutomationConfig }> {
  return { automation: await readEmailAutomationConfig() };
}

export async function putMarketingAutomation(cfg: EmailAutomationConfig, actor: AdminActor) {
  await auditedPatchSetting(
    SITE_SETTING_KEYS.EMAIL_AUTOMATION,
    cfg,
    actor,
    "email.automation.update",
    "Email automation config updated",
    { lowCreditEnabled: cfg.lowCreditEnabled, welcomeEnabled: cfg.welcomeEnabled },
  );
}

export async function broadcastCampaignToAllUsers(
  subject: string,
  htmlBody: string,
  batchSize: number,
  actor: AdminActor,
) {
  const batch = Math.min(80, Math.max(5, Math.floor(batchSize) || 40));
  let offset = 0;
  let sent = 0;
  const failed: string[] = [];
  const sampleEmails: string[] = [];

  while (true) {
    const rows = await prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      select: { email: true, firstName: true, lastName: true, name: true },
      take: batch,
      skip: offset,
      orderBy: { createdAt: "asc" },
    });
    if (rows.length === 0) {
      break;
    }
    for (const u of rows) {
      try {
        const name = displayNameForEmail(u);
        await sendMassCampaignEmail(
          u.email,
          subject,
          htmlBody,
          { name, credits: 0, email: u.email },
        );
        sent++;
        if (sampleEmails.length < 20) {
          sampleEmails.push(u.email);
        }
      } catch {
        failed.push(u.email);
      }
    }
    offset += batch;
    await new Promise((r) => setTimeout(r, 1200));
  }

  await logAdminAudit(actor, "email.broadcast", "all_users", `Manual campaign: ${subject.slice(0, 160)} — sent ${sent}`, {
    sent,
    failedCount: failed.length,
    sampleEmails,
  });

  return { sent, failedCount: failed.length, failedSample: failed.slice(0, 40) };
}
