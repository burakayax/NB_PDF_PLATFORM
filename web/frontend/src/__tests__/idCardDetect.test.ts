import { describe, expect, it } from "vitest";
import { isCardShaped, qualityHint, quadArea, quadAspect, scaleQuad } from "../lib/idCardDetect";
import type { Quad } from "../lib/documentScan";

const rect = (w: number, h: number, x = 0, y = 0): Quad => [
  { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
];

describe("kimlik kartı kenar bulma yardımcıları", () => {
  it("kimlik oranı (1,586) kart sayılır; kare sayılmaz", () => {
    expect(isCardShaped(rect(856, 540))).toBe(true);
    expect(isCardShaped(rect(540, 856))).toBe(true); // dik tutulmuş kart
    expect(isCardShaped(rect(500, 500))).toBe(false);
  });

  it("alan ve oran hesabı", () => {
    expect(quadArea(rect(10, 20))).toBe(200);
    expect(quadAspect(rect(30, 20))).toBeCloseTo(1.5);
  });

  it("ölçekleme dörtgeni orantılı büyütür", () => {
    const q = scaleQuad(rect(10, 10, 5, 5), 2);
    expect(q[0]).toEqual({ x: 10, y: 10 });
    expect(q[2]).toEqual({ x: 30, y: 30 });
  });

  it("uyarı: küçük kapsama ve düşük çözünürlük", () => {
    expect(qualityHint({ reason: "ok", coverage: 0.1, cardWidthPx: 1500 })).toBe("closer");
    expect(qualityHint({ reason: "ok", coverage: 0.5, cardWidthPx: 400 })).toBe("low-res");
    expect(qualityHint({ reason: "ok", coverage: 0.5, cardWidthPx: 1200 })).toBeNull();
    expect(qualityHint({ reason: "not-found", coverage: 0, cardWidthPx: 0 })).toBeNull();
  });
});
