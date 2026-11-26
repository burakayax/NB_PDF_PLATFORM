// Hafif SEO verisi: ana sayfa açılışında gereken küçük sabitler ve sayfa başlıkları. Ağır araç metinleri seoToolData.mjs'te.
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  TEK GERÇEK KAYNAK — Tüm sayfa SEO içeriği (TR birincil, EN ikincil)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Bu dosya HEM Node build script'i (scripts/generate-seo-files.mjs) HEM de
 *  React runtime (src/seo/routeSeoConfig.ts) tarafından tüketilir. Böylece
 *  Google'ın gördüğü statik HTML ile tarayıcıda enjekte edilen meta veriler
 *  ASLA birbirinden ayrışmaz.
 *
 *  Anahtarlar `toolSlugForFeature()` çıktısıyla birebir eşleşir (örn. "compress",
 *  "encrypt", "merge-pdf"). Her araç için:
 *    - title       : <title> ve og:title (≤60 karakter, birincil keyword başta)
 *    - description : meta description / snippet (≤155 karakter)
 *    - h1          : sayfadaki görünür <h1> (prerender gövdesine yazılır)
 *    - intro       : H1 altındaki görünür açıklama paragrafı (snippet kaynağı)
 *    - keywords    : ilgili arama terimleri (içerik üretiminde kullanılır)
 *    - faq         : sayfada görünür + FAQPage schema'ya beslenen Soru/Cevap
 *
 *  .d.mts kardeş dosyası TS tarafına tip sağlar; tsc bu .mjs'i derlemez.
 */

export const BRAND = "PDF Platform";

/** Markalı sosyal paylaşım görseli (1200×630 — WhatsApp/OG standardı).
 *  public/og-image.png — amblem + "PDF PLATFORM" + slogan + domain. */
export const DEFAULT_OG_IMAGE = "/og-image.png";
export const DEFAULT_OG_IMAGE_WIDTH = "1200";
export const DEFAULT_OG_IMAGE_HEIGHT = "630";

/** Diziye göre sitemap araç sırası — toolSlugForFeature çıktılarıyla aynı. */
export const TOOL_SLUGS = [
  "split-pdf",
  "merge-pdf",
  "delete-pages",
  "rotate-pdf",
  "organize-pdf",
  "gorsel-sikistir",
  "gorsel-boyutlandir",
  "pdf-kesit-al",
  "compress",
  "pdf-to-word",
  "word-to-pdf",
  "excel-to-pdf",
  "pdf-to-excel",
  "pdf-to-ppt",
  "ppt-to-pdf",
  "pdf-to-image",
  "image-to-pdf",
  "belge-tara",
  "aranabilir-pdf",
  "html-to-pdf",
  "unlock-pdf",
  "watermark",
  "page-numbers",
  "repair-pdf",
  "encrypt",
  "pdf-to-text",
  "flatten-pdf",
  "grayscale-pdf",
  "resize-pdf",
  "flip-pdf",
  "pdf-yatay-yap",
  "alternate-mix-pdf",
  "deskew-pdf",
  "extract-images",
  "pdf-ozetle",
  "pdf-sohbet",
  "pdf-duzenle",
  "pdf-imzala",
  "form-doldur",
  "ustveri-temizle",
  "pdf-qr-ekle",
  "pdf-birlestir-icindekiler",
  "pdf-to-pdfa",
  "sayfa-duzeni",
  "imza-iste",
  "pdf-yorumla",
  "taranmis-pdf-ocr",
  "pdf-veri-cikar",
  "pdf-ceviri",
  "pdf-sinav-olustur",
  "ai-toplu-islem",
  "pdf-karsilastir",
  "hassas-veri-gizle",
  "sozlesme-denetci",
  "udf-to-pdf",
  "pdf-to-udf",
  "word-to-udf",
  "udf-to-word",
  "udf-viewer",
  "image-to-udf",
  "e-basvuru-uyumluluk",
  "dilekce-sablonlari",
  "kimlik-karti-tek-sayfa",
  "pdf-sesli-oku",
  "pdf-ust-alt-bilgi",
  "tiff-to-pdf",
  "txt-to-pdf",
  "markdown-to-pdf",
  "rtf-to-pdf",
  "odt-to-pdf",
  "epub-to-pdf",
  "pdf-to-epub",
  "pdf-to-markdown",
  "ai-fotograf-studyosu",
  "cv-olustur",
];

/**
 * Yapay zekâ araçları halka açılana kadar "Çok yakında" durumunda; araç SAYISINA DAHİLDİR (2026-11-15 kararı: sayı = katalogdaki tüm araçlar,
 * yapay zekâ dahil). Rozet/vaat metinleri için kullanılır; AI açıldığında bu listeyi boşalt.
 */
