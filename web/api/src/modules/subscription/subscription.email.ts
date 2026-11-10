import { renderCorporateEmail, detailTable, ctaButton, calloutBox, checkList, sectionTitle } from "../../lib/email-layout.js";
import { env } from "../../config/env.js";
import { planDefinitions } from "./subscription.config.js";
import { escapeHtml } from "../../lib/email-html.js";
import type { Locale } from "../../lib/email-i18n.js";

const PRODUCT = "PDF PLATFORM";

// ─── Ödeme başarılı / abonelik aktif ────────────────────────────────────────

type PaymentSuccessInput = {
  planName: string;
  amount: string;       // "299.00"
  currency: string;     // "TRY" | "USD" | "EUR"
  periodEnd?: string;   // ISO veya yerelleştirilmiş tarih
  lang?: Locale;
};

/** Planın müşteriye görünen adı (veritabanındaki STARTER/PLUS/... kodu e-postada gösterilmez). */
function planDisplayName(plan: string, tr: boolean): string {
  const names: Record<string, { tr: string; en: string }> = {
    STARTER: { tr: "Başlangıç", en: "Starter" },
    PLUS: { tr: "Plus", en: "Plus" },
    PRO: { tr: "Pro", en: "Pro" },
    BUSINESS: { tr: "İşletme", en: "Business" },
  };
  const n = names[plan];
  return n ? (tr ? n.tr : n.en) : plan;
}

export function createPaymentSuccessEmailTemplate({
  planName,
  amount,
  currency,
  periodEnd,
  lang = "tr",
}: PaymentSuccessInput) {
  const tr = lang === "tr";
  const planLabel = planDisplayName(planName, tr);
  const safePlan = escapeHtml(planLabel);
  const safeAmount = escapeHtml(`${amount} ${currency}`);
  const safePeriod = periodEnd ? escapeHtml(periodEnd) : "";
  const workspaceUrl = `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/workspace`;

  const subject = tr
    ? `Ödemeniz alındı, ${planLabel} planınız aktif — ${PRODUCT}`
    : `Payment received, your ${planLabel} plan is active — ${PRODUCT}`;

  const rows = [
    { label: "Plan", value: safePlan },
    { label: tr ? "Ödenen tutar" : "Amount paid", value: safeAmount },
  ];
  const daily = (planDefinitions as Record<string, { dailyLimit: number | null } | undefined>)[planName]?.dailyLimit;
  if (daily !== undefined) {
    rows.push({
      label: tr ? "Günlük işlem hakkı" : "Daily operations",
      value: daily === null ? (tr ? "Sınırsız" : "Unlimited") : String(daily),
    });
  }
  if (safePeriod) {
    rows.push({ label: tr ? "Erişim bitişi" : "Access until", value: safePeriod });
  }

  const html = renderCorporateEmail({
    eyebrow: tr ? "Ödeme onaylandı" : "Payment confirmed",
    title: tr ? `${safePlan} planınız aktif` : `Your ${safePlan} plan is active`,
    intro: tr
      ? `Ödemeniz başarıyla alındı. ${PRODUCT} hesabınızda ${safePlan} planının tüm ayrıcalıkları şimdi açık, hemen kullanmaya başlayabilirsiniz.`
      : `We received your payment. All ${safePlan} plan benefits are now unlocked in your ${PRODUCT} account — you can start right away.`,
    bodyHtml: `
      ${calloutBox(
        tr ? "Hesabınız yükseltildi" : "Your account is upgraded",
        tr
          ? "Planınıza dahil olan araçlar çalışma alanınızda kullanıma hazır. Sayfayı yenilemeniz yeterli."
          : "The tools included in your plan are ready in your workspace. Just refresh the page.",
      )}
      ${sectionTitle(tr ? "Ödeme özeti" : "Payment summary")}
      ${detailTable(rows)}
      ${ctaButton(workspaceUrl, tr ? "Çalışma alanına git" : "Go to workspace")}
      ${sectionTitle(tr ? "Bilmeniz gerekenler" : "Good to know")}
      ${checkList(
        tr
          ? [
              "Faturanız ayrı bir e-posta ile gönderilir; birkaç dakika sürebilir.",
              "Aboneliğiniz kendiliğinden yenilenmez, kartınızdan onayınız olmadan ücret çekilmez.",
              "Planınızı ve ödeme geçmişinizi hesap ayarlarınızdaki Abonelik bölümünden görebilirsiniz.",
            ]
          : [
              "Your invoice is sent in a separate email; it can take a few minutes.",
              "Your subscription does not renew automatically and your card is never charged without your confirmation.",
              "You can see your plan and payment history in the Subscription section of your account settings.",
            ],
      )}
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">${
        tr
          ? "Bir sorunuz mu var? Bu e-postaya yanıt vermek yerine info@pdfplatform.app adresine yazabilirsiniz."
          : "Questions? Instead of replying to this email, write to info@pdfplatform.app."
      }</p>
    `,
    footerText: `${PRODUCT} — NB Global Studio`,
    productName: PRODUCT,
    preheader: tr
      ? `${planLabel} planınız şimdi aktif — ödemeniz için teşekkürler.`
      : `Your ${planLabel} plan is now active — thank you for your payment.`,
  });

  const text = [
    subject,
    "",
    tr
      ? `Ödemeniz alındı ve ${planLabel} planınız aktif.`
      : `We received your payment and your ${planLabel} plan is active.`,
    "",
    `Plan: ${planLabel}`,
    `${tr ? "Ödenen tutar" : "Amount paid"}: ${amount} ${currency}`,
    ...(periodEnd ? [`${tr ? "Erişim bitişi" : "Access until"}: ${periodEnd}`] : []),
    "",
    `${tr ? "Çalışma alanına git" : "Go to workspace"}: ${workspaceUrl}`,
    "",
    tr ? "Faturanız ayrı bir e-posta ile gönderilir." : "Your invoice is sent in a separate email.",
  ].join("\n");

  return { subject, html, text };
}

