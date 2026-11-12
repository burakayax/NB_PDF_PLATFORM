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
        title: "Yapay zekâ araçları hakkında",
        intro: "Yapay zekâ araçları ücretlidir; koşulları aşağıda.",
        body: "Yapay zekâ araçları için Başlangıç ya da üzeri bir plan veya satın alınmış kredi gerekir. Ücretsiz hesaba kayıtta bir kez tanımlanan hediye işlemler bittiyse devam etmek için plan seçebilirsin:",
        bullets: [
          `<strong>Pro: ayda ${AI_MONTHLY_CREDITS.PRO} yapay zekâ işlemi</strong> (Başlangıç ${AI_MONTHLY_CREDITS.STARTER}, Plus ${AI_MONTHLY_CREDITS.PLUS})`,
          "<strong>Yapay zekâ araçları:</strong> PDF Özetle, Sohbet, Çeviri, Karşılaştırma, Veri Çıkar",
          "<strong>Plus ve üzeri:</strong> günlük işlem sınırı yok",
          "<strong>Toplu işlem ve API erişimi</strong> Pro ve üzeri planlardadır",
        ],
        cta: "Planları gör",
        footer: "Aboneliğiniz kendiliğinden yenilenmez.",
        subject: (product: string) => `${product} — yapay zekâ araçları ve planlar`,
      },
      winback: {
        eyebrow: "Size özel",
        title: "Plan seçenekleri",
        intro: "Ücretsiz hesabın böyle kalabilir; ihtiyacın artarsa seçenekler var.",
        body: "Ücretsiz hesapta cihazında çalışan araçlar sınırsızdır. Daha fazla sunucu işlemi ya da yapay zekâ araçları gerekirse planlara bakabilirsin.",
        bullets: undefined as string[] | undefined,
        couponLabel: "İndirim kodunuz",
        cta: "İndirimi kullan",
        footer: "Aboneliğiniz kendiliğinden yenilenmez.",
        subject: (product: string) => `${product} — plan seçenekleri`,
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
        title: "About the AI tools",
        intro: "AI tools are paid; the conditions are below.",
        body: "AI tools need a Starter-or-higher plan or purchased credits. If the free operations given once at sign-up are used up, you can pick a plan to continue:",
        bullets: [
          `<strong>Pro: ${AI_MONTHLY_CREDITS.PRO} AI operations a month</strong> (Starter ${AI_MONTHLY_CREDITS.STARTER}, Plus ${AI_MONTHLY_CREDITS.PLUS})`,
          "<strong>AI tools:</strong> Summarize, Chat, Translate, Compare, Extract Data",
          "<strong>Plus and above:</strong> no daily limit",
          "<strong>Batch processing and API access</strong> are on Pro and above",
        ],
        cta: "View plans",
        footer: "Subscriptions never renew automatically.",
        subject: (product: string) => `${product} — AI tools and plans`,
      },
      winback: {
        eyebrow: "Just for you",
        title: "Plan options",
        intro: "Your free account can stay as it is; options are here if your needs grow.",
        body: "On a free account the tools that run on your device are unlimited. If you need more server operations or the AI tools, you can look at the plans.",
        bullets: undefined as string[] | undefined,
        couponLabel: "Your discount code",
        cta: "Use the discount",
        footer: "Subscriptions never renew automatically.",
        subject: (product: string) => `${product} — plan options`,
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

/**
 * Karşılama satırı. Ad bilinmiyorsa "Merhaba Merhaba," gibi saçma bir çıktı üretmemek için
 * yalnızca "Merhaba," yazar. (Çağıranlar ad yoksa boş ya da eski yedek değerleri verebilir.)
 */
export function greetingHtml(locale: Locale, name: string | null | undefined): string {
  const n = (name ?? "").trim();
  const placeholder = n === "" || n === "Merhaba" || n === "there";
  if (placeholder) return locale === "tr" ? "Merhaba," : "Hi,";
  const safe = n.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return emailT[locale].greeting(safe);
}
