import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { logError } from "../lib/app-logger.js";
import { logger } from "../lib/file-log.js";
import { env } from "../config/env.js";
import { sendCheckoutRecoveryEmail } from "../lib/email-service.js";
import type { Locale } from "../lib/email-i18n.js";

/**
 * Checkout recovery (terk edilen yükseltme geri kazanımı).
 *
 * `PaymentCheckout` iyzico ödeme formu başlatıldığında oluşur (status="pending" +
 * iyzicoTokenHash set → kullanıcı ödeme adımını GÖRDÜ). Ödeme tamamlanınca
 * "completed" olur; iyzico init başarısızsa "failed" olur. Dolayısıyla
 * **pending + tokenHash + completedAt=null + hâlâ FREE** = ödeme adımında yarıda
 * kalan yüksek-niyetli terk. Bu kişilere ~2 saat sonra tek "kaldığın yerden devam et"
 * e-postası gider.
 *
 * Uyum (HUKUKİ, sıfır risk): diğer pazarlama e-postalarıyla AYNI sıkı opt-in —
 * yalnız açıkça pazarlama izni VEREN (marketingConsent) ve çıkmayan kullanıcılara.
 * E-postada unsubscribe linki + List-Unsubscribe başlığı. Dedup: 7 günde bir (audit log).
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

const PLAN_LABELS: Record<string, { tr: string; en: string }> = {
  STARTER: { tr: "Başlangıç", en: "Starter" },
  PLUS: { tr: "Plus", en: "Plus" },
  PRO: { tr: "Pro", en: "Pro" },
  BUSINESS: { tr: "Business", en: "Business" },
};

async function runCheckoutRecovery(): Promise<void> {
  const now = Date.now();
  const notBefore = new Date(now - 24 * 60 * 60 * 1000); // en fazla 24 saat önce (bayat değil)
  const notAfter = new Date(now - 2 * 60 * 60 * 1000); // en az 2 saat önce (gerçekten terk)
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const rows = await prisma.paymentCheckout.findMany({
    where: {
      status: "pending",
      iyzicoTokenHash: { not: null },
      completedAt: null,
      createdAt: { gte: notBefore, lte: notAfter },
      // Yalnız gerçek PLAN yükseltmeleri — top-up (AI kredisi) ve koltuk-satın-alma değil.
      bonusAiCredits: null,
      seatsOnly: false,
      user: {
        plan: "FREE", // tamamlamış/yükseltmiş olsaydı FREE olmazdı
        role: "USER",
        isVerified: true,
        // HUKUKİ (KVKK/6563/GDPR): diğer pazarlama e-postalarıyla AYNI sıkı opt-in —
        // yalnız açıkça izin VEREN ve çıkmayan kullanıcılara. Sıfır hukuki risk.
        marketingConsent: true,
        marketingUnsubscribedAt: null,
        teamMembership: { is: null },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      plan: true,
      userId: true,
      user: { select: { email: true, firstName: true, name: true, preferredLanguage: true } },
    },
  });

  const seenUser = new Set<string>();
  let sent = 0;
  for (const r of rows) {
    if (seenUser.has(r.userId)) continue; // kullanıcı başına yalnız en yeni terk
    seenUser.add(r.userId);
    const u = r.user;
    if (!u?.email) continue;

    // Nezaket + dedup: son 7 günde recovery e-postası aldıysa tekrar gönderme.
    const recent = await prisma.adminAuditLog.findFirst({
      where: {
        action: { startsWith: "email.checkout_recovery." },
        targetKey: r.userId,
        createdAt: { gte: sevenDaysAgo },
      },
      select: { id: true },
    });
    if (recent) continue;

    const locale: Locale = u.preferredLanguage === "tr" ? "tr" : "en";
    const label = PLAN_LABELS[r.plan] ?? { tr: r.plan, en: r.plan };
    const planLabel = locale === "tr" ? label.tr : label.en;
    const origin = env.FRONTEND_ORIGIN.replace(/\/$/, "");
    const ctaUrl = `${origin}/workspace?upgrade=1`;
    const name = (u.firstName || u.name || (locale === "tr" ? "Merhaba" : "there")).trim();

    try {
      await sendCheckoutRecoveryEmail(u.email, { name, userId: r.userId, checkoutId: r.id, planLabel, ctaUrl, locale });
      sent += 1;
      await new Promise((res) => setTimeout(res, 400)); // SMTP'yi boğmamak için
    } catch (err) {
      logger.error("checkout-recovery", "recovery email failed (non-fatal)", { detail: String(err) });
    }
  }
  if (sent > 0) logger.info("checkout-recovery", `recovery emails sent: ${sent}`);
}

export function registerCheckoutRecoveryJobs() {
  // Her saatin 20. dakikasında — terk edilen (≥2 saat) yükseltmeleri geri kazan.
  cron.schedule("20 * * * *", () => {
    safeRun("runCheckoutRecovery", runCheckoutRecovery);
  });
}
