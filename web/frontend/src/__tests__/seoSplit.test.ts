import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as full from "../seo/seoContent.mjs";
import * as light from "../seo/seoLight.mjs";
import * as heavy from "../seo/seoToolData.mjs";
import { getToolSeo, isLandingPath, loadToolSeo, toolSeoReady, getRelatedToolLinks } from "../seo/toolSeoRuntime";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("SEO verisi hafif/ağır bölünmesi", () => {
  it("hafif dosya ağır içerikleri (araç metinleri, blog) içeri almaz — ana sayfa açılışı yavaşlamasın", () => {
    const src = read("seo/seoLight.mjs");
    const importSatirlari = src.split("\n").filter((satir) => /^\s*(import|export)\b/.test(satir));
    expect(importSatirlari.join("\n")).not.toMatch(/seoToolData|toolGuides|blogContent|cvProfessionData/);
    expect(src.length).toBeLessThan(60_000);
  });

  it("seoContent.mjs hâlâ eski tüm dışa aktarımları sağlar (Node betikleri ve testler için)", () => {
    for (const k of [
      "TOOL_SLUGS", "ARAC_SAYISI", "AI_COMING_SOON_SLUGS", "TOOL_SEO", "LANDING_SEO", "PRICING_SEO", "LEGAL_SEO",
      "API_SEO", "API_DOCS_SEO", "getToolSeo", "getRelatedToolLinks", "getGuideSlugsForTool", "toolShortLabel",
      "getToolGuide", "RELATED_TOOLS", "BLOG_RELATED_TOOLS", "SOFTWARE_FEATURE_LIST", "ABOUT_SEO", "markaEkle", "BRAND",
    ]) {
      expect(Object.keys(full), k).toContain(k);
    }
  });

  it("hafif ve ağır dosyalar birbirini örtmez (aynı ad iki yerde olmaz)", () => {
    const ortak = Object.keys(light).filter((k) => k in heavy);
    expect(ortak).toEqual([]);
  });

  it("her araç adresinin SEO kaydı var ve araç sayısı liste uzunluğuyla aynı", () => {
    expect(full.ARAC_SAYISI).toBe(full.TOOL_SLUGS.length);
    for (const slug of full.TOOL_SLUGS) expect(full.TOOL_SEO[slug], slug).toBeTruthy();
  });
});

describe("toolSeoRuntime (tarayıcıda gerektiğinde yükleme)", () => {
  it("ana sayfa adreslerini ayırt eder", () => {
    expect(isLandingPath("/")).toBe(true);
    expect(isLandingPath("/en")).toBe(true);
    expect(isLandingPath("/en/")).toBe(true);
    expect(isLandingPath("/tools/compress")).toBe(false);
    expect(isLandingPath("/workspace")).toBe(false);
  });

  it("yüklenmeden null döner, yüklenince seoContent ile aynı metni verir", async () => {
    expect(toolSeoReady()).toBe(false);
    expect(getToolSeo("compress", "tr")).toBeNull();
    expect(getRelatedToolLinks("compress", "tr")).toEqual([]);
    await loadToolSeo();
    expect(toolSeoReady()).toBe(true);
    expect(getToolSeo("compress", "tr")).toEqual(full.getToolSeo("compress", "tr"));
    expect(getToolSeo("compress", "en")).toEqual(full.getToolSeo("compress", "en"));
    expect(getToolSeo("olmayan-arac", "tr")).toBeNull();
    expect(getRelatedToolLinks("compress", "tr")).toEqual(full.getRelatedToolLinks("compress", "tr"));
  });

  it("ikinci çağrı aynı yüklemeyi paylaşır", async () => {
    await expect(loadToolSeo()).resolves.toBeUndefined();
  });
});
