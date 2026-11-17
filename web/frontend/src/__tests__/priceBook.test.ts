import { describe, expect, it } from "vitest";
import { applyPriceBook, buildCheckoutQuote, seatUnitFrom } from "../lib/checkoutQuote";
import { PLANS } from "../lib/planConfig";

const book = {
  planPrices: {
    PLUS: { tryGrossMonthly: "299.00", tryGrossYearly: "2990.00", usdMonthly: "8.49", usdYearly: "64.99" },
  },
  extraSeat: { tryGrossMonthly: "349.00", usdMonthly: "11.99" },
};

describe("fiyat defteri (ön yüz)", () => {
  it("panelde değişen Plus TL + USD fiyatı karta uygulanır; diğer planlar aynı kalır", () => {
    const out = applyPriceBook(PLANS, book);
    const plus = out.find((p) => p.id === "PLUS")!;
    expect(plus.pricing.monthly).toEqual({ TRY: 29900, USD: 849 });
    expect(plus.pricing.yearly).toEqual({ TRY: 299000, USD: 6499 });
    expect(out.find((p) => p.id === "PRO")).toBe(PLANS.find((p) => p.id === "PRO"));
  });

  it("defter yoksa liste olduğu gibi döner", () => {
    expect(applyPriceBook(PLANS, undefined)).toBe(PLANS);
  });

  it("ek koltuk fiyatı defterden gelir, yoksa koddaki varsayılan", () => {
    expect(seatUnitFrom(book)).toEqual({ TRY: 349, USD: 11.99 });
    expect(seatUnitFrom(undefined)).toEqual({ TRY: 299, USD: 9.99 });
  });

  it("ödeme özeti, değişen ek koltuk fiyatıyla hesaplanır", () => {
    const biz = PLANS.find((p) => p.id === "BUSINESS")!;
    const base = buildCheckoutQuote({ plan: biz, planId: "BUSINESS", cycle: "MONTHLY", currency: "TRY", extraSeats: 0, seatsOnly: false, discountPercent: null });
    const withSeats = buildCheckoutQuote({ plan: biz, planId: "BUSINESS", cycle: "MONTHLY", currency: "TRY", extraSeats: 2, seatsOnly: false, discountPercent: null, seatUnit: { TRY: 349, USD: 11.99 } })!;
    // 2 koltuk × 349 ₺ KDV dahil = 698 ₺ → toplam, ek koltuksuz tutarın 698 ₺ üstünde
    expect(Math.round((withSeats.total - base!.total) * 100) / 100).toBe(698);
  });
});
