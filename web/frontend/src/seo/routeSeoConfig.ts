import type { Language } from "../i18n/landing";
import { getPublicSiteOrigin } from "../lib/siteOrigin";
import { toolSlugForFeature } from "../lib/toolRoutes";
import type { FeatureKey } from "../api/subscription";

// ─── Types ────────────────────────────────────────────────────────────────────
type SeoRouteConfig = {
  title: string;
  description: string;
  canonicalPath: string;
  index: boolean;
  follow: boolean;
  ogImage?: string;
  /** Pass to SEO component for og:locale */
  ogLocale?: string;
  /** Pass to SEO component for og:locale:alternate */
  ogLocaleAlternate?: string;
};

export type SeoRouteContext = {
  pathname: string;
  view: string;
  language: Language;
  selectedFeatureId?: FeatureKey | null;
  isAuthenticated?: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const BRAND = "PDF PLATFORM";

const LOCALE: Record<Language, string> = {
  tr: "tr_TR",
  en: "en_US",
};
const LOCALE_ALT: Record<Language, string> = {
  tr: "en_US",
  en: "tr_TR",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

/**
 * Per-tool SEO copy. Each entry targets the keyword users type when searching
 * for that specific PDF operation.
 *
 * title: ≤60 chars (primary keyword first)
 * description: ≤155 chars (include primary + secondary keyword)
 */
function toolSeo(
  slug: string,
  language: Language,
): Pick<SeoRouteConfig, "title" | "description"> {
  const map: Record<
    string,
    Record<Language, { title: string; description: string }>
  > = {
    "merge-pdf": {
      en: {
        title: `Merge PDF files online — free | ${BRAND}`,
        description:
          "Merge PDF files instantly in your browser. Combine multiple PDFs into one document — no installation, no sign-up required.",
      },
      tr: {
        title: `PDF Birleştirme — online ve ücretsiz | ${BRAND}`,
        description:
          "PDF dosyalarını tarayıcınızda anında birleştirin. Birden fazla PDF'i tek belgede toplayın — kurulum veya üyelik gerekmez.",
      },
    },
    "split-pdf": {
      en: {
        title: `Split PDF — extract pages online | ${BRAND}`,
        description:
          "Split a PDF into separate pages or custom ranges. Extract exactly the pages you need — fast and free in your browser.",
      },
      tr: {
        title: `PDF Ayırma — sayfaları online çıkarın | ${BRAND}`,
        description:
          "PDF'i ayrı sayfalara veya özel aralıklara bölün. İhtiyacınız olan sayfaları hızlıca çıkarın — tarayıcıda ücretsiz.",
      },
    },
    "compress-pdf": {
      en: {
        title: `Compress PDF — reduce file size online | ${BRAND}`,
        description:
          "Compress PDF files to reduce size without losing quality. Optimize PDFs for email attachments and uploads — free online tool.",
      },
      tr: {
        title: `PDF Sıkıştırma — dosya boyutunu küçültün | ${BRAND}`,
        description:
          "PDF dosyalarını kalite kaybı olmadan sıkıştırın. E-posta ekleri ve yüklemeler için PDF'i optimize edin — ücretsiz online araç.",
      },
    },
    "pdf-to-word": {
      en: {
        title: `PDF to Word converter — keep formatting | ${BRAND}`,
        description:
          "Convert PDF to Word (.docx) without losing fonts, tables, or layout. Fast, accurate PDF converter — free in your browser.",
      },
      tr: {
        title: `PDF'i Word'e Dönüştür — biçim bozulmaz | ${BRAND}`,
        description:
          "PDF'i Word'e (.docx) yazı tipleri, tablolar ve düzen korunarak dönüştürün. Hızlı ve doğru PDF dönüştürücü — tarayıcıda ücretsiz.",
      },
    },
    "pdf-to-excel": {
      en: {
        title: `PDF to Excel converter online | ${BRAND}`,
        description:
          "Convert PDF tables to editable Excel spreadsheets. Extract data from PDFs into .xlsx format for reporting and analysis.",
      },
      tr: {
        title: `PDF'i Excel'e Dönüştür — online araç | ${BRAND}`,
        description:
          "PDF tablolarını düzenlenebilir Excel dosyasına dönüştürün. Raporlama ve analiz için PDF'teki verileri .xlsx formatına aktarın.",
      },
    },
    "word-to-pdf": {
      en: {
        title: `Word to PDF converter online | ${BRAND}`,
        description:
          "Convert Word documents to PDF online. Preserve layout and fonts — fast, free Word to PDF conversion in your browser.",
      },
      tr: {
        title: `Word'ü PDF'e Dönüştür — online ücretsiz | ${BRAND}`,
        description:
          "Word belgelerini online PDF'e dönüştürün. Düzen ve yazı tipleri korunur — tarayıcıda hızlı ve ücretsiz Word'den PDF dönüşümü.",
      },
    },
    "sign-pdf": {
      en: {
        title: `Sign PDF online — add e-signature | ${BRAND}`,
        description:
          "Sign PDF documents online without printing. Add an electronic signature to contracts and forms — fast and secure.",
      },
      tr: {
        title: `PDF İmzalama — online elektronik imza | ${BRAND}`,
        description:
          "PDF belgelerini yazdırmadan online imzalayın. Sözleşme ve formlara elektronik imza ekleyin — hızlı ve güvenli.",
      },
    },
    "encrypt-pdf": {
      en: {
        title: `Encrypt PDF — password protect your file | ${BRAND}`,
        description:
          "Add a password to your PDF to restrict access. Encrypt PDF files to keep sensitive documents secure.",
      },
      tr: {
        title: `PDF Şifreleme — dosyaya parola ekleyin | ${BRAND}`,
        description:
          "PDF'inize parola ekleyerek erişimi kısıtlayın. Hassas belgeleri güvende tutmak için PDF dosyalarını şifreleyin.",
      },
    },
  };

  const entry = map[slug];
  if (entry) return entry[language];

  // Generic fallback for unmapped tool slugs
  const label = slug.replace(/-/g, " ");
  return language === "tr"
    ? {
        title: `${label} — PDF aracı | ${BRAND}`,
        description: `${label} işlemini güvenli şekilde gerçekleştirin, dosyanızı hızlıca işleyin ve sonuçları indirin.`,
      }
    : {
        title: `${label} — PDF tool | ${BRAND}`,
        description: `Run the ${label} tool securely, process your file quickly, and download results instantly.`,
      };
}

// ─── Landing / home SEO ───────────────────────────────────────────────────────
function landingSeo(
  language: Language,
): Pick<SeoRouteConfig, "title" | "description"> {
  // title: ≤60 chars — primary keyword "merge PDF" first
  // description: ≤155 chars — covers merge, convert, compress, edit
  if (language === "tr") {
    return {
      title: `PDF Birleştir, Dönüştür, Sıkıştır | ${BRAND}`,
      description:
        "PDF birleştirme, dönüştürme, sıkıştırma ve düzenleme işlemlerini tek platformda yapın. Kurulum gerekmez — tarayıcıdan ve Windows'tan çalışır.",
    };
  }
  return {
    title: `Merge PDF, Convert, Compress & Edit | ${BRAND}`,
    description:
      "Merge PDF files, convert documents, compress and edit PDFs from one place. No installation needed — works in your browser and on Windows.",
  };
}

// ─── Public resolver ─────────────────────────────────────────────────────────
export function resolveRouteSeo(context: SeoRouteContext): SeoRouteConfig {
  const pathname = normalizePath(context.pathname);
  const locale = LOCALE[context.language];
  const localeAlt = LOCALE_ALT[context.language];

  // ── Tool page ──────────────────────────────────────────────────────────────
  if (context.view === "web" && context.selectedFeatureId) {
    const slug = toolSlugForFeature(context.selectedFeatureId);
    const copy = toolSeo(slug, context.language);
    return {
      ...copy,
      canonicalPath: `/tools/${slug}`,
      index: true,
      follow: true,
      ogImage: "/app-preview-main.png",
      ogLocale: locale,
      ogLocaleAlternate: localeAlt,
    };
  }

  // ── Landing / home ─────────────────────────────────────────────────────────
  if (context.view === "landing" || pathname === "/") {
    return {
      ...landingSeo(context.language),
      canonicalPath: "/",
      index: true,
      follow: true,
      ogImage: "/app-preview-main.png",
      ogLocale: locale,
      ogLocaleAlternate: localeAlt,
    };
  }

  // ── About ──────────────────────────────────────────────────────────────────
  if (context.view === "about" || pathname === "/about") {
    return {
      title:
        context.language === "tr"
          ? `Hakkımızda | ${BRAND}`
          : `About | ${BRAND}`,
      description:
        context.language === "tr"
          ? "PDF PLATFORM hakkında, vizyon, misyon ve değerlerimiz."
          : "Learn about PDF PLATFORM, our vision, mission and values.",
      canonicalPath: "/about",
      index: true,
      follow: true,
      ogImage: "/app-preview-main.png",
      ogLocale: locale,
      ogLocaleAlternate: localeAlt,
    };
  }

  // ── Pricing ────────────────────────────────────────────────────────────────
  if (context.view === "pricing" || pathname === "/pricing") {
    return {
      title:
        context.language === "tr"
          ? `PDF Araçları Fiyatlandırma — 7 Gün İade Garantisi | ${BRAND}`
          : `PDF Tools Pricing — 7-Day Money-Back Guarantee | ${BRAND}`,
      description:
        context.language === "tr"
          ? "PDF birleştirme, dönüştürme ve sıkıştırma araçları için planları inceleyin. 7 gün koşulsuz para iade garantisi. Ücretsiz başlayın, istediğiniz zaman iptal edin."
          : "Explore plans for PDF merge, convert, and compress tools. 7-day money-back guarantee, cancel anytime. Start free today.",
      canonicalPath: "/pricing",
      index: true,
      follow: true,
      ogImage: "/app-preview-main.png",
      ogLocale: locale,
      ogLocaleAlternate: localeAlt,
    };
  }

  // ── Terms ──────────────────────────────────────────────────────────────────
  if (context.view === "terms") {
    return {
      title: `${context.language === "tr" ? "Hizmet Şartları" : "Terms of Service"} | ${BRAND}`,
      description:
        context.language === "tr"
          ? "PDF PLATFORM hizmet şartlarını okuyun."
          : "Read the terms of service for PDF PLATFORM.",
      canonicalPath: "/terms",
      index: true,
      follow: true,
      ogLocale: locale,
      ogLocaleAlternate: localeAlt,
    };
  }

  // ── Privacy ────────────────────────────────────────────────────────────────
  if (context.view === "privacy") {
    return {
      title: `${context.language === "tr" ? "Gizlilik Politikası" : "Privacy Policy"} | ${BRAND}`,
      description:
        context.language === "tr"
          ? "PDF PLATFORM gizlilik politikasını okuyun."
          : "Read the privacy policy for PDF PLATFORM.",
      canonicalPath: "/privacy",
      index: true,
      follow: true,
      ogLocale: locale,
      ogLocaleAlternate: localeAlt,
    };
  }

  // ── KVKK ──────────────────────────────────────────────────────────────────
  if (context.view === "kvkk") {
    return {
      title: `KVKK Aydınlatma Metni | ${BRAND}`,
      description:
        "PDF PLATFORM kişisel verilerin işlenmesine ilişkin KVKK aydınlatma metnini okuyun.",
      canonicalPath: "/kvkk",
      index: true,
      follow: true,
      ogLocale: locale,
      ogLocaleAlternate: localeAlt,
    };
  }

  // ── Auth / admin — noindex ────────────────────────────────────────────────
  if (
    context.view === "login" ||
    context.view === "register" ||
    context.view === "forgot_password"
  ) {
    return {
      title: `${BRAND} — ${context.language === "tr" ? "Hesap Erişimi" : "Account Access"}`,
      description:
        context.language === "tr"
          ? "PDF çalışma alanınıza erişmek için giriş yapın veya hesap oluşturun."
          : "Sign in or create an account to access your PDF workspace.",
      canonicalPath: "/",
      index: false,
      follow: false,
      ogLocale: locale,
      ogLocaleAlternate: localeAlt,
    };
  }

  if (pathname === "/admin-login" || context.view === "admin_login") {
    return {
      title: `Admin login | ${BRAND}`,
      description: "Administrator sign-in for PDF PLATFORM operations.",
      canonicalPath: "/admin-login",
      index: false,
      follow: false,
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return {
    ...landingSeo(context.language),
    canonicalPath: "/",
    index: true,
    follow: true,
    ogImage: "/app-preview-main.png",
    ogLocale: locale,
    ogLocaleAlternate: localeAlt,
  };
}

// ─── URL helper ───────────────────────────────────────────────────────────────
export function toAbsoluteUrl(pathOrUrl: string): string {
  const originBase = getPublicSiteOrigin();
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${originBase}${path}`;
}
