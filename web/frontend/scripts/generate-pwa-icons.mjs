// PWA ikon setini scripts/icon-source.png'den üretir (full-bleed — kenar boşluğu yok).
// Çalıştır: node scripts/generate-pwa-icons.mjs   (yalnızca ikon/marka değişince gerekir)
// Tek bağımlılık: sharp  (yoksa: npm i -D sharp)
//
// Strateji:
//   - Şeffaf kenar payı kırpılır (trim) → ikon gövdesi tile'ı doldurur.
//   - "any" ikonları: full-bleed, şeffaf köşe korunur (kaynaktaki yuvarlak köşe görünümü).
//   - "maskable" + apple-touch: opak açık-mavi zemin (iOS siyah köşe / Android maske şartı).
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const SRC = path.join(here, "icon-source.png");
const OUT = path.join(frontendRoot, "public", "icons");

// Maskable/apple zemini — kaynak ikonun açık-mavi tonu (app.css --nb-bg değil; ikonun kendi tonu).
const BG = { r: 241, g: 246, b: 254, alpha: 1 };

const ANY_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];
const APPLE_TOUCH = 180;

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("[pwa-icons] 'sharp' bulunamadı. Tek seferlik üretim için: npm i -D sharp");
    process.exit(1);
  }
  if (!fs.existsSync(SRC)) {
    console.error(`[pwa-icons] Kaynak ikon yok: ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  // Şeffaf kenarı kırp → ikon gövdesi (kare-ye yakın).
  const trimmed = await sharp(SRC).trim().png().toBuffer();

  for (const size of ANY_SIZES) {
    await sharp(trimmed)
      .resize(size, size, { fit: "fill" }) // full-bleed
      .png()
      .toFile(path.join(OUT, `icon-${size}.png`));
    console.log(`✓ icon-${size}.png`);
  }

  for (const size of MASKABLE_SIZES) {
    const inner = await sharp(trimmed).resize(size, size, { fit: "fill" }).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
      .composite([{ input: inner, left: 0, top: 0 }])
      .png()
      .toFile(path.join(OUT, `maskable-${size}.png`));
    console.log(`✓ maskable-${size}.png`);
  }

  const appleInner = await sharp(trimmed).resize(APPLE_TOUCH, APPLE_TOUCH, { fit: "fill" }).png().toBuffer();
  await sharp({ create: { width: APPLE_TOUCH, height: APPLE_TOUCH, channels: 4, background: BG } })
    .composite([{ input: appleInner, left: 0, top: 0 }])
    .png()
    .toFile(path.join(OUT, "apple-touch-icon.png"));
  console.log("✓ apple-touch-icon.png");

  await sharp(trimmed).resize(32, 32, { fit: "fill" }).png().toFile(path.join(OUT, "favicon-32.png"));
  console.log("✓ favicon-32.png");

  console.log("[pwa-icons] tamam → public/icons/");
}

main().catch((err) => {
  console.error("[pwa-icons] hata:", err);
  process.exit(1);
});
