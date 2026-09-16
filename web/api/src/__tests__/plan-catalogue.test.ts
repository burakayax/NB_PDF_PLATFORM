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

  it("ek koltuk, Business'ın koltuk başı fiyatını aşmaz", () => {
    // Business 5 koltuk içerir; ek koltuk bundan pahalı olursa paket anlamsızlaşır.
    const perSeatTry = Number.parseFloat(PLAN_PRICES.BUSINESS.tryGrossMonthly) / 5;
    const perSeatUsd = Number.parseFloat(PLAN_PRICES.BUSINESS.usdMonthly) / 5;
    expect(Number.parseFloat(EXTRA_SEAT_PRICE.tryGrossMonthly)).toBeLessThanOrEqual(perSeatTry);
    expect(Number.parseFloat(EXTRA_SEAT_PRICE.usdMonthly)).toBeLessThanOrEqual(perSeatUsd);
  });
});
