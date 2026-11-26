import { describe, expect, it } from "vitest";
import { TOOLS } from "../lib/toolCatalog";
import { toolSlugForFeature } from "../lib/toolRoutes";
import type { FeatureKey } from "../api/subscription";
import { ARAC_SAYISI, TOOL_SLUGS } from "../seo/seoContent.mjs";

/**
 * Araç sayısı (başlık, açıklama, ana sayfa, fiyat kartı) TOOL_SLUGS uzunluğundan türer.
 * Yeni araç yalnız katalogda (toolCatalog.ts) ya da yalnız TOOL_SLUGS'ta eklenirse sayı
 * sessizce yanlış kalır. Bu test iki listeyi eşit tutar: biri eksikse BURADA kırılır.
 */
describe("araç sayısı tek kaynak", () => {
  it("katalogdaki her araç TOOL_SLUGS'ta var", () => {
    const eksik = TOOLS.map((t) => toolSlugForFeature(t.id as FeatureKey)).filter((s) => !TOOL_SLUGS.includes(s));
    expect(eksik).toEqual([]);
  });
  it("TOOL_SLUGS'taki her slug katalogdaki bir araca karşılık gelir", () => {
    const katalog = new Set(TOOLS.map((t) => toolSlugForFeature(t.id as FeatureKey)));
    const fazla = TOOL_SLUGS.filter((s) => !katalog.has(s));
    expect(fazla).toEqual([]);
  });
  it("tekrarlı slug yok ve sayı listeyle aynı", () => {
    expect(new Set(TOOL_SLUGS).size).toBe(TOOL_SLUGS.length);
    expect(ARAC_SAYISI).toBe(TOOL_SLUGS.length);
  });
});
