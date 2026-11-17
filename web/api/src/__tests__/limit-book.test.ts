import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Limit defteri: panelde KAYDEDİLEN limitler kota kontrolünde satırdaki/koddaki değeri ezer;
 * kaydedilmeyen alan eskisi gibi kalır. Geçersiz rakam asla kaydedilmez.
 */

const store = new Map<string, unknown>();

vi.mock("../lib/site-config.service.js", () => ({
  getSetting: vi.fn(async (k: string) => store.get(k) ?? null),
  setSetting: vi.fn(async (k: string, v: unknown) => {
    store.set(k, v);
  }),
  registerPackagesMergedInvalidator: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({ prisma: {} }));
vi.mock("../modules/organization/organization.service.js", () => ({
  createOrganizationForUser: vi.fn(),
  revertExpiredOverride: vi.fn(),
}));

const { upsertPackagesConfigPartial, getResolvedPackagesConfig, invalidateResolvedPackagesConfig } = await import(
  "../lib/packages-config.service.js"
);
const { effectiveOrgLimits } = await import("../lib/quota.js");
const { PLAN_LIMITS, AI_MONTHLY_CREDITS } = await import("../lib/plan-catalogue.js");

beforeEach(() => {
  store.clear();
  invalidateResolvedPackagesConfig();
});

describe("limit defteri", () => {
  it("kayıt yokken kod varsayılanlarını verir, kayıtlı alan yoktur", async () => {
    const r = await getResolvedPackagesConfig();
    expect(r.limitBook.PRO.monthlyOperationLimit).toBe(PLAN_LIMITS.PRO.monthlyOperationLimit);
    expect(r.limitBook.PLUS.aiMonthlyCredits).toBe(AI_MONTHLY_CREDITS.PLUS);
    expect(r.savedLimits).toEqual({});
  });

  it("panelden kaydedilen limit okunur; yalnız o alan kayıtlı sayılır", async () => {
    await upsertPackagesConfigPartial({ limitBook: { STARTER: { monthlyOperationLimit: 400, dailyOperationLimit: null } } });
    invalidateResolvedPackagesConfig();
    const r = await getResolvedPackagesConfig();
    expect(r.savedLimits.STARTER).toEqual({ monthlyOperationLimit: 400, dailyOperationLimit: null });
    expect(r.limitBook.STARTER.monthlyOperationLimit).toBe(400);
    expect(r.limitBook.STARTER.dailyOperationLimit).toBeNull();
    expect(r.limitBook.STARTER.fileSizeLimitMB).toBe(PLAN_LIMITS.STARTER.fileSizeLimitMB);
  });

  it("geçersiz rakam hata verir ve kaydedilmez", async () => {
    await expect(upsertPackagesConfigPartial({ limitBook: { PRO: { monthlyOperationLimit: 0 } } })).rejects.toThrow();
    await expect(upsertPackagesConfigPartial({ limitBook: { PRO: { fileSizeLimitMB: 1.5 } } })).rejects.toThrow();
    expect(store.size).toBe(0);
  });

  it("eski Ücretsiz günlük hak kaydı (plansOverride.FREE.dailyLimit) korunur", async () => {
    store.set("packages.config", { plansOverride: { FREE: { dailyLimit: 7 } } });
    invalidateResolvedPackagesConfig();
    const r = await getResolvedPackagesConfig();
    expect(r.savedLimits.FREE?.dailyOperationLimit).toBe(7);
  });
});

describe("effectiveOrgLimits + kayıtlı limit", () => {
  const org = { plan: "STARTER" as const, monthlyOperationLimit: 250, fileSizeLimitMB: 100, batchLimit: 0 };

  it("kayıt yoksa satırdaki değer geçerlidir (davranış değişmez)", () => {
    expect(effectiveOrgLimits(org, 0, false, null)).toEqual({ monthly: 250, fileSizeLimitMB: 100, batchLimit: 0 });
  });

  it("panelde kayıtlı alan satırı ezer, kayıtsız alan satırı izler", () => {
    const lim = effectiveOrgLimits(org, 0, false, { STARTER: { monthlyOperationLimit: 500, batchLimit: 5 } });
    expect(lim).toEqual({ monthly: 500, fileSizeLimitMB: 100, batchLimit: 5 });
  });

  it("Business: kayıtlı taban + ek koltuk havuzu", () => {
    const b = { plan: "BUSINESS" as const, monthlyOperationLimit: 1, fileSizeLimitMB: 1, batchLimit: 1 };
    expect(effectiveOrgLimits(b, 2, false, { BUSINESS: { monthlyOperationLimit: 8000 } }).monthly).toBe(8000 + 2 * 1000);
    expect(effectiveOrgLimits(b, 2, false, null).monthly).toBe(PLAN_LIMITS.BUSINESS.monthlyOperationLimit + 2000);
  });
});
