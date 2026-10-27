/**
 * Worker'ın "bilinen istemci rotaları" bölümünü uygulamanın kendi kaynağından üretir:
 *   src/lib/appNavigation.ts (KNOWN_EXACT_PATHS, KNOWN_PREFIXES) + src/lib/accountPaths.ts
 * Kullanım:  node cloudflare/build-not-found-worker.mjs          (dosyayı günceller)
 *            node cloudflare/build-not-found-worker.mjs --kontrol (güncel değilse hata verir)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const burasi = dirname(fileURLToPath(import.meta.url));
const kok = join(burasi, "..");
const workerYolu = join(burasi, "not-found-worker.js");

function dizi(kaynak, ad, ac, kapa) {
  const m = kaynak.match(new RegExp(String.raw`${ad}[^=]*=\s*${ac}([\s\S]*?)${kapa};`));
  if (!m) throw new Error(`${ad} bulunamadı`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

export function rotalariUret() {
  const nav = readFileSync(join(kok, "src/lib/appNavigation.ts"), "utf8");
  const hesap = readFileSync(join(kok, "src/lib/accountPaths.ts"), "utf8");
  const tam = dizi(nav, "KNOWN_EXACT_PATHS", String.raw`new Set\(\[`, String.raw`\]\)`);
  const onek = dizi(nav, "KNOWN_PREFIXES", String.raw`\[`, String.raw`\]`);
  const blok = hesap.match(/ACCOUNT_PANEL_PATHS[^=]*=\s*\{([\s\S]*?)\};/);
  const hesapYollari = [...blok[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const hepsi = [...new Set([...tam, ...hesapYollari])];
  return (
    `/*ROTALAR:BASLA*/\nconst BILINEN_TAM = ${JSON.stringify(hepsi)};\n` +
    `const BILINEN_ONEK = ${JSON.stringify(onek)};\n/*ROTALAR:BITIS*/`
  );
}

const mevcut = readFileSync(workerYolu, "utf8");
const yeni = mevcut.replace(/\/\*ROTALAR:BASLA\*\/[\s\S]*?\/\*ROTALAR:BITIS\*\//, () => rotalariUret());
if (process.argv.includes("--kontrol")) {
  if (yeni !== mevcut) {
    console.error("not-found-worker.js güncel değil: node cloudflare/build-not-found-worker.mjs çalıştır");
    process.exit(1);
  }
  console.log("Worker rota listesi güncel.");
} else {
  writeFileSync(workerYolu, yeni);
  console.log("Worker rota listesi üretildi.");
}
