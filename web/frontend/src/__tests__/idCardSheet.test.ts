import { describe, expect, it } from "vitest";
import { A4_MM, CARD_MM, layoutSheet } from "../lib/idCardSheet";

const mm = (pt: number) => (pt * 25.4) / 72;

describe("kimlik kartı A4 yerleşimi", () => {
  it("kartlar gerçek boyutta (85,6 × 54 mm) ve yatayda ortalı", () => {
    const { cards } = layoutSheet("id1", "two");
    expect(cards).toHaveLength(2);
    expect(mm(cards[0]!.w)).toBeCloseTo(CARD_MM.id1.w, 1);
    expect(mm(cards[0]!.h)).toBeCloseTo(CARD_MM.id1.h, 1);
    expect(mm(cards[0]!.x)).toBeCloseTo((A4_MM.w - CARD_MM.id1.w) / 2, 1);
  });

  it("iki yüz alt alta ve çakışmıyor, sayfaya sığıyor", () => {
    for (const kind of ["id1", "id3"] as const) {
      const { page, cards } = layoutSheet(kind, "two");
      expect(cards[1]!.y).toBeGreaterThan(cards[0]!.y + cards[0]!.h);
      expect(cards[1]!.y + cards[1]!.h).toBeLessThan(page.h);
    }
  });

  it("tek yüz modunda yalnız bir kart", () => {
    expect(layoutSheet("id3", "one").cards).toHaveLength(1);
  });

  it("sayfa A4 ölçüsünde", () => {
    const { page } = layoutSheet("id1", "two");
    expect(mm(page.w)).toBeCloseTo(210, 1);
    expect(mm(page.h)).toBeCloseTo(297, 1);
  });
});
