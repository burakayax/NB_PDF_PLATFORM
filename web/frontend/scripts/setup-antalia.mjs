/**
 * Türkçe sesli okuma (Antalia-2 Mini, Apache-2.0) model dosyalarını public/tts-tr/ altına hazırlar
 * (SELF-HOST — belge metni cihazdan çıkmaz, modeller de kendi sunucumuzdan gelir).
 *
 *  - 3 ONNX modeli (~49 MB) + 4 sözlük (~2,7 MB): Hugging Face'ten SABİT SÜRÜM (commit) ile indirilir.
 *    `main` değil sabit commit: model sessizce değişip sesi/davranışı bozmasın.
 *  - ort/: onnxruntime-web wasm çalışma zamanı (node_modules'tan).
 *
 * predev/prebuild'de çalışır; public/tts-tr/ gitignore'dadır. İndirilemezse uyarır (araç "model yok" der).
 */
import { existsSync, mkdirSync, copyFileSync, createWriteStream, statSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const COMMIT = "59e66640fad8b9ac24a448f2ccf3c96858ba97a4";
const BASE = `https://huggingface.co/fr0stb1rd/antalia-mini-web-onnx/resolve/${COMMIT}`;
const FILES = [
  ["text_stage.onnx", 4047889],
  ["sound_stage.onnx", 12177156],
  ["decoder.onnx", 32563317],
  ["foreign_dict.json", 1764009],
  ["foreign_parts.json", 705784],
  ["known_words.json", 60628],
  ["english_i.json", 138361],
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public", "tts-tr");
mkdirSync(join(pub, "ort"), { recursive: true });

try {
  for (const f of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"]) {
    copyFileSync(join(root, "node_modules", "onnxruntime-web", "dist", f), join(pub, "ort", f));
  }
} catch (e) {
  console.warn("[tts-tr] çalışma zamanı kopyalanamadı (node_modules?):", e.message);
}

function download(url, dest, redirects = 6) {
  return new Promise((resolve, reject) => {
    const tmp = dest + ".part";
    https
      .get(url, (r) => {
        if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && redirects > 0) {
          r.resume();
          return resolve(download(new URL(r.headers.location, url).toString(), dest, redirects - 1));
        }
        if (r.statusCode !== 200) {
          r.resume();
          return reject(new Error(`${r.statusCode} ${url}`));
        }
        const file = createWriteStream(tmp);
        r.pipe(file);
        file.on("finish", () => file.close(() => { renameSync(tmp, dest); resolve(); }));
        file.on("error", (e) => { try { unlinkSync(tmp); } catch {} reject(e); });
      })
      .on("error", reject);
  });
}

let ok = 0;
for (const [name, size] of FILES) {
  const dest = join(pub, name);
  // Boyut tam eşleşiyorsa yeniden indirme; eksik/bozuk dosya silinip yeniden indirilir.
  if (existsSync(dest) && statSync(dest).size === size) { ok++; continue; }
  try {
    await download(`${BASE}/${name}`, dest);
    if (statSync(dest).size !== size) throw new Error(`beklenmeyen boyut ${statSync(dest).size} ≠ ${size}`);
    ok++;
  } catch (e) {
    console.warn(`[tts-tr] ${name} indirilemedi:`, e.message);
  }
}
console.log(`[tts-tr] ${ok}/${FILES.length} dosya hazır → public/tts-tr/`);
