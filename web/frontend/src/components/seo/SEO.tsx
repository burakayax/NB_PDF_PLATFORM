import { useEffect } from "react";
import type { Language } from "../../i18n/landing";
import { buildBaseStructuredData } from "../../seo/jsonLd";
import { toAbsoluteUrl } from "../../seo/routeSeoConfig";

const SITE_NAME = "NB PDF PLATFORM";

type SEOProps = {
  title: string;
  description: string;
  canonical: string;
  language: Language;
  robots?: string;
  og?: {
    title?: string;
    description?: string;
    image?: string;
    imageWidth?: string;
    imageHeight?: string;
    url?: string;
    type?: string;
    locale?: string;
    localeAlternate?: string;
  };
  twitter?: {
    card?: "summary" | "summary_large_image";
    title?: string;
    description?: string;
    image?: string;
  };
  includeProductSchema?: boolean;
  faqSchema?: Array<{ question: string; answer: string }>;
  breadcrumb?: Array<{ name: string; url: string }>;
  /** Absolute URLs for hreflang alternates */
  hreflang?: Array<{ lang: string; href: string }>;
};

// ─── head helpers ─────────────────────────────────────────────────────────────
const HEAD_IDS = {
  canonical: "nb-seo-canonical-global",
  robots: "nb-seo-robots-global",
  jsonLdPrefix: "nb-seo-jsonld-global",
  hreflangPrefix: "nb-seo-hreflang",
};

function upsertMeta(
  name: string,
  content: string,
  by: "name" | "property" = "name",
) {
  const selector = `meta[${by}="${CSS.escape(name)}"]`;
  let node = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(by, name);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let node = document.getElementById(
    HEAD_IDS.canonical,
  ) as HTMLLinkElement | null;
  if (!node) {
    node = document.createElement("link");
    node.id = HEAD_IDS.canonical;
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

function upsertRobots(content: string) {
  let node = document.getElementById(
    HEAD_IDS.robots,
  ) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement("meta");
    node.id = HEAD_IDS.robots;
    node.setAttribute("name", "robots");
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function clearJsonLd() {
  document
    .querySelectorAll(`script[id^="${HEAD_IDS.jsonLdPrefix}"]`)
    .forEach((s) => s.remove());
}

function appendJsonLd(index: number, data: Record<string, unknown>) {
  const script = document.createElement("script");
  script.id = `${HEAD_IDS.jsonLdPrefix}-${index}`;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

function syncHreflang(items: Array<{ lang: string; href: string }>) {
  // Remove stale hreflang links
  document
    .querySelectorAll(`link[id^="${HEAD_IDS.hreflangPrefix}"]`)
    .forEach((el) => el.remove());

  items.forEach(({ lang, href }, i) => {
    const link = document.createElement("link");
    link.id = `${HEAD_IDS.hreflangPrefix}-${i}`;
    link.setAttribute("rel", "alternate");
    link.setAttribute("hreflang", lang);
    link.setAttribute("href", href);
    document.head.appendChild(link);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SEO({
  title,
  description,
  canonical,
  language,
  robots = "index, follow",
  og,
  twitter,
  includeProductSchema = false,
  faqSchema,
  breadcrumb,
  hreflang,
}: SEOProps) {
  useEffect(() => {
    const canonicalUrl = toAbsoluteUrl(canonical);
    const ogTitle = og?.title ?? title;
    const ogDescription = og?.description ?? description;
    const ogUrl = toAbsoluteUrl(og?.url ?? canonicalUrl);
    const ogImage = toAbsoluteUrl(og?.image ?? "/app-preview-main.png");
    const ogLocale = og?.locale ?? (language === "tr" ? "tr_TR" : "en_US");
    const ogLocaleAlt =
      og?.localeAlternate ?? (language === "tr" ? "en_US" : "tr_TR");

    // ── Basic ────────────────────────────────────────────────────────────────
    document.title = title;
    document.documentElement.setAttribute(
      "lang",
      language === "tr" ? "tr" : "en",
    );
    upsertMeta("description", description);
    upsertCanonical(canonicalUrl);
    upsertRobots(robots);

    // ── Open Graph ───────────────────────────────────────────────────────────
    upsertMeta("og:type", og?.type ?? "website", "property");
    upsertMeta("og:site_name", SITE_NAME, "property");
    upsertMeta("og:title", ogTitle, "property");
    upsertMeta("og:description", ogDescription, "property");
    upsertMeta("og:image", ogImage, "property");
    upsertMeta("og:image:width", og?.imageWidth ?? "1200", "property");
    upsertMeta("og:image:height", og?.imageHeight ?? "630", "property");
    upsertMeta("og:image:alt", ogTitle, "property");
    upsertMeta("og:url", ogUrl, "property");
    upsertMeta("og:locale", ogLocale, "property");
    upsertMeta("og:locale:alternate", ogLocaleAlt, "property");

    // ── Twitter Card ─────────────────────────────────────────────────────────
    upsertMeta("twitter:card", twitter?.card ?? "summary_large_image");
    upsertMeta("twitter:title", twitter?.title ?? ogTitle);
    upsertMeta("twitter:description", twitter?.description ?? ogDescription);
    upsertMeta("twitter:image", toAbsoluteUrl(twitter?.image ?? ogImage));
    upsertMeta("twitter:image:alt", twitter?.title ?? ogTitle);

    // ── hreflang ─────────────────────────────────────────────────────────────
    if (hreflang && hreflang.length > 0) {
      syncHreflang(hreflang);
    }

    // ── JSON-LD ──────────────────────────────────────────────────────────────
    clearJsonLd();
    const nodes = buildBaseStructuredData({
      language,
      canonicalUrl,
      pageTitle: title,
      pageDescription: description,
      includeProduct: includeProductSchema,
      includeFaq: faqSchema,
      breadcrumb,
    });
    nodes.forEach((entry, index) => appendJsonLd(index, entry));
  }, [
    canonical,
    description,
    faqSchema,
    breadcrumb,
    hreflang,
    includeProductSchema,
    language,
    og,
    robots,
    title,
    twitter,
  ]);

  return null;
}
