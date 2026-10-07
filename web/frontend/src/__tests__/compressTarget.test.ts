import { describe, expect, it } from "vitest";
import {
  COMPRESS_TARGET_PRESETS_KB,
  compressTargetOutcome,
  formatTargetKb,
  isRasterizedFilename,
} from "../lib/compressTarget";

const KB = 1024;

describe("hedef boyut — sonucun dürüst yorumu", () => {
  it("hedefin altına inildiyse 'reached'", () => {
    expect(
      compressTargetOutcome({ sourceBytes: 3000 * KB, resultBytes: 900 * KB, targetKb: 1024, filename: "a(Sıkıştırılmış).pdf" }),
    ).toEqual({ kind: "reached", rasterized: false });
  });

  it("hedef tam sınırdaysa 'reached' (≤)", () => {
    expect(
      compressTargetOutcome({ sourceBytes: 3000 * KB, resultBytes: 500 * KB, targetKb: 500, filename: "a.pdf" }).kind,
    ).toBe("reached");
  });

  it("inilemediyse 'missed' — başarı gibi gösterilmez", () => {
    expect(
      compressTargetOutcome({ sourceBytes: 3000 * KB, resultBytes: 1500 * KB, targetKb: 1024, filename: "a.pdf" }),
    ).toEqual({ kind: "missed", rasterized: false });
  });

  it("dosya zaten hedefin altındaydıysa 'already'", () => {
    expect(
      compressTargetOutcome({ sourceBytes: 400 * KB, resultBytes: 400 * KB, targetKb: 1024, filename: "a.pdf" }),
    ).toEqual({ kind: "already" });
  });

  it("görüntüye çevrilmiş çıktı adından tanınır (Türkçe ve ASCII)", () => {
    expect(isRasterizedFilename("belge(Sıkıştırılmış-görüntü).pdf")).toBe(true);
    expect(isRasterizedFilename("belge(Sikistirilmis-goruntu).pdf")).toBe(true);
    expect(isRasterizedFilename("belge(Sıkıştırılmış).pdf")).toBe(false);
    expect(
      compressTargetOutcome({ sourceBytes: 3000 * KB, resultBytes: 100 * KB, targetKb: 200, filename: "b(Sıkıştırılmış-görüntü).pdf" }),
    ).toEqual({ kind: "reached", rasterized: true });
  });

  it("ön ayarlar artan sırada, ilki 'hedef yok'", () => {
    expect(COMPRESS_TARGET_PRESETS_KB[0]).toBe(0);
    const rest = COMPRESS_TARGET_PRESETS_KB.slice(1);
    expect([...rest].sort((a, b) => a - b)).toEqual([...rest]);
  });

  it("boyut biçimi", () => {
    expect(formatTargetKb(500)).toBe("500 KB");
    expect(formatTargetKb(1024)).toBe("1 MB");
    expect(formatTargetKb(1536)).toBe("1.5 MB");
  });
});