export const AI_COMING_SOON_SLUGS = [
  "pdf-ozetle",
  "pdf-sohbet",
  "pdf-ceviri",
  "pdf-sinav-olustur",
  "pdf-karsilastir",
  "pdf-veri-cikar",
  "sozlesme-denetci",
  "ai-fotograf-studyosu",
  "ai-toplu-islem",
  "hassas-veri-gizle",
];

/**
 * Sitede kaç araç olduğu — TEK KAYNAK.
 *
 * Bu sayı ana sayfa başlığı, H1, açıklama ve fiyat kartında geçiyordu ve HER
 * BİRİNE ELLE yazılmıştı. Yeni araç eklendiğinde güncellenmesi unutuldu: site
 * 46 araç sunarken Google'a ve ziyaretçiye "45 araç" diyordu. Artık listeden
 * türetiliyor, kendiliğinden doğru kalıyor.
 */
export const ARAC_SAYISI = TOOL_SLUGS.length;


/**
 * Başlığa marka ekini YALNIZCA 60 karakterlik görünür sınıra sığdığında ekler.
 *
 * Google arama sonucunda başlığı ~60 karakterde keser. Marka eki 15 karakter
 * yer kaplıyordu ve 34 araç/ticari sayfanın başlığını sınırın dışına taşırıp
 * markayı zaten görünmez hâle getiriyordu (site geneli denetimle ölçüldü).
 * Marka adı og:site_name, yapısal veri ve alan adında zaten görünür.
 */
export const markaEkle = (title) =>
  title.length + " | ".length + BRAND.length <= 60 ? `${title} | ${BRAND}` : title;

export const T = (title, description, h1, intro, keywords, faq) => ({
  title: markaEkle(title),
  description,
  h1,
  intro,
  keywords,
  faq,
});

