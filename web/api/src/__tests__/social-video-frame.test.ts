import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { chooseCoverTime, COVER_FRAME_TIMES, extractCoverFrame, isMostlyBlack } from "../modules/social/platforms/video-frame.js";

const gray = (value: number, n = 576) => new Uint8Array(n).fill(value);
const mixed = (darkShare: number, bright = 200, n = 576) => {
  const a = new Uint8Array(n).fill(bright);
  a.fill(0, 0, Math.floor(n * darkShare));
  return a;
};

describe("siyah kare tespiti", () => {
  it("tamamen siyah, çok koyu ve büyük oranda siyah kareler siyah sayılır", () => {
    expect(isMostlyBlack(gray(0))).toBe(true);
    expect(isMostlyBlack(gray(10))).toBe(true);
    expect(isMostlyBlack(mixed(0.92))).toBe(true);
    expect(isMostlyBlack(new Uint8Array(0))).toBe(true);
  });
  it("başlık ekranı gibi içeriği olan kare siyah sayılmaz", () => {
    expect(isMostlyBlack(gray(180))).toBe(false);
    expect(isMostlyBlack(mixed(0.5))).toBe(false);
    expect(isMostlyBlack(mixed(0.8))).toBe(false);
  });
});

describe("kare seçimi", () => {
  it("ilk anı (2,5 sn) uygunsa onu seçer", async () => {
    expect(await chooseCoverTime(async () => gray(150))).toEqual({ second: 2.5, black: false });
  });
  it("kare siyahsa birkaç kare ileri gider ve ilk uygun kareyi seçer", async () => {
    const seen: number[] = [];
    const r = await chooseCoverTime(async (s) => {
      seen.push(s);
      return s < 3.5 ? gray(0) : gray(150);
    });
    expect(r).toEqual({ second: 3.5, black: false });
    expect(seen).toEqual([2.5, 3, 3.5]);
  });
  it("hepsi siyahsa en parlak kareyi seçer ve bunu bildirir", async () => {
    const r = await chooseCoverTime(async (s) => gray(s === 4 ? 12 : 3));
    expect(r).toEqual({ second: 4, black: true });
  });
  it("video kısaysa (kare yok) kalan anlara bakar, hiç kare yoksa null döner", async () => {
    expect(await chooseCoverTime(async (s) => (s >= 4 ? gray(150) : null))).toEqual({ second: 4, black: false });
    expect(await chooseCoverTime(async () => null)).toBeNull();
    expect(COVER_FRAME_TIMES[0]).toBe(2.5);
  });
});

// Gerçek ffmpeg ile uçtan uca: 3 sn siyah + sonra renkli bir video üretip seçilen karenin siyah olmadığını doğrular.
describe("gerçek video (ffmpeg varsa)", async () => {
  let bin: string | null = null;
  try {
    const mod = (await import("ffmpeg-static")) as unknown as { default?: string | null };
    bin = mod.default ?? null;
  } catch {
    bin = null;
  }
  it.skipIf(!bin)("ilk 3 saniyesi siyah olan videoda siyah olmayan bir kare seçilir", async () => {
    const mk = spawnSync(
      bin!,
      [
        "-v", "error",
        "-f", "lavfi", "-i", "color=c=black:s=160x90:d=3:r=10",
        "-f", "lavfi", "-i", "color=c=orange:s=160x90:d=4:r=10",
        "-filter_complex", "[0][1]concat=n=2:v=1:a=0",
        "-pix_fmt", "yuv420p", "-f", "mp4", "-movflags", "frag_keyframe+empty_moov", "pipe:1",
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    );
    expect(mk.status).toBe(0);
    const frame = await extractCoverFrame(mk.stdout);
    expect(frame).not.toBeNull();
    expect(frame!.black).toBe(false);
    expect(frame!.second).toBeGreaterThanOrEqual(3);
    expect(frame!.jpeg[0]).toBe(0xff); // JPEG imzası
    expect(frame!.jpeg[1]).toBe(0xd8);
  });
});
