import { describe, it, expect } from "vitest";
import {
  TOOL_SLUGS,
  TOOL_SEO,
  LANDING_SEO,
  PRICING_SEO,
  API_SEO,
  API_DOCS_SEO,
  LEGAL_SEO,
} from "../seo/seoContent.mjs";
import { BLOG_POSTS } from "../blog/blogContent.mjs";

/**
 * ARAMA SONUCUNDA KESİLEN BAŞLIK/AÇIKLAMA OLMASIN.
 *
 * Site geneli denetimde 218 sayfanın 145'inin başlığı, 67'sinin açıklaması
 * Google'ın gösterdiği uzunluğu aşıyordu; yazdığımız metin kullanıcıya hiç
 * ulaşmıyordu. Sınırlar ölçüme dayanır, tercih değildir:
 *   • başlık      ~60 karakterden sonra kesilir
 *   • açıklama    ~160 karakterden sonra kesilir; 70'in altı da bilgi vermez
 *
 * Yeni araç/yazı eklenirken bu sınırların sessizce aşılmasını engeller.
 */
const BASLIK_UST = 60;
const ACIKLAMA_ALT = 70;
const ACIKLAMA_UST = 160;

type Metin = { title: string; description: string };

const sayfalar: { ad: string; icerik: Metin }[] = [];
const ekle = (ad: string, o: { tr?: Metin; en?: Metin } | undefined) => {
  for (const dil of ["tr", "en"] as const) {
    const c = o?.[dil];
    if (c?.title && c?.description) sayfalar.push({ ad: `${ad} (${dil})`, icerik: c });
  }
};

for (const slug of TOOL_SLUGS) ekle(`araç:${slug}`, TOOL_SEO[slug]);
ekle("ana sayfa", LANDING_SEO);
ekle("fiyatlandırma", PRICING_SEO);
ekle("api", API_SEO);
ekle("api dokümanı", API_DOCS_SEO);
for (const k of Object.keys(LEGAL_SEO)) ekle(`yasal:${k}`, LEGAL_SEO[k as keyof typeof LEGAL_SEO]);
for (const p of BLOG_POSTS) ekle(`blog:${p.slug}`, p);

describe("SEO metin uzunlukları", () => {
  it("taranacak sayfa listesi boş değil", () => {
    expect(sayfalar.length).toBeGreaterThan(100);
  });

  it.each(sayfalar)("$ad — başlık $BASLIK_UST karakteri aşmıyor", ({ icerik }) => {
    expect(icerik.title.length).toBeLessThanOrEqual(BASLIK_UST);
  });

  it.each(sayfalar)("$ad — açıklama $ACIKLAMA_ALT–$ACIKLAMA_UST karakter", ({ icerik }) => {
    expect(icerik.description.length).toBeGreaterThanOrEqual(ACIKLAMA_ALT);
    expect(icerik.description.length).toBeLessThanOrEqual(ACIKLAMA_UST);
  });

  it("aynı başlığı iki sayfa paylaşmıyor (yamyamlık)", () => {
    const sayac = new Map<string, string[]>();
    for (const s of sayfalar) {
      const liste = sayac.get(s.icerik.title) ?? [];
      liste.push(s.ad);
      sayac.set(s.icerik.title, liste);
    }
    const tekrar = [...sayac.entries()].filter(([, v]) => v.length > 1);
    expect(tekrar).toEqual([]);
  });
});