// ─── Landing / ana sayfa ──────────────────────────────────────────────────────
export const LANDING_SEO = {
  tr: {
    /**
     * BAŞLIK VE AÇIKLAMA ÖLÇÜLEREK YAZILDI.
     *
     * Google otomatik tamamlama (tr) popülerlik sırasıyla döner. "pdf" için ilk
     * sıralar: birleştirme → to word → küçültme → dönüştürücü → to jpg →
     * düzenleme → to excel. Eski metinde en çok aranan İKİNCİ ifade ("Word'e
     * çevirme") hiç geçmiyordu.
     *
     * Ayrıca araç sayısı yazılıyor: sayılan üç-dört aracı okuyan kişi sitede
     * yalnızca onların olduğunu sanıyordu (kullanıcı bildirdi).
     */
    // Marka başa alındı: markaEkle sığmayınca markayı düşürüyordu; 'pdf platform' aramasında
    // Google başlıkta markayı hiç görmüyordu. Anahtar kelimeler (birleştir, Word, küçült) korunur.
    title: `${BRAND}: PDF Birleştir, Word'e Çevir, Küçült — ${ARAC_SAYISI} Araç`,
    description:
      `PDF birleştirme, Word'e çevirme, küçültme, JPG'ye çevirme, düzenleme ve toplam ${ARAC_SAYISI} araç. Üyeliksiz ve ücretsiz; birleştirme tarayıcınızda çalışır, kurulum yok.`,
    h1: `PDF Birleştir, Word'e Çevir, Küçült ve Düzenle — ${ARAC_SAYISI} PDF Aracı Tek Platformda`,
    intro:
      `PDF Platform ${ARAC_SAYISI} araç sunar: PDF birleştirme, ayırma, küçültme (sıkıştırma), Word/Excel/PowerPoint ve JPG dönüştürme, düzenleme, imzalama, form doldurma, tarama, filigran ve şifreleme. Birleştirme ve görselden PDF gibi araçlar üyelik gerektirmeden, tamamen tarayıcınızda çalışır — dosyalarınız cihazınızdan hiç çıkmaz, anında ve 80 MB'a kadar ücretsizdir. Kurulum gerekmez.`,
    faq: [
      { q: "PDF birleştirmek için üye olmam gerekiyor mu?", a: "Hayır. Birleştirme, görselden PDF gibi temel araçları üyelik veya kayıt olmadan, ücretsiz ve sınırsız kullanabilirsiniz. Üyelik yalnızca işlem geçmişini kaydetmek, Word/Excel dönüştürme gibi gelişmiş araçlar ve daha büyük dosyalar için gerekir." },
      { q: "Dosyalarım güvende mi? Sunucuya yükleniyor mu?", a: "Birleştirme ve görselden PDF gibi araçlarda dosyalarınız tamamen TARAYICINIZDA (cihazınızda) işlenir — sunucuya hiç gönderilmez, bilgisayarınızdan çıkmaz. Sunucu gerektiren dönüştürme gibi işlemlerde ise içerik saklanmaz ve şifreli bağlantı kullanılır." },
      { q: "PDF dosyaları nasıl ücretsiz birleştirilir?", a: "Dosyalarınızı sürükleyip bırakın, sırayı ayarlayın ve birleştir deyin. Birleştirilmiş PDF saniyeler içinde, cihazınızda hazırlanır ve otomatik indirilir — üyelik yok, kurulum yok, dosyanız sunucuya gitmez." },
      { q: "PDF'i Word'e biçimlendirme kaybolmadan nasıl dönüştürebilirim?", a: "PDF Platform'daki PDF dönüştürücü, PDF'i Word'e (.docx) çevirirken yazı tipleri, tablolar ve düzeni korur. Sonuç, düzenlemeye hazır tam anlamıyla düzenlenebilir bir belgedir." },
      { q: "PDF dosyasının boyutu nasıl küçültülür?", a: "PDF'inizi yükleyin, sıkıştırma seviyesini seçin ve optimize edilmiş dosyayı indirin. PDF Platform, metin ve görselleri net tutarken dosya boyutunu e-posta ekleri ve portal yüklemeleri için küçültür." },
      { q: "PDF Platform yazılım yüklemeden çalışır mı?", a: "Evet. Web sürümü doğrudan tarayıcınızdan açılır — kurulum veya eklenti gerekmez. Birleştirme gibi araçlar dosyanızı cihazınızda işler; çevrimdışı kullanım için Windows masaüstü uygulaması çok yakında geliyor." },
    ],
  },
  en: {
    // Ölçüldü (en): pdf to word → pdf to jpg → pdf to excel → pdf editor →
    // pdf merge. İngilizcede dönüştürme sorguları birleştirmenin önünde.
    title: `${BRAND}: Merge, Compress & PDF to Word — ${ARAC_SAYISI} PDF Tools`,
    description:
      `PDF to Word, merge, compress, PDF to JPG, edit and ${ARAC_SAYISI} tools in total. Free, no sign-up; merge runs in your browser and your files never leave your device.`,
    h1: "Merge PDF, Convert, Compress and Edit — All PDF Tools in One Place",
    intro:
      "PDF Platform brings PDF merge, split, compress, Word/Excel/PowerPoint conversion, watermarking and encryption into one platform. Tools like merge and image-to-PDF need no account and run entirely in your browser — your files never leave your device, processing is instant and free up to 80 MB. No installation required.",
    faq: [
      { q: "Do I need an account to merge PDF files?", a: "No. You can use basic tools like merge and image-to-PDF for free and without any sign-up or account. An account is only needed to save your history, for tools like Word/Excel conversion and OCR, and for larger files." },
      { q: "Are my files safe? Are they uploaded to a server?", a: "For tools like merge and image-to-PDF your files are processed entirely IN YOUR BROWSER (on your device) — they are never sent to a server and never leave your computer, so they're 100% private. Server-based tools like conversion don't retain content and use encrypted connections." },
      { q: "How do I merge PDF files online for free?", a: "Drag and drop your files, set the order, and click merge. The combined PDF is prepared on your device in seconds and downloads automatically — no sign-up, no installation, your file never goes to a server." },
      { q: "Can I convert PDF to Word without losing formatting?", a: "Yes. The PDF converter in PDF Platform preserves fonts, tables, and layout when converting PDF to Word (.docx). The result is a fully editable document ready for further editing." },
      { q: "How do I compress a PDF to reduce its file size?", a: "Upload your PDF, choose a compression level, and download the optimized file. PDF Platform reduces file size while keeping text and images sharp for email attachments and portal uploads." },
      { q: "Does PDF Platform work without installing software?", a: "Yes. The web version opens right in your browser — no installation, no plugins. Tools like merge process your file on your device; a Windows desktop app for offline use is coming soon." },
    ],
  },
};

