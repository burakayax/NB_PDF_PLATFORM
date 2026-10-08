/**
 * Instagram Reels videoları (1080×1920, 9:16, MP4/H.264, sessiz kanallı AAC).
 *
 * KAYNAK: `generate-carousels.mjs` çıktısı. Her yazının carousel slaytları (JPG) sırayla
 * gösterilip yumuşak geçişle birleştirilir; yeni bir içerik uydurulmaz, slayt metinleri
 * zaten yazının kendi adımlarından geliyor.
 *
 * NEDEN BUILD'DE: Carousel ile aynı mimari — sunucuda ffmpeg ve kalıcı disk gerekmez,
 * Instagram videoyu sitenin kendi adresinden indirir. Dosyalar `public/social/reels/`
 * altında (gitignore'da) üretilir; imza değişmediyse yeniden kodlanmaz.
 *
 * SES: Yok (sessiz kanal eklenir; bazı oynatıcılar ses kanalsız videoyu bozuk sayar).
 * Müzik/telif riski olmasın diye bilerek eklenmedi; istenirse Instagram'ın kendi
 * kütüphanesinden paylaşım sırasında seçilir.
 *
 * HATA YUTULUR: ffmpeg yoksa/çökerse build durmaz; o yazı için Reel çıkmaz ve otomasyon
 * carousel/tek görselle devam eder.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { BG } from "./generate-covers.mjs";

const W = 1080;
const H = 1920;
const FPS = 30;
const DESIGN_VERSION = 1;
/** Slayt başına süre (sn): kapak kısa, içerik okunacak kadar uzun, kapanış biraz daha. */
const COVER_SEC = 2.6;
const SLIDE_SEC = 3.6;
const LAST_SEC = 3.2;
const FADE_SEC = 0.4;

async function resolveFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const mod = await import("ffmpeg-static");
    return mod.default ?? null;
  } catch {
    return null;
  }
}

function durations(count) {
  return Array.from({ length: count }, (_, i) => (i === 0 ? COVER_SEC : i === count - 1 ? LAST_SEC : SLIDE_SEC));
}

/** ffmpeg argümanları: slaytlar dikey tuvale oturtulur, `xfade` ile birleştirilir. */
export function buildFfmpegArgs(images, outFile) {
  const d = durations(images.length);
  const bg = String(BG).replace("#", "0x");
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  // Her görsel, geçiş süresi kadar uzun tutulur ki xfade ortasında kare kalmasın.
  images.forEach((img, i) => args.push("-loop", "1", "-t", String(d[i] + FADE_SEC), "-i", img));
  args.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo");

  const chains = images.map(
    (_, i) =>
      `[${i}:v]scale=${W}:-2,pad=${W}:${H}:0:(${H}-ih)/2:color=${bg},setsar=1,fps=${FPS},format=yuv420p[v${i}]`,
  );
  let last = "v0";
  let offset = 0;
  for (let i = 1; i < images.length; i++) {
    offset += d[i - 1];
    const out = `x${i}`;
    chains.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE_SEC}:offset=${offset.toFixed(2)}[${out}]`);
    last = out;
  }
  const total = offset + d[images.length - 1];
  args.push(
    "-filter_complex",
    chains.join(";"),
    "-map",
    `[${last}]`,
    "-map",
    `${images.length}:a`,
    "-t",
    total.toFixed(2),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    outFile,
  );
  return { args, seconds: total };
}

/**
 * Carousel manifestindeki her yazı için Reel üretir.
 * @returns {{ written: number, skipped: number, failed: number, posts: number, path: string }}
 */
export async function writeReels({ publicDir, baseUrl }) {
  const carouselManifest = join(publicDir, "social", "carousel", "manifest.json");
  const root = join(publicDir, "social", "reels");
  const manifestPath = join(root, "manifest.json");
  const result = { written: 0, skipped: 0, failed: 0, posts: 0, path: "/social/reels/manifest.json" };

  let carousels;
  try {
    carousels = JSON.parse(readFileSync(carouselManifest, "utf8"));
  } catch {
    console.warn("[reels] carousel manifesti yok; Reel üretilmedi.");
    return result;
  }

  const ffmpeg = await resolveFfmpeg();
  if (!ffmpeg) {
    console.warn("[reels] ffmpeg bulunamadı; Reel üretilmedi.");
    return result;
  }

  let previous = {};
  try {
    previous = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    /* ilk üretim */
  }

  const manifest = {};
  for (const [postUrl, entry] of Object.entries(carousels)) {
    const urls = Array.isArray(entry?.urls) ? entry.urls : [];
    if (urls.length < 3 || !entry.signature) continue;

    // Slayt adresi → yerel dosya: /social/carousel/tr/<slug>/N.jpg
    const rel = urls.map((u) => new URL(u).pathname.replace(/^\/social\/carousel\//, ""));
    const images = rel.map((r) => join(publicDir, "social", "carousel", r));
    if (!images.every((p) => existsSync(p))) continue;

    const slugDir = dirname(rel[0]); // "tr/<slug>"
    const outFile = join(root, slugDir, "reel.mp4");
    const signature = createHash("sha1")
      .update(JSON.stringify([DESIGN_VERSION, entry.signature, FPS, W, H]))
      .digest("hex");
    const videoUrl = `${baseUrl}/social/reels/${slugDir}/reel.mp4`;
    const { args, seconds } = buildFfmpegArgs(images, outFile);

    if (previous[postUrl]?.signature === signature && existsSync(outFile)) {
      manifest[postUrl] = previous[postUrl];
      result.skipped++;
      continue;
    }

    mkdirSync(dirname(outFile), { recursive: true });
    const run = spawnSync(ffmpeg, args, { encoding: "utf8", timeout: 180_000 });
    if (run.status !== 0 || !existsSync(outFile)) {
      console.warn(`[reels] ${slugDir} üretilemedi: ${(run.stderr || run.error || "").toString().slice(0, 300)}`);
      result.failed++;
      continue;
    }
    manifest[postUrl] = {
      signature,
      url: videoUrl,
      seconds: Math.round(seconds * 10) / 10,
      bytes: statSync(outFile).size,
    };
    result.written++;
  }

  result.posts = Object.keys(manifest).length;
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return result;
}

// Doğrudan çalıştırılırsa (prebuild): `node scripts/generate-reels.mjs`
import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const publicDir = join(frontendRoot, "public");
  // Adres, carousel manifestindeki slayt adreslerinden alınır: iki üretim hep aynı alan adını kullanır.
  let baseUrl = "";
  try {
    const first = Object.values(JSON.parse(readFileSync(join(publicDir, "social", "carousel", "manifest.json"), "utf8")))[0];
    baseUrl = new URL(first.urls[0]).origin;
  } catch {
    /* carousel yok: writeReels zaten uyarıp çıkar */
  }
  try {
    const r = await writeReels({ publicDir, baseUrl });
    console.log(`[reels] ${r.written} üretildi, ${r.skipped} atlandı, ${r.failed} başarısız (${r.posts} yazı)`);
  } catch (err) {
    // Video üretimi isteğe bağlı bir ek: hata sitenin yayınlanmasını durdurmamalı.
    console.warn(`[reels] atlandı: ${err instanceof Error ? err.message : String(err)}`);
  }
}
