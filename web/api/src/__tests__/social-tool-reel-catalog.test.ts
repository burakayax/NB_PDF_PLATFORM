import { describe, expect, it } from "vitest";
import { TOOL_REEL_CATALOG } from "../modules/social/tool-reel-catalog.js";

/** Kaynakta doğrulanmamış iddialar: gönderi metninde (özet/başlık) geçmemeli. */
const RISKY = /kalite kaybı olmaz|without losing quality|no quality loss|kayıt gerekmez|sunucuya hiç|100%/i;

describe("Araç videosu kataloğu", () => {
  it("kimlikler benzersiz, bağlantılar kendi alan adımızda ve iki dilde dolu", () => {
    const ids = TOOL_REEL_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of TOOL_REEL_CATALOG) {
      expect(e.tr.link).toMatch(/^https:\/\/www\.pdfplatform\.app\/tools\/[a-z0-9-]+$/);
      expect(e.en.link).toMatch(/^https:\/\/www\.pdfplatform\.app\/en\/tools\/[a-z0-9-]+$/);
      expect(e.tr.title.length).toBeGreaterThan(5);
      expect(e.tr.summary.length).toBeGreaterThan(10);
      expect(e.en.summary.length).toBeGreaterThan(10);
      expect(e.keywords.tr.length).toBeGreaterThan(0);
      expect(e.keywords.en.length).toBeGreaterThan(0);
    }
  });

  it("özetlerde doğrulanmamış iddia (kalite kaybı olmaz vb.) yok", () => {
    for (const e of TOOL_REEL_CATALOG) {
      expect(`${e.tr.title} ${e.tr.summary}`, e.id).not.toMatch(RISKY);
      expect(`${e.en.title} ${e.en.summary}`, e.id).not.toMatch(RISKY);
    }
  });
});
