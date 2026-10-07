/**
 * AI Fotoğraf Stüdyosu — cihazda çalışan model ve çalışma-zamanı dosyalarını
 * public/photo-ai/ altına hazırlar (SELF-HOST).
 *
 * Neden self-host: fotoğraf kullanıcının cihazından çıkmamalı; CSP de
 * `connect-src 'self'` olduğu için CDN'den model/wasm çekilemez.
 *  - ort/      : onnxruntime-web wasm çalışma zamanı (node_modules'tan kopyalanır)
 *  - mediapipe/: yüz işaret noktası wasm'ı (node_modules'tan kopyalanır)
 *  - modnet.onnx          : portre matting (Apache-2.0, ~26 MB) — arka plan kaldırma
 *  - face_landmarker.task : yüz işaret noktaları (Apache-2.0, ~3.7 MB) — akıllı kırpma
 *
 * predev/prebuild'de çalışır; public/photo-ai/ gitignore'dadır.
 */
import { existsSync, mkdirSync, copyFileSync, createWriteStream, readdirSync, statSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public", "photo-ai");
const nm = join(root, "node_modules");
for (const d of [pub, join(pub, "ort"), join(pub, "mediapipe")]) mkdirSync(d, { recursive: true });

try {
  for (const f of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
    copyFileSync(join(nm, "onnxruntime-web", "dist", f), join(pub, "ort", f));
  }
  const mp = join(nm, "@mediapipe", "tasks-vision", "wasm");
  for (const f of readdirSync(mp)) copyFileSync(join(mp, f), join(pub, "mediapipe", f));
} catch (e) {
  console.warn("[photo-ai] çalışma zamanı kopyalanamadı (node_modules?):", e.message);
}

function download(url, dest, redirects = 6) {
  return new Promise((resolve, reject) => {
    if (existsSync(dest) && statSync(dest).size > 1000) return resolve();
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

const ASSETS = [
  ["https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx", "modnet.onnx"],
  ["https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", "face_landmarker.task"],
];
for (const [url, name] of ASSETS) {
  try {
    await download(url, join(pub, name));
  } catch (e) {
    console.warn(`[photo-ai] ${name} indirilemedi:`, e.message);
  }
}
console.log("[photo-ai] fotoğraf yapay zekâ dosyaları hazır → public/photo-ai/");
