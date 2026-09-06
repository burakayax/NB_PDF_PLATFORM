import { useEffect } from "react";
import type { Language } from "../../i18n/landing";
import { buildBaseStructuredData } from "../../seo/jsonLd";
import { toAbsoluteUrl } from "../../seo/routeSeoConfig";

const SITE_NAME = "PDF Platform";

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
  includePricingOfferSchema?: boolean;
  faqSchema?: Array<{ question: string; answer: string }>;
  breadcrumb?: Array<{ name: string; url: string }>;
  /** Absolute URLs for hreflang alternates */
  hreflang?: Array<{ lang: string; href: string }>;
  /** Sosyal medya profil URL'leri — Organization sameAs. */
  sameAs?: string[];
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

/**
 * Prerender HTML'i (public/**\/index.html) canonical/robots/hreflang/JSON-LD
 * etiketlerini ID'SİZ basar. Bu yardımcılar eskiden yalnızca kendi ID'lerini
 * aradığı için hidrasyondan sonra head'de İKİ canonical, İKİ robots ve ALTI
 * hreflang kalıyordu. Google birden fazla rel=canonical gördüğünde hepsini
 * yok sayar, tekrarlı hreflang de kümeyi geçersiz kılar → GSC "kullanıcı
 * tarafından seçilen kanonik yok" / "kopya" raporları. Çözüm: ID'ye değil
 * ETİKETİN KENDİSİNE göre eşleştir, ilkini sahiplen, fazlalıkları sil.
 */
function adoptOrCreate<T extends HTMLElement>(
  id: string,
  selector: string,
  create: () => T,
): T {
  const existing = Array.from(
    document.head.querySelectorAll<T>(selector),
  );
  // Birden fazla varsa ilkini tut, kalanları temizle (tekrar birikmesin).
  for (let i = 1; i < existing.length; i += 1) {
    existing[i].remove();
  }
  const node = existing[0] ?? create();
  node.id = id;
  if (!node.isConnected) {
    document.head.appendChild(node);
  }
  return node;
}

function upsertCanonical(href: string) {
  const node = adoptOrCreate<HTMLLinkElement>(
    HEAD_IDS.canonical,
    'link[rel="canonical"]',
    () => {
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      return link;
    },
  );
  node.setAttribute("href", href);
}

function upsertRobots(content: string) {
  const node = adoptOrCreate<HTMLMetaElement>(
    HEAD_IDS.robots,
    'meta[name="robots"]',
    () => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      return meta;
    },
  );
  node.setAttribute("content", content);
}

/** Bir JSON-LD düğümünün kimliği: varsa @id, yoksa @type. */
function jsonLdKey(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  const id = record["@id"];
  if (typeof id === "string") return `id:${id}`;
  const type = record["@type"];
  if (typeof type === "string") return `type:${type}`;
  return null;
}

/**
 * Kendi ürettiğimiz JSON-LD bloklarını sil ve prerender'ın ID'siz bloklarından
 * SADECE birazdan yeniden basacaklarımızla çakışanları kaldır.
 *
 * Topluca silmiyoruz: prerender blog sayfaları client'ın üretmediği BlogPosting
 * ve HowTo şemaları taşıyor; hepsini silmek zengin sonuçları kaybettirirdi.
 */
function pruneJsonLd(incoming: Array<Record<string, unknown>>) {
  const incomingKeys = new Set(
    incoming.map(jsonLdKey).filter((k): k is string => k !== null),
  );

  document
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach((script) => {
      // Önceki render'da kendi bastıklarımız → her zaman gider.
      if (script.id.startsWith(HEAD_IDS.jsonLdPrefix)) {
        script.remove();
        return;
      }
      // Prerender bloğu → yalnızca aynı @id/@type'ı yeniden basacaksak sil.
      try {
        const parsed: unknown = JSON.parse(script.textContent ?? "");
        const nodes = Array.isArray(parsed) ? parsed : [parsed];
        if (nodes.some((n) => {
          const key = jsonLdKey(n);
          return key !== null && incomingKeys.has(key);
        })) {
          script.remove();
        }
      } catch {
        /* bozuk JSON-LD'ye dokunma */
      }
    });
}

function appendJsonLd(index: number, data: Record<string, unknown>) {
  const script = document.createElement("script");
  script.id = `${HEAD_IDS.jsonLdPrefix}-${index}`;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

function syncHreflang(items: Array<{ lang: string; href: string }>) {
  // TÜM hreflang link'lerini kaldır (prerender'ın ID'siz olanları dahil) —
  // yoksa aynı dil için iki farklı etiket kalır ve hreflang kümesi geçersiz olur.
  document
    .querySelectorAll("link[rel='alternate'][hreflang]")
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
  includePricingOfferSchema = false,
  faqSchema,
  breadcrumb,
  hreflang,
  sameAs,
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
    upsertMeta("og:image:width", og?.imageWidth ?? "1280", "property");
    upsertMeta("og:image:height", og?.imageHeight ?? "720", "property");
    upsertMeta("og:image:alt", ogTitle, "property");
    upsertMeta("og:url", ogUrl, "property");
    upsertMeta("og:locale", ogLocale, "property");
    upsertMeta("og:locale:alternate", ogLocaleAlt, "property");

    // ── Twitter Card ─────────────────────────────────────────────────────────
    upsertMeta("twitter:card", twitter?.card ?? "summary_large_image");
    upsertMeta("twitter:site", "@nbglobalstudio");
    upsertMeta("twitter:creator", "@nbglobalstudio");
    upsertMeta("twitter:title", twitter?.title ?? ogTitle);
    upsertMeta("twitter:description", twitter?.description ?? ogDescription);
    upsertMeta("twitter:image", toAbsoluteUrl(twitter?.image ?? ogImage));
    upsertMeta("twitter:image:alt", twitter?.title ?? ogTitle);

    // ── hreflang ─────────────────────────────────────────────────────────────
    if (hreflang && hreflang.length > 0) {
      syncHreflang(hreflang);
    }

    // ── JSON-LD ──────────────────────────────────────────────────────────────
    const nodes = buildBaseStructuredData({
      language,
      canonicalUrl,
      pageTitle: title,
      pageDescription: description,
      includeProduct: includeProductSchema,
      includePricingOffer: includePricingOfferSchema,
      includeFaq: faqSchema,
      breadcrumb,
      sameAs,
    });
    pruneJsonLd(nodes);
    nodes.forEach((entry, index) => appendJsonLd(index, entry));
  }, [
    canonical,
    description,
    faqSchema,
    breadcrumb,
    hreflang,
    includeProductSchema,
    includePricingOfferSchema,
    language,
    og,
    robots,
    title,
    twitter,
    sameAs,
  ]);

  return null;
}
