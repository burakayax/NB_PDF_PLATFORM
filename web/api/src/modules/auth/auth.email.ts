import { renderCorporateEmail, ctaButton, detailTable } from "../../lib/email-layout.js";
import { escapeHtml } from "../../lib/email-html.js";
import { renderBrandedVerificationEmailHtml } from "./verification-email-branded.js";
import { emailT, type Locale } from "../../lib/email-i18n.js";

type VerificationEmailTemplateInput = {
  verificationUrl: string;
  productName: string;
  expiresInHours: number;
  locale?: Locale;
};

type AdminNotificationEmailTemplateInput = {
  userEmail: string;
  registeredAt: string;
  productName: string;
};

export function createVerificationEmailTemplate({
  verificationUrl,
  productName,
  expiresInHours,
  locale = "tr",
}: VerificationEmailTemplateInput) {
  const t = emailT[locale];
  const safeProduct = escapeHtml(productName);
  const html = renderBrandedVerificationEmailHtml(verificationUrl, locale);

  const text = [
    t.verify_subject,
    "",
    t.verify_title,
    "",
    t.verify_body,
    "",
    verificationUrl,
    "",
    locale === "tr"
      ? `Bu bağlantı ${expiresInHours} saat içinde sona erer.`
      : `This link expires in ${expiresInHours} hours.`,
    "",
    t.verify_footer_note,
    `${safeProduct} © 2026`,
  ].join("\n");

  return { subject: t.verify_subject, html, text };
}

export function createAdminNotificationEmailTemplate({
  userEmail,
  registeredAt,
  productName,
}: AdminNotificationEmailTemplateInput) {
  const subject = `New registration — ${productName}`;
  const safeEmail = escapeHtml(userEmail);
  const safeDate = escapeHtml(registeredAt);
  const safeProduct = escapeHtml(productName);

  const html = renderCorporateEmail({
    eyebrow: "Admin",
    title: "New user registered",
    intro: `A new account was created on ${safeProduct}. The user must verify their email before they can sign in.`,
    bodyHtml: detailTable([
      { label: "Email", value: safeEmail },
      { label: "Registered at", value: safeDate },
    ]),
    footerText: `This notification was sent to the configured administrator for ${safeProduct}.`,
    productName: safeProduct,
  });

  const text = [
    `New user registered — ${productName}`,
    "",
    `Email: ${userEmail}`,
    `Registered at: ${registeredAt}`,
  ].join("\n");

  return { subject, html, text };
}

type AccountDeletionEmailInput = {
  email: string;
  deletedAt: string;
  lang?: Locale;
};

export function createAccountDeletionEmailTemplate({
  email,
  deletedAt,
  lang = "en",
}: AccountDeletionEmailInput) {
  const t = emailT[lang];
  const safeEmail = escapeHtml(email);
  const safeDate = escapeHtml(deletedAt);

  const html = renderCorporateEmail({
    eyebrow: t.delete_eyebrow,
    title: t.delete_title,
    intro: t.delete_intro,
    bodyHtml: `
      ${detailTable([
        { label: t.delete_email_label, value: safeEmail },
        { label: t.delete_date_label, value: safeDate },
      ])}
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${t.delete_note}</p>
    `,
    footerText: "PDF PLATFORM — NB Global Studio",
    productName: "PDF PLATFORM",
  });

  const text = [
    t.delete_subject,
    "",
    `${t.delete_email_label}: ${email}`,
    `${t.delete_date_label}: ${deletedAt}`,
    "",
    t.delete_intro,
    t.delete_note,
  ].join("\n");

  return { subject: t.delete_subject, html, text };
}

type PasswordResetCodeEmailInput = {
  code: string;
  lang: Locale;
};

export function createPasswordResetCodeEmailTemplate({
  code,
  lang,
}: PasswordResetCodeEmailInput) {
  const t = emailT[lang];
  const safeCode = escapeHtml(code);

  const html = renderCorporateEmail({
    eyebrow: t.reset_eyebrow,
    title: t.reset_title,
    intro: t.reset_intro,
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"
        style="width:100%;border-collapse:collapse;border:1px solid #2d1b69;border-radius:16px;
          background:linear-gradient(135deg,#13082a 0%,#0d0d2e 100%);padding:28px 24px;">
        <tbody>
          <tr>
            <td style="text-align:center;font-size:36px;font-weight:800;letter-spacing:0.45em;
              color:#a78bfa;font-family:ui-monospace,Courier New,monospace;
              text-shadow:0 0 20px rgba(167,139,250,0.5);">${safeCode}</td>
          </tr>
        </tbody>
      </table>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${t.reset_note}</p>
    `,
    footerText: "PDF PLATFORM — NB Global Studio",
    productName: "PDF PLATFORM",
  });

  const text = [
    t.reset_subject,
    "",
    lang === "tr" ? `Kodunuz: ${code}` : `Your code: ${code}`,
    "",
    t.reset_note,
  ].join("\n");

  return { subject: t.reset_subject, html, text };
}
