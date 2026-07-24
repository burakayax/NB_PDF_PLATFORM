import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { logError } from "../lib/app-logger.js";
import { logger } from "../lib/file-log.js";
import { env } from "../config/env.js";
import { sendLimitReachedEmail } from "../lib/email-service.js";
import type { Locale } from "../lib/email-i18n.js";

/**
 * "Aylık limitine ulaştın" davranış-tetikli yükseltme e-postası.
 *
 * Web kullanımı Organization sayaçlarında tutulur (checkAndIncrementQuota →
 * currentMonthOperations, lazy reset lastMonthlyReset). FREE aylık limit = 30 (planConfig).
 * Bu ay hakkını bitiren (currentMonthOperations >= 30 VE lastMonthlyReset bu ay = sayaç
 * BU aya ait, bayat değil) FREE kullanicilara, uygulamada degilken bir kez upgrade
 * e-postasi gider.
 *
 * Uyum (HUKUKİ): diğer pazarlamayla aynı sıkı opt-in (marketingConsent + çıkmamış).
 * Dedup: takvim ayı başına bir kez (AdminAuditLog `email.limit_reached.{YYYY-MM}`).
 */

const FREE_MONTHLY_LIMIT = 30; // planConfig FREE.monthlyOpsLimit

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

async function runLimitReachedEmail(): Promise<void> {
  const now = new Date();
  // Sayaç "bu aya ait" mi? lastMonthlyReset ay başından yeni olmalı (bayat sayacı ele).
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const orgs = await prisma.organization.findMany({
    where: {
      plan: "FREE",
      currentMonthOperations: { gte: FREE_MONTHLY_LIMIT },
      lastMonthlyReset: { gte: startOfMonth },
    },
    select: {
      id: true,
      members: {
        where: {
          role: "USER",
          isVerified: true,
          marketingConsent: true, // sıkı opt-in
          marketingUnsubscribedAt: null,
          teamMembership: { is: null },
        },
        select: { id: true, email: true, firstName: true, name: true, preferredLanguage: true },
      },
    },
  });

  const origin = env.FRONTEND_ORIGIN.replace(/\/$/, "");
  let sent = 0;
  for (const org of orgs) {
    for (const u of org.members) {
      if (!u.email) continue;
      // Bu ay bir kez: aynı periodKey için gönderildiyse atla.
      const already = await prisma.adminAuditLog.findFirst({
        where: { action: `email.limit_reached.${periodKey}`, targetKey: u.id },
        select: { id: true },
      });
      if (already) continue;

      const locale: Locale = u.preferredLanguage === "tr" ? "tr" : "en";
      const name = (u.firstName || u.name || (locale === "tr" ? "Merhaba" : "there")).trim();
      const ctaUrl = `${origin}/workspace?upgrade=1`;
      try {
        await sendLimitReachedEmail(u.email, { name, userId: u.id, periodKey, ctaUrl, locale });
        sent += 1;
        await new Promise((r) => setTimeout(r, 400)); // SMTP'yi boğmamak için
      } catch (err) {
        logger.error("limit-reached", "email failed (non-fatal)", { detail: String(err) });
      }
    }
  }
  if (sent > 0) logger.info("limit-reached", `limit-reached emails sent: ${sent}`);
}

export function registerLimitReachedEmailJobs() {
  // Her gün 11:00 — bu ay ücretsiz hakkını bitiren FREE kullanıcılara (bir kez/ay).
  cron.schedule("0 11 * * *", () => {
    safeRun("runLimitReachedEmail", runLimitReachedEmail);
  });
}
