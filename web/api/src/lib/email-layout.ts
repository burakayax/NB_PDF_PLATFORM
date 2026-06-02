import { env } from "../config/env.js";

type CorporateEmailLayoutInput = {
  eyebrow: string;
  title: string;
  intro: string;
  bodyHtml: string;
  footerText: string;
  productName: string;
  /** Logo resim URL'i — boşsa metin logosu gösterilir. */
  logoUrl?: string;
};

/** Tüm email şablonları için ortak dark-mode koyu arka planlı layout. */
export function renderCorporateEmail({
  eyebrow,
  title,
  intro,
  bodyHtml,
  footerText,
  productName,
  logoUrl,
}: CorporateEmailLayoutInput): string {
  const origin = (env as any).FRONTEND_ORIGIN?.replace(/\/$/, "") ?? "";
  const resolvedLogo = logoUrl ?? (origin ? `${origin}/logo.png` : "");

  const logoImg = resolvedLogo
    ? `<img src="${resolvedLogo}" width="40" height="40" alt="${productName}" style="display:block;border-radius:10px;border:1px solid rgba(139,92,246,0.3);" />`
    : `<div style="width:40px;height:40px;border-radius:10px;border:1px dashed #8b5cf6;background:rgba(139,92,246,0.12);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;letter-spacing:0.1em;color:#a78bfa;text-transform:uppercase;">PDF</div>`;

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${productName}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1e;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#0a0f1e;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0"
        style="max-width:620px;width:100%;background:#111827;border:1px solid #1e2d45;border-radius:20px;overflow:hidden;">

        <!-- HEADER GRADIENT -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1040 0%,#0d1b35 50%,#0a1628 100%);padding:32px 36px 28px;border-bottom:1px solid #1e2d45;">

            <!-- Logo + Product -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td style="vertical-align:middle;padding-right:14px;">
                  ${logoImg}
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-size:15px;font-weight:800;color:#e2e8f0;letter-spacing:0.04em;">${productName}</div>
                  <div style="font-size:11px;font-weight:600;color:#8b5cf6;letter-spacing:0.15em;text-transform:uppercase;margin-top:3px;">${eyebrow}</div>
                </td>
              </tr>
            </table>

            <!-- Title -->
            <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;line-height:1.25;
              background:linear-gradient(135deg,#f8fafc 0%,#c4b5fd 100%);
              -webkit-background-clip:text;-webkit-text-fill-color:transparent;
              background-clip:text;color:#f8fafc;">${title}</h1>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#94a3b8;">${intro}</p>

          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:32px 36px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:20px 36px 24px;border-top:1px solid #1e2d45;background:#0d1117;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td>
                  <div style="font-size:12px;font-weight:700;color:#475569;letter-spacing:0.05em;">NB GLOBAL STUDIO</div>
                  <div style="margin-top:6px;font-size:12px;line-height:1.6;color:#374151;">${footerText}</div>
                </td>
                <td align="right" style="vertical-align:top;">
                  <div style="font-size:11px;color:#1e2d45;font-weight:600;">PDF PLATFORM</div>
                  <div style="font-size:10px;color:#1e2d45;margin-top:2px;">© 2026</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}

/**
 * CTA butonu — gradient mor/indigo tasarım.
 * Inline CSS ile hover simüle edilmiş (email clientlarda JS çalışmaz).
 */
export function ctaButton(url: string, label: string): string {
  return `<a href="${url}" target="_blank"
    style="display:inline-block;margin:20px 0 0;padding:14px 30px;
      background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);
      color:#ffffff;font-weight:800;text-decoration:none;font-size:15px;
      border-radius:12px;letter-spacing:0.02em;
      box-shadow:0 4px 20px rgba(124,58,237,0.4);
      border:1px solid rgba(167,139,250,0.3);"
  >${label}</a>`;
}

/** Detay tablosu (fatura/hesap bilgileri). */
export function detailTable(rows: Array<{ label: string; value: string }>): string {
  const rowsHtml = rows.map(({ label, value }, i) => `
    <tr>
      <td style="padding:${i === 0 ? "0" : "16px"} 0 6px;font-size:11px;font-weight:700;
        letter-spacing:0.1em;color:#6b7280;text-transform:uppercase;">${label}</td>
    </tr>
    <tr>
      <td style="padding:0 0 ${i === rows.length - 1 ? "0" : "16px"};font-size:16px;
        line-height:1.6;color:#f1f5f9;
        ${i < rows.length - 1 ? "border-bottom:1px solid #1e2d45;" : ""}">${value}</td>
    </tr>
  `).join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border-collapse:collapse;border:1px solid #1e2d45;
        border-radius:16px;background:linear-gradient(135deg,#0f172a 0%,#0d1b35 100%);
        padding:20px 24px;">
      <tbody>${rowsHtml}</tbody>
    </table>`;
}
