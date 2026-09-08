import { describe, expect, it } from "vitest";

import {
  EN_BLOG_SLUGS,
  EN_TOOL_SLUGS,
  blogSlugToTr,
  canonicalBarePath,
  localizedPath,
  toolSlugToTr,
} from "../seo/enSlugs.mjs";
import { BLOG_POSTS } from "../blog/blogContent.mjs";
import { TOOL_SLUGS } from "../seo/seoContent.mjs";

// /en altındaki sayfalar İngilizce içerik sunuyor; URL segmenti de İngilizce
// olmalı. Bu testler eşlemenin eksiksiz, benzersiz ve çift yönlü çözülebilir
// kalmasını garanti eder — yeni bir yazı/araç eklendiğinde burada patlar.
describe("EN slug eşlemesi", () => {
  it("her blog yazısının bir İngilizce slug'ı var", () => {
    const eksik = BLOG_POSTS.filter((p) => !EN_BLOG_SLUGS[p.slug]).map((p) => p.slug);
    expect(eksik).toEqual([]);
  });

  it("eşlemede var olmayan bir slug bulunmuyor", () => {
    const blogSlugs = new Set(BLOG_POSTS.map((p) => p.slug));
    expect(Object.keys(EN_BLOG_SLUGS).filter((s) => !blogSlugs.has(s))).toEqual([]);
    const toolSlugs = new Set(TOOL_SLUGS);
    expect(Object.keys(EN_TOOL_SLUGS).filter((s) => !toolSlugs.has(s))).toEqual([]);
  });

  it("İngilizce slug'lar benzersiz ve geçerli biçimde", () => {
    for (const map of [EN_BLOG_SLUGS, EN_TOOL_SLUGS]) {
      const values = Object.values(map);
      expect(new Set(values).size).toBe(values.length);
      for (const v of values) expect(v).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("İngilizce slug bir Türkçe slug ile çakışmıyor", () => {
    const blogSlugs = new Set(BLOG_POSTS.map((p) => p.slug));
    for (const v of Object.values(EN_BLOG_SLUGS)) expect(blogSlugs.has(v)).toBe(false);
    const toolSlugs = new Set(TOOL_SLUGS);
    for (const v of Object.values(EN_TOOL_SLUGS)) expect(toolSlugs.has(v)).toBe(false);
  });
});

describe("localizedPath", () => {
  it("TR yolları değiştirmez", () => {
    expect(localizedPath("/", "tr")).toBe("/");
    expect(localizedPath("/blog/pdf-word-donusturme", "tr")).toBe("/blog/pdf-word-donusturme");
    expect(localizedPath("/tools/pdf-duzenle", "tr")).toBe("/tools/pdf-duzenle");
  });

  it("EN'de hem önek hem slug çevrilir", () => {
    expect(localizedPath("/", "en")).toBe("/en");
    expect(localizedPath("/pricing", "en")).toBe("/en/pricing");
    expect(localizedPath("/blog/pdf-word-donusturme", "en")).toBe("/en/blog/convert-pdf-to-word");
    expect(localizedPath("/tools/pdf-duzenle", "en")).toBe("/en/tools/edit-pdf");
  });

  it("zaten İngilizce olan slug'a dokunmaz", () => {
    expect(localizedPath("/tools/merge-pdf", "en")).toBe("/en/tools/merge-pdf");
  });
});

describe("canonicalBarePath", () => {
  it("dil öneki ve İngilizce slug'ı kanonik TR yola indirger", () => {
    expect(canonicalBarePath("/en")).toBe("/");
    expect(canonicalBarePath("/en/")).toBe("/");
    expect(canonicalBarePath("/en/blog/convert-pdf-to-word")).toBe("/blog/pdf-word-donusturme");
    expect(canonicalBarePath("/en/tools/edit-pdf")).toBe("/tools/pdf-duzenle");
  });

  it("eski Türkçe /en adreslerini de çözer (kırık link olmasın)", () => {
    expect(canonicalBarePath("/en/blog/pdf-word-donusturme")).toBe("/blog/pdf-word-donusturme");
    expect(canonicalBarePath("/en/tools/pdf-duzenle")).toBe("/tools/pdf-duzenle");
  });

  it("her yol için gidiş-dönüş tutarlı", () => {
    for (const p of BLOG_POSTS) {
      expect(canonicalBarePath(localizedPath(`/blog/${p.slug}`, "en"))).toBe(`/blog/${p.slug}`);
    }
    for (const t of TOOL_SLUGS) {
      expect(canonicalBarePath(localizedPath(`/tools/${t}`, "en"))).toBe(`/tools/${t}`);
    }
  });
});

describe("ters eşleme", () => {
  it("bilinmeyen slug'ı olduğu gibi bırakır", () => {
    expect(blogSlugToTr("bilinmeyen")).toBe("bilinmeyen");
    expect(toolSlugToTr("merge-pdf")).toBe("merge-pdf");
  });
});

describe("router entegrasyonu", () => {
  it("İngilizce araç yolu doğru aracı çözer", async () => {
    const { parseWorkspaceToolPath } = await import("../lib/toolRoutes");
    expect(parseWorkspaceToolPath("/en/tools/merge-pdf")).toBe("merge");
    expect(parseWorkspaceToolPath("/tools/compress")).toBe("compress");
    // Türkçe slug'lı araçlar workspace kaydında değil (ayrı SEO sayfaları) —
    // onları App.tsx `pathname` dalı çözer; burada null dönmesi beklenen davranış.
    expect(parseWorkspaceToolPath("/en/tools/edit-pdf")).toBeNull();
  });

  it("İngilizce SEO araç yolu Türkçe slug'a indirgenir (App.tsx bu dalı kullanır)", () => {
    expect(canonicalBarePath("/en/tools/edit-pdf")).toBe("/tools/pdf-duzenle");
    expect(canonicalBarePath("/en/tools/scan-document")).toBe("/tools/belge-tara");
    expect(canonicalBarePath("/en/tools/summarize-pdf")).toBe("/tools/pdf-ozetle");
  });

  it("dil değiştirici URL'i karşı dilin slug'ına taşır", async () => {
    const { withLangPrefix, stripLangPrefix } = await import("../hooks/usePreferredLanguage");
    expect(withLangPrefix("/en/blog/convert-pdf-to-word", "tr")).toBe("/blog/pdf-word-donusturme");
    expect(withLangPrefix("/blog/pdf-word-donusturme", "en")).toBe("/en/blog/convert-pdf-to-word");
    expect(withLangPrefix("/en/tools/edit-pdf", "tr")).toBe("/tools/pdf-duzenle");
    expect(stripLangPrefix("/en/blog/convert-pdf-to-word")).toBe("/blog/pdf-word-donusturme");
  });
});
