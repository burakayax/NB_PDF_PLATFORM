/**
 * Derleme / geliştirme öncesi hazırlık adımları.
 *
 * ESKİ: altı betik ARKA ARKAYA çalışıyordu (`a && b && c …`). Aralarında iki grup var:
 *   • ağdan model indirenler (tesseract, scanic, photo-ai) — süreleri bekleme,
 *   • işlemciyi kullananlar (SEO dosyaları, kapak üretimi).
 * Birbirlerine bağlı olmadıkları için artık BİRLİKTE çalışıyor: derleme sunucusunda indirme beklerken
 * kapak/SEO üretimi sürer, toplam süre en uzun adıma iner.
 *
 * SIRA KURALI: `fetch-tool-ratings` önce çalışır (SEO dosyaları onun çıktısını okuyabilir); kalanlar paralel.
 * Herhangi bir adım hata verirse süreç hata koduyla çıkar (derleme durur) — eski `&&` davranışıyla aynı.
 * Kapak üretimi kendi içinde hatayı yutar (bkz. generate-reel-covers.mjs); o davranış değişmedi.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));

function run(name) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, [join(SCRIPTS, `${name}.mjs`)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("close", (code) => {
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      // Çıktı adım bitince topluca yazılır: paralel adımların satırları birbirine karışmasın.
      process.stdout.write(`\n── ${name} (${secs} sn) ──\n${out}`);
      if (code === 0) resolve();
      else reject(new Error(`${name} çıkış kodu ${code}`));
    });
  });
}

try {
  await run("fetch-tool-ratings");
  await Promise.all(
    ["generate-seo-files", "generate-reel-covers", "setup-tesseract", "setup-scanic-ml", "setup-photo-ai", "setup-antalia"].map(run),
  );
} catch (err) {
  console.error(`Hazırlık adımı başarısız: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
