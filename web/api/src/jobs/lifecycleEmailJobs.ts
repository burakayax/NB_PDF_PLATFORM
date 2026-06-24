import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { logError } from "../lib/app-logger.js";
import { logger } from "../lib/file-log.js";
import { sendLifecycleEmail, type LifecycleStage } from "../lib/email-service.js";
import { displayNameForEmail, readEmailAutomationConfig } from "../modules/marketing/email-automation.js";

/**
 * Dönüşmeyen FREE kullanıcılara zamanlı yaşam-döngüsü (drip) e-postaları.
 *
 * Davranış + zaman hibrit: kayıt tarihinden N gün sonra, plan hâlâ FREE ise
 * tek bir aşama e-postası gönderilir. Her aşama yalnızca o gün penceresindeki
 * kullanıcılara gider (mevcut kullanıcı tabanı toplu e-posta almaz) ve
 * AdminAuditLog üzerinden mükerrer gönderim engellenir.
 */
const STAGES: ReadonlyArray<{ stage: LifecycleStage; dayOffset: number }> = [
  { stage: "tips", dayOffset: 2 },
  { stage: "value", dayOffset: 6 },
  { stage: "winback", dayOffset: 13 },
];

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

async function alreadySent(userId: string, stage: LifecycleStage): Promise<boolean> {
  const existing = await prisma.adminAuditLog.findFirst({
    where: { action: `email.lifecycle.${stage}`, targetKey: userId },
    select: { id: true },
  });
  return existing != null;
}

async function runLifecycleStage(
  stage: LifecycleStage,
  dayOffset: number,
  ctaDefault: string,
  couponCode: string,
): Promise<void> {
  const { start, end } = dayWindow(dayOffset);
  const origin = env.FRONTEND_ORIGIN.replace(/\/$/, "");

  const users = await prisma.user.findMany({
    where: {
      plan: "FREE",
      role: "USER",
      isVerified: true,
      createdAt: { gte: start, lte: end },
      // Ücretli bir ekibin üyesi olanlar (erişimi org'dan gelir) dışarıda tutulur.
      teamMembership: { is: null },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      preferredLanguage: true,
    },
  });

  let sent = 0;
  for (const u of users) {
    if (!u.email) continue;
    if (await alreadySent(u.id, stage)) continue;

    const locale = u.preferredLanguage === "tr" ? "tr" : "en";
    const name = displayNameForEmail(u);
    const ctaUrl = ctaDefault || `${origin}/workspace`;

    try {
      await sendLifecycleEmail(u.email, {
        name,
        userId: u.id,
        stage,
        ctaUrl,
        couponCode: stage === "winback" && couponCode ? couponCode : undefined,
        locale,
      });
      sent += 1;
      // SMTP'yi boğmamak için küçük aralık
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      logger.error("lifecycle", `lifecycle ${stage} email failed (non-fatal)`, { detail: String(err) });
    }
  }

  if (sent > 0) {
    logger.info("lifecycle", `lifecycle ${stage} emails sent: ${sent}`);
  }
}

async function runLifecycleDrip(): Promise<void> {
  const cfg = await readEmailAutomationConfig();
  if (!cfg.lifecycleEnabled) {
    return;
  }
  const origin = env.FRONTEND_ORIGIN.replace(/\/$/, "");
  // tips → çalışma alanı; value/winback → fiyatlandırma (admin override edilebilir).
  const pricingCta = cfg.upgradeCtaUrl || `${origin}/#pricing`;
  for (const { stage, dayOffset } of STAGES) {
    const cta = stage === "tips" ? `${origin}/workspace` : pricingCta;
    await runLifecycleStage(stage, dayOffset, cta, cfg.winbackCouponCode);
  }
}

export function registerLifecycleEmailJobs() {
  // Her gün 10:00 — dönüşmeyen FREE kullanıcı drip serisi
  cron.schedule("0 10 * * *", () => {
    safeRun("runLifecycleDrip", runLifecycleDrip);
  });
}
