export type Language = "tr" | "en";

type LandingFeature = {
  icon: string;
  title: string;
  benefit: string;
};

type LandingScreenshot = {
  src: string;
  title: string;
  description: string;
};

type LandingPlan = {
  name: string;
  price: string;
  description: string;
  badge?: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

type TrustPoint = {
  title: string;
  description: string;
};

// ─── FAQ type — consumed by SeoRouteManager → jsonLd → FAQPage schema ────────
export type FaqItem = { question: string; answer: string };

export type LandingTranslation = {
  navbar: {
    studioTagline: string;
    productLabel: string;
    platformTag: string;
    contact: string;
    languageLabel: string;
    login: string;
    register: string;
    openWorkspace: string;
    signedInFallback: string;
  };
  hero: {
    audience: string[];
    kicker: string;
    headline: string;
    alternatives: string[];
    description: string;
    primaryCta: string;
    secondaryCta: string;
    highlights: Array<{ label: string; value: string }>;
    quickStats: Array<{ title: string; description: string }>;
  };
  features: {
    kicker: string;
    title: string;
    items: LandingFeature[];
  };
  screenshots: {
    kicker: string;
    title: string;
    description: string;
    items: LandingScreenshot[];
    sideCards: Array<{ icon: string; title: string; description: string }>;
  };
  trust: {
    kicker: string;
    title: string;
    description: string;
    points: TrustPoint[];
  };
  pricing: {
    kicker: string;
    title: string;
    description: string;
    plans: LandingPlan[];
  };
  finalCta: {
    kicker: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
  };
  footer: {
    description: string;
    availability: string;
    security: string;
    contact: string;
    termsLabel: string;
    privacyLabel: string;
    kvkkLabel: string;
  };
  contactSection: {
    kicker: string;
    title: string;
    description: string;
    nameLabel: string;
    emailLabel: string;
    messageLabel: string;
    submit: string;
    submitting: string;
    success: string;
    errorFallback: string;
    validation: {
      nameRequired: string;
      nameTooShort: string;
      emailRequired: string;
      emailInvalid: string;
      messageRequired: string;
      messageTooShort: string;
    };
    honeypotLabel: string;
  };
  marqueeItems: {
    items: string[];
  };
  trustedText: {
    trusted: string;
    payment: string;
    freePlan: string;
  };
  /** Landing-page FAQ items — rendered visibly AND injected into FAQPage schema */
  faq: FaqItem[];
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEO NOTES
// ─────────────────────────────────────────────────────────────────────────────
// • hero.headline   → rendered as <h1>. Keep primary keyword ("merge PDF",
//   "PDF converter", "PDF birleştirme") in the first 60 characters.
// • hero.description → also used as <meta name="description">. Stay ≤155 chars.
// • features.items[].title → rendered as <h3> — secondary keyword targets.
// • trust.points[].title   → rendered as <h3> — E-E-A-T signals.
// • faq[].question         → injected into FAQPage schema; use natural-language
//   questions users actually search for.
// • All Turkish strings MUST use proper Unicode characters (ş, ğ, ü, ö, ç, İ, ı).
//   ASCII substitutes (s, g, u, o, c) break spell-checkers and search indexing.
// ═══════════════════════════════════════════════════════════════════════════════

export const landingTranslations: Record<Language, LandingTranslation> = {
  // ── ENGLISH ────────────────────────────────────────────────────────────────
  en: {
    navbar: {
      studioTagline: "NB Global Studio",
      productLabel: "PDF PLATFORM",
      platformTag: "Professional PDF Workflow Platform",
      contact: "Contact",
      languageLabel: "Language",
      login: "Login",
      register: "Register",
      openWorkspace: "Open Workspace",
      signedInFallback: "Signed in",
    },

    hero: {
      audience: [
        "Office teams",
        "Tender departments",
        "Administrative staff",
        "Operations leads",
      ],

      // kicker: shown above H1, NOT a heading — use brand/intent framing
      kicker: "PDF Management for Business Workflows",

      // H1 — primary keyword "merge PDF" first; "PDF converter" second;
      // "compress PDF" and "PDF editor" follow. ≤70 chars for full display.
      headline:
        "Merge PDF, Convert, Compress and Edit — All PDF Tools in One Place",

      alternatives: [
        "Fast, Secure PDF Management for Business Workflows",
        "Handle Your PDFs in Seconds — Built for Professionals",
      ],

      // Also used as meta description — MUST stay ≤155 characters.
      // Current length: 151 chars ✓
      description:
        "Merge PDF files, convert documents, compress and edit PDFs from one place. No installation needed — works in your browser and on Windows.",

      primaryCta: "Start Free",
      secondaryCta: "Download for Windows",

      highlights: [
        { label: "Built for", value: "Business-critical document handling" },
        { label: "Core value", value: "Less manual work, fewer file errors" },
        { label: "Deployment", value: "Web browser + Windows desktop app" },
      ],

      quickStats: [
        {
          title: "Fast Processing",
          description:
            "Streamline repetitive document tasks without breaking workflow quality.",
        },
        {
          title: "Secure Handling",
          description:
            "Manage protected files with business-focused encryption and control.",
        },
      ],
    },

    trustedText: {
      trusted: "Trusted by 1,000+ users",
      payment: "Secure checkout",
      freePlan: "Pay-As-You-Go — Credit packs & monthly subscription plans",
    },

    features: {
      kicker: "Business Benefits",
      // H2 — secondary keyword cluster: speed, accuracy, control
      title: "PDF tools built for document speed, accuracy, and control.",
      items: [
        {
          icon: "merge",
          // H3 — target: "merge PDF files"
          title: "Merge PDF files in seconds",
          benefit:
            "Combine reports, attachments, and document sets into one polished file without manual rework.",
        },
        {
          icon: "split",
          // H3 — target: "split PDF"
          title: "Split large PDF documents instantly",
          benefit:
            "Extract only the pages you need for procurement packs, internal reviews, and approvals.",
        },
        {
          icon: "convert",
          // H3 — target: "PDF converter" / "convert PDF to Word"
          title: "PDF converter — no formatting loss",
          benefit:
            "Convert PDF to Word, Excel, and back with a workflow built for business-ready output.",
        },
        {
          icon: "secure",
          // H3 — target: "PDF password protect" / "encrypt PDF"
          title: "Password-protect and encrypt PDFs",
          benefit:
            "Secure confidential files with encryption and tighter access control for daily operations.",
        },
        {
          icon: "compress",
          // H3 — target: "compress PDF" / "reduce PDF file size"
          title: "Compress PDF — reduce file size fast",
          benefit:
            "Optimize heavy PDFs before emailing or uploading to client portals and submission platforms.",
        },
        {
          icon: "excel",
          // H3 — target: "PDF to Excel"
          title: "Convert PDF tables to Excel spreadsheets",
          benefit:
            "Extract tabular data from PDFs into editable Excel files for faster reporting and verification.",
        },
      ],
    },

    screenshots: {
      kicker: "Product Preview",
      title:
        "A focused PDF workspace for teams that handle documents every day.",
      description:
        "The interface keeps core PDF operations visible, reduces tool-switching confusion, and supports high-volume document workflows with a clean enterprise-grade layout.",
      items: [
        {
          src: "/app-preview-main.png",
          title: "Unified PDF multi-tool workspace",
          description:
            "All PDF operations — merge, split, convert, compress, sign — grouped in one interface.",
        },
        {
          src: "/app-preview-merge.png",
          title: "Merge PDF with drag-and-drop control",
          description:
            "Clean progress feedback and structured file handling keep large merge jobs under control.",
        },
      ],
      sideCards: [
        {
          icon: "shield",
          title: "Operational confidence",
          description:
            "Keep sensitive PDF files protected while giving teams a dependable daily document workflow.",
        },
        {
          icon: "speed",
          title: "Faster turnaround",
          description:
            "Replace fragmented document steps with one streamlined PDF system for fewer handoff mistakes.",
        },
      ],
    },

    trust: {
      kicker: "Why teams trust PDF PLATFORM",
      // H2 — E-E-A-T focus: accuracy + security
      title: "Built to reduce document errors and protect sensitive files.",
      description:
        "From office operations to procurement submissions, the platform shortens PDF preparation time while keeping outputs organized, secure, and consistent.",
      points: [
        {
          // H3 — local processing = privacy signal (trust + differentiation)
          title: "Your PDF files never leave your device (Windows app)",
          description:
            "The Windows application processes all files locally on your device — sensitive business documents stay under your direct control at all times.",
        },
        {
          // H3 — encryption keyword
          title: "Encrypted, secure PDF processing",
          description:
            "Document workflows include protected handling, access control, and encryption-aware operations designed for business use.",
        },
        {
          // H3 — data privacy / GDPR signal
          title: "Zero data retention — we don't store your files",
          description:
            "Processed document contents are not retained as part of the core workflow, minimizing exposure and data-handling risk for your team.",
        },
      ],
    },

    pricing: {
      kicker: "Pricing",
      title: "Credit packs or unlimited subscription — pay for what you need.",
      description:
        "Starter and Gold are one-time credit packs. Unlimited Pro is a monthly subscription with unlimited PDF operations. Checkout in TRY via our secure payment partner.",
      plans: [],
    },

    finalCta: {
      kicker: "Start with the right PDF workflow for your team",
      title:
        "Start instantly in your browser or download for full desktop control.",
      description:
        "Open the web version for immediate PDF access, or install the Windows app for an offline, dedicated desktop workflow.",
      primaryCta: "Use Web Version",
      secondaryCta: "Download Windows App",
    },

    footer: {
      description:
        "Professional PDF management software — merge, convert, compress, and sign PDFs for business workflows.",
      availability: "Web + Windows",
      security: "Secure document operations",
      contact: "Contact",
      termsLabel: "Terms of Service",
      privacyLabel: "Privacy Policy",
      kvkkLabel: "KVKK disclosure",
    },

    contactSection: {
      kicker: "Contact",
      title: "Send a message to our team",
      description:
        "Tell us what you need and we will get back to you as soon as possible.",
      nameLabel: "Name",
      emailLabel: "Email",
      messageLabel: "Message",
      submit: "Send Message",
      submitting: "Sending…",
      success: "Your message has been sent successfully.",
      errorFallback: "Your message could not be sent. Please try again.",
      validation: {
        nameRequired: "Please enter your name.",
        nameTooShort: "Name must be at least 2 characters.",
        emailRequired: "Please enter your email address.",
        emailInvalid: "Please enter a valid email address.",
        messageRequired: "Please enter your message.",
        messageTooShort: "Message must be at least 10 characters.",
      },
      honeypotLabel: "Leave this field empty",
    },

    marqueeItems: {
      // Keyword-rich tool labels shown in the scrolling marquee
      items: [
        "Merge PDF",
        "Split PDF",
        "Compress PDF",
        "PDF Converter",
        "PDF to Word",
        "PDF to Excel",
        "Word to PDF",
        "PDF Sign",
        "PDF Encrypt",
        "Edit PDF",
      ],
    },

    // ── FAQ — rendered on page + injected into FAQPage schema ────────────────
    // Questions mirror actual search queries (informational intent).
    faq: [
      {
        question: "How do I merge PDF files online for free?",
        answer:
          "With PDF PLATFORM you can merge PDF files directly in your browser at no cost. Upload your files, drag to reorder pages, and download the combined PDF in seconds — no installation required.",
      },
      {
        question: "Can I convert PDF to Word without losing formatting?",
        answer:
          "Yes. The PDF converter in PDF PLATFORM preserves fonts, tables, and layout when converting PDF to Word (.docx). The result is a fully editable document ready for further editing.",
      },
      {
        question: "How do I compress a PDF to reduce its file size?",
        answer:
          "Upload your PDF, choose a compression level, and download the optimized file. PDF PLATFORM reduces file size while keeping text and images sharp for email attachments and portal uploads.",
      },
      {
        question: "Is my PDF data secure when using an online PDF tool?",
        answer:
          "PDF PLATFORM does not retain processed document contents. The Windows app processes files entirely on your device — your PDFs never leave your machine. The web version uses secure, encrypted connections for all transfers.",
      },
      {
        question: "Does PDF PLATFORM work without installing software?",
        answer:
          "Yes. The web version runs entirely in your browser — no installation, no plugins. A Windows desktop app is also available for offline use and higher-volume document operations.",
      },
    ],
  },

  // ── TURKISH ────────────────────────────────────────────────────────────────
  tr: {
    navbar: {
      studioTagline: "NB Global Studio",
      productLabel: "PDF PLATFORM",
      platformTag: "Profesyonel PDF İş Akışı Platformu",
      contact: "İletişim",
      languageLabel: "Dil",
      login: "Giriş Yap",
      register: "Kayıt Ol",
      openWorkspace: "Çalışma Alanını Aç",
      signedInFallback: "Giriş yapıldı",
    },

    hero: {
      audience: [
        "Ofis Ekipleri",
        "İhale Birimleri",
        "İdari Personel",
        "Operasyon Yöneticileri",
      ],

      // kicker — intent/brand çerçevesi, başlık değil
      kicker: "İş Süreçleri İçin PDF Yönetimi",

      // H1 — birincil keyword "PDF birleştirme" öne alındı;
      // "PDF dönüştürme", "PDF sıkıştırma", "PDF düzenleme" takip ediyor.
      headline:
        "PDF Birleştir, Dönüştür, Sıkıştır ve Düzenle — Tüm PDF Araçları Tek Platformda",

      alternatives: [
        "İş Süreçleri İçin Hızlı ve Güvenli PDF Yönetimi",
        "PDF İşlemlerinizi Saniyeler İçinde Tamamlayın — Profesyoneller İçin",
      ],

      // meta description olarak da kullanılır — ≤155 karakter.
      // Mevcut uzunluk: 148 karakter ✓
      description:
        "PDF birleştirme, dönüştürme, sıkıştırma ve düzenleme işlemlerini tek platformda yapın. Kurulum gerekmez — tarayıcıdan ve Windows'tan çalışır.",

      primaryCta: "Ücretsiz Başla",
      secondaryCta: "Windows Uygulamasını İndir",

      highlights: [
        {
          label: "Tasarlanan kullanım",
          value: "İş açısından kritik belge yönetimi",
        },
        {
          label: "Ana fayda",
          value: "Daha az manuel iş, daha az belge hatası",
        },
        {
          label: "Erişim modeli",
          value: "Web tarayıcısı + Windows masaüstü uygulaması",
        },
      ],

      quickStats: [
        {
          title: "Hızlı İşlem",
          description:
            "Tekrarlayan belge işlemlerini iş kalitesini bozmadan hızlandırın.",
        },
        {
          title: "Güvenli Kullanım",
          description:
            "Korumalı dosyaları iş odaklı şifreleme ve erişim kontrolü ile yönetin.",
        },
      ],
    },

    trustedText: {
      trusted: "1.000'den fazla kullanıcı tarafından güveniliyor",
      payment: "Güvenli Ödeme",
      freePlan: "Kullandığın Kadar Öde — Kredi Paketi & Aylık Abonelik",
    },

    features: {
      kicker: "İş Faydası",
      // H2 — ikincil keyword kümesi: hız, doğruluk, kontrol
      title: "Hız, doğruluk ve kontrol odaklı PDF araçları.",
      items: [
        {
          icon: "merge",
          // H3 — hedef: "PDF birleştirme", "PDF birleştir"
          title: "PDF dosyalarını saniyeler içinde birleştirin",
          benefit:
            "Raporları, ekleri ve belge setlerini manuel düzenleme yapmadan tek bir PDF dosyasında toplayın.",
        },
        {
          icon: "split",
          // H3 — hedef: "PDF ayırma", "PDF böl"
          title: "Büyük PDF dosyalarını anında ayırın",
          benefit:
            "İhale paketleri, iç incelemeler ve onay süreçleri için yalnızca gerekli sayfaları çıkarın.",
        },
        {
          icon: "convert",
          // H3 — hedef: "PDF dönüştürme", "PDF'i Word'e çevir"
          title: "PDF dönüştürücü — biçimlendirme bozulmadan",
          benefit:
            "PDF'i Word, Excel'e veya Word'ü PDF'e dönüştürün; iş kullanımına uygun çıktı kalitesiyle.",
        },
        {
          icon: "secure",
          // H3 — hedef: "PDF şifreleme", "PDF parola koruması"
          title: "PDF dosyalarını şifreleyin ve koruyun",
          benefit:
            "Gizli belgeleri şifreleme ve erişim kontrolüyle günlük iş operasyonlarında güvende tutun.",
        },
        {
          icon: "compress",
          // H3 — hedef: "PDF sıkıştırma", "PDF boyutu küçültme"
          title: "PDF sıkıştırma — dosya boyutunu hızla küçültün",
          benefit:
            "Ağır PDF dosyalarını müşterilere, ekiplere veya başvuru platformlarına göndermeden önce optimize edin.",
        },
        {
          icon: "excel",
          // H3 — hedef: "PDF'i Excel'e çevir", "PDF tablo dönüştürme"
          title: "PDF tabloları Excel'e dönüştürün",
          benefit:
            "PDF içindeki tablo verilerini düzenleme, raporlama ve doğrulama için Excel dosyasına aktarın.",
        },
      ],
    },

    screenshots: {
      kicker: "Ürün Önizlemesi",
      title: "Her gün PDF işleyen ekipler için odaklı bir çalışma alanı.",
      description:
        "Arayüz; temel PDF işlemlerini görünür tutmak, araç geçişlerini ortadan kaldırmak ve yüksek hacimli belge operasyonlarını kurumsal düzende yönetmek için tasarlandı.",
      items: [
        {
          src: "/app-preview-main.png",
          title: "Tüm PDF araçları tek çalışma alanında",
          description:
            "PDF birleştirme, bölme, dönüştürme, sıkıştırma ve imzalama tek ekranda bir araya gelir.",
        },
        {
          src: "/app-preview-merge.png",
          title: "Sürükle-bırak ile PDF birleştirme",
          description:
            "Temiz durum yönetimi ve düzenli dosya işleme, büyük birleştirme işlerini kontrol altında tutar.",
        },
      ],
      sideCards: [
        {
          icon: "shield",
          title: "Operasyonel güven",
          description:
            "Hassas PDF dosyalarını korurken ekiplerin her gün kullanabileceği güvenilir bir belge akışı sunun.",
        },
        {
          icon: "speed",
          title: "Daha hızlı teslim",
          description:
            "Parçalı belge adımlarını tek PDF sisteminde toplayarak teslim sürelerini ve hataları azaltın.",
        },
      ],
    },

    trust: {
      kicker: "Ekipler neden PDF PLATFORM'a güveniyor",
      // H2 — E-E-A-T sinyali: doğruluk + güvenlik
      title:
        "Belge hatalarını azaltmak ve hassas dosyaları korumak için tasarlandı.",
      description:
        "Ofis operasyonlarından ihale hazırlığına kadar platform, PDF hazırlama süresini kısaltırken çıktıların düzenli, güvenli ve tutarlı kalmasını sağlar.",
      points: [
        {
          // H3 — yerel işleme = gizlilik sinyali (güven + farklılaşma)
          // DÜZELTİLDİ: Önceki sürümde ASCII karakterler kullanılmıştı (cikmaz, uygulamasi)
          title: "PDF dosyalarınız cihazınızdan çıkmaz (Windows uygulaması)",
          description:
            "Windows uygulaması tüm dosyaları cihazınızda yerel olarak işler; hassas iş belgeleri her zaman doğrudan sizin kontrolünüzde kalır.",
        },
        {
          // H3 — şifreleme keyword'ü
          // DÜZELTİLDİ: Önceki sürümde "Guvenli isleme" ASCII'ydi
          title: "Şifreli ve güvenli PDF işleme",
          description:
            "Belge akışları; korumalı işleme, erişim kontrolü ve şifre bilinciyle kurumsal kullanıma uygun şekilde yapılandırılmıştır.",
        },
        {
          // H3 — veri gizliliği / GDPR / KVKK sinyali
          title: "Sıfır veri saklama — dosyalarınızı tutmuyoruz",
          description:
            "İşlenen belge içerikleri temel iş akışı kapsamında saklanmaz; bu sayede ekibinizin veri maruziyeti ve işleme riski en aza indirilir.",
        },
      ],
    },

    pricing: {
      kicker: "Fiyatlandırma",
      title: "Kredi paketi veya sınırsız abonelik — ihtiyacınız kadar ödeyin.",
      description:
        "Bronz ve Altın tek seferlik kredi paketleridir. Limitsiz Pro, sınırsız PDF işlemi sunan aylık aboneliktir. Ödeme güvenli iş ortağımız üzerinden TRY ile yapılır.",
      plans: [],
    },

    finalCta: {
      kicker: "Ekibiniz için doğru PDF iş akışını seçin",
      title: "Hemen tarayıcıdan başlayın veya masaüstü kontrolü için indirin.",
      description:
        "Anında PDF erişimi için web sürümünü açın ya da çevrimdışı ve yüksek hacimli işlemler için Windows uygulamasını indirin.",
      primaryCta: "Web Sürümünü Aç",
      secondaryCta: "Windows Uygulamasını İndir",
    },

    footer: {
      description:
        "Profesyonel PDF yönetim yazılımı — iş süreçleri için PDF birleştirme, dönüştürme, sıkıştırma ve imzalama.",
      availability: "Web + Windows",
      security: "Güvenli belge operasyonları",
      contact: "İletişim",
      termsLabel: "Hizmet Şartları",
      privacyLabel: "Gizlilik Politikası",
      kvkkLabel: "KVKK Aydınlatma",
    },

    contactSection: {
      kicker: "İletişim",
      title: "Ekibimize mesaj gönderin",
      description: "İhtiyacınızı yazın, size en kısa sürede dönüş yapalım.",
      nameLabel: "Ad Soyad",
      emailLabel: "E-posta",
      messageLabel: "Mesaj",
      submit: "Mesaj Gönder",
      submitting: "Gönderiliyor…",
      success: "Mesajınız başarıyla gönderildi.",
      errorFallback: "Mesajınız gönderilemedi. Lütfen tekrar deneyin.",
      validation: {
        nameRequired: "Lütfen adınızı girin.",
        nameTooShort: "Ad en az 2 karakter olmalıdır.",
        emailRequired: "Lütfen e-posta adresinizi girin.",
        emailInvalid: "Lütfen geçerli bir e-posta adresi girin.",
        messageRequired: "Lütfen mesajınızı girin.",
        messageTooShort: "Mesaj en az 10 karakter olmalıdır.",
      },
      honeypotLabel: "Bu alanı boş bırakın",
    },

    marqueeItems: {
      // Keyword açısından zengin araç etiketleri — kayan şerit
      items: [
        "PDF Birleştirme",
        "PDF Ayırma",
        "PDF Sıkıştırma",
        "PDF Dönüştürme",
        "PDF'i Word'e Çevir",
        "PDF'i Excel'e Çevir",
        "Word'ü PDF'e Çevir",
        "PDF İmzalama",
        "PDF Şifreleme",
        "PDF Düzenleme",
      ],
    },

    // ── SSS — sayfada görünür + FAQPage şemasına enjekte edilir ──────────────
    // Sorular gerçek arama sorgularını yansıtır (bilgi arama niyeti).
    faq: [
      {
        question: "PDF dosyaları nasıl ücretsiz birleştirilir?",
        answer:
          "PDF PLATFORM ile PDF dosyalarınızı tarayıcınızda ücretsiz olarak birleştirebilirsiniz. Dosyaları yükleyin, sayfa sırasını sürükleyerek düzenleyin ve birleştirilmiş PDF'i saniyeler içinde indirin — kurulum gerekmez.",
      },
      {
        question:
          "PDF'i Word'e biçimlendirme kaybolmadan nasıl dönüştürebilirim?",
        answer:
          "PDF PLATFORM'daki PDF dönüştürücü, PDF'i Word'e (.docx) çevirirken yazı tipleri, tablolar ve düzeni korur. Sonuç, düzenlemeye hazır tam anlamıyla düzenlenebilir bir belgedir.",
      },
      {
        question: "PDF dosyasının boyutu nasıl küçültülür?",
        answer:
          "PDF'inizi yükleyin, sıkıştırma seviyesini seçin ve optimize edilmiş dosyayı indirin. PDF PLATFORM, metin ve görselleri net tutarken dosya boyutunu e-posta ekleri ve portal yüklemeleri için küçültür.",
      },
      {
        question: "Online PDF aracı kullanırken verilerim güvende mi?",
        answer:
          "PDF PLATFORM işlenen belge içeriklerini saklamaz. Windows uygulaması dosyaları tamamen cihazınızda işler; PDF'leriniz hiçbir zaman bilgisayarınızdan çıkmaz. Web sürümü ise tüm aktarımlar için şifreli bağlantı kullanır.",
      },
      {
        question: "PDF PLATFORM yazılım yüklemeden çalışır mı?",
        answer:
          "Evet. Web sürümü tamamen tarayıcınızda çalışır — kurulum veya eklenti gerekmez. Çevrimdışı kullanım ve yüksek hacimli işlemler için Windows masaüstü uygulaması da mevcuttur.",
      },
    ],
  },
};