// ─── Fiyatlandırma ────────────────────────────────────────────────────────────
export const PRICING_SEO = {
  tr: {
    title: markaEkle(`PDF Araçları Fiyatlandırma — 7 Gün İade Garantisi`),
    description:
      "PDF birleştirme, dönüştürme ve sıkıştırma araçları için planları inceleyin. 7 gün içinde gerekçesiz iade garantisi, otomatik yenileme yok. Ücretsiz başlayın.",
    h1: "PDF Araçları Fiyatlandırma — Planlar ve Kredi Paketleri",
    intro:
      "Ücretsiz plan dahil aylık abonelik ve kredi paketi seçeneklerini karşılaştırın. Tüm planlarda ilk ödemeden itibaren 7 gün içinde gerekçesiz iade; abonelikler kendiliğinden yenilenmez, kartınızdan izniniz olmadan çekim yapılmaz.",
    // SSS: fiyatlandırma sayfası önceden üretilen HTML'de yalnızca başlık + giriş
    // cümlesi içeriyordu (50 kelime). Satın alma niyetli aramaların indiği sayfa
    // olduğu için gerçek içerik eklendi; aynı metin FAQPage şemasını da besler.
    faq: [
      {
        q: "Ücretsiz plan gerçekten ücretsiz mi?",
        a: "Evet. Ücretsiz planda kart bilgisi istenmez. Ayrıca birleştirme, bölme, döndürme, sayfa silme, sıralama ve kırpma gibi cihazınızda çalışan araçlar üyelik bile gerektirmez ve günlük sınırı yoktur.",
      },
      {
        q: "Abonelik ile kredi paketi arasındaki fark nedir?",
        a: "Abonelik satın aldığınız dönem boyunca (aylık ya da yıllık) kontenjanınızı sağlar; düzenli kullanım için uygundur. Dönem bitince kendiliğinden yenilenmez, devam etmek isterseniz yenilemeyi siz onaylarsınız. Kredi paketi tek seferlik satın alınır ve abonelik başlatmadan yoğun bir işi bitirmek isteyenler içindir.",
      },
      {
        q: "Aboneliğim kendiliğinden yenilenir mi?",
        a: "Hayır. Aboneliğiniz satın aldığınız dönemle (bir ay ya da bir yıl) sınırlıdır ve kendiliğinden yenilenmez; kartınızdan izniniz olmadan çekim yapılmaz. Dönem bitmeden size e-posta ile hatırlatırız; devam etmek isterseniz hesabınızdan yenilemeyi onaylarsınız, istemezseniz hiçbir şey yapmanız gerekmez ve hesabınız Ücretsiz plana döner. Dilerseniz dönem içinde de hesabınızdan iptal edebilirsiniz: ilk 7 gün içinde tam iade, sonrasında dönem sonuna kadar kullanım.",
      },
      {
        q: "İade garantisi nasıl işliyor?",
        a: "İlk ödemenizden itibaren 7 gün içinde gerekçe belirtmeden iade talep edebilirsiniz. Talebinizi destek adresimize ilettiğinizde ödeme aynı yöntemle iade edilir.",
      },
      {
        q: "Ücretli planda ne açılıyor?",
        a: "Sunucuda çalışan işlerde (Word/Excel'e dönüştürme, sıkıştırma, yapay zekâ ile özetleme, çeviri, veri çıkarma ve karşılaştırma) günlük sınırlar yükselir ya da kalkar. Cihazda çalışan araçlar her planda sınırsızdır.",
      },
      {
        q: "Çıktılarda filigran var mı?",
        a: "Hayır. İndirdiğiniz dosyada hiçbir planda görünür filigran bulunmaz. Yalnızca indirmeden önceki hızlı önizlemede işaretli bir kopya gösterilir.",
      },
      {
        q: "Ödeme nasıl alınıyor, fatura kesiliyor mu?",
        a: "Ödemeler PayTR altyapısıyla alınır; kart bilgileriniz bizde saklanmaz. Türkiye'deki müşteriler için TL fiyatların tamamına %20 KDV dahildir; ayrıca ekleme yapılmaz. Yurt dışında yaşayıp yurt dışında çıkarılmış bir kartla ödeme yapan müşterilere hizmet ihracatı istisnası uygulanabilir; kartın yurt içi olduğu ya da ülkesinin belirlenemediği durumlarda fatura KDV’li düzenlenir.",
      },
    ],
  },
  en: {
    title: markaEkle(`PDF Tools Pricing — 7-Day Money-Back Guarantee`),
    description:
      "Explore plans for PDF merge, convert, and compress tools. 7-day money-back guarantee, no automatic renewal. Start free today.",
    h1: "PDF Tools Pricing — Plans and Credit Packs",
    intro:
      "Compare monthly subscriptions and credit packs, including a free plan. Every plan comes with a 7-day no-questions-asked money-back guarantee, and subscriptions never renew automatically: your card is not charged without your confirmation.",
    faq: [
      {
        q: "Is the free plan really free?",
        a: "Yes. The free plan needs no card details. On top of that, tools that run on your device — merge, split, rotate, delete pages, reorder and crop — need no account at all and have no daily limit.",
      },
      {
        q: "What is the difference between a subscription and a credit pack?",
        a: "A subscription gives you the allowance for the period you bought (monthly or yearly), which suits regular use. It does not renew automatically; if you want to continue, you confirm the renewal yourself. A credit pack is a one-off purchase for finishing a heavy job without starting a subscription.",
      },
      {
        q: "Does my subscription renew automatically?",
        a: "No. Your subscription is limited to the period you bought (one month or one year) and never renews on its own; your card is not charged without your confirmation. We email you a reminder before it ends. If you want to continue, you confirm the renewal from your account; if not, you do nothing and your account returns to the Free plan. You can also cancel during the period from your account: a full refund within the first 7 days, and access until the period ends after that.",
      },
      {
        q: "How does the money-back guarantee work?",
        a: "You can ask for a refund within 7 days of your first payment without giving a reason. Once you contact support, the payment is returned through the same method.",
      },
      {
        q: "What does a paid plan unlock?",
        a: "Daily limits rise or disappear for server-side work: conversion to Word and Excel, compression, and the AI tools for summarizing, translating, extracting data and comparing documents. On-device tools are unlimited on every plan.",
      },
      {
        q: "Are there watermarks on the output?",
        a: "No. No plan puts a visible watermark on the file you download. A marked copy appears only in the quick preview shown before you download.",
      },
      {
        q: "How are payments handled and is an invoice issued?",
        a: "Payments run through PayTR and your card details are never stored by us. For customers in Turkey, all prices in Turkish lira already include 20% VAT, with nothing added on top. Purchases made from outside Turkey carry no VAT under the export exemption.",
      },
    ],
  },
};

