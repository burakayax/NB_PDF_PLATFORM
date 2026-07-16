/**
 * Production SEO assets (TR birincil, EN ikincil — /en/ alt dizini):
 * - robots.txt
 * - sitemap.xml (lastmod + çift yönlü hreflang dahil)
 * - prerendered static HTML snapshots (gerçek görünür gövde + zengin JSON-LD)
 *   TR (öneksiz) + EN (/en/ önekli) sürümler.
 *
 * Tüm metin/şema içeriği TEK kaynaktan gelir: src/seo/seoContent.mjs
 * Böylece Google'ın gördüğü statik HTML, tarayıcıda enjekte edilen runtime
 * meta verileriyle hiçbir zaman ayrışmaz.
 *
 * Çok dilli model: her mantıksal sayfa iki URL'de yayınlanır —
 *   TR: https://site/tools/merge-pdf     (canonical=kendisi)
 *   EN: https://site/en/tools/merge-pdf  (canonical=kendisi)
 * İkisi de karşılıklı hreflang (tr <-> en) + x-default=TR taşır.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BRAND,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_OG_IMAGE_HEIGHT,
  TOOL_SLUGS,
  TOOL_SEO,
  LANDING_SEO,
  PRICING_SEO,
  API_SEO,
  LEGAL_SEO,
  SOFTWARE_FEATURE_LIST,
  RELATED_TOOLS as TOOL_RELATED_TOOLS,
  BLOG_RELATED_TOOLS,
} from "../src/seo/seoContent.mjs";
import { BLOG_POSTS, getBlogPostsSorted } from "../src/blog/blogContent.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const publicDir = join(frontendRoot, "public");

/** Statik prerender birincil dili. Hedef pazar Türkiye → "tr". */
const PRIMARY_LANG = "tr";
/** Desteklenen diller (öneksiz TR + /en/ önekli EN). */
const LANGS = ["tr", "en"];

