// Tesseract.js (OCR) asset'lerini public/tesseract/ altına hazırlar — self-host.
// worker + core node_modules'tan kopyalanır; dil verileri (tur/eng) bir kez indirilir.
// CSP `worker-src 'self' blob:` olduğundan CDN worker çalışmaz → self-host şart.
// predev/prebuild'de çalışır. public/tesseract/ gitignore'dadır (repo şişmesin).
import { existsSync, mkdirSync, copyFileSync, readdirSync, writeFileSync } from "fs";
import { gzipSync } from "zlib";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public", "tesseract");
const coreDir = join(pub, "core");
// Klasör adı ocr.ts içindeki TESS_LANG_PATH ile aynı olmalı. Adı değiştirmek, tarayıcıdaki
// önbellekli eski modeli geçersiz kılar.
const langDir = join(pub, "lang-best");
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

const BASE = "https://github.com/tesseract-ocr/tessdata_best/raw/main";
// tesseract.js dil dosyasını "<dil>.traineddata.gz" olarak ister: indirip burada sıkıştırırız.
function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (existsSync(dest)) return resolve();
    const get = (u, left) =>
      https
        .get(u, (r) => {
          if ([301, 302, 307, 308].includes(r.statusCode) && r.headers.location && left > 0) {
            r.resume();
            return get(new URL(r.headers.location, u).toString(), left - 1);
          }
          if (r.statusCode !== 200) {
            r.resume();
            return reject(new Error(`${r.statusCode} ${url}`));
          }
          const chunks = [];
          r.on("data", (c) => chunks.push(c));
          r.on("end", () => {
            try {
              writeFileSync(dest, gzipSync(Buffer.concat(chunks), { level: 9 }));
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        })
        .on("error", reject);
    get(url, 5);
  });
}

for (const lang of ["tur", "eng"]) {
  try {
    await download(`${BASE}/${lang}.traineddata`, join(langDir, `${lang}.traineddata.gz`));
  } catch (e) {
    console.warn(`[tesseract] ${lang} dil verisi indirilemedi:`, e.message);
  }
}
console.log("[tesseract] OCR asset'leri hazır → public/tesseract/ (lang-best)");
