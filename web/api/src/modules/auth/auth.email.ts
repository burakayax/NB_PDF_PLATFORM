import { renderCorporateEmail, ctaButton, detailTable, calloutBox, para, sectionTitle, EMAIL_COLORS } from "../../lib/email-layout.js";
import { escapeHtml } from "../../lib/email-html.js";
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
  fullName?: string | null;
  authProvider?: string | null;
  verified?: boolean;
  country?: string | null;
  city?: string | null;
  phone?: string | null;
  language?: string | null;
  marketingConsent?: boolean;
  totalUsers?: number;
  todayUsers?: number;
  /** Verilirse "Yönetim panelinde aç" düğmesi eklenir. */
  adminUrl?: string;
};

export function createVerificationEmailTemplate({
  verificationUrl,
  productName,
  expiresInHours,
  locale = "tr",
}: VerificationEmailTemplateInput) {
  const t = emailT[locale];
  const safeProduct = escapeHtml(productName);
  const href = escapeHtml(verificationUrl);
  const tr = locale === "tr";
  const c = EMAIL_COLORS;

  const html = renderCorporateEmail({
    eyebrow: tr ? "Hesap güvenliği" : "Account security",
    title: t.verify_title,
    intro: t.verify_body,
    bodyHtml: `
      ${ctaButton(href, t.verify_cta)}
      ${para(
        tr
          ? `Bu bağlantı güvenlik nedeniyle <strong>${expiresInHours} saat</strong> boyunca geçerlidir.`
          : `For security reasons this link is valid for <strong>${expiresInHours} hours</strong>.`,
      )}
      ${sectionTitle(t.verify_fallback)}
      <div style="padding:12px 14px;border:1px solid ${c.line};border-radius:8px;background:${c.soft};font-size:12px;line-height:1.6;color:${c.muted};word-break:break-all;">
        <a href="${href}" style="color:${c.brand};text-decoration:none;">${href}</a>
      </div>
      <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${c.faint};">${t.verify_footer_note}</p>
    `,
    footerText: tr
      ? "Bu e-postayı PDF PLATFORM hesabı oluşturulurken bu adres girildiği için aldınız."
      : "You received this email because this address was used to create a PDF PLATFORM account.",
    productName: safeProduct,
    preheader: tr ? "Hesabınızı etkinleştirmek için e-posta adresinizi doğrulayın." : "Verify your email address to activate your account.",
  });

  const text = [
    t.verify_subject,
    "",
    t.verify_title,
    "",
    t.verify_body,
    "",
    verificationUrl,
    "",
    tr ? `Bu bağlantı ${expiresInHours} saat içinde sona erer.` : `This link expires in ${expiresInHours} hours.`,
    "",
    t.verify_footer_note,
    `${productName} © ${new Date().getFullYear()}`,
  ].join("\n");

  return { subject: t.verify_subject, html, text };
}

/** Yönetici bildiriminde gösterilecek tarih: Türkiye saatiyle okunur biçimde. */
function formatIstanbul(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function createAdminNotificationEmailTemplate({
  userEmail,
  registeredAt,
  productName,
  fullName,
  authProvider,
  verified,
  country,
  city,
  phone,
  language,
  marketingConsent,
  totalUsers,
  todayUsers,
  adminUrl,
}: AdminNotificationEmailTemplateInput) {
  const safeEmail = escapeHtml(userEmail);
  const safeProduct = escapeHtml(productName);
  const displayName = (fullName ?? "").trim();
  const subject = displayName
    ? `Yeni üye: ${displayName} (${userEmail})`
    : `Yeni üye kaydı — ${userEmail}`;
  const via = authProvider === "google" ? "Google hesabı" : "E-posta ve şifre";
  const place = [city, country].map((x) => (x ?? "").trim()).filter(Boolean).join(", ");
  const c = EMAIL_COLORS;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Ad Soyad", value: displayName ? escapeHtml(displayName) : "—" },
    { label: "E-posta", value: safeEmail },
    { label: "Kayıt yöntemi", value: via },
    {
      label: "Durum",
      value: verified
        ? `<span style="color:${c.ok};font-weight:700;">E-posta doğrulandı</span>`
        : `<span style="color:#b45309;font-weight:700;">E-posta doğrulaması bekleniyor</span>`,
    },
    { label: "Kayıt zamanı", value: escapeHtml(formatIstanbul(registeredAt)) },
  ];
  if (place) rows.push({ label: "Konum", value: escapeHtml(place) });
  if (phone && phone.trim()) rows.push({ label: "Telefon", value: escapeHtml(phone.trim()) });
  if (language) rows.push({ label: "Dil", value: language === "tr" ? "Türkçe" : "İngilizce" });
  rows.push({ label: "Pazarlama izni", value: marketingConsent ? "Verdi" : "Vermedi" });

  const stats =
    typeof totalUsers === "number"
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 18px;border-collapse:separate;">
           <tr>
             <td style="width:50%;padding:14px 16px;border:1px solid ${c.line};border-radius:10px 0 0 10px;background:#ffffff;">
               <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${c.muted};">Toplam üye</div>
               <div style="margin-top:4px;font-size:26px;font-weight:700;color:${c.ink};">${totalUsers}</div>
             </td>
             <td style="width:50%;padding:14px 16px;border:1px solid ${c.line};border-left:0;border-radius:0 10px 10px 0;background:#ffffff;">
               <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${c.muted};">Bugünkü kayıt</div>
               <div style="margin-top:4px;font-size:26px;font-weight:700;color:${c.ink};">${typeof todayUsers === "number" ? todayUsers : "—"}</div>
             </td>
           </tr>
         </table>`
      : "";

  const html = renderCorporateEmail({
    eyebrow: "Yönetici bildirimi",
    title: displayName ? `Yeni üye: ${escapeHtml(displayName)}` : "Yeni bir üye kaydoldu",
    intro: `${safeProduct}'a ${via === "Google hesabı" ? "Google hesabıyla" : "e-posta ve şifreyle"} yeni bir hesap açıldı.`,
    bodyHtml: `
      ${stats}
      ${detailTable(rows)}
      ${adminUrl ? ctaButton(escapeHtml(adminUrl), "Yönetim panelinde aç") : ""}
      <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${c.faint};">Bu e-postayı yanıtlarsanız yanıt doğrudan üyeye gider.</p>
    `,
    footerText: `Bu bildirim ${safeProduct} yöneticisine otomatik olarak gönderildi.`,
    productName: safeProduct,
    preheader: `${userEmail} kaydoldu${typeof totalUsers === "number" ? ` — toplam ${totalUsers} üye` : ""}.`,
  });

  const text = [
    subject,
    "",
    ...rows.map((r) => `${r.label}: ${r.value.replace(/<[^>]+>/g, "")}`),
    ...(typeof totalUsers === "number" ? ["", `Toplam üye: ${totalUsers}`, `Bugünkü kayıt: ${todayUsers ?? "-"}`] : []),
    ...(adminUrl ? ["", `Yönetim paneli: ${adminUrl}`] : []),
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
