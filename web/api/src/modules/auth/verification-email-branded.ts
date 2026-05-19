import { escapeHtmlAttr, escapeHtml } from "../../lib/email-html.js";
import { env } from "../../config/env.js";
import { type Locale } from "../../lib/email-i18n.js";

const copy = {
  tr: {
    title: "E-posta adresinizi doğrulayın",
    body: "PDF PLATFORM hesabınızı aktifleştirmek için doğrulama yapmanız gerekiyor.",
    note: "Bu bağlantı güvenlik nedeniyle sınırlı süre geçerlidir.",
    cta: "E-postamı doğrula",
    fallback_label: "Buton çalışmıyorsa bağlantıyı kopyalayın:",
    footer_note: "Bu işlemi siz yapmadıysanız dikkate almayabilirsiniz.",
    copyright: "PDF PLATFORM © 2026",
  },
  en: {
    title: "Verify your email address",
    body: "You need to verify your email to activate your PDF PLATFORM account.",
    note: "This link is valid for a limited time for security reasons.",
    cta: "Verify my email",
    fallback_label: "If the button doesn't work, copy the link:",
    footer_note: "If you did not request this, you can safely ignore this email.",
    copyright: "PDF PLATFORM © 2026",
  },
};

/** Branded doğrulama emaili — modern dark tasarım, gerçek logo. */
export function renderBrandedVerificationEmailHtml(
  verificationUrl: string,
  locale: Locale = "tr",
): string {
  const href = escapeHtmlAttr(verificationUrl);
  const origin = (env as any).FRONTEND_ORIGIN?.replace(/\/$/, "") ?? "";
  const logoUrl = origin ? escapeHtml(`${origin}/logo.png`) : "";
  const c = copy[locale];

  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" width="38" height="38" alt="PDF PLATFORM"
        style="display:block;border-radius:10px;border:1px solid rgba(139,92,246,0.35);" />`
    : `<div style="width:38px;height:38px;border-radius:10px;border:1px dashed #8b5cf6;
        background:rgba(139,92,246,0.12);display:inline-block;line-height:38px;text-align:center;
        font-size:9px;font-weight:800;letter-spacing:0.1em;color:#a78bfa;">PDF</div>`;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>PDF PLATFORM</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1e;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#0a0f1e;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%;background:#111827;border:1px solid #1e2d45;
          border-radius:20px;overflow:hidden;">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1040 0%,#0d1b35 50%,#0a1628 100%);
            padding:30px 36px 26px;border-bottom:1px solid #1e2d45;">

            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:14px;">${logoBlock}</td>
                <td style="vertical-align:middle;">
                  <div style="font-size:15px;font-weight:800;color:#e2e8f0;letter-spacing:0.04em;">PDF PLATFORM</div>
                  <div style="font-size:10px;font-weight:700;color:#8b5cf6;letter-spacing:0.18em;
                    text-transform:uppercase;margin-top:3px;">${locale === "tr" ? "DOĞRULAMA" : "VERIFICATION"}</div>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:34px 36px 10px;">

            <h1 style="margin:0 0 14px;font-size:22px;font-weight:800;line-height:1.3;
              background:linear-gradient(135deg,#f8fafc 0%,#c4b5fd 100%);
              -webkit-background-clip:text;-webkit-text-fill-color:transparent;
              background-clip:text;color:#f8fafc;">
              ${c.title}
            </h1>

            <p style="margin:0 0 8px;font-family:Arial;font-size:15px;line-height:1.65;color:#94a3b8;">
              ${c.body}
            </p>

            <p style="margin:0;font-family:Arial;font-size:13px;color:#6b7280;">
              ${c.note}
            </p>

          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:28px 36px 14px;">
            <a href="${href}" target="_blank"
              style="display:inline-block;padding:15px 32px;
                background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);
                color:#ffffff;text-decoration:none;border-radius:12px;
                font-family:Arial;font-size:15px;font-weight:800;letter-spacing:0.02em;
                border:1px solid rgba(167,139,250,0.3);">
              ${c.cta}
            </a>
          </td>
        </tr>

        <!-- FALLBACK LINK -->
        <tr>
          <td style="padding:8px 36px 28px;">
            <p style="margin:0 0 6px;font-family:Arial;font-size:12px;color:#4b5563;">
              ${c.fallback_label}
            </p>
            <p style="margin:0;font-family:Arial;font-size:12px;color:#7c3aed;word-break:break-all;">
              ${href}
            </p>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#0d1117;border-top:1px solid #1e2d45;padding:18px 36px;">
            <p style="margin:0 0 6px;font-family:Arial;font-size:12px;color:#374151;">
              ${c.footer_note}
            </p>
            <p style="margin:0;font-family:Arial;font-size:11px;color:#1e2d45;font-weight:600;">
              ${c.copyright}
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}
