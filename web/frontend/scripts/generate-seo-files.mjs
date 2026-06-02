/**
 * Production SEO assets:
 * - robots.txt
 * - sitemap.xml
 * - prerendered static HTML snapshots for public crawl routes
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FEATURE_IDS,
  STATIC_PUBLIC_ROUTES,
  toolSlugForFeature,
} from "./seo-routes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const publicDir = join(frontendRoot, "public");

function readEnvBaseUrl() {
  let base =
    String(
      process.env.VITE_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "",
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
    base = "https://pdfplatform.app";
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

function ensurePublicFilePathForRoute(routePath) {
  if (routePath === "/") {
    return join(publicDir, "index.html");
  }
  return join(publicDir, routePath.replace(/^\//, ""), "index.html");
}

function pageMetaForRoute(routePath) {
  if (routePath === "/") {
    return {
      title: "PDF editing and conversion platform | PDF PLATFORM",
      description:
        "Use PDF editing, PDF converter, merge PDF, and compress PDF workflows in one professional platform.",
      index: true,
      follow: true,
      includeProductSchema: true,
    };
  }
  if (routePath.startsWith("/tools/")) {
    const slug = routePath.slice("/tools/".length);
    const toolNames = {
      "merge-pdf": "Merge PDF",
      "split-pdf": "Split PDF",
      compress: "Compress PDF",
      "pdf-to-word": "PDF to Word",
      "word-to-pdf": "Word to PDF",
      "pdf-to-excel": "PDF to Excel",
      "excel-to-pdf": "Excel to PDF",
      "pdf-to-ppt": "PDF to PowerPoint",
      "ppt-to-pdf": "PowerPoint to PDF",
      "pdf-to-image": "PDF to Image",
      "image-to-pdf": "Image to PDF",
      "html-to-pdf": "HTML to PDF",
      "rotate-pdf": "Rotate PDF",
      "delete-pages": "Delete PDF Pages",
      "organize-pdf": "Organize PDF Pages",
      watermark: "Add Watermark to PDF",
      "page-numbers": "Add Page Numbers to PDF",
      encrypt: "Encrypt PDF",
      "unlock-pdf": "Unlock PDF",
      "repair-pdf": "Repair PDF",
      "pdf-to-text": "PDF to Text",
      "flatten-pdf": "Flatten PDF",
    };
    const readable =
      toolNames[slug] ||
      slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bPdf\b/g, "PDF")
        .replace(/\bPpt\b/g, "PPT");
    return {
      title: `${readable} | PDF PLATFORM`,
      description: `Use the ${readable} tool in a secure, professional PDF platform.`,
      index: true,
      follow: true,
      includeProductSchema: true,
    };
  }
  if (routePath === "/pricing") {
    return {
      title: "Pricing | PDF PLATFORM",
      description: "Explore plans and credit packs for PDF workflows.",
      index: true,
      follow: true,
    };
  }
  if (routePath === "/terms") {
    return {
      title: "Terms of service | PDF PLATFORM",
      description: "Read the PDF PLATFORM terms of service.",
      index: true,
      follow: true,
    };
  }
  if (routePath === "/privacy") {
    return {
      title: "Privacy policy | PDF PLATFORM",
      description: "Read the PDF PLATFORM privacy policy.",
      index: true,
      follow: true,
    };
  }
  if (routePath === "/kvkk") {
    return {
      title: "KVKK | PDF PLATFORM",
      description: "Read PDF PLATFORM KVKK information.",
      index: true,
      follow: true,
    };
  }
  return {
    title: "PDF PLATFORM",
    description: "Professional PDF platform.",
    index: false,
    follow: false,
  };
}

function renderStructuredData(baseUrl, routePath, meta) {
  const canonicalUrl = `${baseUrl}${routePath}`;
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PDF PLATFORM",
    url: canonicalUrl,
  };
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PDF PLATFORM",
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
  };
  const all = [website, org];
  if (meta.includeProductSchema) {
    all.push({
      "@context": "https://schema.org",
      "@type": "Product",
      name: meta.title,
      description: meta.description,
      category: "PDF software",
      brand: { "@type": "Brand", name: "PDF PLATFORM" },
      url: canonicalUrl,
    });
  }
  return all
    .map(
      (node) =>
        `<script type="application/ld+json">${JSON.stringify(node)}</script>`,
    )
    .join("\n");
}

function renderPrerenderHtml(baseUrl, routePath) {
  const meta = pageMetaForRoute(routePath);
  const canonicalUrl = `${baseUrl}${routePath}`;
  const robots = meta.index
    ? meta.follow
      ? "index, follow"
      : "index, nofollow"
    : "noindex, nofollow";
  const title = meta.title;
  const description = meta.description;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0f172a" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <link rel="alternate" hreflang="tr" href="${canonicalUrl}" />
    <link rel="alternate" hreflang="en" href="${canonicalUrl}" />
    <link rel="alternate" hreflang="x-default" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="PDF PLATFORM" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${baseUrl}/app-preview-main.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${title}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:locale" content="tr_TR" />
    <meta property="og:locale:alternate" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@nbglobalstudio" />
    <meta name="twitter:creator" content="@nbglobalstudio" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${baseUrl}/app-preview-main.png" />
    <meta name="twitter:image:alt" content="${title}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    ${renderStructuredData(baseUrl, routePath, meta)}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

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
Disallow: /workspace
Disallow: /admin
Disallow: /admin-login
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
  const AUTH_ROUTES = [
    { path: "/login", changefreq: "monthly", priority: "0.5" },
    { path: "/register", changefreq: "monthly", priority: "0.5" },
  ];

  const urls = [
    ...STATIC_PUBLIC_ROUTES.map((route) => ({
      loc: `${base}${route.path}`,
      changefreq: route.changefreq,
      priority: route.priority,
    })),
    ...AUTH_ROUTES.map((route) => ({
      loc: `${base}${route.path}`,
      changefreq: route.changefreq,
      priority: route.priority,
    })),
    ...FEATURE_IDS.map((id) => ({
      loc: `${base}/tools/${toolSlugForFeature(id)}`,
      changefreq: "weekly",
      priority: "0.9",
    })),
  ];

  function renderHreflang(loc) {
    return [
      `    <xhtml:link rel="alternate" hreflang="tr" href="${escapeXml(loc)}"/>`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(loc)}"/>`,
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

const prerenderRoutes = [
  "/",
  "/pricing",
  "/terms",
  "/privacy",
  "/kvkk",
  ...FEATURE_IDS.map((id) => `/tools/${toolSlugForFeature(id)}`),
];

for (const routePath of prerenderRoutes) {
  const outPath = ensurePublicFilePathForRoute(routePath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderPrerenderHtml(base, routePath), "utf8");
}

console.log(
  "[seo] robots + sitemap + prerendered HTML generated:",
  blockIndexing ? "(block indexing)" : base,
);
