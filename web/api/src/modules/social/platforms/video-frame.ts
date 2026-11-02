/**
 * Videodan KAPAK karesi seçme (Pinterest video pin kapağı yedeği).
 *
 * Kapak dosyası (reel-covers/<araç>.jpg) bulunamazsa videonun BAŞLIK EKRANININ göründüğü kare kullanılır
 * (bizim videolarda yaklaşık 2–3. saniye). Kare tamamen ya da büyük oranda siyahsa birkaç kare ileri gidilir.
 *
 * Kare okumak için `ffmpeg-static` kullanılır (isteğe bağlı bağımlılık). Kurulu değilse ya da çalışmazsa
 * `null` döner; çağıran Pinterest'in "anahtar kare" özelliğine düşer — kapak eksikliği yayını ASLA engellemez.
 */

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger } from "../../../lib/file-log.js";

/** Denenecek anlar (saniye): önce başlık ekranı, siyahsa ileri. */
export const COVER_FRAME_TIMES = [2.5, 3, 3.5, 4, 4.5, 5, 6] as const;

/** Karşılaştırma için kare küçültülür: 32×18 gri = 576 bayt. */
const PROBE_W = 32;
const PROBE_H = 18;
const DARK_PIXEL = 24; // 0-255 aralığında bundan koyu piksel "siyah" sayılır
const BLACK_SHARE = 0.9; // piksellerin en az %90'ı siyahsa kare siyah sayılır
const MEAN_FLOOR = 14; // ortalama parlaklık bunun altındaysa kare siyah sayılır

/** SAF: gri kare (bayt dizisi) tamamen ya da büyük oranda siyah mı? */
export function isMostlyBlack(gray: Uint8Array): boolean {
  if (gray.length === 0) return true;
  let sum = 0;
  let dark = 0;
  for (const v of gray) {
    sum += v;
    if (v < DARK_PIXEL) dark++;
  }
  return sum / gray.length < MEAN_FLOOR || dark / gray.length >= BLACK_SHARE;
}

/**
 * SAF: sırayla anları dener, ilk siyah OLMAYAN kareyi seçer. Hepsi siyahsa en parlak kare seçilir.
 * `probe` o andaki gri kareyi verir; kare yoksa (video o kadar uzun değil) `null`.
 */
export async function chooseCoverTime(
  probe: (second: number) => Promise<Uint8Array | null>,
  times: readonly number[] = COVER_FRAME_TIMES,
): Promise<{ second: number; black: boolean } | null> {
  let best: { second: number; mean: number } | null = null;
  for (const second of times) {
    const gray = await probe(second);
    if (!gray) continue;
    if (!isMostlyBlack(gray)) return { second, black: false };
    const mean = gray.reduce((a, b) => a + b, 0) / gray.length;
    if (!best || mean > best.mean) best = { second, mean };
  }
  return best ? { second: best.second, black: true } : null;
}

async function ffmpegPath(): Promise<string | null> {
  try {
    const mod = (await import("ffmpeg-static")) as unknown as { default?: string | null };
    return typeof mod.default === "string" && mod.default ? mod.default : null;
  } catch {
    return null;
  }
}

function run(bin: string, args: string[]): Promise<Buffer | null> {
  return new Promise((resolve) => {
    execFile(bin, args, { encoding: "buffer", maxBuffer: 16 * 1024 * 1024, timeout: 30_000 }, (err, stdout) => {
      resolve(err || !stdout?.length ? null : (stdout as Buffer));
    });
  });
}

export type CoverFrame = { jpeg: Buffer; second: number; black: boolean };

/** Videonun başlık karesini JPEG olarak çıkarır; ffmpeg yoksa ya da kare okunamazsa `null`. */
export async function extractCoverFrame(video: Buffer): Promise<CoverFrame | null> {
  const bin = await ffmpegPath();
  if (!bin) return null;
  const dir = await mkdtemp(join(tmpdir(), "pin-cover-"));
  try {
    const file = join(dir, "v.mp4");
    await writeFile(file, video);
    const probe = async (second: number): Promise<Uint8Array | null> => {
      const out = await run(bin, [
        "-v", "error", "-ss", String(second), "-i", file, "-frames:v", "1",
        "-vf", `scale=${PROBE_W}:${PROBE_H},format=gray`, "-f", "rawvideo", "-",
      ]);
      return out && out.length === PROBE_W * PROBE_H ? new Uint8Array(out) : null;
    };
    const choice = await chooseCoverTime(probe);
    if (!choice) return null;
    const jpeg = await run(bin, ["-v", "error", "-ss", String(choice.second), "-i", file, "-frames:v", "1", "-q:v", "3", "-f", "image2pipe", "-vcodec", "mjpeg", "-"]);
    return jpeg ? { jpeg, second: choice.second, black: choice.black } : null;
  } catch (err) {
    logger.warn("social", `Videodan kapak karesi çıkarılamadı: ${String(err)}`);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
