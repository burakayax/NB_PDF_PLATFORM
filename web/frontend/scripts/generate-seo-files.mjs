/**
 * Production SEO assets (TR birincil, EN ikincil):
 * - robots.txt
 * - sitemap.xml (lastmod dahil)
 * - prerendered static HTML snapshots (gerçek görünür gövde + zengin JSON-LD)
 *
 * Tüm metin/şema içeriği TEK kaynaktan gelir: src/seo/seoContent.mjs
 * Böylece Google'ın gördüğü statik HTML, tarayıcıda enjekte edilen runtime
 * meta verileriyle hiçbir zaman ayrışmaz.
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

// Tematik iç linkleme haritaları seoContent.mjs'ten gelir (SEO + React ortak kaynak).

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

function ensurePublicFilePathForRoute(routePath) {
  if (routePath === "/") {
    return join(publicDir, "index.html");
  }
  return join(publicDir, routePath.replace(/^\//, ""), "index.html");
}

const todayIso = new Date().toISOString().slice(0, 10);

// ─── Route → SEO meta (TR birincil) ──────────────────────────────────────────
function pageMetaForRoute(routePath) {
  const lang = PRIMARY_LANG;

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
      description: `${label} işlemini güvenli, profesyonel bir PDF platformunda gerçekleştirin.`,
      h1: label,
      intro: `${label} aracını kullanın; dosyanızı yükleyin, işleyin ve sonucu indirin.`,
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
    return {
      title: `Blog — Rehberler & İpuçları | ${BRAND}`,
      description: "PDF işlerini hızlandıran pratik rehberler: birleştirme, veri çıkarma, çeviri ve yapay zekâ araçlarıyla iş akışınızı kolaylaştırın.",
      h1: "PDF Platform Blog",
      intro: "PDF birleştirme, faturadan veri çıkarma, çeviri ve yapay zekâ araçlarıyla iş akışınızı kolaylaştıran pratik rehberler.",
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
    if (p) {
      const c = p[lang];
      return {
        title: `${c.title} — ${BRAND}`,
        description: c.description,
        h1: c.title,
        intro: c.excerpt,
        keywords: p.tags[lang] || [],
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
    description: "Profesyonel PDF platformu.",
    h1: BRAND,
    intro: "Profesyonel PDF araçları.",
    keywords: [],
    faq: [],
    kind: "other",
    index: false,
    follow: false,
  };
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────
function renderStructuredData(baseUrl, routePath, meta) {
  const lang = PRIMARY_LANG;
  const canonicalUrl = `${baseUrl}${routePath === "/" ? "" : routePath}` || baseUrl;
  const orgId = `${baseUrl}/#organization`;
  const nodes = [];

  nodes.push({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    name: BRAND,
    url: baseUrl,
    inLanguage: "tr-TR",
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
    description:
      "Profesyonel PDF birleştirme, dönüştürme, sıkıştırma ve düzenleme platformu — iş süreçleri için tasarlandı.",
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
        priceCurrency: "TRY",
        availability: "https://schema.org/InStock",
        description:
          "Ücretsiz plan mevcut. Ücretsiz paket ve aylık abonelik seçenekleri sunulmaktadır.",
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
        { "@type": "ListItem", position: 1, name: BRAND, item: baseUrl },
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
      name: "PDF Platform — Abonelik Planları",
      description:
        "Ücretsiz plan dahil aylık abonelik seçenekleri. 7 gün koşulsuz para iade garantisi.",
      url: canonicalUrl,
      priceCurrency: "TRY",
      availability: "https://schema.org/InStock",
      seller: { "@id": orgId },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        name: "7 Gün Para İade Garantisi",
        description:
          "Satın alma tarihinden itibaren 7 gün içinde tam iade. Gerekçe belirtmenize gerek yoktur.",
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

    // HowTo — yazıdaki adım adım "steps" bloğunu yapılandırılmış rehbere çevirir.
    // Rich result Google'da sınırlansa da AI Overviews / AEO için değerlidir.
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

  // FAQPage — rich result Mayıs 2026'da kaldırıldı ancak AI Overviews / AEO için
  // hâlâ değerli; schema geçerli olduğundan korunur.
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
// İçerik #root içine yazılır; React createRoot mount olunca temizleyip yeniden
// render eder (çift içerik olmaz). Crawler JS çalıştırmasa bile içeriği görür.
/** Blog bloklarını crawler-dostu semantik HTML'e çevirir. */
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
function toolShortLabel(slug) {
  const t = TOOL_SEO[slug]?.[PRIMARY_LANG]?.title || "";
  return (t.split(/[—–|]/)[0] || "").trim() || slug.replace(/-/g, " ");
}
function toolLi(slug) {
  return `<li><a href="/tools/${slug}">${escapeHtml(toolShortLabel(slug))}</a></li>`;
}
function blogTitleFor(slug) {
  const p = BLOG_POSTS.find((x) => x.slug === slug);
  return p ? p[PRIMARY_LANG].title : slug.replace(/-/g, " ");
}
// Bu aracı ilgili gösteren blog yazıları (ters harita).
function guidesForTool(toolSlug) {
  return Object.keys(BLOG_RELATED_TOOLS).filter((b) => BLOG_RELATED_TOOLS[b].includes(toolSlug));
}