// ─── Geliştirici API landing ──────────────────────────────────────────────────
/**
 * API dokümantasyon sayfası (/pdf-api/docs).
 *
 * NEDEN AYRI: Geliştiricilerin bağlantı verdiği sayfa tanıtım sayfası değil,
 * REFERANS sayfasıdır. Ön-render edilmediği sürece arama motorları ve yapay
 * zekâ araçları burada genel ana sayfa başlığını görüyordu.
 */
export const API_DOCS_SEO = {
  tr: {
    title: markaEkle(`API Dokümantasyonu — Uçlar, Kimlik Doğrulama, Hatalar`),
    description:
      "PDF Platform REST API referansı: kimlik doğrulama, /v1 uçları, istek ve yanıt örnekleri, RFC 9457 hata biçimi, sınırlar ve sürüm politikası.",
    h1: "API Dokümantasyonu",
    intro:
      "PDF Platform API referansı. Anahtar bazlı kimlik doğrulama, /v1 altında sürümlenen uçlar, her uç için istek ve yanıt örneği, RFC 9457 biçiminde hatalar, IETF taslağına uygun istek sınırı başlıkları ve Idempotency-Key ile tekrar güvenliği. Makine-okur OpenAPI tanımı da yayınlanır.",
    keywords: ["pdf api dokümantasyonu", "pdf api referans", "belge işleme api dokümanı", "rest api pdf", "openapi pdf"],
    faq: [
      { q: "API'yi nasıl doğrularım?", a: "Panelden ürettiğiniz anahtarı her istekte Authorization: Bearer başlığında gönderin. Anahtarın çalıştığını GET /v1/me ile kredi harcamadan sınayabilirsiniz." },
      { q: "Hatalar hangi biçimde döner?", a: "Hatalar RFC 9457 uyarınca application/problem+json biçiminde döner; type, title, status, code, detail ve request_id alanlarını içerir." },
      { q: "İstek sınırı nedir?", a: "Anahtar başına dakikada 60 istek. Yanıtlar RateLimit başlıklarını taşır; sınır aşıldığında 429 ve Retry-After döner." },
      { q: "Bir uç kaldırılırsa ne olur?", a: "Kırıcı değişiklikler yeni sürümde yapılır. Bir uç emekliye ayrılacaksa yanıtlar RFC 9745 uyarınca Deprecation ve Sunset başlıklarını taşımaya başlar ve kapanmaya en az 6 ay kalır." },
      { q: "İstekler nasıl gönderilir?", a: "Uçlar HTTPS üzerinden POST kabul eder. Belgeyi çok parçalı form verisi olarak ya da erişilebilir bir bağlantı ile gönderir, seçenekleri aynı istekte alan olarak iletirsiniz. Yanıt JSON döner." },
      { q: "Aynı isteği iki kez gönderirsem ne olur?", a: "İstek başlığında bir tekrar anahtarı (idempotency key) gönderirseniz aynı anahtarla yapılan ikinci çağrı yeni bir işlem başlatmaz, ilk çağrının sonucunu döndürür. Ağ kesintilerinde çift ücretlenmeyi bu önler." },
      { q: "Büyük dosyalarda ne olur?", a: "Dosya boyutu ve sayfa sınırları uç bazında tanımlıdır. Sınır aşıldığında istek RFC 9457 biçiminde açıklayıcı bir hata döner; dosyayı bölüp parça parça göndermek en pratik yoldur." },
      { q: "Test ve canlı ortam ayrı mı?", a: "API anahtarları hesap bazında üretilir ve her anahtarın kullanımı ayrı izlenir. Geliştirme için ayrı bir anahtar üretip harcamayı canlı trafikten bağımsız takip edebilirsiniz." },
    ],
  },
  en: {
    title: markaEkle(`API Reference: Auth, Errors, Rate Limits`),
    description:
      "Integration notes for the PDF Platform REST API: Bearer-key auth, /v1 routes, problem+json errors, 60 requests a minute, safe retries and deprecation policy.",
    h1: "PDF Platform API Reference",
    intro:
      "This is the reference you keep open while wiring the API into your code. Authenticate with a Bearer key, call versioned routes under /v1, and read failures as RFC 9457 problem+json that includes a request_id you can quote to support. Rate-limit headers tell you how much headroom is left before a 429. Add an Idempotency-Key to a POST and a retried call after a dropped connection returns the first result instead of billing again. Retired routes announce themselves with Deprecation and Sunset headers well ahead of shutdown. If you generate clients from a spec, a machine-readable OpenAPI file is published alongside this page.",
    keywords: ["pdf api reference", "pdf api documentation", "bearer token pdf api", "rfc 9457 problem details api", "api idempotency key", "openapi pdf", "rest api rate limit headers", "document processing api"],
    faq: [
      { q: "How do I check that my key works without spending credits?", a: "Call GET /v1/me with the key in an Authorization: Bearer header. It costs no credits, which makes it a good first request to confirm the key is accepted." },
      { q: "What does a failed request look like?", a: "A JSON body of type application/problem+json (RFC 9457) with type, title, status, code, detail and request_id. Log the request_id; it is the fastest way to trace a specific failure." },
      { q: "How many calls can I make?", a: "60 per minute for each key. RateLimit headers on every response show what is left, and going over returns 429 with a Retry-After value you can sleep on." },
      { q: "How do I avoid being charged twice after a timeout?", a: "Send an idempotency key with the POST. If the connection drops and you repeat the call with the same key, the service returns the original result rather than starting new work." },
      { q: "How are documents submitted?", a: "As a POST over HTTPS, either uploaded as multipart form data or referenced by a link the service can reach. Options travel as fields in that same request and the response is JSON." },
      { q: "What if my file is too big?", a: "Size and page limits are set for each endpoint. Exceeding one yields a descriptive problem+json error. Splitting the document and sending the parts separately is the practical workaround." },
      { q: "Will an endpoint disappear without warning?", a: "No. Breaking changes land in a new version. Before a route is retired its responses add RFC 9745 Deprecation and Sunset headers, with at least six months until it closes." },
      { q: "Is there a sandbox?", a: "Keys belong to an account and each key's usage is tracked on its own, so create a dedicated key for development and watch its spend apart from production." },
    ],
  },
};

