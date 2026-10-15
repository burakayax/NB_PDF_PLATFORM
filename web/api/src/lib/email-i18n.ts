import { AI_MONTHLY_CREDITS } from "./plan-catalogue.js";

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
    welcome_intro: "PDF PLATFORM'a katıldığınız için teşekkür ederiz. Hesabınız şu andan itibaren kullanıma açık.",
    welcome_gift_title: (n: number) => `${n} ücretsiz yapay zekâ işlemi hesabınıza tanımlandı`,
    welcome_gift_body:
      "Belgelerinizi özetlemek, faturalardan veri çıkarmak ya da belgenizle sohbet etmek için kullanabilirsiniz. Süre sınırı yoktur; çalışma alanında bir yapay zekâ aracını açmanız yeterlidir.",
    welcome_section: "Hesabınızla neler yapabilirsiniz",
    welcome_points: (dailyLimit: number): string[] => [
      "<strong>Cihazınızda sınırsız:</strong> birleştirme, bölme, döndürme, sayfa silme ve sıralama, görselden PDF. Dosyalarınız cihazınızdan çıkmaz.",
      `<strong>Günde ${dailyLimit} sunucu işlemi:</strong> sıkıştırma, Word ↔ PDF ve PDF → JPG dönüşümleri.`,
      "<strong>Size özel çalışma alanı:</strong> favori araçlarınızı yıldızlayın, imzanızı kaydedip tek tıkla kullanın, son işlemlerinizi görün, taradığınız belgeleri saklayın.",
    ],
    welcome_cta: "Çalışma alanını aç",
    welcome_footer: "Bu e-postayı PDF PLATFORM hesabı oluşturduğunuz için aldınız.",
    welcome_subject: (product: string, giftCredits = 0) =>
      giftCredits > 0 ? `Hesabınız hazır — ${giftCredits} ücretsiz yapay zekâ işleminiz tanımlandı` : `${product}'a hoş geldiniz`,
    welcome_preheader: (giftCredits: number) =>
      giftCredits > 0 ? `${giftCredits} ücretsiz yapay zekâ işlemi ve günlük işlem hakkınız hesabınızda hazır.` : "Hesabınız kullanıma hazır.",

    // Yaşam-döngüsü (lifecycle) drip serisi — dönüşmeyen FREE kullanıcılar
    lifecycle: {
      tips: {
        eyebrow: "İpuçları",
        title: "PDF işlerinizi hızlandırın",
        intro: "Hesabınızdan en iyi şekilde yararlanmanız için birkaç ipucu.",
        body: "Çoğu kullanıcı ilk haftada şu araçlarla zaman kazanıyor. Kurulum yok — birleştirme gibi araçlar tamamen tarayıcınızda çalışır (dosyanız yüklenmez); sunucuda işlenen araçlarda dosyalar işlemden sonra kalıcı olarak silinir:",
        bullets: [
          "<strong>Birleştir & Böl</strong> — cihazınızda sınırsız; sayfaları saniyeler içinde düzenleyin",
          "<strong>Sıkıştır</strong> — e-postaya sığması için dosya boyutunu küçültün (günlük hakkınızdan düşer)",
          "<strong>Word ↔ PDF, PDF → JPG</strong> — dönüştürün (günlük hakkınızdan düşer)",
        ],
        cta: "Bir aracı dene",
        footer: "İhtiyacınız olan aracı çalışma alanından bulabilirsiniz.",
        subject: (product: string) => `${product} ile 3 hızlı kazanım`,
      },
      value: {
        eyebrow: "Yükseltme",
        title: "Belgelerinizi yapay zekâyla konuşturun",
        intro: "Cihazınızdaki araçlar sınırsız — asıl zaman kazancı yapay zekâda.",
        body: "Hesabınıza tanımlanan ücretsiz yapay zekâ işlemleriniz bittiyse, Pro ile devam edebilirsiniz:",
        bullets: [
          `<strong>Ayda ${AI_MONTHLY_CREDITS.PRO} yapay zekâ işlemi</strong> — uzun sözleşme ve raporları saniyeler içinde özetleyin`,
          "<strong>Veri Çıkar</strong> — fatura ve tablolardan Excel'e hazır veri",
          "<strong>Çeviri & Karşılaştırma</strong> — belgeleri çevirin, iki sürümün farkını bulun",
          "<strong>Günlük işlem sınırı yok</strong>, toplu işlem, daha büyük dosyalar ve API erişimi",
        ],
        cta: "Planları gör",
        footer: "Aboneliğiniz kendiliğinden yenilenmez.",
        subject: (product: string) => `${product} ile belgelerde yapay zekânın gücü`,
      },
      winback: {
        eyebrow: "Size özel",
        title: "Geri dönmeniz için küçük bir teşvik",
        intro: "Hâlâ ücretsiz plandasınız — belki doğru an şimdidir.",
        body: "Yükseltmeyi düşünüyorsanız, bu size özel indirim tam zamanı. PDF özetleme, faturadan veri çıkarma, çeviri ve toplu işlem — yapay zekâ araçlarının tamamı sizi bekliyor.",
        bullets: undefined as string[] | undefined,
        couponLabel: "İndirim kodunuz",
        cta: "İndirimi kullan",
        footer: "Bu teklif sınırlı süre geçerlidir. Aboneliğiniz kendiliğinden yenilenmez.",
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
    welcome_title: "Your account is ready",
    welcome_intro: "Thank you for joining PDF PLATFORM. Your account is ready to use.",
    welcome_gift_title: (n: number) => `${n} free AI operations have been added to your account`,
    welcome_gift_body:
      "Use them to summarize documents, extract data from invoices or chat with your document. They never expire — just open an AI tool in your workspace.",
    welcome_section: "What you can do with your account",
    welcome_points: (dailyLimit: number): string[] => [
      "<strong>Unlimited on your device:</strong> merge, split, rotate, delete and reorder pages, image to PDF. Your files never leave your device.",
      `<strong>${dailyLimit} server operations a day:</strong> compress, Word ↔ PDF and PDF → JPG conversions.`,
      "<strong>A workspace of your own:</strong> star your favorite tools, save your signature for one-click use, see your recent operations and keep your scanned documents.",
    ],
    welcome_cta: "Open workspace",
    welcome_footer: "You received this email because you created a PDF PLATFORM account.",
    welcome_subject: (product: string, giftCredits = 0) =>
      giftCredits > 0 ? `Your account is ready — ${giftCredits} free AI operations added` : `Welcome to ${product}`,
    welcome_preheader: (giftCredits: number) =>
      giftCredits > 0 ? `${giftCredits} free AI operations and your daily allowance are ready.` : "Your account is ready to use.",

    lifecycle: {
      tips: {
        eyebrow: "Tips",
        title: "Speed up your PDF work",
        intro: "A few tips to get the most out of your account.",
        body: "Most users save time in their first week with these tools. No install — tools like merge run entirely in your browser (nothing is uploaded); for server-side operations, files are permanently deleted after processing:",
        bullets: [
          "<strong>Merge & Split</strong> — unlimited on your device; reorganize pages in seconds",
          "<strong>Compress</strong> — shrink files to fit email limits (uses your daily allowance)",
          "<strong>Word ↔ PDF, PDF → JPG</strong> — convert (uses your daily allowance)",
        ],
        cta: "Try a tool",
        footer: "Find the tool you need anytime in your workspace.",
        subject: (product: string) => `3 quick wins with ${product}`,
      },
      value: {
        eyebrow: "Upgrade",
        title: "Put AI to work on your documents",
        intro: "The tools on your device are unlimited — the real time-saver is AI.",
        body: "If you have used the free AI operations on your account, you can continue with Pro:",
        bullets: [
          `<strong>${AI_MONTHLY_CREDITS.PRO} AI operations a month</strong> — long contracts and reports summarized in seconds`,
          "<strong>Extract Data</strong> — invoices and tables straight into Excel",
          "<strong>Translate & Compare</strong> — translate docs, diff two versions",
          "<strong>No daily limit</strong>, batch processing, larger files and API access",
        ],
        cta: "View plans",
        footer: "Subscriptions never renew automatically.",
        subject: (product: string) => `The power of AI on your documents with ${product}`,
      },
      winback: {
        eyebrow: "Just for you",
        title: "A little nudge to come back",
        intro: "You're still on the free plan — maybe now is the right time.",
        body: "If you've been thinking about upgrading, this discount is perfect timing. PDF summarization, data extraction from invoices, translation and batch processing — the full AI toolkit is waiting.",
        bullets: undefined as string[] | undefined,
        couponLabel: "Your discount code",
        cta: "Use the discount",
        footer: "This offer is valid for a limited time. Subscriptions never renew automatically.",
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
