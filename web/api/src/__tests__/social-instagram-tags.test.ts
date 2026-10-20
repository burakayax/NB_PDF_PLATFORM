/**
 * Instagram içerik kuralları: etiket seçimi ve açıklama biçimi.
 * (@pdfplatformapp kuralları: 3–5 Türkçe konu etiketi, genel etiket yok, #PDFPlatform 3'te 1, art arda aynı set yok, yalnız Türkçe.)
 */

import { describe, expect, it } from "vitest";
import { BANNED_TAGS, instagramHashtags, parseTags, poolsFor } from "../modules/social/instagram-tags.js";
import { writePostBodies } from "../modules/social/copy.service.js";
import type { FeedItem } from "../modules/social/social.types.js";

const SLUGS = [
  "/blog/ogretmen-cv-ornegi",
  "/blog/pdf-boyutu-kucultme-sikistirma",
  "/blog/edevlet-belgelerini-tek-pdf-yapma",
  "/blog/uzun-belgeleri-ai-ile-ozetleme",
  "/blog/hemsire-cv-ornegi",
  "/blog/akademik-makale-ozetleme-literatur",
  "/blog/iki-pdf-birlestirme-ucretsiz",
  "/blog/vize-basvurusu-evrak-hazirlama",
  "/blog/depo-lojistik-cv-ornegi",
  "/blog/word-pdf-cevirme",
  "/blog/cv-nasil-hazirlanir",
  "/blog/telefonla-belge-tarama-pdf",
];

describe("Instagram hashtag kuralları", () => {
  it("her gönderide 3–5 etiket, hepsi # ile başlar ve genel etiket yoktur", () => {
    for (const key of SLUGS) {
      const tags = instagramHashtags({ key });
      expect(tags.length).toBeGreaterThanOrEqual(3);
      expect(tags.length).toBeLessThanOrEqual(5);
      for (const t of tags) {
        expect(t.startsWith("#")).toBe(true);
        expect(BANNED_TAGS.has(t.slice(1).toLocaleLowerCase("tr"))).toBe(false);
      }
      expect(new Set(tags).size).toBe(tags.length);
    }
  });

  it("seçim sabittir: aynı yazı aynı etiketleri alır", () => {
    expect(instagramHashtags({ key: SLUGS[0] as string })).toEqual(instagramHashtags({ key: SLUGS[0] as string }));
  });

  it("konuya göre havuz seçilir; meslek etiketi yalnız o meslekte çıkar", () => {
    expect(poolsFor("/blog/ogretmen-cv-ornegi").main).toBe("cv");
    expect(poolsFor("/blog/akademik-makale-ozetleme-literatur").main).toBe("ogrenci");
    expect(poolsFor("/blog/edevlet-belgelerini-tek-pdf-yapma").main).toBe("evrak");
    expect(poolsFor("/blog/pdf-boyutu-kucultme-sikistirma").main).toBe("pdf");
    expect(instagramHashtags({ key: "/blog/ogretmen-cv-ornegi" })).toContain("#öğretmen");
    expect(instagramHashtags({ key: "/blog/pdf-boyutu-kucultme-sikistirma" })).not.toContain("#öğretmen");
    expect(instagramHashtags({ key: "/blog/hemsire-cv-ornegi" })).toContain("#hemşire");
  });

  it("#PDFPlatform her gönderide değil; kabaca 3'te 1", () => {
    const keys = Array.from({ length: 60 }, (_, i) => `/blog/yazi-${i}-pdf`);
    const withBrand = keys.filter((k) => instagramHashtags({ key: k }).includes("#PDFPlatform")).length;
    expect(withBrand).toBeGreaterThan(10);
    expect(withBrand).toBeLessThan(35);
    // marka etiketi varken bile toplam 5'i aşmaz
    for (const k of keys) expect(instagramHashtags({ key: k }).length).toBeLessThanOrEqual(5);
  });

  it("bir önceki gönderinin etiketleri mümkün olduğunca tekrar edilmez (aynı set asla)", () => {
    for (const key of SLUGS) {
      const first = instagramHashtags({ key });
      const second = instagramHashtags({ key, avoid: first });
      expect(second).not.toEqual(first);
    }
  });

  it("parseTags etiketleri küçük harfle ve # olmadan döndürür", () => {
    expect(parseTags("metin\n\n#CVhazırlama #özgeçmiş")).toEqual(["cvhazırlama", "özgeçmiş"]);
  });
});

