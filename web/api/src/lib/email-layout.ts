import { env } from "../config/env.js";
import { senderIdentity } from "../modules/email/sender-identity.service.js";

/**
 * TİCARİ ELEKTRONİK İLETİDE ZORUNLU KİMLİK BİLGİLERİ.
 *
 * Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik md.7,
 * tanıtım içeren her e-postada şunları arıyor:
 *   - Şirketse: ticaret unvanı + MERSİS numarası
 *   - Esnaf/şahıs işletmesiyse: ad soyad + T.C. kimlik numarası
 *   - Erişilebilir iletişim bilgilerinden EN AZ BİRİ (telefon / e-posta)
 *
 * Değerler yönetim panelinden girilir (E-postalar → Gönderen kimliği) ve
 * veritabanında saklanır. Eksikse ticari e-posta HİÇ gönderilmez — gönderim
 * yolları `assertSenderIdentityComplete` ile korunuyor.
 */
function commercialIdentityLines(): string[] {
  const id = senderIdentity();
  const lines: string[] = [];

  // Kimlik satırı: şirketse unvan + MERSİS, esnafsa ad soyad + T.C. no.
  if (id.legalName && id.entityType === "company" && id.mersisNo) {
    lines.push(`${id.legalName} · MERSİS: ${id.mersisNo}`);
  } else if (id.legalName && id.entityType === "sole" && id.tckn) {
    lines.push(`${id.legalName} · T.C. Kimlik No: ${id.tckn}`);
  } else if (id.legalName) {
    lines.push(id.legalName);
  }

  // İletişim satırı: en az biri yeterli, ikisi varsa ikisi de yazılır.
  const contact = [id.phone, id.contactEmail].filter(Boolean).join(" · ");
  if (contact) lines.push(contact);

  return lines;
}

/**
 * Ticari iletinin konu satırı — niteliği belirleyici ibare eklenir.
 *
 * Yönetmelik md.7: iletinin ticari niteliği içeriğinden açıkça anlaşılmıyorsa,
 * e-postalarda KONU BÖLÜMÜNDE "tanıtım", "kampanya" gibi bir ibare bulunmalı.
 * "Anlaşılıyor mu?" değerlendirmesini her konu için tek tek yapmak yerine
 * ibare her ticari iletiye ekleniyor: yanlış tarafta olmanın maliyeti, konu
 * satırında dört karakter yer kaplamaktan çok daha yüksek.
 */
export function commercialSubject(subject: string, locale: "tr" | "en"): string {
  const tag = locale === "tr" ? "[Tanıtım]" : "[Promotion]";
  // Zaten etiketliyse ikinci kez eklenmez (test gönderimi, yeniden deneme).
  return subject.startsWith(tag) ? subject : `${tag} ${subject}`;
}

type CorporateEmailLayoutInput = {
  eyebrow: string;
  title: string;
  intro: string;
  bodyHtml: string;
  footerText: string;
  productName: string;
  /** Logo resim URL'i — boşsa varsayılan marka amblemi kullanılır. */
  logoUrl?: string;
  /** Verilirse footer'da "Ticari e-postalardan çık" bağlantısı gösterilir (pazarlama e-postaları için hukuki gereklilik). */
  unsubscribeUrl?: string;
  /** Gelen kutusu listesinde konu satırının yanında görünen gizli özet metin (e-posta içinde görünmez). */
  preheader?: string;
};

/** Marka renkleri — e-posta istemcileri CSS değişkenini bilmediği için sabit değerlerle satır içi yazılır. */
export const EMAIL_COLORS = {
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  page: "#f1f5f9",
  soft: "#f8fafc",
  brand: "#4338ca",
  brandDark: "#312e81",
  brandSoft: "#eef2ff",
  ok: "#047857",
} as const;

