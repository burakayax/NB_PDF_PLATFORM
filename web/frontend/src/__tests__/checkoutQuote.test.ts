import { describe, it, expect } from "vitest";
import { PLANS } from "../lib/planConfig";
import { applyTryPriceOverrides, buildCheckoutQuote, yearlyGrossFromMonthly } from "../lib/checkoutQuote";

const plan = (id: string) => PLANS.find((p) => p.id === id)!;
const base = { extraSeats: 0, seatsOnly: false, discountPercent: null };

describe("ödeme özeti = sunucunun tahsil ettiği tutar", () => {
  it("TL fiyat KDV DAHİLDİR: ödenecek tutar listedeki fiyatın aynısıdır (üstüne KDV eklenmez)", () => {
    for (const p of PLANS.filter((x) => x.id !== "FREE")) {
      for (const cycle of ["MONTHLY", "YEARLY"] as const) {
        const q = buildCheckoutQuote({ ...base, plan: p, planId: p.id, cycle, currency: "TRY" })!;
        const listed = (cycle === "YEARLY" ? p.pricing.yearly.TRY : p.pricing.monthly.TRY) / 100;
        expect(q.total, `${p.id} ${cycle}`).toBeCloseTo(listed, 2);
      }
    }
  });

  it("Pro aylık 449 ₺: net 374,17 + KDV 74,83 = 449,00", () => {
    const q = buildCheckoutQuote({ ...base, plan: plan("PRO"), planId: "PRO", cycle: "MONTHLY", currency: "TRY" })!;
    expect([q.net, q.vat, q.total]).toEqual([374.17, 74.83, 449]);
  });

  it("USD'de KDV yoktur: ödenecek tutar liste fiyatıdır", () => {
    for (const p of PLANS.filter((x) => x.id !== "FREE")) {
      const q = buildCheckoutQuote({ ...base, plan: p, planId: p.id, cycle: "MONTHLY", currency: "USD", exportExemption: true })!;
      expect(q.vat).toBe(0);
      expect(q.total).toBeCloseTo(p.pricing.monthly.USD / 100, 2);
    }
  });

  it("iskonto netten düşer, KDV indirimli net üzerine eklenir (Pro 449 ₺, %15)", () => {
    const q = buildCheckoutQuote({ ...base, plan: plan("PRO"), planId: "PRO", cycle: "MONTHLY", currency: "TRY", discountPercent: 15 })!;
    expect(q.net).toBe(318.04); // 374,17 × 0,85
    expect(q.vat).toBe(63.61);
    expect(q.total).toBe(381.65);
    expect(q.listTotal).toBe(449);
  });

  it("istisna KAPALIYKEN (varsayılan) USD'ye de %20 KDV eklenir — sunucuyla aynı", () => {
    const q = buildCheckoutQuote({ ...base, plan: plan("PRO"), planId: "PRO", cycle: "MONTHLY", currency: "USD" })!;
    const net = plan("PRO").pricing.monthly.USD / 100;
    expect(q.vatRate).toBe(0.2);
    expect(q.net).toBeCloseTo(net, 2);
    expect(q.vat).toBeCloseTo(Math.round(net * 0.2 * 100) / 100, 2);
    expect(q.total).toBeCloseTo(q.net + q.vat, 2);
  });

  it("USD iskontosu gerçekten uygulanır (Pro $12,99, %15)", () => {
    const q = buildCheckoutQuote({ ...base, plan: plan("PRO"), planId: "PRO", cycle: "MONTHLY", currency: "USD", discountPercent: 15, exportExemption: true })!;
    expect(q.total).toBe(11.04);
    expect(q.listTotal).toBe(12.99);
  });

  it("yıllık Business + 3 ek koltuk: koltuklara %17 yıllık indirim de dahil", () => {
    const q = buildCheckoutQuote({ ...base, plan: plan("BUSINESS"), planId: "BUSINESS", cycle: "YEARLY", currency: "TRY", extraSeats: 3 })!;
    // plan net 14.988/1,2 = 12.490 ; koltuk: 3 × 249,17 × 12 × 0,83 = 7.445,20
    expect(q.net).toBe(19935.2);
    expect(q.total).toBe(23922.24);
  });

  it("yalnız koltuk satın alma: plan bedeli yok", () => {
    const q = buildCheckoutQuote({ ...base, plan: undefined, planId: "BUSINESS", cycle: "MONTHLY", currency: "TRY", extraSeats: 2, seatsOnly: true })!;
    expect(q.net).toBe(498.34); // 2 × 249,17 (299/1,2)
    expect(q.total).toBe(598.01); // 2 × 249,17 × 1,2 (sunucuyla aynı yuvarlama)
  });
});

describe("yönetim paneli fiyatı ve yıllık türetme", () => {
  it("yıllık = ~10 ay fiyatı, 12'nin tam katı", () => {
    expect(yearlyGrossFromMonthly(279)).toBe(2796);
    expect(yearlyGrossFromMonthly(449)).toBe(4488);
    expect(yearlyGrossFromMonthly(1499)).toBe(14988);
  });

  it("panelde Business aylık değişirse yıllık türetilir; Plus/Başlangıç etkilenmez", () => {
    const out = applyTryPriceOverrides(PLANS, { proMonthly: "349.00", proAnnual: "3500.00", businessMonthly: "999.00" });
    const get = (id: string) => out.find((p) => p.id === id)!;
    expect(get("PRO").pricing.monthly.TRY).toBe(34900);
    expect(get("PRO").pricing.yearly.TRY).toBe(350000);
    expect(get("BUSINESS").pricing.monthly.TRY).toBe(99900);
    expect(get("BUSINESS").pricing.yearly.TRY).toBe(yearlyGrossFromMonthly(999) * 100);
    expect(get("PLUS")).toBe(PLANS.find((p) => p.id === "PLUS"));
  });

  it("panel girdisi yoksa fiyatlar planConfig ile aynı kalır", () => {
    expect(applyTryPriceOverrides(PLANS, null)).toBe(PLANS);
    const out = applyTryPriceOverrides(PLANS, { proMonthly: "449.00", proAnnual: "4488.00", businessMonthly: "1499.00" });
    expect(out.map((p) => p.pricing)).toEqual(PLANS.map((p) => p.pricing));
  });
});
