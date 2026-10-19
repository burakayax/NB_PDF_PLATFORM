import { describe, expect, it } from "vitest";
import { isFeatureLockedByPlan } from "../lib/planGate";

const base = { isAuthenticated: true, allowedFeatures: null, loading: false, failed: false };

describe("plan kilidi", () => {
  it("plan bilgisi alınamadıysa (429/500/ağ) araç kilitli kalır", () => {
    expect(isFeatureLockedByPlan("watermark", { ...base, failed: true })).toBe(true);
    expect(isFeatureLockedByPlan("pdf-to-pdfa", { ...base, failed: true, loading: true })).toBe(true);
  });
  it("ilk yüklenirken (henüz hata yok) yanıp sönen kilit göstermez", () => {
    expect(isFeatureLockedByPlan("watermark", { ...base, loading: true })).toBe(false);
  });
  it("bilgi gelince plana göre karar verir", () => {
    const g = { ...base, allowedFeatures: ["merge", "split"] };
    expect(isFeatureLockedByPlan("watermark", g)).toBe(true);
    expect(isFeatureLockedByPlan("merge", g)).toBe(false);
  });
  it("son iyi bilgi varken geçici hata yetkiyi değiştirmez", () => {
    const g = { ...base, allowedFeatures: ["merge"], failed: true };
    expect(isFeatureLockedByPlan("merge", g)).toBe(false);
    expect(isFeatureLockedByPlan("watermark", g)).toBe(true);
  });
  it("misafirde kilit yoktur", () => {
    expect(isFeatureLockedByPlan("watermark", { ...base, isAuthenticated: false, failed: true })).toBe(false);
  });
});