// ─── Dile göre URL öneki / yol yardımcıları ──────────────────────────────────
/** EN sayfaları /en/ altında; TR öneksiz. */
function langPrefix(lang) {
  return lang === "en" ? "/en" : "";
}
/** routePath ("/", "/tools/x", ...) → o dildeki tam URL (canonical). */
function urlForRoute(baseUrl, routePath, lang) {
  const suffix = routePath === "/" ? "" : routePath;
  return `${baseUrl}${langPrefix(lang)}${suffix}` || baseUrl;
}
/** routePath → o dildeki public/ çıktı dosya yolu. */
function outFileForRoute(routePath, lang) {
  const rel = routePath === "/" ? "" : routePath.replace(/^\//, "");
  return join(publicDir, langPrefix(lang).replace(/^\//, ""), rel, "index.html");
}
/** Görünür gövde/iç link öneki (EN sayfalarda linkler /en/ altında kalsın). */
function linkBase(lang) {
  return langPrefix(lang);
}

// ─── Dile bağlı sabit arayüz metinleri (görünür gövde + şema) ─────────────────
const UI = {
  tr: {
    relatedTools: "İlgili Araçlar",
    relatedGuides: "İlgili Rehberler",
    toolsForTask: "Bu İşi Yapan PDF Araçları",
    allTools: "Tüm PDF Araçları",
    allPosts: "Tüm Yazılar",
    faqHeading: "Sık Sorulan Sorular",
    ariaRelatedTools: "İlgili araçlar",
    ariaToolsForTask: "İlgili PDF araçları",
    ariaRelatedGuides: "İlgili rehberler",
    ariaBlogPosts: "Blog yazıları",
    ariaAllTools: "PDF araçları",
    ariaFaq: "Sık sorulan sorular",
    pricingCta: (base) =>
      `<p><a href="${base}/register">Ücretsiz başlayın</a> veya <a href="${base || "/"}">tüm PDF araçlarını</a> inceleyin.</p>`,
    blogIndex: {
      title: `Blog — Rehberler & İpuçları | ${BRAND}`,
      description:
        "PDF işlerini hızlandıran pratik rehberler: birleştirme, veri çıkarma, çeviri ve yapay zekâ araçlarıyla iş akışınızı kolaylaştırın.",
      h1: "PDF Platform Blog",
      intro:
        "PDF birleştirme, faturadan veri çıkarma, çeviri ve yapay zekâ araçlarıyla iş akışınızı kolaylaştıran pratik rehberler.",
    },
    genericToolDesc: (label) =>
      `${label} işlemini güvenli, profesyonel bir PDF platformunda gerçekleştirin.`,
    genericToolIntro: (label) =>
      `${label} aracını kullanın; dosyanızı yükleyin, işleyin ve sonucu indirin.`,
    orgDescription:
      "Profesyonel PDF birleştirme, dönüştürme, sıkıştırma ve düzenleme platformu — iş süreçleri için tasarlandı.",
    softwareOfferDesc:
      "Ücretsiz plan mevcut. Ücretsiz paket ve aylık abonelik seçenekleri sunulmaktadır.",
    pricingOfferName: "PDF Platform — Abonelik Planları",
    pricingOfferDesc:
      "Ücretsiz plan dahil aylık abonelik seçenekleri. 7 gün koşulsuz para iade garantisi.",
    returnPolicyName: "7 Gün Para İade Garantisi",
    returnPolicyDesc:
      "Satın alma tarihinden itibaren 7 gün içinde tam iade. Gerekçe belirtmenize gerek yoktur.",
    inLanguageTag: "tr-TR",
    ogLocale: "tr_TR",
    ogLocaleAlt: "en_US",
    priceCurrency: "TRY",
  },
  en: {
    relatedTools: "Related Tools",
    relatedGuides: "Related Guides",
    toolsForTask: "PDF Tools for This Task",
    allTools: "All PDF Tools",
    allPosts: "All Posts",
    faqHeading: "Frequently Asked Questions",
    ariaRelatedTools: "Related tools",
    ariaToolsForTask: "Related PDF tools",
    ariaRelatedGuides: "Related guides",
    ariaBlogPosts: "Blog posts",
    ariaAllTools: "PDF tools",
    ariaFaq: "Frequently asked questions",
    pricingCta: (base) =>
      `<p><a href="${base}/register">Start for free</a> or explore <a href="${base || "/"}">all PDF tools</a>.</p>`,
    blogIndex: {
      title: `Blog — Guides & Tips | ${BRAND}`,
      description:
        "Practical guides that speed up your PDF work: merging, data extraction, translation, and AI tools to streamline your workflow.",
      h1: "PDF Platform Blog",
      intro:
        "Practical guides on PDF merging, invoice data extraction, translation, and AI tools to streamline your workflow.",
    },
    genericToolDesc: (label) =>
      `Perform ${label} on a secure, professional PDF platform.`,
    genericToolIntro: (label) =>
      `Use the ${label} tool: upload your file, process it, and download the result.`,
    orgDescription:
      "Professional PDF merge, convert, compress, and edit platform — built for business document workflows.",
    softwareOfferDesc:
      "Free plan available. Free packs and monthly subscription plans offered.",
    pricingOfferName: "PDF Platform — Subscription Plans",
    pricingOfferDesc:
      "Monthly subscription plans including a free tier. 7-day no-questions-asked money-back guarantee.",
    returnPolicyName: "7-Day Money-Back Guarantee",
    returnPolicyDesc:
      "Full refund within 7 days of purchase. No questions asked.",
    inLanguageTag: "en-US",
    ogLocale: "en_US",
    ogLocaleAlt: "tr_TR",
    priceCurrency: "USD",
  },
};

function readEnvBaseUrl() {
  let base =
    String(
      process.env.VITE_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "",
    ).trim() || "";
  const envFile = join(frontendRoot, ".env");
  if (!base && existsSync(envFile)) {
    const raw = readFileSync(envFile, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(
        /^\s*(?:VITE_PUBLIC_SITE_URL|NEXT_PUBLIC_SITE_URL)\s*=\s*(.+?)\s*$/,
      );
      if (m?.[1]) {
        base = m[1].replace(/^["']|["']$/g, "").trim();
        break;
      }
    }
  }
  if (!base) {
    base = "https://www.pdfplatform.app";
  }
  return base.replace(/\/$/, "");
}

/** Yerel / önizleme: Google vb. indekslemesin diye `true` (`.env` içinde). */
function readBlockSearchIndexing() {
  const direct = String(process.env.VITE_BLOCK_SEARCH_INDEXING ?? "")
    .trim()
    .toLowerCase();
  if (direct === "true" || direct === "1") return true;
  if (direct === "false" || direct === "0") return false;
  const envFile = join(frontendRoot, ".env");
  if (!existsSync(envFile)) {
    return false;
  }
  const raw = readFileSync(envFile, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*VITE_BLOCK_SEARCH_INDEXING\s*=\s*(.+?)\s*$/);
    if (m?.[1]) {
      const v = m[1]
        .replace(/^["']|["']$/g, "")
        .trim()
        .toLowerCase();
      return v === "true" || v === "1";
    }
  }
  return false;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML metin içeriği için kaçış (görünür gövde + attribute). */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const todayIso = new Date().toISOString().slice(0, 10);

/** Bir routePath'in belirtilen dilde içeriği var mı? (EN'de eksik blog atlanır) */
function routeHasLang(routePath, lang) {
  if (lang === PRIMARY_LANG) return true;
  if (routePath.startsWith("/blog/")) {
    const slug = routePath.slice("/blog/".length);
    const p = BLOG_POSTS.find((x) => x.slug === slug);
    return Boolean(p && p[lang] && p[lang].title);
  }
  if (routePath.startsWith("/tools/")) {
    const slug = routePath.slice("/tools/".length);
    // Eşlenmemiş araç jenerik içerikle her dilde üretilebilir.
    return Boolean(!TOOL_SEO[slug] || TOOL_SEO[slug]?.[lang]);
  }
  return true;
}

// ─── Route → SEO meta ────────────────────────────────────────────────────────
function pageMetaForRoute(routePath, lang) {
  if (routePath === "/") {
    const c = LANDING_SEO[lang];
    return {
      ...c,
      kind: "landing",
      index: true,
      follow: true,
      includeSoftware: true,
      includeFaq: true,
    };
  }

  if (routePath.startsWith("/tools/")) {
    const slug = routePath.slice("/tools/".length);
    const c = TOOL_SEO[slug]?.[lang];
    if (c) {
      return {
        ...c,
        kind: "tool",
        slug,
        index: true,
        follow: true,
        includeSoftware: true,
        includeFaq: true,
        breadcrumb: true,
      };
    }
    // Eşlenmemiş araç — jenerik
    const label = slug.replace(/-/g, " ");
    return {
      title: `${label} | ${BRAND}`,
      description: UI[lang].genericToolDesc(label),
      h1: label,
      intro: UI[lang].genericToolIntro(label),
      keywords: [],
      faq: [],
      kind: "tool",
      slug,
      index: true,
      follow: true,
      includeSoftware: true,
    };
  }

  if (routePath === "/pricing") {
    const c = PRICING_SEO[lang];
    return { ...c, kind: "pricing", index: true, follow: true, includePricing: true };
  }

  if (routePath === "/pdf-api") {
    const c = API_SEO[lang];
    return { ...c, kind: "apilanding", index: true, follow: true, includeFaq: true };
  }

  if (routePath === "/blog") {
    const c = UI[lang].blogIndex;
    return {
      title: c.title,
      description: c.description,
      h1: c.h1,
      intro: c.intro,
      keywords: [],
      faq: [],
      kind: "blogindex",
      index: true,
      follow: true,
    };
  }

  if (routePath.startsWith("/blog/")) {
    const slug = routePath.slice("/blog/".length);
    const p = BLOG_POSTS.find((x) => x.slug === slug);
    if (p && p[lang]) {
      const c = p[lang];
      return {
        title: `${c.title} — ${BRAND}`,
        description: c.description,
        h1: c.title,
        intro: c.excerpt,
        keywords: (p.tags && p.tags[lang]) || [],
        faq: c.faq || [],
        kind: "blogpost",
        post: p,
        blocks: c.blocks,
        index: true,
        follow: true,
        includeFaq: true,
      };
    }
  }

  for (const key of ["terms", "privacy", "kvkk"]) {
    if (routePath === `/${key}`) {
      const c = LEGAL_SEO[key][lang];
      return { ...c, kind: "legal", index: true, follow: true };
    }
  }

  return {
    title: BRAND,
    description: lang === "tr" ? "Profesyonel PDF platformu." : "Professional PDF platform.",
    h1: BRAND,
    intro: lang === "tr" ? "Profesyonel PDF araçları." : "Professional PDF tools.",
    keywords: [],
    faq: [],
    kind: "other",
    index: false,
    follow: false,
  };
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────
function renderStructuredData(baseUrl, routePath, meta, lang) {
  const t = UI[lang];
  const canonicalUrl = urlForRoute(baseUrl, routePath, lang);
  const orgId = `${baseUrl}/#organization`;
  const nodes = [];

  nodes.push({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    name: BRAND,
    url: baseUrl,
    inLanguage: t.inLanguageTag,
    description: LANDING_SEO[lang].description,
    publisher: { "@id": orgId },
  });

  nodes.push({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": orgId,
    name: BRAND,
    url: baseUrl,
    logo: {
      "@type": "ImageObject",
      url: `${baseUrl}/logo.png`,
      width: 192,
      height: 192,
    },
    description: t.orgDescription,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: ["Turkish", "English"],
    },
    sameAs: [],
  });

  if (meta.includeSoftware) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: meta.h1 || BRAND,
      url: canonicalUrl,
      description: meta.description,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web Browser",
      browserRequirements:
        "Requires JavaScript. Works in Chrome, Firefox, Edge, Safari.",
      inLanguage: [
        { "@type": "Language", name: "Turkish" },
        { "@type": "Language", name: "English" },
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: t.priceCurrency,
        availability: "https://schema.org/InStock",
        description: t.softwareOfferDesc,
      },
      brand: { "@type": "Brand", name: BRAND },
      publisher: { "@id": orgId },
      featureList: SOFTWARE_FEATURE_LIST[lang],
    });
  }

  if (meta.breadcrumb && meta.kind === "tool") {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: BRAND, item: urlForRoute(baseUrl, "/", lang) },
        {
          "@type": "ListItem",
          position: 2,
          name: meta.h1,
          item: canonicalUrl,
        },
      ],
    });
  }

  if (meta.includePricing) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "Offer",
      name: t.pricingOfferName,
      description: t.pricingOfferDesc,
      url: canonicalUrl,
      priceCurrency: t.priceCurrency,
      availability: "https://schema.org/InStock",
      seller: { "@id": orgId },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        name: t.returnPolicyName,
        description: t.returnPolicyDesc,
        returnPolicyCategory:
          "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        refundType: "https://schema.org/FullRefund",
        returnFees: "https://schema.org/FreeReturn",
      },
    });
  }

  // BlogPosting — blog yazıları için makale şeması.
  if (meta.kind === "blogpost" && meta.post) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: meta.title.replace(` — ${BRAND}`, ""),
      description: meta.description,
      datePublished: meta.post.date,
      dateModified: meta.post.updated,
      inLanguage: lang,
      mainEntityOfPage: canonicalUrl,
      author: { "@type": "Organization", name: BRAND, "@id": orgId },
      publisher: { "@id": orgId },
      image: `${baseUrl}${DEFAULT_OG_IMAGE}`,
    });

    const stepsBlock = Array.isArray(meta.blocks)
      ? meta.blocks.find((b) => b.t === "steps" && Array.isArray(b.items) && b.items.length)
      : null;
    if (stepsBlock) {
      nodes.push({
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: meta.h1,
        description: meta.description,
        inLanguage: lang,
        step: stepsBlock.items.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.title,
          text: s.x,
        })),
      });
    }
  }

  if (meta.includeFaq && Array.isArray(meta.faq) && meta.faq.length > 0) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: meta.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }

  return nodes
    .map(
      (node) =>
        `<script type="application/ld+json">${JSON.stringify(node)}</script>`,
    )
    .join("\n    ");
}

