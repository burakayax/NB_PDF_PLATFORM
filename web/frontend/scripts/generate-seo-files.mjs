/**
 * `public/robots.txt` ve `public/sitemap.xml` üretir.
 * `VITE_BLOCK_SEARCH_INDEXING=true` iken tüm botlara `Disallow: /` (geliştirme / Vercel önizleme koruması).
 * Üretimde `VITE_PUBLIC_SITE_URL` ile kanonik kök; sync kaynak: workspaceFeatures REGISTRY.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const publicDir = join(frontendRoot, "public");

/** workspaceFeatures REGISTRY sırasıyla (toolSlugForFeature ile dönüşür). */
const FEATURE_IDS = [
  "split",
  "merge",
  "delete-pages",
  "rotate-pdf",
  "organize-pdf",
  "compress",
  "pdf-to-word",
  "word-to-pdf",
  "excel-to-pdf",
  "pdf-to-excel",
  "pdf-to-ppt",
  "ppt-to-pdf",
  "pdf-to-image",
  "image-to-pdf",
  "html-to-pdf",
  "unlock-pdf",
  "watermark",
  "page-numbers",
  "repair-pdf",
  "encrypt",
];

function toolSlugForFeature(id) {
  if (id === "merge") return "merge-pdf";
  if (id === "split") return "split-pdf";
  return id;
}

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
    { loc: `${base}/`, changefreq: "weekly", priority: "1.0" },
    { loc: `${base}/admin-login`, changefreq: "monthly", priority: "0.3" },
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

console.log("[seo] public/robots.txt + public/sitemap.xml → base:", base, blockIndexing ? "(block indexing)" : "");
