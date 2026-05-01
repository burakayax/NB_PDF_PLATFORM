import { useEffect } from "react";
import type { Language } from "../../i18n/landing";
import { buildBaseStructuredData } from "../../seo/jsonLd";
import { toAbsoluteUrl } from "../../seo/routeSeoConfig";

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
    url?: string;
    type?: string;
  };
  twitter?: {
    card?: "summary" | "summary_large_image";
    title?: string;
    description?: string;
    image?: string;
  };
  includeProductSchema?: boolean;
  faqSchema?: Array<{ question: string; answer: string }>;
};

const HEAD_IDS = {
  canonical: "nb-seo-canonical-global",
  robots: "nb-seo-robots-global",
  jsonLdPrefix: "nb-seo-jsonld-global",
};

function upsertMeta(name: string, content: string, by: "name" | "property" = "name") {
  const selector = `meta[${by}="${name}"]`;
  let node = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(by, name);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let node = document.getElementById(HEAD_IDS.canonical) as HTMLLinkElement | null;
  if (!node) {
    node = document.createElement("link");
    node.id = HEAD_IDS.canonical;
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

function upsertRobots(content: string) {
  let node = document.getElementById(HEAD_IDS.robots) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement("meta");
    node.id = HEAD_IDS.robots;
    node.setAttribute("name", "robots");
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function clearJsonLd() {
  const scripts = document.querySelectorAll(`script[id^="${HEAD_IDS.jsonLdPrefix}"]`);
  scripts.forEach((s) => s.remove());
}

function appendJsonLd(index: number, data: Record<string, unknown>) {
  const script = document.createElement("script");
  script.id = `${HEAD_IDS.jsonLdPrefix}-${index}`;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

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
}: SEOProps) {
  useEffect(() => {
    const canonicalUrl = toAbsoluteUrl(canonical);
    const ogTitle = og?.title || title;
    const ogDescription = og?.description || description;
    const ogUrl = toAbsoluteUrl(og?.url || canonicalUrl);
    const ogImage = toAbsoluteUrl(og?.image || "/app-preview-main.png");

    document.title = title;
    document.documentElement.setAttribute("lang", language);
    upsertMeta("description", description);
    upsertCanonical(canonicalUrl);
    upsertRobots(robots);
    upsertMeta("og:title", ogTitle, "property");
    upsertMeta("og:description", ogDescription, "property");
    upsertMeta("og:image", ogImage, "property");
    upsertMeta("og:url", ogUrl, "property");
    upsertMeta("og:type", og?.type || "website", "property");

    upsertMeta("twitter:card", twitter?.card || "summary_large_image");
    upsertMeta("twitter:title", twitter?.title || title);
    upsertMeta("twitter:description", twitter?.description || description);
    upsertMeta("twitter:image", toAbsoluteUrl(twitter?.image || ogImage));

    clearJsonLd();
    const nodes = buildBaseStructuredData({
      language,
      canonicalUrl,
      pageTitle: title,
      pageDescription: description,
      includeProduct: includeProductSchema,
      includeFaq: faqSchema,
    });
    nodes.forEach((entry, index) => appendJsonLd(index, entry));
  }, [
    canonical,
    description,
    faqSchema,
    includeProductSchema,
    language,
    og,
    robots,
    title,
    twitter,
  ]);

  return null;
}
