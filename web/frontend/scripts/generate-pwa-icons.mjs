// PWA ikon setini public/logo.png'den üretir (any + maskable + apple-touch + favicon).
// Çalıştır: node scripts/generate-pwa-icons.mjs  (yalnızca logo/marka değişince gerekir)
// Tek bağımlılık: sharp varsa onu kullanır; yoksa açık bir hata ile yönlendirir.
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const SRC = path.join(frontendRoot, "public", "logo.png");
const OUT = path.join(frontendRoot, "public", "icons");

// Tasarım token'ı --nb-bg (app.css) ile birebir; maskable arka planı ve splash için.
const BG = "#0f172a";

// "any" ikonları: şeffaf, kenardan ufak nefes payı. "maskable": dolu arka plan + %20 güvenli alan.
const ANY_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];
const APPLE_TOUCH = 180;

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error(
      "[pwa-icons] 'sharp' bulunamadı. Tek seferlik üretim için: npm i -D sharp\n" +
        "Alternatif: ikonları herhangi bir araçla üretip public/icons/ altına ayni isimlerle koyun.",
    );
    process.exit(1);
  }

  if (!fs.existsSync(SRC)) {
    console.error(`[pwa-icons] Kaynak logo yok: ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  for (const size of ANY_SIZES) {
    const pad = Math.round(size * 0.08);
    await sharp(SRC)
      .resize(size - pad * 2, size - pad * 2, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(OUT, `icon-${size}.png`));
    console.log(`✓ icon-${size}.png`);
  }

  for (const size of MASKABLE_SIZES) {
    const inner = Math.round(size * 0.6); // %20 güvenli alan her kenarda
    const off = Math.round((size - inner) / 2);
    const logo = await sharp(SRC)
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
      .composite([{ input: logo, top: off, left: off }])
      .png()
      .toFile(path.join(OUT, `maskable-${size}.png`));
    console.log(`✓ maskable-${size}.png`);
  }

  // apple-touch-icon: şeffaflık iOS'ta siyah görünür → dolu arka plan.
  const appleInner = Math.round(APPLE_TOUCH * 0.74);
  const appleOff = Math.round((APPLE_TOUCH - appleInner) / 2);
  const appleLogo = await sharp(SRC)
    .resize(appleInner, appleInner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: APPLE_TOUCH, height: APPLE_TOUCH, channels: 4, background: BG } })
    .composite([{ input: appleLogo, top: appleOff, left: appleOff }])
    .png()
    .toFile(path.join(OUT, `apple-touch-icon.png`));
  console.log("✓ apple-touch-icon.png");

  // favicon (32) — tarayıcı sekmesi.
  await sharp(SRC).resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(OUT, "favicon-32.png"));
  console.log("✓ favicon-32.png");

  console.log("[pwa-icons] tamam → public/icons/");
}

main().catch((err) => {
  console.error("[pwa-icons] hata:", err);
  process.exit(1);
});
