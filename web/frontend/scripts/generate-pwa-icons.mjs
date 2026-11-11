// PWA ikon setini scripts/icon-source.png'den üretir.
// Çalıştır: node scripts/generate-pwa-icons.mjs   (yalnızca ikon/marka değişince gerekir)
// Tek bağımlılık: sharp  (yoksa: npm i -D sharp)
//
// Strateji:
//   - Kaynak görselde asıl logo (açık-mavi 4-ikonlu kare) koyu gradient bir arka
//     plan + glow içinde, tuvalin ~%72'sinde. Otomatik trim gradient'i kesemez;
//     bu yüzden merkezdeki logo bölgesini KIRPARIZ (extract).
//   - Kırpılan logo BEYAZ zemine, ikonu neredeyse dolduracak minimal payla oturur.
//   - maskable için Android "safe zone" gereği biraz daha pay bırakılır.
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const SRC = path.join(here, "icon-source.png");
const OUT = path.join(frontendRoot, "public", "icons");

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// Kaynaktaki logonun (açık-mavi kare) tuval içindeki oranı — gradient arka planı
// dışarıda bırakacak şekilde. Gerekirse ince ayar: sol/üst kenar ve genişlik/boy.
const CROP = { left: 0.14, top: 0.11, width: 0.72, height: 0.73 };

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

  const meta = await sharp(SRC).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1024;
  const logo = await sharp(SRC)
    .extract({
      left: Math.round(CROP.left * W),
      top: Math.round(CROP.top * H),
      width: Math.round(CROP.width * W),
      height: Math.round(CROP.height * H),
    })
    .png()
    .toBuffer();

  // Beyaz kare zemin + logo (contain, verilen pay). padRatio: kenar payı oranı.
  async function render(size, outPath, padRatio) {
    const pad = Math.round(size * padRatio);
    const inner = Math.max(1, size - pad * 2);
    const li = await sharp(logo)
      .resize(inner, inner, { fit: "contain", background: WHITE })
      .png()
      .toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
      .composite([{ input: li, left: pad, top: pad }])
      .png()
      .toFile(outPath);
  }

  for (const size of ANY_SIZES) {
    await render(size, path.join(OUT, `icon-${size}.png`), 0.04);
    console.log(`✓ icon-${size}.png`);
  }
  for (const size of MASKABLE_SIZES) {
    await render(size, path.join(OUT, `maskable-${size}.png`), 0.12); // Android safe zone
    console.log(`✓ maskable-${size}.png`);
  }
  await render(APPLE_TOUCH, path.join(OUT, "apple-touch-icon.png"), 0.05);
  console.log("✓ apple-touch-icon.png");
  await render(32, path.join(OUT, "favicon-32.png"), 0.03);
  console.log("✓ favicon-32.png");

  // Navbar/landing amblemi — mobil ikonla aynı beyaz-zeminli logo, ama YUVARLAK
  // köşeli (sitede küçük gösterilir; koyu navbarda köşeli beyaz kare çirkin durur).
  {
    const size = 256;
    const pad = Math.round(size * 0.05);
    const inner = size - pad * 2;
    const li = await sharp(logo).resize(inner, inner, { fit: "contain", background: WHITE }).png().toBuffer();
    const base = await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
      .composite([{ input: li, left: pad, top: pad }])
      .png()
      .toBuffer();
    const rx = Math.round(size * 0.22);
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${rx}" ry="${rx}"/></svg>`,
    );
    await sharp(base)
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toFile(path.join(frontendRoot, "public", "emblem.png"));
    console.log("✓ emblem.png (public, yuvarlak)");
  }

  console.log("[pwa-icons] tamam → public/icons/");
}

main().catch((err) => {
  console.error("[pwa-icons] hata:", err);
  process.exit(1);
});
