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
    String(process.env.VITE_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim() ||
    "";
  const envFile = join(frontendRoot, ".env");
  if (!base && existsSync(envFile)) {
    const raw = readFileSync(envFile, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*(?:VITE_PUBLIC_SITE_URL|NEXT_PUBLIC_SITE_URL)\s*=\s*(.+?)\s*$/);
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
  const direct = String(process.env.VITE_BLOCK_SEARCH_INDEXING ?? "").trim().toLowerCase();
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
      const v = m[1].replace(/^["']|["']$/g, "").trim().toLowerCase();
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
      title: "PDF editing and conversion platform | NB PDF PLATFORM",
      description:
        "Use PDF editing, PDF converter, merge PDF, and compress PDF workflows in one professional platform.",
      index: true,
      follow: true,
      includeProductSchema: true,
    };
  }
  if (routePath.startsWith("/tools/")) {
    const readable = routePath
      .slice("/tools/".length)
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      title: `${readable} | NB PDF PLATFORM`,
      description: `Run ${readable} in a secure PDF workflow platform.`,
      index: true,
      follow: true,
      includeProductSchema: true,
    };
  }
  if (routePath === "/pricing") {
    return {
      title: "Pricing | NB PDF PLATFORM",
      description: "Explore plans and credit packs for PDF workflows.",
      index: true,
      follow: true,
    };
  }
  if (routePath === "/terms") {
    return {
      title: "Terms of service | NB PDF PLATFORM",
      description: "Read the NB PDF PLATFORM terms of service.",
      index: true,
      follow: true,
    };
  }
  if (routePath === "/privacy") {
    return {
      title: "Privacy policy | NB PDF PLATFORM",
      description: "Read the NB PDF PLATFORM privacy policy.",
      index: true,
      follow: true,
    };
  }
  if (routePath === "/kvkk") {
    return {
      title: "KVKK | NB PDF PLATFORM",
      description: "Read NB PDF PLATFORM KVKK information.",
      index: true,
      follow: true,
    };
  }
  return {
    title: "NB PDF PLATFORM",
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
    name: "NB PDF PLATFORM",
    url: canonicalUrl,
  };
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "NB PDF PLATFORM",
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
      brand: { "@type": "Brand", name: "NB PDF PLATFORM" },
      url: canonicalUrl,
    });
  }
  return all
    .map((node) => `<script type="application/ld+json">${JSON.stringify(node)}</script>`)
    .join("\n");
}

function renderPrerenderHtml(baseUrl, routePath) {
  const meta = pageMetaForRoute(routePath);
  const canonicalUrl = `${baseUrl}${routePath}`;
  const robots = meta.index ? (meta.follow ? "index, follow" : "index, nofollow") : "noindex, nofollow";
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
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${baseUrl}/app-preview-main.png" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${baseUrl}/app-preview-main.png" />
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
Allow: /
Disallow: /admin
Disallow: /admin-login
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /fake-payment
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
  const urls = [
    ...STATIC_PUBLIC_ROUTES.map((route) => ({
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
  sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
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
