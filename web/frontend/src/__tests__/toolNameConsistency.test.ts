import { describe, expect, it } from "vitest";
import { TOOLS } from "../lib/toolCatalog";
import { SIDEBAR_TOOL_ORDER, sidebarToolLabel, featureCopy } from "../i18n/workspace";
import { TOOL_CATEGORIES } from "../components/tools/pdfToolCatalog";
import { HERO_CATS } from "../components/landing/heroToolCatalog";
import type { FeatureKey } from "../api/subscription";

/**
 * Aynı araç ana sayfadaki tam listede, hızlı alanda, çalışma alanı kenar çubuğunda,
 * araç seçicide ve araç sayfası başlığında AYNI adla görünmelidir. Ad değiştirirken
 * tek kaynak `lib/toolCatalog.ts`'tir; diğer yüzeyler buna uymak zorundadır.
 */
/** Büyük harf farkını (i/İ/ı) yok sayarak karşılaştırmak için. */
const up = (s: string) => s.toLocaleUpperCase("en").replace(/İ/g, "I").replace(/ı/g, "I");
const byId = new Map(TOOLS.map((t) => [t.id, t] as const));

describe("araç adı tutarlılığı", () => {
  it("kenar çubuğu adları katalogla aynı", () => {
    const bad: string[] = [];
    for (const id of SIDEBAR_TOOL_ORDER) {
      const t = byId.get(id);
      if (!t) continue;
      for (const lang of ["tr", "en"] as const) {
        const got = sidebarToolLabel(id as FeatureKey, lang);
        if (got !== t[lang].name) bad.push(`${id} [${lang}]: "${got}" ≠ "${t[lang].name}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("araç sayfası başlığı katalog adının büyük harfli hâli (EN/TR)", () => {
    const bad: string[] = [];
    for (const id of SIDEBAR_TOOL_ORDER) {
      const t = byId.get(id);
      if (!t) continue;
      const tr = featureCopy(id as FeatureKey, "tr").title;
      const en = featureCopy(id as FeatureKey, "en").title;
      if (up(tr) !== up(t.tr.name)) bad.push(`${id} [tr]: "${tr}" ≠ "${t.tr.name}"`);
      if (up(en) !== up(t.en.name)) bad.push(`${id} [en]: "${en}" ≠ "${t.en.name}"`);
    }
    expect(bad).toEqual([]);
  });

  it("araç seçici (PdfHub) adları katalogla aynı", () => {
    const bad: string[] = [];
    for (const cat of TOOL_CATEGORIES) {
      for (const tool of cat.tools) {
        const t = byId.get(tool.id);
        if (!t) continue;
        if (tool.tr !== t.tr.name) bad.push(`${tool.id} [tr]: "${tool.tr}" ≠ "${t.tr.name}"`);
        if (tool.en !== t.en.name) bad.push(`${tool.id} [en]: "${tool.en}" ≠ "${t.en.name}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("hızlı alan (hero) sayfa/üye kutu adları katalogla aynı", () => {
    const bad: string[] = [];
    for (const c of HERO_CATS) {
      for (const it of c.items) {
        if (it.k !== "page" && it.k !== "member") continue;
        const t = byId.get(it.slug);
        if (!t) continue;
        if (it.tr !== t.tr.name) bad.push(`${it.slug} [tr]: "${it.tr}" ≠ "${t.tr.name}"`);
        if (it.en !== t.en.name) bad.push(`${it.slug} [en]: "${it.en}" ≠ "${t.en.name}"`);
      }
    }
    expect(bad).toEqual([]);
  });
});
