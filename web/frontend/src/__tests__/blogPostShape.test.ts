import { describe, expect, it } from "vitest";
import { BLOG_POSTS } from "../blog/blogContent.mjs";

/**
 * Blog sayfası her yazının `faq` dizisini bekler. CV örneği rehberlerinde bu alan
 * yoktu ve /blog/depo-lojistik-cv-ornegi gibi 14 sayfa
 * "Cannot read properties of undefined (reading 'length')" ile çöküyordu.
 */
describe("blog yazısı şekli", () => {
  it("her yazının TR ve EN metninde blocks ve faq dizisi var", () => {
    const bad: string[] = [];
    for (const p of BLOG_POSTS) {
      for (const lang of ["tr", "en"] as const) {
        const c = p[lang];
        if (!c) continue;
        if (!Array.isArray(c.blocks)) bad.push(`${p.slug} [${lang}] blocks`);
        if (!Array.isArray(c.faq)) bad.push(`${p.slug} [${lang}] faq`);
      }
    }
    expect(bad).toEqual([]);
  });
});
