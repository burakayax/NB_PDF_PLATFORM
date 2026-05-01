import type { Language } from "../../i18n/landing";
import type { FeatureKey } from "../../api/subscription";
import { resolveRouteSeo, toAbsoluteUrl } from "../../seo/routeSeoConfig";
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
   * REQUIRED for proper multi-language SEO.
   */
  siteOrigin?: string;
};

export function SeoRouteManager({
  pathname,
  view,
  language,
  selectedFeatureId,
  siteOrigin = "",
}: SeoRouteManagerProps) {
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
            name: "NB PDF PLATFORM",
            url: siteOrigin || toAbsoluteUrl("/"),
          },
          {
            name: seo.title.split(" | ")[0] ?? seo.title,
            url: toAbsoluteUrl(seo.canonicalPath),
          },
        ]
      : undefined;

  // ── hreflang: TR root / EN root / x-default ───────────────────────────────
  // Only generate if siteOrigin is provided
  const hreflang = siteOrigin
    ? [
        { lang: "tr", href: `${siteOrigin}/` },
        { lang: "en", href: `${siteOrigin}/en` },
        { lang: "x-default", href: `${siteOrigin}/` },
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
      faqSchema={faqSchema}
      breadcrumb={breadcrumb}
      hreflang={hreflang}
    />
  );
}
