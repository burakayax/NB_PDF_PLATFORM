import type { Language } from "../../i18n/landing";
import type { FeatureKey } from "../../api/subscription";
import { resolveRouteSeo, toAbsoluteUrl } from "../../seo/routeSeoConfig";
import { getPublicSiteOrigin } from "../../lib/siteOrigin";
import { landingTranslations } from "../../i18n/landing";
import { SEO } from "./SEO";

type SeoRouteManagerProps = {
  pathname: string;
  view: string;
  language: Language;
  selectedFeatureId?: FeatureKey | null;
  /**
   * Site origin e.g. "https://nbpdfplatform.com"
   * Used to generate hreflang alternates and absolute canonical URLs.
   * Boş bırakılırsa getPublicSiteOrigin() (VITE_PUBLIC_SITE_URL veya window.origin) kullanılır.
   */
  siteOrigin?: string;
};

export function SeoRouteManager({
  pathname,
  view,
  language,
  selectedFeatureId,
  siteOrigin: siteOriginProp = "",
}: SeoRouteManagerProps) {
  // Origin verilmediyse merkezi yardımcıdan al — hreflang her zaman üretilebilsin.
  const siteOrigin = siteOriginProp || getPublicSiteOrigin();
  // ── Resolve route-specific SEO config ─────────────────────────────────────
  const seo = resolveRouteSeo({
    pathname,
    view,
    language,
    selectedFeatureId,
  });

  // ── FAQ for landing page (feeds into FAQPage schema) ────────────────────────
  const faqSchema =
    view === "landing" || pathname === "/"
      ? landingTranslations[language].faq
      : undefined;

  // ── Breadcrumb for tool pages ────────────────────────────────────────────────
  const breadcrumb =
    view === "web" && selectedFeatureId
      ? [
          {
            name: "PDF PLATFORM",
            url: siteOrigin || toAbsoluteUrl("/"),
          },
          {
            name: seo.title.split(" | ")[0] ?? seo.title,
            url: toAbsoluteUrl(seo.canonicalPath),
          },
        ]
      : undefined;

  // ── hreflang ──────────────────────────────────────────────────────────────
  // Bu SPA'da dil URL'ye değil client tercihine bağlıdır; aynı kanonik URL hem
  // TR hem EN içeriği sunar. Bu yüzden her iki dil de aynı sayfaya işaret eder.
  const canonicalAbsolute = `${siteOrigin}${seo.canonicalPath === "/" ? "" : seo.canonicalPath}` || "/";
  const hreflang = siteOrigin
    ? [
        { lang: "tr", href: canonicalAbsolute || `${siteOrigin}/` },
        { lang: "en", href: canonicalAbsolute || `${siteOrigin}/` },
        { lang: "x-default", href: canonicalAbsolute || `${siteOrigin}/` },
      ]
    : undefined;

  return (
    <SEO
      title={seo.title}
      description={seo.description}
      canonical={seo.canonicalPath}
      language={language}
      robots={
        seo.index
          ? seo.follow
            ? "index, follow, max-image-preview:large"
            : "index, nofollow"
          : "noindex, nofollow"
      }
      og={{
        title: seo.title,
        description: seo.description,
        image: seo.ogImage ?? "/app-preview-main.png",
        imageWidth: "1200",
        imageHeight: "630",
        url: seo.canonicalPath,
        locale: seo.ogLocale,
        localeAlternate: seo.ogLocaleAlternate,
      }}
      twitter={{
        card: "summary_large_image",
        title: seo.title,
        description: seo.description,
        image: seo.ogImage ?? "/app-preview-main.png",
      }}
      includeProductSchema={view === "landing" || view === "web"}
      includePricingOfferSchema={view === "pricing"}
      faqSchema={faqSchema}
      breadcrumb={breadcrumb}
      hreflang={hreflang}
    />
  );
}
