import { env } from "../config/env.js";
import { escapeHtml } from "./email-html.js";
import { renderCorporateEmail, ctaButton } from "./email-layout.js";
import { sendMail } from "./mailer.js";
import { logAutomationEmailAudit } from "../modules/admin/admin-audit.service.js";
import { emailT, type Locale } from "./email-i18n.js";

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
    <p style="margin:0 0 14px;font-size:16px;line-height:1.75;color:#e2e8f0;">${t.greeting(name)}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#cbd5e1;">${t.welcome_body()}</p>
    <p style="margin:0;font-size:14px;line-height:1.75;color:#94a3b8;">${t.welcome_footer}</p>
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

export async function sendLowCreditNudge(
  toEmail: string,
  vars: { name: string; credits: number; userId: string; ctaUrl: string; locale?: Locale },
): Promise<void> {
  const locale: Locale = vars.locale ?? "tr";
  const t = emailT[locale];
  const name = escapeHtml(vars.name);
  const credits = String(vars.credits);
  const ctaUrl = vars.ctaUrl || `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/workspace`;

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.75;color:#e2e8f0;">${t.greeting(name)}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#fbbf24;">${t.low_credit_body(credits)}</p>
    ${ctaButton(ctaUrl, t.low_credit_cta)}
  `;

  const html = renderCorporateEmail({
    eyebrow: t.low_credit_eyebrow,
    title: t.low_credit_title,
    intro: t.low_credit_intro,
    bodyHtml,
    footerText: t.low_credit_footer,
    productName: product(),
  });

  const subject = t.low_credit_subject(product());
  await sendMail({ to: toEmail, subject, html, text: stripForText(name + " " + credits + " " + ctaUrl) });
  await logAutomationEmailAudit("email.automation.low_credit", vars.userId, `Low-credit nudge → ${toEmail}`, {
    template: "low_credit",
    credits: vars.credits,
    ctaUrl,
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
  const wrapped = renderCorporateEmail({
    eyebrow: t.newsletter_eyebrow,
    title: t.newsletter_title,
    intro: " ",
    bodyHtml: `<div style="font-size:15px;line-height:1.75;color:#e2e8f0;">${inner}</div>`,
    footerText: t.newsletter_footer,
    productName: product(),
  });
  await sendMail({
    to: toEmail,
    subject: safeSubject,
    html: wrapped,
    text: stripForText(safeSubject + " " + inner),
  });
}