// ─── Görünür gövde (crawler + AI motorları + ilk boya içeriği) ────────────────
function renderBlogBlocksHtml(blocks) {
  return blocks
    .map((b) => {
      if (b.t === "lead") return `<p class="seo-lead">${escapeHtml(b.x)}</p>`;
      if (b.t === "p" || b.t === "tip") return `<p>${escapeHtml(b.x)}</p>`;
      if (b.t === "h2") return `<h2>${escapeHtml(b.x)}</h2>`;
      if (b.t === "h3") return `<h3>${escapeHtml(b.x)}</h3>`;
      if (b.t === "ul") return `<ul>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
      if (b.t === "ol") return `<ol>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ol>`;
      if (b.t === "steps") return `<ol>${b.items.map((s) => `<li><strong>${escapeHtml(s.title)}:</strong> ${escapeHtml(s.x)}</li>`).join("")}</ol>`;
      if (b.t === "cta") return `<p><a href="${escapeHtml(b.tool)}"><strong>${escapeHtml(b.title)}</strong> — ${escapeHtml(b.x)}</a></p>`;
      return "";
    })
    .join("");
}

// Araç kısa etiketi — SEO title'ın "—" öncesi kısmı (ör. "PDF Birleştir").
function toolShortLabel(slug, lang) {
  const t = TOOL_SEO[slug]?.[lang]?.title || "";
  return (t.split(/[—–|]/)[0] || "").trim() || slug.replace(/-/g, " ");
}
function toolLi(slug, lang) {
  return `<li><a href="${linkBase(lang)}/tools/${slug}">${escapeHtml(toolShortLabel(slug, lang))}</a></li>`;
}
function blogTitleFor(slug, lang) {
  const p = BLOG_POSTS.find((x) => x.slug === slug);
  if (!p) return slug.replace(/-/g, " ");
  return (p[lang] || p[PRIMARY_LANG]).title;
}
// Bu aracı ilgili gösteren blog yazıları (ters harita).
function guidesForTool(toolSlug) {
  return Object.keys(BLOG_RELATED_TOOLS).filter((b) => BLOG_RELATED_TOOLS[b].includes(toolSlug));
}

function renderVisibleBody(baseUrl, meta, lang) {
  const t = UI[lang];
  const base = linkBase(lang);
  const parts = [];
  parts.push(`<h1>${escapeHtml(meta.h1)}</h1>`);
  parts.push(`<p class="seo-intro">${escapeHtml(meta.intro)}</p>`);

  // Blog yazısı — tam makale gövdesi (crawler görünür metin)
  if (meta.kind === "blogpost" && Array.isArray(meta.blocks)) {
    parts.push(`<article class="seo-article">${renderBlogBlocksHtml(meta.blocks)}</article>`);
    const rel = (meta.post && BLOG_RELATED_TOOLS[meta.post.slug]) || [];
    if (rel.length) {
      parts.push(
        `<nav aria-label="${t.ariaToolsForTask}" class="seo-related-tools"><h2>${t.toolsForTask}</h2><ul>${rel.map((s) => toolLi(s, lang)).join("")}</ul></nav>`,
      );
    }
  }

  // Araç sayfası — tematik ilgili araçlar + ilgili rehberler
  if (meta.kind === "tool" && meta.slug) {
    const rel = TOOL_RELATED_TOOLS[meta.slug] || [];
    if (rel.length) {
      parts.push(
        `<nav aria-label="${t.ariaRelatedTools}" class="seo-related-tools"><h2>${t.relatedTools}</h2><ul>${rel.map((s) => toolLi(s, lang)).join("")}</ul></nav>`,
      );
    }
    const guides = guidesForTool(meta.slug).filter((s) => routeHasLang(`/blog/${s}`, lang));
    if (guides.length) {
      const gl = guides
        .map((s) => `<li><a href="${base}/blog/${s}">${escapeHtml(blogTitleFor(s, lang))}</a></li>`)
        .join("");
      parts.push(
        `<nav aria-label="${t.ariaRelatedGuides}" class="seo-related-guides"><h2>${t.relatedGuides}</h2><ul>${gl}</ul></nav>`,
      );
    }
  }

  // Blog index — yazı kartlarına iç bağlantı
  if (meta.kind === "blogindex") {
    const links = getBlogPostsSorted()
      .filter((p) => routeHasLang(`/blog/${p.slug}`, lang))
      .map((p) => {
        const c = p[lang] || p[PRIMARY_LANG];
        return `<li><a href="${base}/blog/${p.slug}"><strong>${escapeHtml(c.title)}</strong></a><span> — ${escapeHtml(c.excerpt)}</span></li>`;
      })
      .join("");
    parts.push(`<nav aria-label="${t.ariaBlogPosts}" class="seo-posts"><h2>${t.allPosts}</h2><ul>${links}</ul></nav>`);
  }

  // Araç ve landing sayfalarında tüm araçlara iç bağlantı
  if (meta.kind === "tool" || meta.kind === "landing") {
    const links = TOOL_SLUGS.map((slug) => {
      const c = TOOL_SEO[slug]?.[lang];
      const label = c ? c.h1 : slug.replace(/-/g, " ");
      return `<li><a href="${base}/tools/${slug}">${escapeHtml(label)}</a></li>`;
    }).join("");
    parts.push(
      `<nav aria-label="${t.ariaAllTools}" class="seo-tools"><h2>${t.allTools}</h2><ul>${links}</ul></nav>`,
    );
  }

  if (meta.kind === "pricing") {
    parts.push(t.pricingCta(base));
  }

  // SSS bölümü (görünür) — FAQPage schema ile birebir aynı metin
  if (Array.isArray(meta.faq) && meta.faq.length > 0) {
    const items = meta.faq
      .map(
        (f) =>
          `<div class="seo-faq-item"><h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></div>`,
      )
      .join("");
    parts.push(
      `<section aria-label="${t.ariaFaq}" class="seo-faq"><h2>${t.faqHeading}</h2>${items}</section>`,
    );
  }

  return `<div id="root"><main class="seo-prerender">${parts.join("")}</main></div>`;
}

// ─── hreflang blokları (HTML <link> + sitemap <xhtml:link>) ───────────────────
/** Bir mantıksal route için tüm dil alternatiflerinin URL haritası. */
function altUrlsForRoute(baseUrl, routePath) {
  const map = {};
  for (const lang of LANGS) {
    if (routeHasLang(routePath, lang)) {
      map[lang] = urlForRoute(baseUrl, routePath, lang);
    }
  }
  return map;
}
function renderHreflangLinks(baseUrl, routePath) {
  const alts = altUrlsForRoute(baseUrl, routePath);
  const lines = [];
  for (const lang of LANGS) {
    if (alts[lang]) {
      lines.push(`<link rel="alternate" hreflang="${lang}" href="${alts[lang]}" />`);
    }
  }
  // x-default → birincil (TR) sürüm
  if (alts[PRIMARY_LANG]) {
    lines.push(`<link rel="alternate" hreflang="x-default" href="${alts[PRIMARY_LANG]}" />`);
  }
  return lines.join("\n    ");
}
function renderSitemapHreflang(baseUrl, routePath) {
  const alts = altUrlsForRoute(baseUrl, routePath);
  const lines = [];
  for (const lang of LANGS) {
    if (alts[lang]) {
      lines.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(alts[lang])}"/>`);
    }
  }
  if (alts[PRIMARY_LANG]) {
    lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(alts[PRIMARY_LANG])}"/>`);
  }
  return lines.join("\n");
}