export const API_SEO = {
  tr: {
    title: markaEkle(`PDF & Yapay Zekâ API — Belge İşlemeyi Yazılımınıza Gömün`),
    description:
      "PDF veri çıkarma, özetleme ve çeviriyi tek API ile yazılımınıza gömün. Fatura okuma, sözleşme özeti — yapılandırılmış JSON, API anahtarıyla.",
    h1: "PDF & Yapay Zekâ API — Belge İşlemeyi Yazılımınıza Gömün",
    intro:
      "PDF Platform API'siyle belge işlemeyi kendi ürününüze gömün: fatura/tablo verisi çıkarın, uzun belgeleri özetleyin, 12+ dile çevirin. API anahtarı alın, /v1 uçlarını çağırın, yapılandırılmış JSON alın. Kullanım kredi bazlıdır.",
    keywords: ["pdf api", "belge işleme api", "fatura okuma api", "pdf veri çıkarma api", "yapay zeka pdf api", "pdf özetleme api", "document ai api"],
    faq: [
      { q: "PDF Platform API'si ne yapar?", a: "PDF/belge metninden yapılandırılmış veri çıkarma, özetleme ve çeviriyi programatik sunar. /v1 uçlarını API anahtarınızla çağırır, JSON yanıt alırsınız." },
      { q: "Nasıl başlarım?", a: "API anahtarı yalnızca Pro ve Business planlarında üretilir. Planınız varsa panelden bir anahtar üretin ve /v1/extract, /v1/summarize, /v1/translate uçlarını çağırın; her istek AI kredinizden düşer. Yapay zekâ uçları şu an çok yakında durumundadır." },
      { q: "Faturalandırma nasıl?", a: "Kullanım kredi bazlıdır: kredi paketi (top-up) alır, her API çağrısında 1 kredi harcarsınız. Fatura otomatik kesilir." },
      { q: "Hangi işlemler API üzerinden yapılabiliyor?", a: "Faturalardan ve tablolardan yapılandırılmış veri çıkarma, uzun belgeleri özetleme, 12'den fazla dile çeviri ve iki belgeyi karşılaştırma. Hepsi tek API anahtarı ve aynı istek biçimiyle çalışır." },
      { q: "Yanıtlar hangi biçimde geliyor?", a: "Tüm uçlar JSON döner. Veri çıkarma uçlarında alan adları sabittir, böylece yanıtı doğrudan kendi veritabanınıza ya da muhasebe yazılımınıza yazabilirsiniz; serbest metin ayrıştırmanıza gerek kalmaz." },
      { q: "Gönderdiğim belgeler saklanıyor mu?", a: "API'ye gönderilen dosyalar işlem tamamlandıktan sonra sunucudan silinir; model eğitimi için kullanılmaz. Saklama süreleri ve veri işleme ayrıntıları gizlilik politikasında yazılıdır." },
      { q: "Deneme yapabilir miyim?", a: "Evet. Hesabınızı açıp bir API anahtarı ürettikten sonra küçük bir kredi paketiyle uçları kendi belgelerinizle deneyebilir, ölçeklemeden önce sonuçları görebilirsiniz." },
    ],
  },
  en: {
    title: markaEkle(`PDF & AI API — Embed Document Processing in Your Software`),
    description:
      "Integrate PDF data extraction, summarization and translation into your software with one API. Invoice parsing and contract summaries as structured JSON.",
    h1: "PDF & AI API — Embed Document Processing",
    intro:
      "Embed document processing into your product with the PDF Platform API: extract invoice/table data, summarize long documents, translate to 12+ languages. Get an API key, call the /v1 endpoints, receive structured JSON. Usage is credit-based.",
    keywords: ["pdf api", "document processing api", "invoice extraction api", "pdf data extraction api", "document ai api", "pdf summarization api"],
    faq: [
      { q: "What does the PDF Platform API do?", a: "It offers programmatic structured-data extraction, summarization and translation from PDF/document text. Call the /v1 endpoints with your API key and get JSON responses." },
      { q: "How do I get started?", a: "Create an account, generate an API key from the dashboard, and call /v1/extract, /v1/summarize, /v1/translate. Each request uses one AI credit." },
      { q: "How is it billed?", a: "Usage is credit-based: buy a credit pack (top-up) and spend 1 credit per API call. Invoices are issued automatically." },
      { q: "Which operations are available through the API?", a: "Structured data extraction from invoices and tables, summarization of long documents, translation into more than 12 languages, and comparison of two documents. All of them use one API key and the same request shape." },
      { q: "What format do responses come in?", a: "Every endpoint returns JSON. Extraction endpoints use fixed field names, so you can write the response straight into your own database or accounting software without parsing free text." },
      { q: "Are the documents I send stored?", a: "Files sent to the API are removed from the server once processing finishes and are never used to train models. Retention periods and processing details are set out in the privacy policy." },
      { q: "Can I try it first?", a: "Yes. Create an account, generate an API key and test the endpoints against your own documents with a small credit pack before you scale up." },
    ],
  },
};

