import { describe, expect, it } from "vitest";
import { A4_MM, CARD_MM, alignmentsConflict, defaultAligns, layoutSheet, sideBySideAligns } from "../lib/idCardSheet";

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

  it("hizalama: ön ve arka ayrı konumlanır, sayfa içinde kalır", () => {
    const L = { h: "left", v: "top" } as const;
    const R = { h: "right", v: "bottom" } as const;
    const { cards } = layoutSheet("id1", "two", { front: L, back: R });
    expect(mm(cards[0]!.x)).toBeCloseTo(15, 1);
    expect(mm(cards[0]!.y)).toBeCloseTo(15, 1);
    expect(mm(cards[1]!.x + cards[1]!.w)).toBeCloseTo(A4_MM.w - 15, 1);
    expect(mm(cards[1]!.y + cards[1]!.h)).toBeCloseTo(A4_MM.h - 15, 1);
  });

  it("aynı veya üst üste konumlar çakışır; yan yana düzen kimlikte var, pasaportta yok", () => {
    const T = { h: "center", v: "top" } as const;
    expect(alignmentsConflict("id1", T, T)).toBe(true);
    expect(alignmentsConflict("id1", T, { h: "left", v: "top" })).toBe(true);
    expect(alignmentsConflict("id1", T, { h: "center", v: "bottom" })).toBe(false);
    expect(alignmentsConflict("id1", { h: "left", v: "top" }, { h: "right", v: "top" })).toBe(false);
    expect(sideBySideAligns("id1")).not.toBeNull();
    expect(sideBySideAligns("id3")).toBeNull();
  });

  it("alt alta (aynı konum) tek blok: arka yüz ön yüzün hemen altında, her belge türünde sayfaya sığar", () => {
    for (const kind of ["id1", "id3"] as const) {
      const { page, cards } = layoutSheet(kind, "two", defaultAligns(kind));
      const gap = mm(cards[1]!.y - (cards[0]!.y + cards[0]!.h));
      expect(gap).toBeCloseTo(12, 1);
      expect(cards[1]!.y + cards[1]!.h).toBeLessThan(page.h);
    }
    // Sayfanın ortasında blok: üst ve alt boşluk eşit
    const mid = { h: "center", v: "middle" } as const;
    const { page, cards } = layoutSheet("id1", "two", { front: mid, back: mid });
    expect(cards[0]!.y).toBeCloseTo(page.h - (cards[1]!.y + cards[1]!.h), 1);
  });
});
