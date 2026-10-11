import { describe, expect, it } from "vitest";
import { splitNeedsPages, watermarkMissingContent } from "../lib/toolSubmissionCheck";

/**
 * Düğmenin pasif kalma koşulları (canlı kontrolde yakalanan hata): yeni bölme kiplerinde sayfa
 * metni gerekmez; filigranda yalnızca logo da yeterlidir.
 */
describe("splitNeedsPages", () => {
  it("tek PDF ve ayrı ayrı kiplerinde sayfa gerekir", () => {
    expect(splitNeedsPages("single")).toBe(true);
    expect(splitNeedsPages("separate")).toBe(true);
  });
  it("her N sayfa, boyuta göre ve yer imine göre kiplerinde gerekmez", () => {
    expect(splitNeedsPages("every")).toBe(false);
    expect(splitNeedsPages("size")).toBe(false);
    expect(splitNeedsPages("outline")).toBe(false);
  });
  it("bilinmeyen/boş kip eski davranışı korur (sayfa gerekir)", () => {
    expect(splitNeedsPages("")).toBe(true);
  });
});

describe("watermarkMissingContent", () => {
  it("ne metin ne logo varsa eksik", () => {
    expect(watermarkMissingContent("  ", false)).toBe(true);
  });
  it("yalnızca metin yeterli", () => {
    expect(watermarkMissingContent("GİZLİ", false)).toBe(false);
  });
  it("yalnızca logo yeterli", () => {
    expect(watermarkMissingContent("", true)).toBe(false);
  });
});
