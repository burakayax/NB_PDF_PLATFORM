import type { Language } from "../../i18n/landing";
import type { FeatureKey } from "../../api/subscription";
import { resolveRouteSeo } from "../../seo/routeSeoConfig";
import { SEO } from "./SEO";

type SeoRouteManagerProps = {
  pathname: string;
  view: string;
  language: Language;
  selectedFeatureId?: FeatureKey | null;
};

export function SeoRouteManager({
  pathname,
  view,
  language,
  selectedFeatureId,
}: SeoRouteManagerProps) {
  const seo = resolveRouteSeo({
    pathname,
    view,
    language,
    selectedFeatureId,
  });

  return (
    <SEO
      title={seo.title}
      description={seo.description}
      canonical={seo.canonicalPath}
      language={language}
      robots={seo.index ? (seo.follow ? "index, follow" : "index, nofollow") : "noindex, nofollow"}
      og={{
        title: seo.title,
        description: seo.description,
        image: seo.ogImage ?? "/app-preview-main.png",
        url: seo.canonicalPath,
      }}
      twitter={{
        card: "summary_large_image",
        title: seo.title,
        description: seo.description,
        image: seo.ogImage ?? "/app-preview-main.png",
      }}
      includeProductSchema={view === "landing" || view === "web"}
    />
  );
}
