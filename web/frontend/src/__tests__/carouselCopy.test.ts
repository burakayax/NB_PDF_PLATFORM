import { describe, expect, it } from "vitest";
import { CURATED_CAROUSELS, curatedCarousel } from "../blog/carouselCopy.mjs";
import { getBlogPostsSorted } from "../blog/blogContent.mjs";

describe("elle yazılmış slayt metinleri", () => {
  const posts = getBlogPostsSorted();

  it("her blog yazısının elle yazılmış slaytı var, fazladan kayıt yok", () => {
    const slugs = new Set(posts.map((p: { slug: string }) => p.slug));
    const missing = posts.filter((p: { slug: string }) => !CURATED_CAROUSELS[p.slug]).map((p: { slug: string }) => p.slug);
    expect(missing).toEqual([]);
    expect(Object.keys(CURATED_CAROUSELS).filter((s) => !slugs.has(s))).toEqual([]);
  });

  it("kapak kısa, slayt sayısı 4–6, başlık ve metin sığacak uzunlukta", () => {
    for (const [slug, c] of Object.entries(CURATED_CAROUSELS)) {
      expect(c.hook.split(/\s+/).length, `${slug} kapak`).toBeLessThanOrEqual(14);
      expect(c.slides.length, `${slug} slayt sayısı`).toBeGreaterThanOrEqual(4);
      expect(c.slides.length, `${slug} slayt sayısı`).toBeLessThanOrEqual(6);
      for (const [title, text] of c.slides) {
        expect(title.split(/\s+/).length, `${slug} başlık: ${title}`).toBeLessThanOrEqual(9);
        expect(text.length, `${slug} metin: ${title}`).toBeLessThanOrEqual(200);
        expect(text.length, `${slug} metin: ${title}`).toBeGreaterThan(20);
      }
    }
  });

  it("kullanıcıya yabancı jargon ve robotik kalıp içermez", () => {
    const banned = /röntgen|sekme(si)? tarih|çözülür|\bsonuç olarak\b|\bsonuç itibarıyla\b/i;
    for (const [slug, c] of Object.entries(CURATED_CAROUSELS)) {
      const all = [c.hook, ...c.slides.flat()].join(" \n ");
      expect(banned.test(all), slug).toBe(false);
    }
  });

  it("curatedCarousel yoksa null döner", () => {
    expect(curatedCarousel("olmayan-yazi")).toBeNull();
    expect(curatedCarousel("udf-dosyasi-nasil-acilir")?.slides.length).toBeGreaterThanOrEqual(4);
  });
});
