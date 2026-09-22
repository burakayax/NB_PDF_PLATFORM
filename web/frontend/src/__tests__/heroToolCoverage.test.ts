import { describe, it, expect } from "vitest";
import { HERO_CATS } from "../components/landing/heroToolCatalog";
import { TOOLS } from "../components/ui/pdf-tools-section";

/**
 * ANA SAYFADAKİ HIZLI ARAÇ ALANI, ÜCRETSİZ ARAÇLARIN HEPSİNİ GÖSTERMELİ.
 *
 * Sayfanın altındaki tam araç listesinde "Üyeliksiz" rozeti taşıyan bir araç
 * yukarıdaki hızlı alanda yoksa, ziyaretçi aşağıda gördüğü ücretsiz aracı
 * yukarıda bulamaz; rozete güveni kırılır. (Sayfa Düzeni ve UDF → PDF tam olarak
 * bu şekilde gözden kaçmıştı.)
 *
 * Yeni bir üyeliksiz araç eklenip hero kategorilerine yazılmazsa bu test düşer.
 */

/** Hero ızgarasındaki tüm araçların kimlikleri (kategori farkı gözetmeden). */
const heroSlugs = new Set<string>(
  HERO_CATS.flatMap((c) =>
    c.items.map((it) =>
      it.k === "free" ? it.id : it.k === "editor" ? "pdf-duzenle" : it.slug,
    ),
  ),
);

describe("hero araç kapsamı", () => {
  it("üyeliksiz kullanılan her araç hızlı alanda da var", () => {
    const eksik = TOOLS.filter((t) => t.free).map((t) => t.id).filter((id) => !heroSlugs.has(id));
    expect(eksik).toEqual([]);
  });

  it("hızlı alandaki her araç tam listede de tanımlı", () => {
    const bilinen = new Set(TOOLS.map((t) => t.id));
    const tanimsiz = [...heroSlugs].filter((id) => !bilinen.has(id));
    expect(tanimsiz).toEqual([]);
  });

  it("hiçbir araç iki kategoride birden durmuyor", () => {
    const hepsi = HERO_CATS.flatMap((c) =>
      c.items.map((it) =>
        it.k === "free" ? it.id : it.k === "editor" ? "pdf-duzenle" : it.slug,
      ),
    );
    expect(hepsi.length).toBe(heroSlugs.size);
  });

  it("her kategoride hero içinde çalışan en az bir araç var", () => {
    // Sekme değişince alttaki dosya bırakma alanı bir araca bağlanmalı; yoksa
    // kullanıcı boş bir alanla karşılaşır.
    const bos = HERO_CATS.filter(
      (c) => !c.items.some((it) => it.k === "free" || it.k === "editor"),
    ).map((c) => c.id);
    expect(bos).toEqual([]);
  });

  it("hiçbir kategori tek satırı taşırmıyor", () => {
    // Izgara geniş ekranda 6 sütun; kategoriler bunu aşarsa alan yine şişer.
    const tasan = HERO_CATS.filter((c) => c.items.length > 6).map((c) => c.id);
    expect(tasan).toEqual([]);
  });
});
