import { env } from "../config/env.js";
import { escapeHtml } from "./email-html.js";
import { renderCorporateEmail, ctaButton } from "./email-layout.js";
import { sendMail } from "./mailer.js";
import { logAutomationEmailAudit } from "../modules/admin/admin-audit.service.js";
import { emailT, type Locale } from "./email-i18n.js";
import { unsubscribeUrlFor } from "../modules/email/email-unsubscribe.service.js";

const product = () => env.SMTP_FROM_NAME;

export function applyTemplateVars(content: string, vars: Record<string, string | number>): string {
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

function stripForText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function sendWelcomeEmailToUser(
  toEmail: string,
  vars: { name: string; userId: string; locale?: Locale },
): Promise<void> {
  const locale: Locale = vars.locale ?? "tr";
  const t = emailT[locale];
  const name = escapeHtml(vars.name);
  const shopUrl = `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/workspace`;

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.75;color:#0f172a;">${t.greeting(name)}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#334155;">${t.welcome_body()}</p>
    <p style="margin:0;font-size:14px;line-height:1.75;color:#64748b;">${t.welcome_footer}</p>
    ${ctaButton(shopUrl, t.welcome_cta)}
  `;

  const html = renderCorporateEmail({
    eyebrow: t.welcome_eyebrow,
    title: t.welcome_title,
    intro: t.welcome_intro,
    bodyHtml,
    footerText: t.welcome_footer,
    productName: product(),
  });

  const subject = t.welcome_subject(product());
  await sendMail({ to: toEmail, subject, html, text: stripForText(`${vars.name} — ${shopUrl}`) });
  await logAutomationEmailAudit("email.welcome", vars.userId, `Welcome email → ${toEmail}`, { template: "welcome", to: toEmail, locale });
}

/** Lifecycle drip aşamaları — dönüşmeyen FREE kullanıcılara zamanlı gönderilir. */
export type LifecycleStage = "tips" | "value" | "winback";

export async function sendLifecycleEmail(
  toEmail: string,
  vars: {
    name: string;
    userId: string;
    stage: LifecycleStage;
    ctaUrl: string;
    couponCode?: string;
    locale?: Locale;
  },
): Promise<void> {
  const locale: Locale = vars.locale ?? "tr";
  const t = emailT[locale];
  const name = escapeHtml(vars.name);
  const ctaUrl = vars.ctaUrl || `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/workspace`;
  const stage = vars.stage;
  const lc = t.lifecycle[stage] as {
    eyebrow: string;
    title: string;
    intro: string;
    body: string;
    bullets?: readonly string[];
    couponLabel?: string;
    cta: string;
    footer: string;
    subject: (product: string) => string;
  };

  // Win-back: kupon varsa indirim bloğu ekle, yoksa değer-odaklı kalır.
  const couponBlock =
    stage === "winback" && vars.couponCode
      ? `<div style="margin:18px 0 4px;padding:16px 18px;border:1px solid rgba(16,185,129,0.35);border-radius:14px;background:rgba(16,185,129,0.08);">
           <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.04em;color:#047857;text-transform:uppercase;">${lc.couponLabel}</p>
           <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:0.12em;color:#065f46;">${escapeHtml(vars.couponCode)}</p>
         </div>`
      : "";

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.75;color:#0f172a;">${t.greeting(name)}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#334155;">${lc.body}</p>
    ${lc.bullets ? `<ul style="margin:0 0 8px;padding:0 0 0 18px;color:#334155;font-size:14px;line-height:1.9;">${lc.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
    ${couponBlock}
    ${ctaButton(ctaUrl, lc.cta)}
  `;

  // Pazarlama e-postası → hukuki olarak abonelikten çıkış yolu ZORUNLU
  // (GDPR/CASL/CAN-SPAM/6563). Token'lı gerçek https endpoint (tek-tık uyumlu).
  const unsubscribeUrl = unsubscribeUrlFor(vars.userId);
  const html = renderCorporateEmail({
    eyebrow: lc.eyebrow,
    title: lc.title,
    intro: lc.intro,
    bodyHtml,
    footerText: lc.footer,
    productName: product(),
    unsubscribeUrl,
  });

  const subject = lc.subject(product());
  await sendMail({ to: toEmail, subject, html, text: stripForText(`${vars.name} — ${ctaUrl}`), listUnsubscribeUrl: unsubscribeUrl });
  await logAutomationEmailAudit(`email.lifecycle.${stage}`, vars.userId, `Lifecycle ${stage} → ${toEmail}`, {
    template: `lifecycle_${stage}`,
    ctaUrl,
    couponCode: vars.couponCode ?? null,
    locale,
  });
}

export async function sendMassCampaignEmail(
  toEmail: string,
  subject: string,
  bodyHtml: string,
  sampleVars: { name: string; credits: number; email: string },
  locale: Locale = "tr",
): Promise<void> {
  const t = emailT[locale];
  const safe = {
    name: escapeHtml(sampleVars.name),
    email: escapeHtml(sampleVars.email),
    credits: String(sampleVars.credits),
  };
  const safeSubject = applyTemplateVars(subject, safe);
  const inner = applyTemplateVars(bodyHtml, safe);
  const unsubscribeUrl = `mailto:${env.SMTP_FROM_EMAIL}?subject=${encodeURIComponent("Ticari e-postalardan çıkmak istiyorum")}`;
  const wrapped = renderCorporateEmail({
    eyebrow: t.newsletter_eyebrow,
    title: t.newsletter_title,
    intro: " ",
    bodyHtml: `<div style="font-size:15px;line-height:1.75;color:#334155;">${inner}</div>`,
    footerText: t.newsletter_footer,
    productName: product(),
    unsubscribeUrl,
  });
  await sendMail({
    to: toEmail,
    subject: safeSubject,
    html: wrapped,
    text: stripForText(safeSubject + " " + inner),
  });
}
