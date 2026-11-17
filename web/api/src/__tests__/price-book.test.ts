import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();
vi.mock("../lib/site-config.service.js", async () => {
  const keys = await import("../lib/site-setting-keys.js");
  return {
    SITE_SETTING_KEYS: keys.SITE_SETTING_KEYS,
    registerPackagesMergedInvalidator: () => undefined,
    getSetting: async (k: string) => store.get(k) ?? null,
    setSetting: async (k: string, v: unknown) => {
      store.set(k, v);
    },
  };
});

import { PLAN_PRICES, EXTRA_SEAT_PRICE } from "../lib/plan-catalogue.js";
import { SITE_SETTING_KEYS } from "../lib/site-setting-keys.js";
import {
  getResolvedPackagesConfig,
  invalidateResolvedPackagesConfig,
  upsertPackagesConfigPartial,
} from "../lib/packages-config.service.js";

beforeEach(() => {
  store.clear();
  invalidateResolvedPackagesConfig();
});

describe("fiyat defteri", () => {
  it("kayıt yoksa varsayılan, koddaki yeni fiyatlardır (TL + USD + ek koltuk)", async () => {
    const { priceBook, prices } = await getResolvedPackagesConfig();
    expect(priceBook.plans).toEqual(PLAN_PRICES);
    expect(priceBook.extraSeat).toEqual(EXTRA_SEAT_PRICE);
    expect(prices).toEqual({ PRO: "449.00", BUSINESS: "1499.00", PRO_ANNUAL: "3600.00" });
  });

  it("ESKİ kayıtlı Pro/Business fiyatı yeni varsayılanı ezmez", async () => {
    store.set(SITE_SETTING_KEYS.PACKAGES_CONFIG, { prices: { PRO: "399.00", BUSINESS: "1099.00", PRO_ANNUAL: "3990.00" } });
    const { priceBook } = await getResolvedPackagesConfig();
    expect(priceBook.plans.PRO.tryGrossMonthly).toBe("449.00");
    expect(priceBook.plans.BUSINESS.tryGrossMonthly).toBe("1499.00");
  });

  it("panelden girilen TL ve USD değerleri geçerli olur; gönderilmeyen alan korunur", async () => {
    await upsertPackagesConfigPartial({
      priceBook: { plans: { PLUS: { tryGrossMonthly: "299,00", usdMonthly: "8.49" } }, extraSeat: { usdMonthly: "10.99" } },
    });
    invalidateResolvedPackagesConfig();
    const { priceBook } = await getResolvedPackagesConfig();
    expect(priceBook.plans.PLUS.tryGrossMonthly).toBe("299.00");
    expect(priceBook.plans.PLUS.usdMonthly).toBe("8.49");
    expect(priceBook.plans.PLUS.tryGrossYearly).toBe("2400.00");
    expect(priceBook.extraSeat).toEqual({ tryGrossMonthly: "299.00", usdMonthly: "10.99" });
  });

  it("sıfır, negatif ya da sayı olmayan fiyat reddedilir", async () => {
    await expect(upsertPackagesConfigPartial({ priceBook: { plans: { PRO: { usdMonthly: "0" } } } })).rejects.toThrow();
    await expect(upsertPackagesConfigPartial({ priceBook: { plans: { PRO: { tryGrossMonthly: "abc" } } } })).rejects.toThrow();
    await expect(upsertPackagesConfigPartial({ priceBook: { extraSeat: { tryGrossMonthly: "-5" } } })).rejects.toThrow();
  });
});
