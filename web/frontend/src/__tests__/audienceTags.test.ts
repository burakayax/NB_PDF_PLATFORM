import { describe, expect, it } from "vitest";
import { AUDIENCE_TAGS, audiencePath } from "../content/audienceTags.mjs";
import { BLOG_POSTS } from "../blog/blogContent.mjs";
import { TOOL_SEO, TOOL_SLUGS } from "../seo/seoContent.mjs";

describe("hedef kitle şeridi", () => {
  it("TR ve EN listeleri aynı sırada aynı sayfalara bağlanır", () => {
    expect(AUDIENCE_TAGS.en.map(audiencePath)).toEqual(AUDIENCE_TAGS.tr.map(audiencePath));
  });

  it("her etiket tek bir sayfaya gider ve iki etiket aynı sayfayı paylaşmaz", () => {
    for (const tag of AUDIENCE_TAGS.tr) expect(Boolean(tag.blog) !== Boolean(tag.tool), tag.label).toBe(true);
    const paths = AUDIENCE_TAGS.tr.map(audiencePath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  // Olmayan bir adres canlıda 200 dönüp ana sayfanın kopyasını gösterir; bu yüzden hedef burada doğrulanır.
  it("bağlanan her yazı ve araç sayfası gerçekten var, iki dilde de içeriği dolu", () => {
    const posts = BLOG_POSTS as Array<{ slug: string; tr?: unknown; en?: unknown }>;
    const toolSeo = TOOL_SEO as Record<string, { tr?: unknown; en?: unknown }>;
    for (const { blog, tool } of AUDIENCE_TAGS.tr) {
      const entry = blog ? posts.find((p) => p.slug === blog) : toolSeo[tool as string];
      if (tool) expect(TOOL_SLUGS, tool).toContain(tool);
      expect(entry?.tr, blog ?? tool).toBeTruthy();
      expect(entry?.en, blog ?? tool).toBeTruthy();
    }
  });
});