function renderVisibleBody(baseUrl, meta) {
  const parts = [];
  parts.push(`<h1>${escapeHtml(meta.h1)}</h1>`);
  parts.push(`<p class="seo-intro">${escapeHtml(meta.intro)}</p>`);

  // Blog yazısı — tam makale gövdesi (crawler görünür metin)
  if (meta.kind === "blogpost" && Array.isArray(meta.blocks)) {
    parts.push(`<article class="seo-article">${renderBlogBlocksHtml(meta.blocks)}</article>`);
    // Yazıdaki işi yapan araçlara CTA + iç link
    const rel = (meta.post && BLOG_RELATED_TOOLS[meta.post.slug]) || [];
    if (rel.length) {
      parts.push(
        `<nav aria-label="İlgili PDF araçları" class="seo-related-tools"><h2>Bu İşi Yapan PDF Araçları</h2><ul>${rel.map(toolLi).join("")}</ul></nav>`,
      );
    }
  }

  // Araç sayfası — tematik ilgili araçlar + ilgili rehberler (flat listeden önce)
  if (meta.kind === "tool" && meta.slug) {
    const rel = TOOL_RELATED_TOOLS[meta.slug] || [];
    if (rel.length) {
      parts.push(
        `<nav aria-label="İlgili araçlar" class="seo-related-tools"><h2>İlgili Araçlar</h2><ul>${rel.map(toolLi).join("")}</ul></nav>`,
      );
    }
    const guides = guidesForTool(meta.slug);
    if (guides.length) {
      const gl = guides
        .map((s) => `<li><a href="/blog/${s}">${escapeHtml(blogTitleFor(s))}</a></li>`)
        .join("");
      parts.push(
        `<nav aria-label="İlgili rehberler" class="seo-related-guides"><h2>İlgili Rehberler</h2><ul>${gl}</ul></nav>`,
      );
    }
  }

  // Blog index — yazı kartlarına iç bağlantı
  if (meta.kind === "blogindex") {
    const links = getBlogPostsSorted()
      .map((p) => {
        const c = p[PRIMARY_LANG];
        return `<li><a href="/blog/${p.slug}"><strong>${escapeHtml(c.title)}</strong></a><span> — ${escapeHtml(c.excerpt)}</span></li>`;
      })
      .join("");
    parts.push(`<nav aria-label="Blog yazıları" class="seo-posts"><h2>Tüm Yazılar</h2><ul>${links}</ul></nav>`);
  }

  // Araç ve landing sayfalarında tüm araçlara iç bağlantı (crawl + sitelink sinyali)
  if (meta.kind === "tool" || meta.kind === "landing") {
    const links = TOOL_SLUGS.map((slug) => {
      const c = TOOL_SEO[slug]?.[PRIMARY_LANG];
      const label = c ? c.h1 : slug.replace(/-/g, " ");
      return `<li><a href="/tools/${slug}">${escapeHtml(label)}</a></li>`;
    }).join("");
    parts.push(
      `<nav aria-label="PDF araçları" class="seo-tools"><h2>Tüm PDF Araçları</h2><ul>${links}</ul></nav>`,
    );
  }

  if (meta.kind === "pricing") {
    parts.push(
      `<p><a href="/register">Ücretsiz başlayın</a> veya <a href="/">tüm PDF araçlarını</a> inceleyin.</p>`,
    );
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
      `<section aria-label="Sık sorulan sorular" class="seo-faq"><h2>Sık Sorulan Sorular</h2>${items}</section>`,
    );
  }

  return `<div id="root"><main class="seo-prerender">${parts.join("")}</main></div>`;
}