// ─── Abonelik iptal edildi ──────────────────────────────────────────────────

type SubscriptionCancelledInput = {
  planName: string;
  effectiveDate?: string; // ne zaman FREE'ye düşer
  refunded?: boolean;
  lang?: Locale;
};

export function createSubscriptionCancelledEmailTemplate({
  planName,
  effectiveDate,
  refunded = false,
  lang = "tr",
}: SubscriptionCancelledInput) {
  const tr = lang === "tr";
  const safePlan = escapeHtml(planName);
  const safeDate = effectiveDate ? escapeHtml(effectiveDate) : "";

  const subject = tr
    ? `Aboneliğiniz iptal edildi — ${PRODUCT}`
    : `Your subscription was cancelled — ${PRODUCT}`;

  const introTr = refunded
    ? `${safePlan} aboneliğiniz iptal edildi ve ödemeniz iade edildi. Planınız Ücretsiz plana düşürüldü.`
    : `${safePlan} aboneliğiniz iptal edildi. ${
        safeDate ? `Mevcut döneminiz ${safeDate} tarihinde sona erecek ve ardından` : "Dönem sonunda"
      } Ücretsiz plana geçeceksiniz.`;
  const introEn = refunded
    ? `Your ${safePlan} subscription has been cancelled and your payment refunded. Your plan has been downgraded to Free.`
    : `Your ${safePlan} subscription has been cancelled. ${
        safeDate ? `Your current period ends on ${safeDate}, after which` : "At the end of your period"
      } you will move to the Free plan.`;

  const rows = [{ label: tr ? "Plan" : "Plan", value: safePlan }];
  if (safeDate) {
    rows.push({ label: tr ? "Geçerlilik" : "Effective", value: safeDate });
  }
  rows.push({
    label: tr ? "İade" : "Refund",
    value: refunded ? (tr ? "Evet" : "Yes") : (tr ? "Hayır" : "No"),
  });

  const html = renderCorporateEmail({
    eyebrow: tr ? "Abonelik" : "Subscription",
    title: tr ? "Aboneliğiniz iptal edildi" : "Your subscription was cancelled",
    intro: tr ? introTr : introEn,
    bodyHtml: `
      ${detailTable(rows)}
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${
        tr
          ? "Fikrinizi değiştirirseniz hesap ayarlarınızdan istediğiniz zaman yeniden abone olabilirsiniz."
          : "If you change your mind, you can resubscribe anytime from your account settings."
      }</p>
    `,
    footerText: `${PRODUCT} — NB Global Studio`,
    productName: PRODUCT,
  });

  const text = [
    subject,
    "",
    tr ? introTr : introEn,
  ].join("\n");

  return { subject, html, text };
}

// ─── Yenileme hatırlatması (süre dolmadan önce) ─────────────────────────────

type RenewalReminderInput = {
  planName: string;
  renewalDate: string;
  amount?: string;
  currency?: string;
  lang?: Locale;
};

export function createRenewalReminderEmailTemplate({
  planName,
  renewalDate,
  amount,
  currency,
  lang = "tr",
}: RenewalReminderInput) {
  const tr = lang === "tr";
  const safePlan = escapeHtml(planName);
  const safeDate = escapeHtml(renewalDate);

  const subject = tr
    ? `Aboneliğiniz yakında sona erecek — ${PRODUCT}`
    : `Your subscription ends soon — ${PRODUCT}`;

  const rows = [
    { label: tr ? "Plan" : "Plan", value: safePlan },
    { label: tr ? "Bitiş tarihi" : "End date", value: safeDate },
  ];
  if (amount && currency) {
    rows.push({ label: tr ? "Tutar" : "Amount", value: escapeHtml(`${amount} ${currency}`) });
  }

  const html = renderCorporateEmail({
    eyebrow: tr ? "Hatırlatma" : "Reminder",
    title: tr ? "Aboneliğiniz yakında sona erecek" : "Your subscription ends soon",
    intro: tr
      ? `${safePlan} aboneliğiniz ${safeDate} tarihinde sona erecek. Aboneliğiniz kendiliğinden yenilenmez ve kartınızdan sizin onayınız olmadan ücret çekilmez.`
      : `Your ${safePlan} subscription ends on ${safeDate}. It does not renew automatically and your card is never charged without your confirmation.`,
    bodyHtml: `
      ${detailTable(rows)}
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${
        tr
          ? "Devam etmek isterseniz, bitiş tarihinden önce hesabınızdaki Abonelik bölümünden yenileme için onay verebilirsiniz. Hiçbir şey yapmazsanız süre dolunca hesabınız ücretsiz plana döner."
          : "If you'd like to continue, confirm the renewal from the Subscription section of your account before the end date. If you do nothing, your account returns to the free plan when the period ends."
      }</p>
    `,
    footerText: `${PRODUCT} — NB Global Studio`,
    productName: PRODUCT,
  });

  const text = [
    subject,
    "",
    `${tr ? "Plan" : "Plan"}: ${planName}`,
    `${tr ? "Bitiş tarihi" : "End date"}: ${renewalDate}`,
    ...(amount && currency ? [`${tr ? "Tutar" : "Amount"}: ${amount} ${currency}`] : []),
  ].join("\n");

  return { subject, html, text };
}
