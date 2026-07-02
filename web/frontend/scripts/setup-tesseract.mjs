// Tesseract.js (OCR) asset'lerini public/tesseract/ altına hazırlar — self-host.
// worker + core node_modules'tan kopyalanır; dil verileri (tur/eng) bir kez indirilir.
// CSP `worker-src 'self' blob:` olduğundan CDN worker çalışmaz → self-host şart.
// predev/prebuild'de çalışır. public/tesseract/ gitignore'dadır (repo şişmesin).
import { existsSync, mkdirSync, copyFileSync, createWriteStream, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public", "tesseract");
const coreDir = join(pub, "core");
const langDir = join(pub, "lang");
for (const d of [pub, coreDir, langDir]) mkdirSync(d, { recursive: true });

const nm = join(root, "node_modules");
try {
  // Worker
  copyFileSync(join(nm, "tesseract.js/dist/worker.min.js"), join(pub, "worker.min.js"));
  // Core: TÜM dosyalar (simd/lstm varyantları dahil — OEM'e göre importScripts eder).
  const coreSrc = join(nm, "tesseract.js-core");
  for (const f of readdirSync(coreSrc)) {
    if (f.endsWith(".wasm") || f.endsWith(".js")) {
      copyFileSync(join(coreSrc, f), join(coreDir, f));
    }
  }
} catch (e) {
  console.warn("[tesseract] core/worker kopyalanamadı (node_modules?):", e.message);
}

const BASE = "https://tessdata.projectnaptha.com/4.0.0";
function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (existsSync(dest)) return resolve();
    const file = createWriteStream(dest);
    https
      .get(url, (r) => {
        if (r.statusCode !== 200) {
          reject(new Error(`${r.statusCode} ${url}`));
          return;
        }
        r.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", reject);
  });
}

for (const lang of ["tur", "eng"]) {
  try {
    await download(`${BASE}/${lang}.traineddata.gz`, join(langDir, `${lang}.traineddata.gz`));
  } catch (e) {
    console.warn(`[tesseract] ${lang} dil verisi indirilemedi:`, e.message);
  }
}
console.log("[tesseract] OCR asset'leri hazır → public/tesseract/");
