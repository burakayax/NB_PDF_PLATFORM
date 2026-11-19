import { describe, expect, it } from "vitest";
import { change, maskForSharing, shiftYmd, trYesterdayYmd } from "../modules/nightly-summary/nightly-summary.js";

describe("gecelik özet", () => {
  it("dün, Türkiye saatine göre hesaplanır", () => {
    // 18 Kasım 00:30 TR = 17 Kasım 21:30 UTC → "dün" 17 Kasım
    expect(trYesterdayYmd(new Date("2026-11-17T21:30:00Z"))).toBe("2026-11-17");
    // 18 Kasım 23:30 TR = 20:30 UTC → "dün" 17 Kasım
    expect(trYesterdayYmd(new Date("2026-11-18T20:30:00Z"))).toBe("2026-11-17");
  });

  it("gün kaydırma ay ve yıl sınırını geçer", () => {
    expect(shiftYmd("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftYmd("2026-01-01", -7)).toBe("2025-12-25");
  });

  it("değişim: fark, yön oku ve 7 gün ortalaması", () => {
    expect(change(5, 3, [1, 2, 3, 4])).toEqual({ value: 5, previousDay: 3, diff: 2, trend: "↑", avg7d: 2.5 });
    expect(change(0, 2, [])).toMatchObject({ diff: -2, trend: "↓", avg7d: 0 });
    expect(change(4, 4, [4])).toMatchObject({ diff: 0, trend: "=" });
  });

  it("iç raporda sayılar maskelenmez; paylaşım sürümü için yardımcı <5 yazar", () => {
    expect(maskForSharing(3)).toBe("<5");
    expect(maskForSharing(0)).toBe(0);
    expect(maskForSharing(12)).toBe(12);
  });
});
