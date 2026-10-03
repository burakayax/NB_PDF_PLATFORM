/**
 * FİYAT TUTARLILIĞI — sistemin dört ayrı yerinde farklı fiyat olamaz.
 *
 * NEDEN: Fiyatlar bir dönem dört yerde ayrı tanımlıydı (ana sayfa kartları,
 * uygulama içi yükseltme ekranı, ödeme denetleyicisi, veritabanı varsayılanı)
 * ve ayrışmışlardı: kullanıcı 249 ₺ görüp 358,80 ₺ ödüyordu. Ödemeler kapalı
 * olduğu için kimse zarar görmedi, ama açıldığı gün ilk müşteri gördüğünün 1,4
 * katını ödeyecekti.
 *
 * Bu test iki şeyi garanti eder:
 *   1. Ön yüzdeki yedek fiyatlar katalogla birebir aynıdır.
 *   2. Hiçbir plan, yapay zekâ hakkının TAMAMI kullanılsa bile zarar ettirmez.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PLAN_PRICES,
  EXTRA_SEAT_PRICE,
  AI_MONTHLY_CREDITS,
  AI_COST_PER_CREDIT_USD,
  TOPUP_PACKS,
  CONTRACT_AUDIT,
  contractAuditCredits,
  contractAuditCostUsd,
  QUICK_SCAN,
  quickScanCredits,
  quickScanCostUsd,
  YEARLY_BILLING_PLANS,
  KDV_RATE,
  netFromGrossTry,
  type PaidPlanId,
} from "../lib/plan-catalogue.js";

const here = dirname(fileURLToPath(import.meta.url));
const planConfigPath = join(here, "..", "..", "..", "frontend", "src", "lib", "planConfig.ts");

/** Ön yüzdeki plan tanımından bir planın fiyatlarını (minor unit) okur. */
function frontendPrices(planId: string): { monthlyTry: number; yearlyTry: number; monthlyUsd: number; yearlyUsd: number } {
  const src = readFileSync(planConfigPath, "utf8");
  const at = src.indexOf(`id: "${planId}"`);
  expect(at, `${planId} ön yüz plan tanımında bulunamadı`).toBeGreaterThan(-1);
  const block = src.slice(at, at + 3000);
  const monthly = /monthly:\s*\{\s*TRY:\s*(\d+),\s*USD:\s*(\d+)\s*\}/.exec(block);
  const yearly = /yearly:\s*\{\s*TRY:\s*(\d+),\s*USD:\s*(\d+)\s*\}/.exec(block);
  expect(monthly, `${planId} aylık fiyatı okunamadı`).not.toBeNull();
  expect(yearly, `${planId} yıllık fiyatı okunamadı`).not.toBeNull();
  return {
    monthlyTry: Number(monthly![1]),
    monthlyUsd: Number(monthly![2]),
    yearlyTry: Number(yearly![1]),
    yearlyUsd: Number(yearly![2]),
  };
}

const PAID: PaidPlanId[] = ["STARTER", "PLUS", "PRO", "BUSINESS"];
const minor = (s: string) => Math.round(Number.parseFloat(s) * 100);

describe("fiyat kataloğu ↔ ön yüz", () => {
  it.each(PAID)("%s fiyatları her iki tarafta aynı", (plan) => {
    const fe = frontendPrices(plan);
    const cat = PLAN_PRICES[plan];
    expect(fe.monthlyTry).toBe(minor(cat.tryGrossMonthly));
    expect(fe.yearlyTry).toBe(minor(cat.tryGrossYearly));
    expect(fe.monthlyUsd).toBe(minor(cat.usdMonthly));
    expect(fe.yearlyUsd).toBe(minor(cat.usdYearly));
  });
});

