/**
 * Scanic ML (opsiyonel nöral köşe dedektörü) asset'lerini node_modules'dan
 * public/scanic-ml/'e kopyalar. Böylece model + ONNX Runtime WASM CDN yerine
 * KENDİ sunucumuzdan servis edilir (gizlilik + CSP `connect-src 'self'` korunur).
 *
 * documentScan.ts bunu `ml: { assetBaseUrl: "/scanic-ml/" }` ile kullanır.
 * Build-zamanı çalışır (prebuild/predev); çıktı .gitignore'dadır.
 */
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const srcDir = join(frontendRoot, "node_modules", "scanic-ml", "dist");
const dstDir = join(frontendRoot, "public", "scanic-ml");

const FILES = [
  "doccornernet_lean.ort",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];

if (!existsSync(srcDir)) {
  console.warn("[scanic-ml] node_modules/scanic-ml bulunamadı — ML dedektörü atlandı.");
  process.exit(0);
}

mkdirSync(dstDir, { recursive: true });
let copied = 0;
for (const f of FILES) {
  const s = join(srcDir, f);
  if (existsSync(s)) {
    copyFileSync(s, join(dstDir, f));
    copied++;
  }
}
console.log(`[scanic-ml] ${copied}/${FILES.length} ML asset'i hazır → public/scanic-ml/`);