// ─── Hukuki sayfalar ──────────────────────────────────────────────────────────
export const LEGAL_SEO = {
  terms: {
    tr: {
      title: markaEkle(`Hizmet Şartları`),
      description: "PDF Platform hizmet şartları: hizmetin kapsamı, kullanım kuralları, abonelik ve iptal koşulları, sorumluluk sınırları ve iletişim bilgileri.",
      h1: "Hizmet Şartları",
      intro: "PDF Platform hizmetlerinin kullanımına ilişkin şartlar ve koşullar.",
    },
    en: {
      title: markaEkle(`Terms of Service`),
      description: "PDF Platform terms of service: scope of the service, acceptable use, subscription and cancellation terms, limits of liability and contact details.",
      h1: "Terms of Service",
      intro: "Terms and conditions for using PDF Platform services.",
    },
  },
  privacy: {
    tr: {
      title: markaEkle(`Gizlilik Politikası`),
      description: "PDF Platform gizlilik politikası: hangi kişisel veriler işlenir, ne kadar saklanır, kimlerle paylaşılır ve haklarınızı nasıl kullanırsınız.",
      h1: "Gizlilik Politikası",
      intro: "Kişisel verilerinizin nasıl işlendiğine ve korunduğuna dair gizlilik politikamız.",
    },
    en: {
      title: markaEkle(`Privacy Policy — How We Handle Your Data`),
      description: "PDF Platform privacy policy: what personal data we process, how long we keep it, who we share it with and how you can exercise your rights.",
      h1: "Privacy Policy — How We Handle Your Data",
      intro: "Our privacy policy on how your personal data is processed and protected.",
    },
  },
  "legal/on-bilgilendirme": {
    tr: {
      title: markaEkle(`Ön Bilgilendirme Formu`),
      description: "Mesafeli Sözleşmeler Yönetmeliği kapsamında ödeme öncesinde sunulan Ön Bilgilendirme Formu: satıcı bilgileri, hizmetin nitelikleri, ücret ve cayma hakkı.",
      h1: "Ön Bilgilendirme Formu",
      intro: "Ödeme öncesinde tüketiciye sunulması zorunlu bilgilendirme formu.",
    },
    en: {
      title: markaEkle(`Pre-Purchase Information Form`),
      description: "Consumer information form shown before payment under the Distance Sales Regulation: seller details, service features, price and right of withdrawal.",
      h1: "Pre-Purchase Information Form",
      intro: "The mandatory consumer information form shown before payment.",
    },
  },
  "legal/mesafeli-satis": {
    tr: {
      title: markaEkle(`Mesafeli Satış Sözleşmesi`),
      description: "6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında düzenlenen PDF Platform mesafeli satış sözleşmesi.",
      h1: "Mesafeli Satış Sözleşmesi",
      intro: "Her abonelik satın alımında geçerli olan mesafeli satış sözleşmesi.",
    },
    en: {
      title: markaEkle(`Distance Sales Agreement`),
      description: "PDF Platform distance sales agreement drawn up under Law No. 6502 on the Protection of Consumers and the Distance Sales Regulation.",
      h1: "Distance Sales Agreement",
      intro: "The agreement that applies to each subscription purchase.",
    },
  },
  "legal/iptal-iade": {
    tr: {
      title: markaEkle(`İptal ve İade Koşulları`),
      description: "PDF Platform aboneliği nasıl iptal edilir, iade hangi durumlarda yapılır ve nasıl ödenir: iade kurallarının tek sayfada özeti.",
      h1: "İptal ve İade Koşulları",
      intro: "Aboneliğin iptali, iade koşulları ve iadenin ödenme biçimi.",
    },
    en: {
      title: markaEkle(`Cancellation and Refund Terms`),
      description: "How to cancel a PDF Platform subscription, when refunds are available and how they are paid: the refund rules summarized on one page.",
      h1: "Cancellation and Refund Terms",
      intro: "How subscriptions are cancelled and when refunds are available.",
    },
  },
  "legal/cerez-politikasi": {
    tr: {
      title: markaEkle(`Çerez Politikası`),
      description: "PDF Platform hangi çerezleri ve benzeri depolama öğelerini neden kullanır ve bunları nasıl yönetebilirsiniz.",
      h1: "Çerez Politikası",
      intro: "Kullandığımız çerezler, amaçları ve yönetme seçenekleriniz.",
    },
    en: {
      title: markaEkle(`Cookie Policy`),
      description: "Which cookies and similar storage items PDF Platform uses, why, and how you can control them.",
      h1: "Cookie Policy",
      intro: "The cookies we use, why we use them and how you can control them.",
    },
  },
  kvkk: {
    tr: {
      title: markaEkle(`KVKK Aydınlatma Metni`),
      description:
        "PDF Platform kişisel verilerin işlenmesine ilişkin KVKK aydınlatma metnini okuyun.",
      h1: "KVKK Aydınlatma Metni",
      intro: "6698 sayılı KVKK kapsamında kişisel verilerin işlenmesine ilişkin aydınlatma metni.",
    },
    en: {
      title: markaEkle(`KVKK Notice — Personal Data Processing`),
      description: "PDF Platform KVKK notice: which personal data we process, the legal grounds, retention periods, transfers and your rights under Turkish law.",
      h1: "KVKK Notice — Personal Data Processing",
      intro: "Information notice on the processing of personal data under Turkish KVKK law (No. 6698).",
    },
  },
};

