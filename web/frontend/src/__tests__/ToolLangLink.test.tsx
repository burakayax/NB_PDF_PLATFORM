import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { toolLangHref } from "../components/common/ToolLangLink";
import { loadToolSeo } from "../seo/toolSeoRuntime";

const sitemap = readFileSync(join(__dirname, "../../public/sitemap.xml"), "utf8");
const paths = [...sitemap.matchAll(/<loc>https:\/\/www\.pdfplatform\.app([^<]*)<\/loc>/g)].map((m) => m[1]);
const trSlugs = paths.filter((p) => /^\/tools\/[^/]+$/.test(p)).map((p) => p.slice("/tools/".length));

describe("araç sayfası dil bağlantısı", () => {
  beforeAll(async () => {
    await loadToolSeo();
  });

  it("gösterildiği her araçta site haritasındaki bir adrese gider (iki yönde)", () => {
    expect(trSlugs.length).toBeGreaterThan(20);
    const bad: string[] = [];
    let shown = 0;
    for (const slug of trSlugs) {
      for (const lang of ["tr", "en"] as const) {
        const link = toolLangHref(slug, lang);
        if (!link) continue;
        shown += 1;
        if (!paths.includes(link.href)) bad.push(`${lang} ${slug} -> ${link.href}`);
      }
    }
    expect(bad).toEqual([]);
    expect(shown).toBeGreaterThan(40);
  });

  it("sayfası olmayan araçta bağlantı göstermez", () => {
    expect(toolLangHref("olmayan-arac", "tr")).toBeNull();
  });
});
