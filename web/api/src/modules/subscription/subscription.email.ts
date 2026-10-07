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
    rows.push({ label: tr ? "Dönem bitişi" : "Period ends", value: safePeriod });
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
    ...(periodEnd ? [`${tr ? "Dönem bitişi" : "Period ends"}: ${periodEnd}`] : []),
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
