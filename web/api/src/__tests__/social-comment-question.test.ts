import { describe, it, expect } from "vitest";
import { ensureQuestion, ensureSaveLine, writePostBodies } from "../modules/social/copy.service.js";
import { ALL_PLATFORMS } from "../modules/social/social.types.js";

const side = { lang: "tr" as const, title: "t", summary: "s", link: "https://www.pdfplatform.app/blog/x", terms: [], tags: [] };

describe("yorum sorusu", () => {
  it("soruyla bitmeyen metne soru ekler", () => {
    const out = ensureQuestion("PDF'i küçültmek kolay.", side, 400);
    expect(out.trim().split("\n").pop()).toMatch(/\?/);
  });
  it("zaten soruyla biten metne dokunmaz", () => {
    expect(ensureQuestion("Sen hangisini yazıyorsun? 👇", side, 400)).toBe("Sen hangisini yazıyorsun? 👇");
  });
  it("sınırı aşmaz", () => {
    const out = ensureQuestion("kelime ".repeat(200), side, 200);
    expect(out.length).toBeLessThanOrEqual(200);
  });
  it("LinkedIn için profesyonel (siz) soru seçer", () => {
    expect(ensureQuestion("Bir tespit.", side, 400, "professional")).toMatch(/[Ss]iz|[Ii]şe alım/);
  });
});

describe("Instagram kaydetme çağrısı", () => {
  it("kaydetme çağrısı olmayan metne ekler", () => {
    const out = ensureSaveLine("CV'de 3 hata\n1. Uzun giriş", 400);
    expect(out.split("\n").pop()).toContain("Kaydet");
  });
  it("zaten kaydet ile biten metne dokunmaz", () => {
    const text = "CV'de 3 hata\nKaydet, lazım olacak 📌";
    expect(ensureSaveLine(text, 400)).toBe(text);
  });
  it("sınırı aşmaz", () => {
    expect(ensureSaveLine("kelime ".repeat(200), 200).length).toBeLessThanOrEqual(200);
  });
  it("şablon Instagram metni yorum sorusu değil kaydetme çağrısıyla biter, uygulamayı bir cümleyle anar", async () => {
    const bodies = await writePostBodies({
      item: { guid: "g", title: "Başlık", summary: "Özet", link: "https://www.pdfplatform.app/blog/a", lang: "tr" } as never,
      platforms: ["INSTAGRAM"],
      keywords: { tr: [], en: [], tagsTr: [], tagsEn: [] } as never,
      bilingual: false,
      singleLang: "tr",
      templateOnly: true,
    });
    expect(bodies.INSTAGRAM).toContain("Kaydet, lazım olacak");
    expect(bodies.INSTAGRAM.match(/PDF Platform/g)?.length).toBe(1);
  });
});

describe("tüm ağlarda Türkçe tek dil", () => {
  it("şablon metinde ayraç (— — —) yok", async () => {
    const bodies = await writePostBodies({
      item: { guid: "g", title: "Başlık", summary: "Özet", link: "https://www.pdfplatform.app/blog/a", lang: "tr", alt: { title: "Title", summary: "Sum", link: "https://www.pdfplatform.app/en/blog/a" } } as never,
      platforms: [...ALL_PLATFORMS],
      keywords: { tr: [], en: [], tagsTr: [], tagsEn: [] } as never,
      bilingual: true,
      singleLang: "en",
      templateOnly: true,
    });
    for (const p of ALL_PLATFORMS) {
      expect(bodies[p]).not.toContain("— — —");
      expect(bodies[p]).not.toContain("Title");
    }
  });
});

import { canonicalLink } from "../modules/social/social.service.js";

describe("kopya kontrolü adresi", () => {
  it("kampanya etiketi, www ve sondaki eğik çizgiyi yok sayar", () => {
    expect(canonicalLink("https://www.pdfplatform.app/blog/a/?utm_source=pinterest")).toBe(
      canonicalLink("https://pdfplatform.app/blog/a"),
    );
  });
});
