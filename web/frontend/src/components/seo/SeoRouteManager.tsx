import type { Language } from "../../i18n/landing";
import type { FeatureKey } from "../../api/subscription";
import { resolveRouteSeo, toAbsoluteUrl } from "../../seo/routeSeoConfig";
import { getPublicSiteOrigin } from "../../lib/siteOrigin";
import { landingTranslations } from "../../i18n/landing";
import { useSettings } from "../../contexts/SettingsContext";
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
  // Admin panelinden yönetilen sosyal medya profilleri → Organization sameAs.
  const { site } = useSettings();
  const sameAs = site.socialLinks ?? [];
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
            name: "PDF Platform",
            url: siteOrigin || toAbsoluteUrl("/"),
          },
          {
            name: seo.title.split(" | ")[0] ?? seo.title,
            url: toAbsoluteUrl(seo.canonicalPath),
          },
        ]
      : undefined;

  // ── Çok dilli canonical + hreflang ──────────────────────────────────────────
  // TR öneksiz, EN /en/ alt dizininde yayınlanır (prerender + sitemap ile birebir).
  // Aktif dil "en" ise canonical /en önekli olur; her iki sürüm karşılıklı
  // hreflang taşır, x-default = TR.
  const barePath = seo.canonicalPath;
  const enPath = barePath === "/" ? "/en" : `/en${barePath}`;
  const activePath = language === "en" ? enPath : barePath;
  const trAbsolute = `${siteOrigin}${barePath === "/" ? "" : barePath}` || `${siteOrigin}/`;
  const enAbsolute = `${siteOrigin}${enPath}`;
  const hreflang = siteOrigin
    ? [
        { lang: "tr", href: trAbsolute || `${siteOrigin}/` },
        { lang: "en", href: enAbsolute },
        { lang: "x-default", href: trAbsolute || `${siteOrigin}/` },
      ]
    : undefined;

  return (
    <SEO
      title={seo.title}
      description={seo.description}
      canonical={activePath}
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
        imageWidth: "1280",
        imageHeight: "720",
        url: activePath,
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
      sameAs={sameAs}
    />
  );
}