// ─── SoftwareApplication featureList ─────────────────────────────────────────
export const SOFTWARE_FEATURE_LIST = {
  tr: [
    "PDF birleştirme",
    "PDF ayırma",
    "PDF sıkıştırma",
    "PDF dönüştürme (Word, Excel, PowerPoint)",
    "PDF'den görüntüye ve görüntüden PDF'e",
    "PDF şifreleme ve parola koruma",
    "PDF filigran ve sayfa numarası ekleme",
    "PDF döndürme, sayfa silme ve düzenleme",
  ],
  en: [
    "Merge PDF",
    "Split PDF",
    "Compress PDF",
    "PDF conversion (Word, Excel, PowerPoint)",
    "PDF to image and image to PDF",
    "PDF encryption and password protection",
    "Add watermark and page numbers to PDF",
    "Rotate, delete and organize PDF pages",
  ],
};

// ─── Hakkımızda ──────────────────────────────────────────────────────────────
// Gövde metni src/content/aboutContent.mjs'ten gelir (React sayfasıyla aynı kaynak);
// burada yalnızca başlık / açıklama / H1 / giriş vardır.
export const ABOUT_SEO = {
  tr: {
    title: markaEkle(`Hakkımızda: Misyon ve Çalışma İlkelerimiz`),
    description: "PDF Platform neden geliştiriliyor? Dosyaların cihazda kalması, yapay zekânın yalnızca seçildiğinde çalışması ve filigransız sonuçlar: ilkelerimiz.",
    h1: "Hakkımızda",
    intro: "Belgeleriniz üzerinde çalışmak hızlı, anlaşılır ve güvenli olmalı. PDF Platform'u bunun için geliştiriyoruz.",
    keywords: [],
    faq: [],
  },
  en: {
    title: markaEkle(`About Us: Our Mission and How We Work`),
    description: "Who builds PDF Platform and why? Files that stay on your device, AI that only runs when you choose it, and results without watermarks: how we work.",
    h1: "About",
    intro: "Working on your documents should be fast, clear and safe. That is why we build PDF Platform.",
    keywords: [],
    faq: [],
  },
};