describe("KDV çevrimi", () => {
  it("net tutara KDV eklenince müşterinin gördüğü tutar çıkar", () => {
    for (const plan of PAID) {
      for (const gross of [PLAN_PRICES[plan].tryGrossMonthly, PLAN_PRICES[plan].tryGrossYearly]) {
        const net = Number.parseFloat(netFromGrossTry(gross));
        const backToGross = Math.round(net * (1 + KDV_RATE) * 100) / 100;
        // Kuruş yuvarlamasından en fazla 1 kuruş sapma kabul edilir.
        expect(Math.abs(backToGross - Number.parseFloat(gross))).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it("geçersiz tutarı sessizce kabul etmez", () => {
    expect(() => netFromGrossTry("0")).toThrow();
    expect(() => netFromGrossTry("abc")).toThrow();
  });
});

describe("zarar koruması", () => {
  /**
   * Tek değişken gider yapay zekâ çağrılarıdır. Bir plan, aylık hakkının
   * TAMAMI kullanılsa bile ödeme komisyonu sonrası en az %55 brüt marj
   * bırakmalıdır. Bırakmıyorsa ya fiyat düşük ya hak sayısı fazladır.
   */
  const MIN_MARGIN = 0.55;
  const PSP_FEE_RATE = 0.035; // iyzico komisyonu için güvenli üst tahmin
  const USD_PER_TRY = 1 / 60; // kur güvenli taraf: TL'nin değeri düşük varsayılır

  it.each(PAID)("%s planı en kötü kullanımda bile zarar ettirmez", (plan) => {
    const aiCost = AI_MONTHLY_CREDITS[plan] * AI_COST_PER_CREDIT_USD;

    // TL kanalı: gelir KDV hariç nettir (KDV devlete gider, gelir değildir).
    const grossTry = Number.parseFloat(PLAN_PRICES[plan].tryGrossMonthly);
    const netRevenueUsd = Number.parseFloat(netFromGrossTry(PLAN_PRICES[plan].tryGrossMonthly)) * USD_PER_TRY;
    const tryProfit = netRevenueUsd - aiCost - grossTry * PSP_FEE_RATE * USD_PER_TRY;
    expect(tryProfit / netRevenueUsd).toBeGreaterThanOrEqual(MIN_MARGIN);

    // USD kanalı: ihracat istisnası → KDV yok, gösterilen tutar gelirdir.
    const usd = Number.parseFloat(PLAN_PRICES[plan].usdMonthly);
    const usdProfit = usd - aiCost - usd * PSP_FEE_RATE;
    expect(usdProfit / usd).toBeGreaterThanOrEqual(MIN_MARGIN);
  });

  it("ücretsiz plan yapay zekâ hakkı vermez", () => {
    // Ücretsiz planda yapay zekâ = sınırsız gider. Hak sayısı sıfır kalmalı.
    expect(AI_MONTHLY_CREDITS.FREE).toBe(0);
  });
});

describe("fiyat merdiveni", () => {
  it("üst plan alt plandan pahalıdır (her iki para biriminde)", () => {
    for (let i = 1; i < PAID.length; i++) {
      const lower = PLAN_PRICES[PAID[i - 1]!];
      const upper = PLAN_PRICES[PAID[i]!];
      expect(minor(upper.tryGrossMonthly)).toBeGreaterThan(minor(lower.tryGrossMonthly));
      expect(minor(upper.usdMonthly)).toBeGreaterThan(minor(lower.usdMonthly));
    }
  });

  it("yıllık ödeme aylıktan ucuzdur (iki ay bedava)", () => {
    for (const plan of PAID) {
      const p = PLAN_PRICES[plan];
      expect(minor(p.tryGrossYearly)).toBeLessThan(minor(p.tryGrossMonthly) * 12);
      expect(minor(p.usdYearly)).toBeLessThan(minor(p.usdMonthly) * 12);
    }
  });

  it("yıllık faturalandırma yalnızca ekranda sunulan planlarda açıktır", () => {
    // Başlangıç ve Plus ekranda aylık-tek karttır (MonthlyOnlyCard). Ödeme
    // tarafı da bunu reddetmeli, yoksa satılmayan bir döngü tahsil edilir.
    expect([...YEARLY_BILLING_PLANS].sort()).toEqual(["BUSINESS", "PRO"]);
  });

  it("yıllık tutar aylığın tam 10 katıdır (iki ay bedava)", () => {
    // Ekranda Business yıllığı bir dönem 12 katla hesaplanıyordu; ödeme ise 10
    // katı çekiyordu. Kural her iki planda da aynı kalmalı.
    for (const plan of YEARLY_BILLING_PLANS) {
      const p = PLAN_PRICES[plan];
      expect(minor(p.tryGrossYearly)).toBe(minor(p.tryGrossMonthly) * 10);
    }
  });

  it("ek koltuk, Business'ın koltuk başı fiyatını aşmaz", () => {
    // Business 5 koltuk içerir; ek koltuk bundan pahalı olursa paket anlamsızlaşır.
    const perSeatTry = Number.parseFloat(PLAN_PRICES.BUSINESS.tryGrossMonthly) / 5;
    const perSeatUsd = Number.parseFloat(PLAN_PRICES.BUSINESS.usdMonthly) / 5;
    expect(Number.parseFloat(EXTRA_SEAT_PRICE.tryGrossMonthly)).toBeLessThanOrEqual(perSeatTry);
    expect(Number.parseFloat(EXTRA_SEAT_PRICE.usdMonthly)).toBeLessThanOrEqual(perSeatUsd);
  });
});


describe("ek kredi paketleri ve sözleşme denetimi", () => {
  const MIN_MARGIN = 0.55;
  const PSP_FEE_RATE = 0.035;
  /** Paket TL fiyatları bu kura göre kurulur (gerçek kur 2026-10-02: ~60,4); kur aşarsa TL paketler yükseltilmelidir. */
  const TRY_PER_USD = 60;
  const SIZES = [3_700, 125_000, 240_000]; // küçük / ~50 sayfa / en uzun kabul edilen belge

  it("kredi başı fiyat paket büyüdükçe düşer (her iki para biriminde)", () => {
    for (let i = 1; i < TOPUP_PACKS.length; i++) {
      const a = TOPUP_PACKS[i - 1]!;
      const b = TOPUP_PACKS[i]!;
      expect(b.priceUSD / b.credits).toBeLessThan(a.priceUSD / a.credits);
      expect(b.priceTRY / b.credits).toBeLessThan(a.priceTRY / a.credits);
    }
  });

  it.each(SIZES)("sözleşme denetimi (%i karakter) HER pakette en az %55 marj bırakır", (chars) => {
    const credits = contractAuditCredits(chars);
    const cost = contractAuditCostUsd(chars);
    for (const pack of TOPUP_PACKS) {
      // USD kanalı: KDV yok, gösterilen tutar gelirdir.
      const usdRev = credits * (pack.priceUSD / pack.credits);
      expect((usdRev - cost - usdRev * PSP_FEE_RATE) / usdRev, `${pack.id} USD`).toBeGreaterThanOrEqual(MIN_MARGIN);
      // TL kanalı: gelir KDV hariç nettir; komisyon KDV dahil tutar üzerinden.
      const grossUsd = (credits * (pack.priceTRY / pack.credits)) / TRY_PER_USD;
      const netUsd = grossUsd / (1 + KDV_RATE);
      expect((netUsd - cost - grossUsd * PSP_FEE_RATE) / netUsd, `${pack.id} TRY`).toBeGreaterThanOrEqual(MIN_MARGIN);
    }
  });

  it.each(SIZES)("USD kanalında sağlayıcı vergisi (%20) GERİ ALINAMASA bile (%i karakter) marj pozitif ve ≥ %40", (chars) => {
    // Anthropic bakiye yüklemesinde fiyatın üstüne ~%20 vergi eklenir (20 $ → 24 $). Şirket bunu
    // KDV olarak geri alamazsa gerçek maliyet ×1,2 olur. TL kanalı zaten 60 ₺/$ ile bunu içerir.
    const credits = contractAuditCredits(chars);
    const cost = contractAuditCostUsd(chars) * 1.2;
    for (const pack of TOPUP_PACKS) {
      const rev = credits * (pack.priceUSD / pack.credits);
      expect((rev - cost - rev * PSP_FEE_RATE) / rev, `${pack.id} USD (vergili maliyet)`).toBeGreaterThanOrEqual(0.4);
    }
  });

  it("denetim bedeli belge uzadıkça artar ve sınırlar içinde kalır", () => {
    expect(contractAuditCredits(0)).toBe(CONTRACT_AUDIT.minCredits);
    expect(contractAuditCredits(125_000)).toBeGreaterThan(contractAuditCredits(3_700));
    expect(contractAuditCredits(10_000_000)).toBe(CONTRACT_AUDIT.maxCredits);
  });

  it("en uzun denetim bile tek bir paketle karşılanabilir", () => {
    expect(TOPUP_PACKS.some((p) => p.credits >= CONTRACT_AUDIT.maxCredits)).toBe(true);
    // (Aylık hakkın ağır araca geçmemesi bir KURALDIR; ai-quota-reserve.test.ts doğrular.)
  });

  it("ön yüzdeki tahmin formülü sunucuyla aynıdır", () => {
    const src = readFileSync(join(here, "..", "..", "..", "frontend", "src", "lib", "aiCredits.ts"), "utf8");
    const num = (k: string) => Number(new RegExp(`${k}:\\s*([\\d_]+)`).exec(src)?.[1]?.replace(/_/g, ""));
    expect(num("baseCredits")).toBe(CONTRACT_AUDIT.baseCredits);
    expect(num("charsPerCredit")).toBe(CONTRACT_AUDIT.charsPerCredit);
    expect(num("minCredits")).toBe(CONTRACT_AUDIT.minCredits);
    expect(num("maxCredits")).toBe(CONTRACT_AUDIT.maxCredits);
  });
});


describe("hızlı tarama fiyatı", () => {
  const MIN_MARGIN = 0.55;
  const PSP_FEE_RATE = 0.035;
  const TRY_PER_USD = 60;
  const SIZES = [3_700, 125_000, 240_000];

  it.each(SIZES)("(%i karakter) HER pakette en az %55 marj bırakır (USD ve TL)", (chars) => {
    const credits = quickScanCredits(chars);
    const cost = quickScanCostUsd(chars);
    for (const pack of TOPUP_PACKS) {
      const usdRev = credits * (pack.priceUSD / pack.credits);
      expect((usdRev - cost - usdRev * PSP_FEE_RATE) / usdRev, `${pack.id} USD`).toBeGreaterThanOrEqual(MIN_MARGIN);
      const grossUsd = (credits * (pack.priceTRY / pack.credits)) / TRY_PER_USD;
      const netUsd = grossUsd / (1 + KDV_RATE);
      expect((netUsd - cost - grossUsd * PSP_FEE_RATE) / netUsd, `${pack.id} TRY`).toBeGreaterThanOrEqual(MIN_MARGIN);
    }
  });

  it.each(SIZES)("(%i karakter) aylık haktan düşse bile (hak başı 0,035 $) maliyeti aşmaz", (chars) => {
    // Plan testi her hakkı 0,035 $ maliyetli sayar; hızlı tarama bunun altında kalmalı.
    expect(quickScanCredits(chars) * AI_COST_PER_CREDIT_USD).toBeGreaterThanOrEqual(quickScanCostUsd(chars));
  });

  it("vergi geri alınamasa bile (maliyet ×1,2) USD kanalında marj ≥ %40", () => {
    for (const chars of SIZES) {
      const credits = quickScanCredits(chars);
      const cost = quickScanCostUsd(chars) * 1.2;
      for (const pack of TOPUP_PACKS) {
        const rev = credits * (pack.priceUSD / pack.credits);
        expect((rev - cost - rev * PSP_FEE_RATE) / rev, `${pack.id}`).toBeGreaterThanOrEqual(0.4);
      }
    }
  });

  it("belge uzadıkça artar, sınırlar içinde kalır; tam denetimden her zaman ucuzdur", () => {
    expect(quickScanCredits(0)).toBe(QUICK_SCAN.baseCredits);
    expect(quickScanCredits(125_000)).toBeGreaterThan(quickScanCredits(3_700));
    expect(quickScanCredits(99_999_999)).toBe(QUICK_SCAN.maxCredits);
    for (const chars of SIZES) {
      expect(quickScanCredits(chars)).toBeLessThan(contractAuditCredits(chars) / 4);
    }
  });

  it("ön yüzdeki tahmin formülü sunucuyla aynıdır", () => {
    const src = readFileSync(join(here, "..", "..", "..", "frontend", "src", "lib", "aiCredits.ts"), "utf8");
    const num = (k: string) => Number(new RegExp(`${k}:\\s*([\\d_]+)`).exec(src)?.[1]?.replace(/_/g, ""));
    expect(num("quickBase")).toBe(QUICK_SCAN.baseCredits);
    expect(num("quickCharsPerStep")).toBe(QUICK_SCAN.charsPerStep);
    expect(num("quickMax")).toBe(QUICK_SCAN.maxCredits);
  });
});

describe("kredi paketi ödeme tutarı (KDV iki kez eklenmemeli)", () => {
  it("TL: ödeme akışının KDV ekledikten sonraki tutarı, ekranda gösterilen KDV dahil fiyatla AYNI olur", async () => {
    const { buildCheckoutPricing } = await import("../lib/vat.js");
    const { topupCheckoutAmount, TOPUP_PACKS } = await import("../lib/plan-catalogue.js");
    for (const p of TOPUP_PACKS) {
      const { currency, amount } = topupCheckoutAmount(p, false);
      expect(currency).toBe("TRY");
      const final = buildCheckoutPricing(amount, "TR", "TRY");
      expect(final.grossAmount).toBe(p.priceTRY.toFixed(2));
    }
  });

  it("yurt dışı: USD, KDV'siz — ödenen tutar gösterilen tutardır", async () => {
    const { buildCheckoutPricing } = await import("../lib/vat.js");
    const { topupCheckoutAmount, TOPUP_PACKS } = await import("../lib/plan-catalogue.js");
    for (const p of TOPUP_PACKS) {
      const { currency, amount } = topupCheckoutAmount(p, true);
      expect(currency).toBe("USD");
      expect(buildCheckoutPricing(amount, "DE", "USD").grossAmount).toBe(p.priceUSD.toFixed(2));
    }
  });
});
