import { describe, expect, it } from "vitest";
import { AUDIENCE_TAGS } from "../content/audienceTags.mjs";
import { BLOG_POSTS } from "../blog/blogContent.mjs";

describe("hedef kitle şeridi", () => {
  it("TR ve EN listeleri aynı sırada aynı yazılara bağlanır", () => {
    expect(AUDIENCE_TAGS.en.map((t) => t.blog)).toEqual(AUDIENCE_TAGS.tr.map((t) => t.blog));
  });

  it("her etiket bir yazıya gider ve iki etiket aynı yazıyı paylaşmaz", () => {
    const blogs = AUDIENCE_TAGS.tr.map((t) => t.blog);
    expect(blogs.every(Boolean)).toBe(true);
    expect(new Set(blogs).size).toBe(blogs.length);
  });

  it("bağlanan her yazı gerçekten var ve iki dilde de içeriği dolu", () => {
    const posts = BLOG_POSTS as Array<{ slug: string; tr?: unknown; en?: unknown }>;
    for (const { blog } of AUDIENCE_TAGS.tr) {
      if (!blog) continue;
      const post = posts.find((p) => p.slug === blog);
      expect(post?.tr, blog).toBeTruthy();
      expect(post?.en, blog).toBeTruthy();
    }
  });
});
