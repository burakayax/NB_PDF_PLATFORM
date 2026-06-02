/** Email şablonları için TR/EN çeviri haritası. */

export type Locale = "tr" | "en";

export const emailT = {
  tr: {
    // Genel
    greeting: (name: string) => `Merhaba <strong>${name}</strong>,`,
    footer_company: "NB Global Studio",
    footer_auto: "Bu e-posta otomatik olarak oluşturulmuştur. Lütfen yanıtlamayın.",

    // Hoş geldiniz
    welcome_eyebrow: "Hoş Geldiniz",
    welcome_title: "Hesabınız hazır",
    welcome_intro: "PDF PLATFORM ailesine katıldığınız için teşekkürler.",
    welcome_body: () =>
      `Hesabınız aktif ve kullanıma hazır. PDF araçlarına hemen erişebilirsiniz.`,
    welcome_cta: "Çalışma alanını aç",
    welcome_footer: "Araçlarınızı istediğiniz zaman çalışma alanından yönetebilirsiniz.",
    welcome_subject: (product: string) => `${product}'a hoş geldiniz`,

    // Düşük kredi
    low_credit_eyebrow: "Hesap",
    low_credit_title: "Krediniz azalıyor",
    low_credit_intro: "İşlerinizin yarıda kalmaması için size hatırlatmak istedik.",
    low_credit_body: (credits: string) =>
      `Bakiyeniz <strong>${credits}</strong> kredi — azalıyor. Bu hafta kredi paketlerinde özel indirim var.`,
    low_credit_cta: "Kredi al / İndirim",
    low_credit_footer: "Bu otomatik bir hatırlatmadır. Zaten kredi aldıysanız dikkate almayın.",
    low_credit_subject: (product: string) => `Krediniz azalıyor — ${product}`,

    // Newsletter
    newsletter_eyebrow: "Bülten",
    newsletter_title: "Ekibimizden mesaj",
    newsletter_footer: "Bu e-postayı kayıtlı kullanıcı olarak alıyorsunuz.",

    // Doğrulama
    verify_title: "E-posta adresinizi doğrulayın",
    verify_body: "PDF PLATFORM hesabınızı aktifleştirmek için doğrulama yapmanız gerekiyor.",
    verify_note: "Bu bağlantı güvenlik nedeniyle sınırlı süre geçerlidir.",
    verify_cta: "E-postamı doğrula",
    verify_fallback: "Buton çalışmıyorsa bağlantıyı kopyalayın:",
    verify_footer_note: "Bu işlemi siz yapmadıysanız dikkate almayabilirsiniz.",
    verify_subject: "E-posta Doğrulama — PDF PLATFORM",

    // Şifre sıfırlama
    reset_eyebrow: "Güvenlik",
    reset_title: "Şifre sıfırlama kodu",
    reset_intro: "Hesabınız için tek kullanımlık doğrulama kodunuz aşağıdadır. Kodu kimseyle paylaşmayın.",
    reset_note: "Bu kod 15 dakika geçerlidir. İsteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.",
    reset_subject: "PDF PLATFORM — Şifre sıfırlama kodunuz",

    // Hesap silme
    delete_eyebrow: "Hesap",
    delete_title: "Hesap Silindi",
    delete_intro: "PDF PLATFORM hesabınız kalıcı olarak silindi. Tüm verileriniz kaldırıldı.",
    delete_email_label: "E-posta",
    delete_date_label: "Silinme Tarihi",
    delete_note: "Bu işlemi siz yapmadıysanız lütfen destek ekibimizle iletişime geçin.",
    delete_subject: "Hesabınız silindi — PDF PLATFORM",

    // Fatura
    invoice_subject: (company: string, no: string) => `${company} — Fatura #${no}`,
    invoice_eyebrow: "Fatura",
    invoice_title: "Ödemeniz alındı",
    invoice_intro: "Ödemeniz onaylandı ve faturanız düzenlendi.",
    invoice_no_label: "Fatura No",
    invoice_date_label: "Fatura Tarihi",
    invoice_type_label: "Belge Türü",
    invoice_cta: "Faturayı Görüntüle",
    invoice_attached: "Faturanız bu e-postaya PDF olarak eklenmiştir.",
    invoice_contact: "Herhangi bir sorunuz olursa bizimle iletişime geçebilirsiniz.",
    invoice_regards: (company: string) => `Saygılarımızla,<br><strong>${company} Ekibi</strong>`,
  },

  en: {
    greeting: (name: string) => `Hi <strong>${name}</strong>,`,
    footer_company: "NB Global Studio",
    footer_auto: "This email was generated automatically. Please do not reply.",

    welcome_eyebrow: "Welcome",
    welcome_title: "You're in",
    welcome_intro: "Thanks for creating your account.",
    welcome_body: () =>
      `Your account is ready. You can now access all PDF tools.`,
    welcome_cta: "Open workspace",
    welcome_footer: "You can manage your tools anytime from the workspace.",
    welcome_subject: (product: string) => `Welcome to ${product}`,

    low_credit_eyebrow: "Account",
    low_credit_title: "Low credit reminder",
    low_credit_intro: "A quick nudge so you are not stopped mid-work.",
    low_credit_body: (credits: string) =>
      `Your balance is <strong>${credits}</strong> credits — running low. Special offer on credit packs this week.`,
    low_credit_cta: "Get credits / discount",
    low_credit_footer: "This is an automated reminder. You can ignore it if you already topped up.",
    low_credit_subject: (product: string) => `Your credits are low — ${product}`,

    newsletter_eyebrow: "Newsletter",
    newsletter_title: "Message from the team",
    newsletter_footer: "You are receiving this as a registered user.",

    verify_title: "Verify your email address",
    verify_body: "You need to verify your email to activate your PDF PLATFORM account.",
    verify_note: "This link is valid for a limited time for security reasons.",
    verify_cta: "Verify my email",
    verify_fallback: "If the button doesn't work, copy the link:",
    verify_footer_note: "If you did not request this, you can safely ignore this email.",
    verify_subject: "Email Verification — PDF PLATFORM",

    reset_eyebrow: "Security",
    reset_title: "Password reset code",
    reset_intro: "Your one-time verification code is below. Do not share this code with anyone.",
    reset_note: "This code expires in 15 minutes. If you did not request a reset, you can ignore this email.",
    reset_subject: "PDF PLATFORM — Your password reset code",

    delete_eyebrow: "Account",
    delete_title: "Account Deleted",
    delete_intro: "Your PDF PLATFORM account has been permanently deleted. All your data has been removed.",
    delete_email_label: "Email",
    delete_date_label: "Deleted At",
    delete_note: "If you did not request this, please contact our support team immediately.",
    delete_subject: "Your account has been deleted — PDF PLATFORM",

    invoice_subject: (company: string, no: string) => `${company} — Invoice #${no}`,
    invoice_eyebrow: "Invoice",
    invoice_title: "Payment received",
    invoice_intro: "Your payment has been confirmed and your invoice has been issued.",
    invoice_no_label: "Invoice No",
    invoice_date_label: "Invoice Date",
    invoice_type_label: "Document Type",
    invoice_cta: "View Invoice",
    invoice_attached: "Your invoice has been attached as a PDF to this email.",
    invoice_contact: "If you have any questions, feel free to contact us.",
    invoice_regards: (company: string) => `Best regards,<br><strong>${company} Team</strong>`,
  },
} as const;

export type EmailTranslations = typeof emailT.tr;
