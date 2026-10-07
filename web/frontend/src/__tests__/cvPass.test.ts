import { describe, expect, it } from "vitest";
import { hasCvPass, hasFullCvAccess, isPaidPlan } from "../lib/currentPlan";
import { remainingLabel } from "../components/tools/cv/CvPassModal";
import { CV_TEMPLATES } from "../components/tools/cv/cvTemplates";

/**
 * CV GEÇİŞİ — süre dolunca şablonlar KİLİTLENMELİ; ücretli plan ya da geçerli geçiş açmalı.
 * Ücretsiz şablon sayısı ürün kararıdır (4): düşerse/artarsa burada görünür olsun.
 */
const NOW = Date.parse("2026-10-08T12:00:00Z");
const base = { plan: "FREE", teamMember: false };

describe("CV Geçişi erişimi", () => {
  it("geçiş yoksa ya da süresi dolduysa açmaz", () => {
    expect(hasCvPass({ ...base, cvPassUntil: null }, NOW)).toBe(false);
    expect(hasCvPass({ ...base, cvPassUntil: "2026-10-08T11:59:59Z" }, NOW)).toBe(false);
    expect(hasCvPass({ ...base, cvPassUntil: "bozuk" }, NOW)).toBe(false);
  });
  it("süresi dolmamış geçiş açar", () => {
    expect(hasFullCvAccess({ ...base, cvPassUntil: "2026-10-09T12:00:00Z" }, NOW)).toBe(true);
  });
  it("ücretli plan geçişsiz de açar; ücretsiz plan açmaz", () => {
    expect(hasFullCvAccess({ plan: "PRO", teamMember: false, cvPassUntil: null }, NOW)).toBe(true);
    expect(hasFullCvAccess({ ...base, cvPassUntil: null }, NOW)).toBe(false);
    expect(isPaidPlan({ ...base, cvPassUntil: "2026-10-09T12:00:00Z" })).toBe(false); // geçiş plan DEĞİLDİR
  });
});

describe("kalan süre yazısı", () => {
  it("gün, saat ve dakika", () => {
    expect(remainingLabel("2026-10-12T12:00:00Z", true, NOW)).toBe("4 gün");
    expect(remainingLabel("2026-10-08T17:30:00Z", true, NOW)).toBe("5 saat");
    expect(remainingLabel("2026-10-08T12:40:00Z", true, NOW)).toBe("40 dk");
    expect(remainingLabel("2026-10-08T11:00:00Z", true, NOW)).toBe("bitti");
  });
});

describe("şablon katmanları", () => {
  it("4 şablon ücretsiz, kalanı kilitli", () => {
    expect(CV_TEMPLATES.filter((t) => t.free).map((t) => t.id).sort()).toEqual(["klasik-serif", "modern-mavi", "net", "sade"]);
    expect(CV_TEMPLATES.length).toBeGreaterThan(12);
  });
});