const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Tüm e-posta şablonları için ortak KURUMSAL layout (açık tema).
 *
 * Tasarım ilkeleri: sade ve ölçülü (emoji/gölge/gradyan yok — Outlook'ta bozulmaz), güçlü tipografik
 * hiyerarşi, tek vurgu rengi (lacivert-indigo), tek ana eylem düğmesi, kurumsal alt bilgi (unvan,
 * adres, iletişim, yasal bağlantılar). Yalnızca tablo + satır içi CSS (e-posta istemcisi uyumu).
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
  preheader,
}: CorporateEmailLayoutInput): string {
  const origin = (env as any).FRONTEND_ORIGIN?.replace(/\/$/, "") ?? "";
  const siteUrl = origin || "https://www.pdfplatform.app";
  const resolvedLogo = logoUrl ?? `${siteUrl}/emblem.png`;
  const c = EMAIL_COLORS;

  const logoImg = resolvedLogo
    ? `<img src="${resolvedLogo}" width="40" height="40" alt="${productName}" style="display:block;width:40px;height:40px;border:0;border-radius:9px;" />`
    : `<div style="width:40px;height:40px;border-radius:9px;background:${c.brand};text-align:center;line-height:40px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#ffffff;">PDF</div>`;

  // Fiziksel posta adresi — CAN-SPAM (ABD) ve CASL (Kanada) tanıtım e-postalarında
  // ZORUNLU. Yönetim panelinden girilir; boşsa satır gizlenir (ve ticari gönderim
  // zaten durur, çünkü eksik sayılıyor).
  const postalAddress = senderIdentity().postalAddress;
  const addressLine = unsubscribeUrl && postalAddress
    ? `<div style="margin-top:6px;font-size:11px;line-height:1.6;color:${c.faint};">${postalAddress}</div>`
    : "";

  // Ticari iletide zorunlu kimlik bilgileri (Yönetmelik md.7) — unvan/MERSİS
  // veya ad-soyad/T.C. no ve en az bir iletişim bilgisi. Yalnız tanıtım
  // e-postalarında gösterilir; işlem e-postalarında gerekmez.
  const identityLine = unsubscribeUrl
    ? commercialIdentityLines()
        .map(
          (line) =>
            `<div style="margin-top:4px;font-size:11px;line-height:1.6;color:${c.faint};">${line}</div>`,
        )
        .join("")
    : "";

  const unsubscribeLine = unsubscribeUrl
    ? `<div style="margin-top:12px;font-size:11px;line-height:1.6;color:${c.faint};">Bu bir tanıtım e-postasıdır. <a href="${unsubscribeUrl}" style="color:${c.muted};text-decoration:underline;">E-posta aboneliğinden çık</a>.</div>${identityLine}${addressLine}`
    : "";

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;">${preheader}${"&nbsp;&zwnj;".repeat(40)}</div>`
    : "";

  const legalLinks = [
    { href: `${siteUrl}/terms`, label: "Hizmet Şartları" },
    { href: `${siteUrl}/privacy`, label: "Gizlilik" },
    { href: `${siteUrl}/kvkk`, label: "KVKK" },
  ]
    .map((l) => `<a href="${l.href}" target="_blank" style="color:${c.muted};text-decoration:none;">${l.label}</a>`)
    .join(`<span style="color:${c.line};padding:0 8px;">|</span>`);

  return `<!DOCTYPE html>
<html lang="tr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${productName}</title>
</head>
<body style="margin:0;padding:0;background-color:${c.page};font-family:${FONT};-webkit-text-size-adjust:100%;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${c.page};border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${c.line};border-radius:12px;border-collapse:separate;overflow:hidden;">

        <!-- Marka şeridi -->
        <tr><td style="height:4px;background-color:${c.brand};font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Üst bilgi: logo + marka -->
        <tr>
          <td style="padding:24px 36px 18px;border-bottom:1px solid ${c.line};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;width:52px;">
                  <a href="${siteUrl}" target="_blank" style="text-decoration:none;">${logoImg}</a>
                </td>
                <td style="vertical-align:middle;">
                  <a href="${siteUrl}" target="_blank" style="text-decoration:none;">
                    <div style="font-family:${FONT};font-size:16px;font-weight:700;color:${c.ink};letter-spacing:0.01em;">${productName}</div>
                  </a>
                  <div style="font-family:${FONT};font-size:12px;color:${c.muted};margin-top:2px;">Belge çözümleri · NB Global Studio</div>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;padding:5px 10px;border:1px solid ${c.line};border-radius:999px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${c.brand};">${eyebrow}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Başlık -->
        <tr>
          <td style="padding:32px 36px 8px;">
            <h1 style="margin:0 0 12px;font-family:${FONT};font-size:26px;font-weight:700;line-height:1.25;color:${c.ink};">${title}</h1>
            <p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.65;color:${c.muted};">${intro}</p>
          </td>
        </tr>

        <!-- İçerik -->
        <tr>
          <td style="padding:16px 36px 36px;font-family:${FONT};">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Alt bilgi -->
        <tr>
          <td style="padding:24px 36px 28px;border-top:1px solid ${c.line};background-color:${c.soft};">
            <div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.06em;color:${c.body};">NB GLOBAL STUDIO</div>
            <div style="margin-top:6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${c.muted};">${footerText}</div>
            <div style="margin-top:12px;font-family:${FONT};font-size:12px;line-height:1.6;">${legalLinks}</div>
            ${unsubscribeLine}
            <div style="margin-top:14px;font-family:${FONT};font-size:11px;line-height:1.5;color:${c.faint};">Bu e-posta otomatik olarak oluşturulmuştur. © ${new Date().getFullYear()} ${productName}</div>
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
 * Ana eylem düğmesi — "bulletproof": arka plan renkli tablo hücresinde, bu yüzden görsel engellense ya da
 * Outlook gibi CSS'i kısıtlayan istemcilerde de düğme görünür kalır. Tek vurgu rengi (marka indigo).
 */
export function ctaButton(url: string, label: string): string {
  const c = EMAIL_COLORS;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
    <tr>
      <td align="center" bgcolor="${c.brand}" style="background-color:${c.brand};border-radius:8px;">
        <a href="${url}" target="_blank"
          style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

/** Detay tablosu (hesap/fatura bilgileri) — etiket solda, değer sağda; sıralı ince çizgiler. */
export function detailTable(rows: Array<{ label: string; value: string }>): string {
  const c = EMAIL_COLORS;
  const rowsHtml = rows
    .map(
      ({ label, value }, i) => `
    <tr>
      <td style="padding:12px 16px;width:38%;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${c.muted};vertical-align:top;${i < rows.length - 1 ? `border-bottom:1px solid ${c.line};` : ""}">${label}</td>
      <td style="padding:12px 16px;font-family:${FONT};font-size:15px;line-height:1.5;color:${c.ink};vertical-align:top;${i < rows.length - 1 ? `border-bottom:1px solid ${c.line};` : ""}">${value}</td>
    </tr>`,
    )
    .join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border-collapse:separate;border:1px solid ${c.line};border-radius:10px;background:${c.soft};">
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

/** Vurgu kutusu — soldaki kalın şerit ve açık zemin; tek önemli duyuru için (hediye, uyarı, kupon). */
export function calloutBox(title: string, bodyHtml: string): string {
  const c = EMAIL_COLORS;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:6px 0 4px;border-collapse:separate;">
    <tr>
      <td style="width:4px;background-color:${c.brand};border-radius:4px 0 0 4px;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:16px 20px;background-color:${c.brandSoft};border-radius:0 10px 10px 0;">
        <div style="font-family:${FONT};font-size:15px;font-weight:700;line-height:1.4;color:${c.brandDark};">${title}</div>
        <div style="margin-top:6px;font-family:${FONT};font-size:14px;line-height:1.65;color:${c.body};">${bodyHtml}</div>
      </td>
    </tr>
  </table>`;
}

/** Onay işaretli madde listesi (özellikler/kazanımlar). */
export function checkList(items: readonly string[]): string {
  const c = EMAIL_COLORS;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:10px 0 4px;">
    ${items
      .map(
        (it) => `<tr>
      <td style="width:26px;padding:6px 0;vertical-align:top;font-family:${FONT};font-size:15px;font-weight:700;color:${c.ok};">&#10003;</td>
      <td style="padding:6px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${c.body};">${it}</td>
    </tr>`,
      )
      .join("")}
  </table>`;
}

/** Bölüm başlığı (küçük, harf aralıklı) — içerik bloklarını ayırır. */
export function sectionTitle(text: string): string {
  return `<div style="margin:26px 0 6px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL_COLORS.muted};">${text}</div>`;
}

/** Normal gövde paragrafı. */
export function para(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.75;color:${EMAIL_COLORS.body};">${html}</p>`;
}
