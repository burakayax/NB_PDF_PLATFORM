import { renderCorporateEmail, detailTable } from "../../lib/email-layout.js";
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

export function createPaymentSuccessEmailTemplate({
  planName,
  amount,
  currency,
  periodEnd,
  lang = "tr",
}: PaymentSuccessInput) {
  const tr = lang === "tr";
  const safePlan = escapeHtml(planName);
  const safeAmount = escapeHtml(`${amount} ${currency}`);
  const safePeriod = periodEnd ? escapeHtml(periodEnd) : "";

  const subject = tr
    ? `Aboneliğiniz aktif — ${PRODUCT}`
    : `Your subscription is active — ${PRODUCT}`;

  const rows = [
    { label: tr ? "Plan" : "Plan", value: safePlan },
    { label: tr ? "Tutar" : "Amount", value: safeAmount },
  ];
  if (safePeriod) {
    rows.push({ label: tr ? "Sonraki yenileme" : "Next renewal", value: safePeriod });
  }

  const html = renderCorporateEmail({
    eyebrow: tr ? "Ödeme" : "Payment",
    title: tr ? "Aboneliğiniz başarıyla aktifleştirildi" : "Your subscription is now active",
    intro: tr
      ? `${PRODUCT} ${safePlan} planınız için ödemeniz alındı. Tüm premium araçlara artık erişebilirsiniz.`
      : `We received your payment for the ${PRODUCT} ${safePlan} plan. You now have access to all premium tools.`,
    bodyHtml: `
      ${detailTable(rows)}
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${
        tr
          ? "Faturanız ayrıca e-posta ile gönderilecektir. Aboneliğinizi istediğiniz zaman hesap ayarlarınızdan yönetebilirsiniz."
          : "Your invoice will be sent separately. You can manage your subscription anytime from your account settings."
      }</p>
    `,
    footerText: `${PRODUCT} — NB Global Studio`,
    productName: PRODUCT,
  });

  const text = [
    subject,
    "",
    `${tr ? "Plan" : "Plan"}: ${planName}`,
    `${tr ? "Tutar" : "Amount"}: ${amount} ${currency}`,
    ...(periodEnd ? [`${tr ? "Sonraki yenileme" : "Next renewal"}: ${periodEnd}`] : []),
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
    ? `Aboneliğiniz yakında yenilenecek — ${PRODUCT}`
    : `Your subscription renews soon — ${PRODUCT}`;

  const rows = [
    { label: tr ? "Plan" : "Plan", value: safePlan },
    { label: tr ? "Yenileme tarihi" : "Renewal date", value: safeDate },
  ];
  if (amount && currency) {
    rows.push({ label: tr ? "Tutar" : "Amount", value: escapeHtml(`${amount} ${currency}`) });
  }

  const html = renderCorporateEmail({
    eyebrow: tr ? "Hatırlatma" : "Reminder",
    title: tr ? "Aboneliğiniz yakında yenilenecek" : "Your subscription renews soon",
    intro: tr
      ? `${safePlan} aboneliğiniz ${safeDate} tarihinde otomatik olarak yenilenecek. Devam etmek için bir şey yapmanıza gerek yok.`
      : `Your ${safePlan} subscription will automatically renew on ${safeDate}. No action is needed to continue.`,
    bodyHtml: `
      ${detailTable(rows)}
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${
        tr
          ? "Yenilemeyi durdurmak isterseniz, yenileme tarihinden önce hesap ayarlarınızdan aboneliğinizi iptal edebilirsiniz."
          : "If you'd like to stop the renewal, you can cancel your subscription from your account settings before the renewal date."
      }</p>
    `,
    footerText: `${PRODUCT} — NB Global Studio`,
    productName: PRODUCT,
  });

  const text = [
    subject,
    "",
    `${tr ? "Plan" : "Plan"}: ${planName}`,
    `${tr ? "Yenileme tarihi" : "Renewal date"}: ${renewalDate}`,
    ...(amount && currency ? [`${tr ? "Tutar" : "Amount"}: ${amount} ${currency}`] : []),
  ].join("\n");

  return { subject, html, text };
}