const ITEM: FeedItem = {
  guid: "https://www.pdfplatform.app/blog/ogretmen-cv-ornegi",
  lang: "tr",
  title: "Öğretmen CV Örneği: görev değil sonuç yazın",
  summary: "Öğretmen özgeçmişinde deneyim maddelerini sonuçla yazmanın yolları.",
  link: "https://www.pdfplatform.app/blog/ogretmen-cv-ornegi",
  publishedAt: Date.now(),
  categories: [],
  images: {},
  alt: {
    lang: "en",
    title: "Teacher CV Example",
    summary: "How to write achievements on a teacher CV.",
    link: "https://www.pdfplatform.app/en/blog/teacher-cv-example",
  },
};

describe("Instagram açıklaması", () => {
  it("yalnız Türkçe: iki dilli ayar açık olsa da İngilizce bölüm ve ayırıcı yoktur", async () => {
    const bodies = await writePostBodies({
      item: ITEM,
      platforms: ["INSTAGRAM", "FACEBOOK"],
      keywords: { tr: ["cv hazırlama"], en: ["cv maker"], tagsTr: ["cv hazırla"], tagsEn: ["cv maker"] },
      bilingual: true,
      singleLang: "tr",
      templateOnly: true,
    });
    const ig = bodies.INSTAGRAM;
    expect(ig.includes("— — —")).toBe(false);
    expect(ig.includes("Teacher CV")).toBe(false);
    // Facebook da yalnız Türkçe: ayırıcı yok, bağlantı metinde değil ilk yorumda.
    expect(bodies.FACEBOOK.includes("— — —")).toBe(false);
    expect(bodies.FACEBOOK.includes("Teacher CV")).toBe(false);
    expect(bodies.FACEBOOK).not.toMatch(/https?:\/\//);
    expect(bodies.FACEBOOK).toContain("Link ilk yorumda");
    expect(bodies.FACEBOOK).not.toMatch(/OfficeTips|Dijitalleşme|OfisİpuçlarI/);
  });

  it("etiketler en sonda; bağlantı profilde satırı etiketlerden önce; genel etiket yok", async () => {
    const bodies = await writePostBodies({
      item: ITEM,
      platforms: ["INSTAGRAM"],
      keywords: { tr: [], en: [], tagsTr: ["pdf"], tagsEn: [] },
      bilingual: false,
      singleLang: "tr",
      templateOnly: true,
    });
    const lines = bodies.INSTAGRAM.trim().split("\n").filter(Boolean);
    expect(lines[lines.length - 1]?.startsWith("#")).toBe(true);
    expect(bodies.INSTAGRAM.indexOf("Bağlantı profilde")).toBeLessThan(bodies.INSTAGRAM.indexOf("#"));
    const tags = parseTags(bodies.INSTAGRAM);
    expect(tags.length).toBeGreaterThanOrEqual(3);
    expect(tags.length).toBeLessThanOrEqual(5);
    for (const t of tags) expect(BANNED_TAGS.has(t)).toBe(false);
  });

  it("art arda gönderide etiket seti tekrar etmez (avoidTags)", async () => {
    const base = {
      item: ITEM,
      platforms: ["INSTAGRAM"] as const,
      keywords: { tr: [], en: [], tagsTr: [], tagsEn: [] },
      bilingual: false,
      singleLang: "tr" as const,
      templateOnly: true,
    };
    const a = (await writePostBodies({ ...base, platforms: ["INSTAGRAM"] })).INSTAGRAM;
    const b = (await writePostBodies({ ...base, platforms: ["INSTAGRAM"], avoidTags: parseTags(a) })).INSTAGRAM;
    expect(parseTags(b)).not.toEqual(parseTags(a));
  });
});
