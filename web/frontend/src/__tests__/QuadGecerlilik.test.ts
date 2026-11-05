import { describe, it, expect } from "vitest";
import { quadGecerli, cekimSonucuGuvenilir } from "../lib/quadGecerlilik";
import type { Quad } from "../lib/documentScan";

const W = 800;
const H = 600;
const q = (...n: number[]) =>
  [{ x: n[0]!, y: n[1]! }, { x: n[2]!, y: n[3]! }, { x: n[4]!, y: n[5]! }, { x: n[6]!, y: n[7]! }] as Quad;

describe("quadGecerli", () => {
  it("düzgün bir sayfayı kabul eder", () => {
    expect(quadGecerli(q(100, 80, 700, 90, 690, 520, 110, 530), W, H)).toBe(true);
  });
  it("perspektifli (yamuk) sayfayı kabul eder", () => {
    expect(quadGecerli(q(180, 80, 620, 80, 720, 520, 80, 520), W, H)).toBe(true);
  });
  it("kendini kesen (kelebek) dörtgeni reddeder", () => {
    expect(quadGecerli(q(100, 80, 700, 520, 700, 80, 100, 520), W, H)).toBe(false);
  });
  it("içe çöken (dışbükey olmayan) dörtgeni reddeder", () => {
    expect(quadGecerli(q(100, 80, 700, 80, 400, 200, 100, 520), W, H)).toBe(false);
  });
  it("ince şeridi (kıvrım/metin satırı) reddeder", () => {
    expect(quadGecerli(q(100, 280, 700, 280, 700, 320, 100, 320), W, H)).toBe(false);
  });
  it("aşırı dar açılı dörtgeni reddeder", () => {
    expect(quadGecerli(q(100, 100, 700, 100, 650, 500, 400, 140), W, H)).toBe(false);
  });
  it("NaN köşeyi reddeder", () => {
    expect(quadGecerli(q(NaN, 80, 700, 90, 690, 520, 110, 530), W, H)).toBe(false);
  });
});

describe("cekimSonucuGuvenilir", () => {
  it("küçük kırıntıyı reddeder", () => {
    expect(cekimSonucuGuvenilir(q(300, 250, 420, 250, 420, 340, 300, 340), W, H)).toBe(false);
  });
  it("sayfayı dolduran sonucu kabul eder", () => {
    expect(cekimSonucuGuvenilir(q(20, 20, 780, 25, 775, 580, 25, 575), W, H)).toBe(true);
  });
});
