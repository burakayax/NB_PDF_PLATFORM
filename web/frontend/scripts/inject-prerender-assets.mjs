/**
 * Post-build: prerendered statik HTML snapshot'larına gerçek üretim asset'lerini
 * enjekte eder.
 *
 * generate-seo-files.mjs, prerender HTML'lere geliştirme girişini yazar:
 *   <script type="module" src="/src/main.tsx"></script>
 * Bu yol ÜRETİMDE mevcut değildir. Vite yalnızca dist/index.html'e hash'li
 * bundle + CSS + modulepreload enjekte eder. Bu script, o etiketleri
 * dist/index.html'den okuyup tüm diğer prerender HTML'lere taşır.
 *
 * Sonuç: Google zengin statik içeriği görür VE bu URL'lere doğrudan gelen
 * gerçek kullanıcıda React uygulaması normal şekilde önyüklenir.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const distDir = join(frontendRoot, "dist");
const indexPath = join(distDir, "index.html");
// Zengin prerender edilmiş ana sayfa (generate-seo-files.mjs çıktısı). Vite bunu
// kök şablonla çakıştığı için dist/index.html'e KOPYALAMAZ; biz birleştireceğiz.
const prerenderHomePath = join(frontendRoot, "public", "index.html");

// Üretim asset etiketlerini Vite'ın ürettiği dist/index.html'den oku (üzerine
// yazmadan ÖNCE).
const indexHtml = readFileSync(indexPath, "utf8");

// dist/index.html <head> içindeki Vite tarafından enjekte edilen asset etiketleri.
function extractTags(html, regex) {
  const out = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    out.push(m[0]);
  }
  return out;
}

const stylesheetTags = extractTags(
  indexHtml,
  /<link\b[^>]*rel="stylesheet"[^>]*href="\/assets\/[^"]+"[^>]*>/g,
);
const modulePreloadTags = extractTags(
  indexHtml,
  /<link\b[^>]*rel="modulepreload"[^>]*>/g,
);
const entryScriptMatch = indexHtml.match(
  /<script\b[^>]*type="module"[^>]*src="\/assets\/[^"]+"[^>]*><\/script>/,
);

if (!entryScriptMatch) {
  console.error(
    "[inject] dist/index.html içinde üretim giriş script'i bulunamadı — atlanıyor.",
  );
  process.exit(0);
}

const entryScript = entryScriptMatch[0];
const headInjection = [...stylesheetTags, ...modulePreloadTags].join("\n    ");
const bodyInjection = [...modulePreloadTags, entryScript].join("\n    ");

const DEV_ENTRY = '<script type="module" src="/src/main.tsx"></script>';

function listHtmlFiles(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      result.push(...listHtmlFiles(full));
    } else if (name.endsWith(".html")) {
      result.push(full);
    }
  }
  return result;
}

function injectAssets(html) {
  // Gövdedeki dev giriş script'ini üretim script + modulepreload ile değiştir.
  let out = html.replace(DEV_ENTRY, bodyInjection);
  // Stylesheet (+ preload) etiketlerini </head> öncesine ekle.
  if (headInjection) {
    out = out.replace("</head>", `    ${headInjection}\n  </head>`);
  }
  return out;
}

let patched = 0;
for (const file of listHtmlFiles(distDir)) {
  if (file === indexPath) continue; // ana sayfa ayrı (aşağıda) ele alınır
  const html = readFileSync(file, "utf8");
  if (!html.includes(DEV_ENTRY)) continue; // prerender değil / zaten yamalı
  writeFileSync(file, injectAssets(html), "utf8");
  patched++;
}

// ── Ana sayfa: zengin prerender (görünür gövde + FAQ/SoftwareApplication schema)
// içeriğini al, üretim asset'lerini enjekte et ve dist/index.html'i bununla ez.
// Böylece en önemli sayfa boş #root yerine zengin statik içerikle servis edilir.
try {
  const homeHtml = readFileSync(prerenderHomePath, "utf8");
  if (homeHtml.includes(DEV_ENTRY)) {
    writeFileSync(indexPath, injectAssets(homeHtml), "utf8");
    patched++;
    console.log("[inject] ana sayfa zengin prerender ile birleştirildi (dist/index.html).");
  }
} catch {
  console.warn("[inject] prerender ana sayfa okunamadı — dist/index.html olduğu gibi bırakıldı.");
}

console.log(
  `[inject] üretim asset'leri ${patched} prerender HTML dosyasına enjekte edildi.`,
);
