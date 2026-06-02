import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { logError } from "../lib/app-logger.js";
import { logger } from "../lib/file-log.js";
import { sendMail } from "../lib/mailer.js";
import { createRenewalReminderEmailTemplate } from "../modules/subscription/subscription.email.js";

/** Yenileme tarihinden kaç gün önce hatırlatma gönderilsin. */
const RENEWAL_REMINDER_DAYS = 3;

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

/**
 * Yenileme hatırlatması — abonelik bitişine RENEWAL_REMINDER_DAYS gün kala
 * bireysel (organizasyon sahibi) kullanıcılara e-posta gönderir.
 *
 * Aynı gün içinde mükerrer gönderimi önlemek için, yalnızca tam olarak
 * hedef gündeki abonelikler seçilir (gün penceresi).
 */
async function sendRenewalReminders(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() + RENEWAL_REMINDER_DAYS);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setHours(23, 59, 59, 999);

  // Aktif, yenilenecek (canceled olmayan) abonelikler — bitişi hedef gün penceresinde
  const orgs = await prisma.organization.findMany({
    where: {
      subscriptionStatus: "active",
      subscriptionExpiry: { gte: windowStart, lte: windowEnd },
      plan: { not: "FREE" },
    },
    select: {
      id: true,
      plan: true,
      subscriptionExpiry: true,
      members: {
        where: { orgRole: "OWNER" },
        select: { email: true, preferredLanguage: true },
        take: 1,
      },
    },
  });

  let sent = 0;
  for (const org of orgs) {
    const owner = org.members[0];
    if (!owner?.email || !org.subscriptionExpiry) continue;

    const lang = owner.preferredLanguage === "tr" ? "tr" : "en";
    const renewalDate = new Date(org.subscriptionExpiry).toLocaleDateString(
      lang === "tr" ? "tr-TR" : "en-US",
      { dateStyle: "long" },
    );

    try {
      const tpl = createRenewalReminderEmailTemplate({ planName: org.plan, renewalDate, lang });
      await sendMail({ to: owner.email, ...tpl });
      sent += 1;
    } catch (err) {
      logger.error("subscription", "renewal reminder email failed (non-fatal)", { detail: String(err) });
    }
  }

  if (sent > 0) {
    logger.info("subscription", `renewal reminders sent: ${sent}`);
  }
}

export function registerSubscriptionJobs() {
  // Her gün 09:00 — yenileme hatırlatmaları
  cron.schedule("0 9 * * *", () => {
    safeRun("sendRenewalReminders", sendRenewalReminders);
  });
}
