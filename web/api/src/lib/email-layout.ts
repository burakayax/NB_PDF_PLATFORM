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
  /** Verilirse footer'da "Ticari e-postalardan çık" bağlantısı gösterilir (pazarlama e-postaları için hukuki gereklilik). */
  unsubscribeUrl?: string;
};

/**
 * Tüm email şablonları için ortak AÇIK (light) kurumsal layout.
 * Araştırmaya dayalı: açık arka plan + yüksek kontrastlı turuncu CTA dönüşümü artırır.
 */
export function renderCorporateEmail({
  eyebrow,
  title,
  intro,
  bodyHtml,
  footerText,
  productName,
  logoUrl,
  unsubscribeUrl,
}: CorporateEmailLayoutInput): string {
  const origin = (env as any).FRONTEND_ORIGIN?.replace(/\/$/, "") ?? "";
  const siteUrl = origin || "https://www.pdfplatform.app";
  const resolvedLogo = logoUrl ?? `${siteUrl}/emblem.png`;

  const logoImg = resolvedLogo
    ? `<img src="${resolvedLogo}" height="36" alt="${productName}" style="display:block;height:36px;width:auto;max-width:180px;" />`
    : `<div style="width:36px;height:36px;border-radius:9px;background:#4f46e5;display:inline-block;text-align:center;line-height:36px;font-size:9px;font-weight:800;letter-spacing:0.08em;color:#ffffff;">PDF</div>`;

  // Fiziksel posta adresi — CAN-SPAM (ABD) ve CASL (Kanada) tanıtım e-postalarında ZORUNLU.
  // COMPANY_POSTAL_ADDRESS env'i ile ayarlanır; boşsa satır gizlenir.
  const postalAddress = (process.env.COMPANY_POSTAL_ADDRESS
    ?? "NB Global Studio · Toklu Mah. Devlet Sahil Yolu Cad. Gürpınar Sok. ParkOrman Konutları A Blok Kat:6 D:26, Ortahisar/Trabzon, Türkiye").trim();
  const addressLine = unsubscribeUrl && postalAddress
    ? `<div style="margin-top:6px;font-size:11px;line-height:1.6;color:#94a3b8;">${postalAddress}</div>`
    : "";
  const unsubscribeLine = unsubscribeUrl
    ? `<div style="margin-top:10px;font-size:11px;line-height:1.6;color:#94a3b8;">Bu bir tanıtım e-postasıdır. <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">E-posta aboneliğinden çık</a>.</div>${addressLine}`
    : "";

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${productName}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f9;font-family:-apple-system,Segoe UI,Roboto,Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background-color:#eef2f9;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:36px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.06);">

        <!-- ÜST AKSAN ŞERİDİ (marka) -->
        <tr><td style="height:4px;background:linear-gradient(90deg,#06b6d4 0%,#4f46e5 100%);font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- HEADER -->
        <tr>
          <td style="padding:28px 34px 20px;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  <a href="${siteUrl}" target="_blank" style="text-decoration:none;">${logoImg}</a>
                </td>
                <td style="vertical-align:middle;">
                  <a href="${siteUrl}" target="_blank" style="text-decoration:none;">
                    <div style="font-size:15px;font-weight:800;color:#0f172a;letter-spacing:0.02em;">${productName}</div>
                  </a>
                  <div style="font-size:11px;font-weight:700;color:#4f46e5;letter-spacing:0.14em;text-transform:uppercase;margin-top:3px;">${eyebrow}</div>
                </td>
              </tr>
            </table>

            <h1 style="margin:0 0 12px;font-size:25px;font-weight:800;line-height:1.28;color:#0f172a;">${title}</h1>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#64748b;">${intro}</p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:6px 34px 32px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:22px 34px 26px;border-top:1px solid #eef2f9;background:#f8fafc;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:top;">
                  <div style="font-size:12px;font-weight:800;color:#334155;letter-spacing:0.04em;">NB GLOBAL STUDIO</div>
                  <div style="margin-top:6px;font-size:12px;line-height:1.6;color:#94a3b8;">${footerText}</div>
                  ${unsubscribeLine}
                </td>
                <td align="right" style="vertical-align:top;">
                  <a href="${siteUrl}" target="_blank" style="font-size:12px;color:#4f46e5;font-weight:700;text-decoration:none;">PDF Platform ↗</a>
                  <div style="font-size:10px;color:#cbd5e1;margin-top:3px;">© 2026</div>
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
 * CTA butonu — araştırmaya dayalı YÜKSEK KONTRAST turuncu (enerji/aciliyet/eylem).
 * Açık arka planla güçlü kontrast → tıklama/dönüşüm artışı. Email clientlarda JS yok,
 * hover simüle edilemez; renk ve gölge dikkat çeker.
 */
export function ctaButton(url: string, label: string): string {
  return `<a href="${url}" target="_blank"
    style="display:inline-block;margin:22px 0 4px;padding:15px 34px;
      background:linear-gradient(135deg,#fb923c 0%,#ea580c 100%);
      color:#ffffff;font-weight:800;text-decoration:none;font-size:15px;
      border-radius:12px;letter-spacing:0.01em;
      box-shadow:0 6px 18px rgba(234,88,12,0.32);">${label} →</a>`;
}

/** Detay tablosu (fatura/hesap bilgileri) — açık tema. */
export function detailTable(rows: Array<{ label: string; value: string }>): string {
  const rowsHtml = rows.map(({ label, value }, i) => `
    <tr>
      <td style="padding:${i === 0 ? "0" : "16px"} 0 6px;font-size:11px;font-weight:700;
        letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">${label}</td>
    </tr>
    <tr>
      <td style="padding:0 0 ${i === rows.length - 1 ? "0" : "16px"};font-size:16px;
        line-height:1.6;color:#0f172a;
        ${i < rows.length - 1 ? "border-bottom:1px solid #e2e8f0;" : ""}">${value}</td>
    </tr>
  `).join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;
        border-radius:14px;background:#f8fafc;padding:20px 24px;">
      <tbody>${rowsHtml}</tbody>
    </table>`;
}
