import { env } from "../config/env.js";
import { escapeHtml } from "./email-html.js";
import { renderCorporateEmail } from "./email-layout.js";
import { sendMail } from "./mailer.js";
import { logAutomationEmailAudit } from "../modules/admin/admin-audit.service.js";

const product = () => env.SMTP_FROM_NAME;
const cta = (url: string, label: string) =>
  `<a href="${escapeHtml(url)}" style="display:inline-block;margin:8px 0 0;padding:14px 28px;border-radius:14px;background:linear-gradient(180deg,#22d3ee 0%,#0ea5e9 100%);color:#0f172a;font-weight:800;text-decoration:none;font-size:15px;">${escapeHtml(
    label,
  )}</a>`;

export function applyTemplateVars(content: string, vars: Record<string, string | number>) {
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
  vars: { name: string; credits: number; userId: string },
) {
  const name = escapeHtml(vars.name);
  const credits = String(vars.credits);
  const bodyFragment = applyTemplateVars(
    `<p style="margin:0 0 12px;font-size:16px;line-height:1.75;color:#e2e8f0;">Hi <strong>{{name}}</strong>,</p>
     <p style="margin:0 0 12px;font-size:15px;line-height:1.75;color:#cbd5e1;">Your account is ready. You have <strong>{{credits}}</strong> credits to get started with NB PDF.</p>
     <p style="margin:0;font-size:15px;line-height:1.75;color:#94a3b8;">We're glad you're here.</p>`,
    { name, credits },
  );
  const shopUrl = `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/workspace`;
  const bodyHtml = `${bodyFragment}<div style="margin-top:20px;">${cta(shopUrl, "Open workspace")}</div>`;
  const html = renderCorporateEmail({
    eyebrow: "Welcome",
    title: "You’re in",
    intro: "Thanks for creating your account.",
    bodyHtml,
    footerText: "You can manage your tools anytime from the workspace.",
    productName: product(),
  });
  const subject = `Welcome to ${product()}`;
  await sendMail({ to: toEmail, subject, html, text: stripForText(`${vars.name} — welcome. Credits: ${credits} — ${shopUrl}`) });
  await logAutomationEmailAudit("email.welcome", vars.userId, `Welcome email → ${toEmail}`, {
    template: "welcome",
    to: toEmail,
  });
}

export async function sendLowCreditNudge(
  toEmail: string,
  vars: { name: string; credits: number; userId: string; ctaUrl: string },
) {
  const name = escapeHtml(vars.name);
  const credits = String(vars.credits);
  const ctaUrl = vars.ctaUrl || `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/workspace`;
  const bodyFragment = applyTemplateVars(
    `<p style="margin:0 0 12px;font-size:16px;line-height:1.75;color:#e2e8f0;">Hi <strong>{{name}}</strong>,</p>
     <p style="margin:0 0 12px;font-size:15px;line-height:1.75;color:#fbbf24;">Your balance is <strong>{{credits}}</strong> credits — running low.</p>
     <p style="margin:0;font-size:15px;line-height:1.75;color:#cbd5e1;">Top up and keep working without interruption. Special offer on credit packs this week.</p>`,
    { name, credits } as Record<string, string>,
  );
  const bodyHtml = `${bodyFragment}<div style="margin-top:20px;">${cta(ctaUrl, "Get credits / discount")}</div>`;
  const html = renderCorporateEmail({
    eyebrow: "Account",
    title: "Low credit reminder",
    intro: "A quick nudge so you are not stopped mid-work.",
    bodyHtml,
    footerText: "This is an automated sales message. You can ignore it if you already topped up.",
    productName: product(),
  });
  const subject = `Your credits are low — ${product()}`;
  await sendMail({
    to: toEmail,
    subject,
    html,
    text: stripForText(name + " low balance " + credits + " " + ctaUrl),
  });
  await logAutomationEmailAudit("email.automation.low_credit", vars.userId, `Low-credit nudge → ${toEmail}`, {
    template: "low_credit",
    credits: vars.credits,
    ctaUrl,
  });
}

export async function sendMassCampaignEmail(
  toEmail: string,
  subject: string,
  bodyHtml: string,
  sampleVars: { name: string; credits: number; email: string },
) {
  const safe = {
    name: escapeHtml(sampleVars.name),
    email: escapeHtml(sampleVars.email),
    credits: String(sampleVars.credits),
  };
  const safeSubject = applyTemplateVars(subject, safe);
  const inner = applyTemplateVars(bodyHtml, safe);
  const wrapped = renderCorporateEmail({
    eyebrow: "Newsletter",
    title: "Message from the team",
    intro: " ",
    bodyHtml: `<div style="font-size:15px;line-height:1.75;color:#e2e8f0;">${inner}</div>`,
    footerText: "You are receiving this as a registered user.",
    productName: product(),
  });
  await sendMail({
    to: toEmail,
    subject: safeSubject,
    html: wrapped,
    text: stripForText(safeSubject + " " + inner),
  });
}
