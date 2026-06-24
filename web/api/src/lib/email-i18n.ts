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

    // Yaşam-döngüsü (lifecycle) drip serisi — dönüşmeyen FREE kullanıcılar
    lifecycle: {
      tips: {
        eyebrow: "İpuçları",
        title: "PDF işlerinizi hızlandırın",
        intro: "Hesabınızdan en iyi şekilde yararlanmanız için birkaç ipucu.",
        body: "Çoğu kullanıcı ilk haftada şu araçlarla zaman kazanıyor. Hepsi tarayıcıda, kurulum yok ve dosyalarınız 1 saat içinde kalıcı olarak silinir:",
        bullets: [
          "<strong>Birleştir & Böl</strong> — sayfaları saniyeler içinde düzenleyin",
          "<strong>Sıkıştır</strong> — e-postaya sığması için dosya boyutunu küçültün",
          "<strong>PDF → Word / Görsel</strong> — düzenlenebilir formata dönüştürün",
        ],
        cta: "Bir aracı dene",
        footer: "İhtiyacınız olan aracı çalışma alanından bulabilirsiniz.",
        subject: (product: string) => `${product} ile 3 hızlı kazanım`,
      },
      value: {
        eyebrow: "Yükseltme",
        title: "Filigranları kaldırın, sınırsız çalışın",
        intro: "Ücretsiz plan harika bir başlangıç — ama daha fazlasına hazır olabilirsiniz.",
        body: "Bir üst plana geçen kullanıcılar şunları açıyor:",
        bullets: [
          "<strong>Filigransız</strong> temiz çıktılar",
          "<strong>Sınırsız günlük işlem</strong> — günlük limite takılmadan",
          "<strong>Tüm araçlar</strong> ve daha büyük dosya boyutları",
          "<strong>Öncelikli işlem kuyruğu</strong> — daha hızlı sonuç",
        ],
        cta: "Planları gör",
        footer: "İstediğiniz zaman iptal edebilirsiniz. 7 gün para iade garantisi.",
        subject: (product: string) => `${product}'ta neleri kaçırıyorsunuz?`,
      },
      winback: {
        eyebrow: "Size özel",
        title: "Geri dönmeniz için küçük bir teşvik",
        intro: "Hâlâ ücretsiz plandasınız — belki doğru an şimdidir.",
        body: "Yükseltmeyi düşünüyorsanız, bu size özel teklifi değerlendirebilirsiniz. Filigransız çıktılar, sınırsız günlük işlem ve tüm araçlar sizi bekliyor.",
        bullets: undefined as string[] | undefined,
        couponLabel: "İndirim kodunuz",
        cta: "İndirimi kullan",
        footer: "Bu teklif sınırlı süre geçerlidir. İstediğiniz zaman iptal edebilirsiniz.",
        subject: (product: string) => `${product} — size özel indirim hazır`,
      },
    },

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

    lifecycle: {
      tips: {
        eyebrow: "Tips",
        title: "Speed up your PDF work",
        intro: "A few tips to get the most out of your account.",
        body: "Most users save time in their first week with these tools. Everything runs in the browser, no install, and your files are permanently deleted within 1 hour:",
        bullets: [
          "<strong>Merge & Split</strong> — reorganize pages in seconds",
          "<strong>Compress</strong> — shrink files to fit email limits",
          "<strong>PDF → Word / Image</strong> — convert to editable formats",
        ],
        cta: "Try a tool",
        footer: "Find the tool you need anytime in your workspace.",
        subject: (product: string) => `3 quick wins with ${product}`,
      },
      value: {
        eyebrow: "Upgrade",
        title: "Remove watermarks, work without limits",
        intro: "The free plan is a great start — but you may be ready for more.",
        body: "Users who upgrade unlock:",
        bullets: [
          "<strong>No watermarks</strong> on your output",
          "<strong>Unlimited daily operations</strong> — no daily cap",
          "<strong>All tools</strong> and larger file sizes",
          "<strong>Priority processing queue</strong> — faster results",
        ],
        cta: "View plans",
        footer: "Cancel anytime. 7-day money-back guarantee.",
        subject: (product: string) => `What you're missing on ${product}`,
      },
      winback: {
        eyebrow: "Just for you",
        title: "A little nudge to come back",
        intro: "You're still on the free plan — maybe now is the right time.",
        body: "If you've been thinking about upgrading, here's an offer just for you. Watermark-free output, unlimited daily operations, and all tools are waiting.",
        bullets: undefined as string[] | undefined,
        couponLabel: "Your discount code",
        cta: "Use the discount",
        footer: "This offer is valid for a limited time. Cancel anytime.",
        subject: (product: string) => `${product} — your personal discount is ready`,
      },
    },

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
