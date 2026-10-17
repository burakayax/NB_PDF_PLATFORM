// Fiyatlandırma SSS soruları — ana sayfadaki tek SSS bölümünde ("Ödeme ve planlar" grubu) gösterilir
// ve FAQPage şemasına landing.ts üzerinden birleşik listeyle girer.
export type PricingFaqItem = { question: string; answer: string };

export const PRICING_FAQ_TR: PricingFaqItem[] = [
  {
    question: "7 günlük para iade garantisi nasıl çalışır?",
    answer: "İlk ödemenizden itibaren 7 gün içinde, herhangi bir neden göstermeksizin tam iade talep edebilirsiniz. İade talebinizi destek ekibimize iletmeniz yeterli — işlem 3–5 iş günü içinde tamamlanır. 7 günü geçtikten sonra iptal ederseniz mevcut abonelik döneminizin sonuna kadar tüm özelliklere erişiminiz kesintisiz devam eder; paranız boşa gitmez.",
  },
  {
    question: "Aboneliğim kendiliğinden yenilenir mi?",
    answer: "Hayır. Aboneliğiniz satın aldığınız dönemle sınırlıdır ve kendiliğinden yenilenmez; kartınızdan izniniz olmadan çekim yapılmaz. Bitmeden size e-posta ile hatırlatırız. Devam etmek isterseniz yenilemeyi hesabınızdan onaylarsınız; istemezseniz hiçbir şey yapmanız gerekmez, hesabınız Ücretsiz plana geçer ve verileriniz silinmez. Dönem içinde iptal ederseniz ilk 7 gün tam iade, sonrasında dönem sonuna kadar kullanım devam eder.",
  },
  {
    question: "Ücretsiz planda kredi kartı gerekli mi?",
    answer: "Hayır. Ücretsiz plan için herhangi bir ödeme bilgisi istenmez. Hesap oluşturarak hemen başlayabilirsiniz.",
  },
  {
    question: "Başlangıç planı yıllık seçenek sunuyor mu?",
    answer: "Hayır. Başlangıç planı yalnızca aylık olarak faturalandırılır; istediğiniz ay iptal edebilirsiniz. Plus, Pro ve Business için aylık/yıllık seçeneği mevcuttur.",
  },
  {
    question: "Pro ve Business arasındaki fark nedir?",
    answer: "Pro bireysel güç kullanıcıları için optimize edilmiştir. Business ise çok kullanıcılı ekipler, kurumsal onay akışları ve organizasyon genelinde PDF yönetimi için tasarlanmıştır.",
  },
  {
    question: "Yıllık plana geçince hemen mi uygulanır?",
    answer: "Evet. Yıllık plana geçiş anında aktif olur ve yıllık toplam ücret tek seferinde tahsil edilir. Kalan aylık ücret orantılı olarak hesaplanır.",
  },
  {
    question: "İşlenen dosyalarım ne kadar süre saklanıyor?",
    answer: "Web uygulamasında işlenen dosyalar 1 saat sonra kalıcı olarak silinir. Yakında çıkacak Windows masaüstü uygulamasında dosyalar hiç sunucuya gönderilmeyecek — tüm işlem cihazınızda gerçekleşecek.",
  },
];

export const PRICING_FAQ_EN: PricingFaqItem[] = [
  {
    question: "How does the 7-day money-back guarantee work?",
    answer: "Within 7 days of your first payment, you can request a full refund for any reason. Just contact our support team — refunds are processed within 3–5 business days. If you cancel after 7 days, you keep full access until your current billing period ends, so your money never goes to waste.",
  },
  {
    question: "Does my subscription renew automatically?",
    answer: "No. Your subscription is limited to the period you bought and never renews on its own; your card is not charged without your confirmation. We email you a reminder before it ends. If you want to continue, you confirm the renewal from your account; if not, do nothing — your account returns to the Free plan and your data is never deleted. If you cancel during the period, you get a full refund in the first 7 days, and keep access until the period ends after that.",
  },
  {
    question: "Do I need a credit card for the free plan?",
    answer: "No. No payment information is required for the Free plan. Simply create an account and start immediately.",
  },
  {
    question: "Does the Starter plan offer a yearly option?",
    answer: "No. Starter is billed monthly only and can be cancelled any month. Plus, Pro and Business offer both monthly and yearly billing.",
  },
  {
    question: "What's the difference between Pro and Business?",
    answer: "Pro is optimized for individual power users. Business is designed for multi-user teams, enterprise approval workflows, and organization-wide PDF management.",
  },
  {
    question: "Does switching to yearly take effect immediately?",
    answer: "Yes. Switching to yearly is instant and the annual total is charged in one payment. Any remaining monthly balance is calculated on a pro-rated basis.",
  },
  {
    question: "How long are my processed files stored?",
    answer: "Files processed via the web app are permanently deleted after 1 hour. With the upcoming Windows desktop app, files will never leave your device — all processing happens locally.",
  },
];
