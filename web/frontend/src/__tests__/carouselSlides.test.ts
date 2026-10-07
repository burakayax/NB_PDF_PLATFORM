import { describe, expect, it } from "vitest";
import { CAROUSEL_COPY, MAX_CONTENT_SLIDES, extractContentSlides, firstSentence } from "../blog/carouselSlides.mjs";
import { getBlogPostsSorted } from "../blog/blogContent.mjs";

describe("carousel slaytları — içerik yazının kendisinden gelir", () => {
  it("adım listesini slayt yapar, her adımın ilk cümlesiyle", () => {
    const slides = extractContentSlides([
      { t: "lead", x: "Giriş." },
      {
        t: "steps",
        items: [
          { title: "Dosyayı bırakın", x: "Alana sürükleyin. İkinci cümle atılır." },
          { title: "«PDF'e çevir» deyin", x: "Belge çözülür." },
        ],
      },
    ]);
    expect(slides).toEqual([
      { title: "Dosyayı bırakın", text: "Alana sürükleyin." },
      { title: "«PDF'e çevir» deyin", text: "Belge çözülür." },
    ]);
  });

  it("adım yoksa başlık + hemen altındaki paragrafın ilk cümlesini kullanır; SSS atlanır", () => {
    const slides = extractContentSlides([
      { t: "h2", x: "Neden önemli?" },
      { t: "p", x: "Çünkü zaman kazandırır. Detaylar sonra." },
      { t: "h2", x: "Nasıl çalışır:" },
      { t: "p", x: "Dosya tarayıcıda işlenir." },
      { t: "h2", x: "Sık sorulan sorular" },
      { t: "p", x: "Bu slayt olmamalı." },
    ]);
    expect(slides.map((s) => s.title)).toEqual(["Neden önemli?", "Nasıl çalışır"]);
    expect(slides[0]!.text).toBe("Çünkü zaman kazandırır.");
  });

  it("2'den az içerik çıkıyorsa carousel yok (tek görsele düşülür)", () => {
    expect(extractContentSlides([{ t: "h2", x: "Tek" }, { t: "p", x: "Bir." }])).toEqual([]);
    expect(extractContentSlides([])).toEqual([]);
    expect(extractContentSlides(undefined as never)).toEqual([]);
  });

  it("üst sınırı aşmaz", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ title: `Adım ${i}`, x: `Metin ${i}.` }));
    expect(extractContentSlides([{ t: "steps", items }]).length).toBe(MAX_CONTENT_SLIDES);
  });

  it("uzun cümle yarım ifadeyle değil anlam sınırında kısalır", () => {
    const long =
      "Pratikte çoğu kişinin PDF ile işi çok daha sade: birkaç dosyayı birleştirmek, sayfa silmek, yan sayfayı düzeltmek, belgeyi küçültmek, bir forma imza atmak ve sonuçları paylaşmak gibi küçük işler.";
    const out = firstSentence(long, 150);
    expect(out.length).toBeLessThanOrEqual(150);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
    // Yarım kalmış "bir forma imza…" değil, virgül/iki nokta sınırında bitmeli.
    expect(out).not.toMatch(/imza…$/);
  });

  it("gerçek yazıların neredeyse tamamı (≥%95) carousel üretir ve metin yazıdan gelir", () => {
    const posts = getBlogPostsSorted();
    let ok = 0;
    for (const p of posts) {
      const slides = extractContentSlides(p.tr.blocks);
      if (slides.length >= 2) ok++;
      // Bloklardaki tüm düz metin (JSON kaçışları olmadan).
      const body = p.tr.blocks
        .flatMap((blk: { x?: string; items?: unknown[] }) => [
          blk.x ?? "",
          ...(blk.items ?? []).map((it) => (typeof it === "string" ? it : `${(it as { title?: string }).title ?? ""} ${(it as { x?: string }).x ?? ""}`)),
        ])
        .join(" ");
      for (const s of slides) {
        // Kısaltılmış (…) metinde sonuna kadar bakma; ilk 25 karakter yazıda geçmeli.
        const probe = s.text.replace(/…$/, "").slice(0, 25);
        expect(body.replace(/\*\*/g, "").replace(/\s+/g, " ")).toContain(probe);
      }
    }
    expect(ok / posts.length).toBeGreaterThanOrEqual(0.95);
  });

  it("sabit ifadeler iki dilde de var", () => {
    for (const lang of ["tr", "en"] as const) {
      expect(CAROUSEL_COPY[lang].ctaTitle.length).toBeGreaterThan(5);
      expect(CAROUSEL_COPY[lang].stepLabel(2, 4)).toMatch(/2\/4/);
    }
  });
});
