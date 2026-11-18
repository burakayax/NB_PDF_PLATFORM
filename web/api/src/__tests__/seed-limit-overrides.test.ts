import { describe, expect, it } from "vitest";
import { applySavedLimits, extractSavedLimitOverrides } from "../lib/seed-limit-overrides.js";

const code = { dailyOperationLimit: 3, monthlyOperationLimit: 30, fileSizeLimitMB: 80, batchLimit: 0, queuePriority: "LOW" };

describe("seed: panelde kayıtlı limit korunur", () => {
  it("kayıt yoksa kodun değerleri aynen kalır", () => {
    const r = applySavedLimits("FREE", code, extractSavedLimitOverrides(null));
    expect(r.config).toEqual(code);
    expect(r.changed).toEqual([]);
  });

  it("limit defterindeki kayıt kodun değerinin yerine geçer, diğer alanlar kalır", () => {
    const saved = extractSavedLimitOverrides({ limitBook: { FREE: { dailyOperationLimit: 7, fileSizeLimitMB: 120 } } });
    const r = applySavedLimits("FREE", code, saved);
    expect(r.config.dailyOperationLimit).toBe(7);
    expect(r.config.fileSizeLimitMB).toBe(120);
    expect(r.config.monthlyOperationLimit).toBe(30);
    expect(r.config.queuePriority).toBe("LOW"); // ilgisiz alana dokunulmaz
    expect(r.changed.sort()).toEqual(["dailyOperationLimit", "fileSizeLimitMB"]);
  });

  it("başka planın kaydı bu planı etkilemez", () => {
    const saved = extractSavedLimitOverrides({ limitBook: { PRO: { batchLimit: 50 } } });
    expect(applySavedLimits("FREE", code, saved).config).toEqual(code);
    expect(applySavedLimits("PRO", { ...code, batchLimit: 25 }, saved).config.batchLimit).toBe(50);
  });

  it("günlük limit null (sınırsız) geçerli bir kayıttır", () => {
    const saved = extractSavedLimitOverrides({ limitBook: { STARTER: { dailyOperationLimit: null } } });
    expect(applySavedLimits("STARTER", { ...code, dailyOperationLimit: 25 }, saved).config.dailyOperationLimit).toBeNull();
  });

  it("geçersiz değerler yok sayılır (aralık dışı, tip hatası): seed asla bozuk veri yazmaz", () => {
    const saved = extractSavedLimitOverrides({
      limitBook: { FREE: { dailyOperationLimit: -1, monthlyOperationLimit: 0, fileSizeLimitMB: "9", batchLimit: 2000 } },
    });
    expect(applySavedLimits("FREE", code, saved).config).toEqual(code);
  });

  it("bozuk/beklenmeyen şekiller çökertmez", () => {
    for (const bad of [undefined, null, 5, "x", [], { limitBook: [] }, { limitBook: { FREE: 3 } }]) {
      expect(applySavedLimits("FREE", code, extractSavedLimitOverrides(bad)).config).toEqual(code);
    }
  });

  it("eski yol: Ücretsiz günlük hak plansOverride.FREE.dailyLimit, defterde yoksa korunur", () => {
    const saved = extractSavedLimitOverrides({ plansOverride: { FREE: { dailyLimit: 9 } } });
    expect(applySavedLimits("FREE", code, saved).config.dailyOperationLimit).toBe(9);
  });

  it("defterdeki değer eski yoldan önceliklidir", () => {
    const saved = extractSavedLimitOverrides({
      limitBook: { FREE: { dailyOperationLimit: 4 } },
      plansOverride: { FREE: { dailyLimit: 9 } },
    });
    expect(applySavedLimits("FREE", code, saved).config.dailyOperationLimit).toBe(4);
  });

  it("eski anahtar (plans.override) yalnız yeni kayıtta plansOverride yoksa kullanılır", () => {
    expect(
      applySavedLimits("FREE", code, extractSavedLimitOverrides({}, { FREE: { dailyLimit: 8 } })).config.dailyOperationLimit,
    ).toBe(8);
    expect(
      applySavedLimits("FREE", code, extractSavedLimitOverrides({ plansOverride: {} }, { FREE: { dailyLimit: 8 } })).config
        .dailyOperationLimit,
    ).toBe(3);
  });
});
