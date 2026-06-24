import type { Language } from "../i18n/landing";
import { getPublicSiteOrigin } from "../lib/siteOrigin";
import { toolSlugForFeature } from "../lib/toolRoutes";
import type { FeatureKey } from "../api/subscription";
// Tek gerçek SEO içerik kaynağı — statik prerender (generate-seo-files.mjs) ile
// runtime'ın aynı metni kullanmasını garanti eder.
import { getToolSeo, LANDING_SEO } from "./seoContent.mjs";

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
  // Paylaşılan tek kaynaktan (seoContent.mjs) — statik prerender ile birebir aynı.
  const shared = getToolSeo(slug, language);
  if (shared) {
    return { title: shared.title, description: shared.description };
  }

  // Eşlenmemiş araç slug'ı için jenerik yedek
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
  // Paylaşılan tek kaynaktan — statik prerender ile birebir aynı metin.
  const shared = LANDING_SEO[language];
  return { title: shared.title, description: shared.description };
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

  if (pathname === "/nbadmin" || context.view === "admin_login") {
    return {
      title: `Admin login | ${BRAND}`,
      description: "Administrator sign-in for PDF PLATFORM operations.",
      canonicalPath: "/nbadmin",
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