// ─── Tam HTML ─────────────────────────────────────────────────────────────────
function renderPrerenderHtml(baseUrl, routePath) {
  const meta = pageMetaForRoute(routePath);
  const canonicalUrl = `${baseUrl}${routePath === "/" ? "" : routePath}` || baseUrl;
  const robots = meta.index
    ? meta.follow
      ? "index, follow, max-image-preview:large"
      : "index, nofollow"
    : "noindex, nofollow";
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const ogImage = `${baseUrl}${DEFAULT_OG_IMAGE}`;

  return `<!doctype html>
<html lang="${PRIMARY_LANG}">
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
    <!-- Tek URL, TR-birincil (prerender içeriği Türkçe). Ayrı /en/ URL'i olmadığından
         yanıltıcı hreflang="en" (aynı URL'e) kaldırıldı; tr + x-default self-referans. -->
    <link rel="alternate" hreflang="tr" href="${canonicalUrl}" />
    <link rel="alternate" hreflang="x-default" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${BRAND}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="${DEFAULT_OG_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="${DEFAULT_OG_IMAGE_HEIGHT}" />
    <meta property="og:image:alt" content="${title}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:locale" content="tr_TR" />
    <meta property="og:locale:alternate" content="en_US" />
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
    ${renderStructuredData(baseUrl, routePath, meta)}
  </head>
  <body>
    ${renderVisibleBody(baseUrl, meta)}
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
  // Google önerisi: bir sayfayı indeksten çıkarmak için robots.txt ile ENGELLEME —
  // engelliyse Google `noindex` etiketini/başlığını göremez ("engelli ama indeksli" uyarısı).
  // Özel HTML rotaları (workspace/admin/nbadmin/admin-login/login-success) render.yaml'de
  // `X-Robots-Tag: noindex` başlığıyla ele alınır; burada taramaya izin veriyoruz.
  // /api/ HTML değil (SEO içeriği yok) → geleneksel olarak engelli bırakılır.
  robots = `User-agent: *
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
}

let sitemap;
if (blockIndexing) {
  sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>
`;
} else {
  const STATIC_ROUTES = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/pricing", changefreq: "weekly", priority: "0.8" },
    { path: "/terms", changefreq: "monthly", priority: "0.4" },
    { path: "/privacy", changefreq: "monthly", priority: "0.4" },
    { path: "/kvkk", changefreq: "monthly", priority: "0.4" },
    { path: "/login", changefreq: "monthly", priority: "0.5" },
    { path: "/register", changefreq: "monthly", priority: "0.5" },
  ];

  const urls = [
    ...STATIC_ROUTES.map((route) => ({
      loc: `${base}${route.path}`,
      changefreq: route.changefreq,
      priority: route.priority,
    })),
    ...TOOL_SLUGS.map((slug) => ({
      loc: `${base}/tools/${slug}`,
      changefreq: "weekly",
      priority: "0.9",
    })),
    { loc: `${base}/pdf-api`, changefreq: "monthly", priority: "0.7" },
    { loc: `${base}/blog`, changefreq: "weekly", priority: "0.7" },
    ...BLOG_POSTS.map((p) => ({
      loc: `${base}/blog/${p.slug}`,
      changefreq: "monthly",
      priority: "0.7",
    })),
  ];

  function renderHreflang(loc) {
    // Tek URL, TR-birincil — ayrı /en/ URL'i yok. Yanıltıcı hreflang="en"
    // (aynı URL'e) kaldırıldı; tr + x-default self-referans (HTML meta ile aynı).
    return [
      `    <xhtml:link rel="alternate" hreflang="tr" href="${escapeXml(loc)}"/>`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}"/>`,
    ].join("\n");
  }

  sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
${renderHreflang(u.loc)}
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

// ─── Prerendered HTML snapshots ───────────────────────────────────────────────
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

for (const routePath of prerenderRoutes) {
  const outPath = ensurePublicFilePathForRoute(routePath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderPrerenderHtml(base, routePath), "utf8");
}

console.log(
  "[seo] robots + sitemap + prerendered HTML generated:",
  blockIndexing ? "(block indexing)" : base,
  `| ${prerenderRoutes.length} pages, lang=${PRIMARY_LANG}`,
);
