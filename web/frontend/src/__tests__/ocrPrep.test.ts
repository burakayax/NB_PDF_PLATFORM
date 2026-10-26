import { describe, expect, it } from "vitest";
import { estimateSkewDeg, flattenBackground, scaleForOcr, stretchContrast } from "../lib/ocrPrep";

/** Beyaz zemin üstüne `deg` derece eğik yatay yazı çizgileri çizer (koyu çubuklar). */
function skewedLines(w: number, h: number, deg: number): Uint8ClampedArray {
  const g = new Uint8ClampedArray(w * h).fill(255);
  const t = Math.tan((deg * Math.PI) / 180);
  for (let line = 0; line < 14; line++) {
    const y0 = 150 + line * 55;
    for (let x = 120; x < w - 120; x++) {
      // Çubuk yüksekliği ~14 px (bir yazı satırı gibi).
      for (let dy = 0; dy < 14; dy++) {
        const y = Math.round(y0 + dy + (x - w / 2) * t);
        if (y >= 0 && y < h) g[y * w + x] = 20;
      }
    }
  }
  return g;
}

describe("ocrPrep", () => {
  it("küçük girdiyi büyütür, çok büyüğü küçültür, A4/300 DPI'a dokunmaz", () => {
    expect(scaleForOcr(1240, 1754)).toBeGreaterThan(1.9); // 150 DPI A4 → ~2×
    expect(scaleForOcr(2480, 3508)).toBe(1); // 300 DPI A4
    expect(scaleForOcr(6000, 8000)).toBeLessThan(1); // 12 MP+ fotoğraf
  });

  it("eğik satırların eğimini bulur (işaret doğru)", () => {
    const a = estimateSkewDeg(skewedLines(1600, 1100, 2), 1600, 1100);
    const b = estimateSkewDeg(skewedLines(1600, 1100, -2), 1600, 1100);
    expect(Math.abs(a - -b)).toBeLessThan(0.3); // simetrik
    expect(Math.abs(a)).toBeGreaterThan(1.5);
    expect(Math.abs(a)).toBeLessThan(2.5);
    expect(Math.sign(a)).toBe(-Math.sign(b));
  });

  it("düz sayfada ve boş sayfada eğrilik 0 döner", () => {
    expect(estimateSkewDeg(skewedLines(1600, 1100, 0), 1600, 1100)).toBe(0);
    expect(estimateSkewDeg(new Uint8ClampedArray(1600 * 1100).fill(255), 1600, 1100)).toBe(0);
  });

  it("ışık gradyanını düzleştirir: gölgeli kağıt ile aydınlık kağıt aynı değere gelir", () => {
    const w = 640;
    const h = 480;
    const g = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = 255 - (x / w) * 110; // soldan sağa kararan kağıt
    const flat = flattenBackground(g, w, h);
    const left = flat[200 * w + 40];
    const right = flat[200 * w + w - 40];
    expect(Math.abs(left - right)).toBeLessThan(8);
    expect(right).toBeGreaterThan(240);
  });

  it("yazıyı silmez: koyu çizgi düzleştirmeden sonra da koyu kalır", () => {
    const w = 400;
    const h = 300;
    const g = new Uint8ClampedArray(w * h).fill(220);
    for (let x = 50; x < 350; x++) for (let y = 140; y < 146; y++) g[y * w + x] = 30;
    const flat = flattenBackground(g, w, h);
    stretchContrast(flat);
    expect(flat[143 * w + 200]).toBeLessThan(60);
    expect(flat[50 * w + 200]).toBeGreaterThan(240);
  });
});
