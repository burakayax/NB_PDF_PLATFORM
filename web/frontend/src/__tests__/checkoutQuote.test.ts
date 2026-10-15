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

  it("Pro aylık 399 ₺: net 332,50 + KDV 66,50 = 399,00", () => {
    const q = buildCheckoutQuote({ ...base, plan: plan("PRO"), planId: "PRO", cycle: "MONTHLY", currency: "TRY" })!;
    expect([q.net, q.vat, q.total]).toEqual([332.5, 66.5, 399]);
  });

  it("USD'de KDV yoktur: ödenecek tutar liste fiyatıdır", () => {
    for (const p of PLANS.filter((x) => x.id !== "FREE")) {
      const q = buildCheckoutQuote({ ...base, plan: p, planId: p.id, cycle: "MONTHLY", currency: "USD" })!;
      expect(q.vat).toBe(0);
      expect(q.total).toBeCloseTo(p.pricing.monthly.USD / 100, 2);
    }
  });

  it("iskonto netten düşer, KDV indirimli net üzerine eklenir (Pro 399 ₺, %15)", () => {
    const q = buildCheckoutQuote({ ...base, plan: plan("PRO"), planId: "PRO", cycle: "MONTHLY", currency: "TRY", discountPercent: 15 })!;
    expect(q.net).toBe(282.63); // 332,50 × 0,85
    expect(q.vat).toBe(56.53);
    expect(q.total).toBe(339.16);
    expect(q.listTotal).toBe(399);
  });

  it("USD iskontosu gerçekten uygulanır (Pro $11,99, %15)", () => {
    const q = buildCheckoutQuote({ ...base, plan: plan("PRO"), planId: "PRO", cycle: "MONTHLY", currency: "USD", discountPercent: 15 })!;
    expect(q.total).toBe(10.19);
    expect(q.listTotal).toBe(11.99);
  });

  it("yıllık Business + 3 ek koltuk: koltuklara %17 yıllık indirim de dahil", () => {
    const q = buildCheckoutQuote({ ...base, plan: plan("BUSINESS"), planId: "BUSINESS", cycle: "YEARLY", currency: "TRY", extraSeats: 3 })!;
    // plan net 10.992/1,2 = 9.160 ; koltuk: 3 × 182,50 × 12 × 0,83 = 5.453,10
    expect(q.net).toBe(14613.1);
    expect(q.total).toBe(17535.72);
  });

  it("yalnız koltuk satın alma: plan bedeli yok", () => {
    const q = buildCheckoutQuote({ ...base, plan: undefined, planId: "BUSINESS", cycle: "MONTHLY", currency: "TRY", extraSeats: 2, seatsOnly: true })!;
    expect(q.net).toBe(365); // 2 × 182,50
    expect(q.total).toBe(438); // 219 × 2
  });
});

describe("yönetim paneli fiyatı ve yıllık türetme", () => {
  it("yıllık = ~10 ay fiyatı, 12'nin tam katı", () => {
    expect(yearlyGrossFromMonthly(229)).toBe(2292);
    expect(yearlyGrossFromMonthly(399)).toBe(3996);
    expect(yearlyGrossFromMonthly(1099)).toBe(10992);
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
    const out = applyTryPriceOverrides(PLANS, { proMonthly: "399.00", proAnnual: "3996.00", businessMonthly: "1099.00" });
    expect(out.map((p) => p.pricing)).toEqual(PLANS.map((p) => p.pricing));
  });
});