// ─── Tam HTML ─────────────────────────────────────────────────────────────────
function renderPrerenderHtml(baseUrl, routePath, lang) {
  const t = UI[lang];
  const meta = pageMetaForRoute(routePath, lang);
  const canonicalUrl = urlForRoute(baseUrl, routePath, lang);
  const robots = meta.index
    ? meta.follow
      ? "index, follow, max-image-preview:large"
      : "index, nofollow"
    : "noindex, nofollow";
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const ogImage = `${baseUrl}${DEFAULT_OG_IMAGE}`;

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0f172a" />
    <script>
      // Bakım modu ipucu (localStorage, 5dk TTL) varsa prerender içeriğini GÖRSEL gizle.
      // React mount edip MaintenancePage gösterene kadar "landing bir an görünüp kaybolma"
      // (flicker) olmasın. İçerik DOM'da kalır (yalnızca visibility:hidden) → SEO/crawler etkilenmez.
      try {
        var h = JSON.parse(localStorage.getItem("nb-maintenance-mode-hint") || "null");
        if (h && h.active === true && typeof h.ts === "number" && Date.now() - h.ts < 300000) {
          document.documentElement.className += " nb-maint";
        }
      } catch (e) {}
    </script>
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="application-name" content="${BRAND}" />
    <meta name="mobile-web-app-capable" content="yes" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="${BRAND}" />
    <meta name="msapplication-TileColor" content="#0f172a" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="robots" content="${robots}" />
    <meta name="googlebot" content="${robots}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <!-- Çok dilli: TR (öneksiz) + EN (/en/) karşılıklı hreflang; x-default = TR. -->
    ${renderHreflangLinks(baseUrl, routePath)}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${BRAND}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="${DEFAULT_OG_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="${DEFAULT_OG_IMAGE_HEIGHT}" />
    <meta property="og:image:alt" content="${title}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:locale" content="${t.ogLocale}" />
    <meta property="og:locale:alternate" content="${t.ogLocaleAlt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@nbglobalstudio" />
    <meta name="twitter:creator" content="@nbglobalstudio" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />
    <meta name="twitter:image:alt" content="${title}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" onload="this.onload=null;this.rel='stylesheet'" />
    <noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" /></noscript>
    <style>
      /* Anlık koyu zemin: React yüklenene dek beyaz "flash" olmaz (uygulama bg ile aynı). */
      html,body{margin:0;background:#0f172a}
      /* Prerender içeriği YALNIZCA arama motorları / JS'siz botlar için DOM'da durur;
         kullanıcıya görsel olarak GÖSTERİLMEZ (flash/FOUC önlenir). React hidrasyonunda
         zaten gerçek arayüzle değiştirilir. SEO KAYBI YOK: metin DOM'da + erişilebilirlik
         ağacında kalır; Google JS render edince gerçek sayfayı görür (sr-only/clip tekniği). */
      .seo-prerender{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
    </style>
    ${renderStructuredData(baseUrl, routePath, meta, lang)}
  </head>
  <body>
    ${renderVisibleBody(baseUrl, meta, lang)}
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

// ─── robots.txt & sitemap.xml ─────────────────────────────────────────────────
const blockIndexing = readBlockSearchIndexing();
const base = readEnvBaseUrl();
mkdirSync(publicDir, { recursive: true });

let robots;
if (blockIndexing) {
  robots = `User-agent: *
Disallow: /
`;
} else {
  robots = `User-agent: *
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
}

// Mantıksal route listesi (dil-öneksiz). Her biri sitemap'te TR + EN olarak çıkar.
const LOGICAL_ROUTES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "weekly", priority: "0.8" },
  { path: "/terms", changefreq: "monthly", priority: "0.4" },
  { path: "/privacy", changefreq: "monthly", priority: "0.4" },
  { path: "/kvkk", changefreq: "monthly", priority: "0.4" },
  ...TOOL_SLUGS.map((slug) => ({ path: `/tools/${slug}`, changefreq: "weekly", priority: "0.9" })),
  { path: "/pdf-api", changefreq: "monthly", priority: "0.7" },
  { path: "/blog", changefreq: "weekly", priority: "0.7" },
  ...BLOG_POSTS.map((p) => ({ path: `/blog/${p.slug}`, changefreq: "monthly", priority: "0.7" })),
];
// Yalnızca sitemap'e giren, prerender edilmeyen ek rotalar (login/register).
const SITEMAP_EXTRA_ROUTES = [
  { path: "/login", changefreq: "monthly", priority: "0.5" },
  { path: "/register", changefreq: "monthly", priority: "0.5" },
];

let sitemap;
if (blockIndexing) {
  sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>
`;
} else {
  // Her mantıksal route için mevcut her dilde bir <url> (çift yönlü hreflang ile).
  const urlEntries = [];
  for (const route of [...LOGICAL_ROUTES, ...SITEMAP_EXTRA_ROUTES]) {
    for (const lang of LANGS) {
      if (!routeHasLang(route.path, lang)) continue;
      urlEntries.push({
        loc: urlForRoute(base, route.path, lang),
        routePath: route.path,
        changefreq: route.changefreq,
        priority: route.priority,
      });
    }
  }

  sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
${renderSitemapHreflang(base, u.routePath)}
    <lastmod>${todayIso}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

writeFileSync(join(publicDir, "robots.txt"), robots, "utf8");
writeFileSync(join(publicDir, "sitemap.xml"), sitemap, "utf8");

// ─── Prerendered HTML snapshots (TR + EN) ─────────────────────────────────────
const prerenderRoutes = [
  "/",
  "/pricing",
  "/terms",
  "/privacy",
  "/kvkk",
  ...TOOL_SLUGS.map((slug) => `/tools/${slug}`),
  "/pdf-api",
  "/blog",
  ...BLOG_POSTS.map((p) => `/blog/${p.slug}`),
];

let pageCount = 0;
for (const lang of LANGS) {
  for (const routePath of prerenderRoutes) {
    if (!routeHasLang(routePath, lang)) continue;
    const outPath = outFileForRoute(routePath, lang);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, renderPrerenderHtml(base, routePath, lang), "utf8");
    pageCount++;
  }
}

console.log(
  "[seo] robots + sitemap + prerendered HTML generated:",
  blockIndexing ? "(block indexing)" : base,
  `| ${pageCount} pages, langs=${LANGS.join("+")}`,
);
