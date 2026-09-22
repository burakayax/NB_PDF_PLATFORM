import { describe, it, expect } from "vitest";
import { BLOG_POSTS } from "../blog/blogContent.mjs";
import { TOOL_SLUGS, RELATED_TOOLS, BLOG_RELATED_TOOLS } from "../seo/seoContent.mjs";

/**
 * BLOG İÇİNDEKİ ARAÇ BAĞLANTILARI GERÇEKTEN AÇILMALI.
 *
 * Yazılardaki her CTA bir araç sayfasına gider. Slug yanlış yazıldığında ya da
 * bir araç yeniden adlandırıldığında bağlantı sessizce kırılır: kullanıcı boş
 * sayfaya düşer, Google da kırık iç bağlantı görür. Elle fark edilmesi zor bir
 * hata olduğu için burada kilitleniyor.
 *
 * Geçerli hedef: "/" ya da TOOL_SLUGS içinde yer alan bir "/tools/<slug>".
 */
const gecerli = new Set<string>(["/", ...TOOL_SLUGS.map((s) => `/tools/${s}`)]);

/** Yazıdaki tüm araç bağlantıları: yazı üstü `tool` + gövdedeki cta blokları. */
function baglantilar(): { nerede: string; yol: string }[] {
  const out: { nerede: string; yol: string }[] = [];
  for (const p of BLOG_POSTS) {
    out.push({ nerede: `${p.slug} (yazı başlığı)`, yol: p.tool });
    for (const dil of ["tr", "en"] as const) {
      p[dil].blocks.forEach((b, i) => {
        if (b.t === "cta") out.push({ nerede: `${p.slug} (${dil}, blok ${i})`, yol: b.tool });
      });
    }
  }
  return out;
}

describe("blog araç bağlantıları", () => {
  const hepsi = baglantilar();

  it("taranacak bağlantı bulundu", () => {
    expect(hepsi.length).toBeGreaterThan(50);
  });

  it("her bağlantı var olan bir araç sayfasına gidiyor", () => {
    const kirik = hepsi.filter((b) => !gecerli.has(b.yol));
    expect(kirik).toEqual([]);
  });

  it("her yazının bir araç bağlantısı var", () => {
    expect(BLOG_POSTS.filter((p) => !p.tool)).toEqual([]);
  });
});

describe("ilgili araç haritaları", () => {
  it("RELATED_TOOLS yalnızca var olan araçlara işaret ediyor", () => {
    const kirik: string[] = [];
    for (const [slug, liste] of Object.entries(RELATED_TOOLS)) {
      if (!TOOL_SLUGS.includes(slug)) kirik.push(`anahtar: ${slug}`);
      for (const t of liste) if (!TOOL_SLUGS.includes(t)) kirik.push(`${slug} → ${t}`);
    }
    expect(kirik).toEqual([]);
  });

  it("BLOG_RELATED_TOOLS var olan yazı ve araçlara işaret ediyor", () => {
    const yazilar = new Set(BLOG_POSTS.map((p) => p.slug));
    const kirik: string[] = [];
    for (const [slug, liste] of Object.entries(BLOG_RELATED_TOOLS)) {
      if (!yazilar.has(slug)) kirik.push(`yazı yok: ${slug}`);
      for (const t of liste) if (!TOOL_SLUGS.includes(t)) kirik.push(`${slug} → ${t}`);
    }
    expect(kirik).toEqual([]);
  });
});
