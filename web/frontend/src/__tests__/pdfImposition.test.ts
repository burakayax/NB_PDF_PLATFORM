import { describe, it, expect } from "vitest";
import { PDFDocument, rgb } from "pdf-lib";
import { kitapcikSirasi, izgara, nUpYap, kitapcikYap } from "../lib/pdfImposition";

/**
 * SAYFA DÜZENİ.
 *
 * Kitapçık sıralamasındaki bir hata ancak kâğıt basılıp KATLANDIKTAN sonra fark
 * edilir; kullanıcı o çıktıyı çöpe atar. Bu yüzden sıra, kaynaklarda tarif
 * edilen saddle-stitch düzenine göre testlerle sabitlenmiştir.
 */

async function belge(sayfaSayisi: number, yatay = false): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < sayfaSayisi; i++) {
    const s = pdf.addPage(yatay ? [600, 400] : [400, 600]);
    // Gerçek belgelerdeki gibi içerik: boş sayfa gömülemiyor.
    s.drawRectangle({ x: 20, y: 20, width: 60, height: 40, color: rgb(0.2, 0.4, 0.8) });
  }
  return pdf.save();
}

describe("kitapçık sırası", () => {
  it("8 sayfalık kitapçığı doğru dizer", () => {
    // Kaynaklardaki örnek: ilk yaprağın ön yüzü 8-1, arka yüzü 2-7.
    expect(kitapcikSirasi(8)).toEqual([
      [8, 1],
      [2, 7],
      [6, 3],
      [4, 5],
    ]);
  });

  it("4 sayfalık kitapçık tek yaprak eder", () => {
    expect(kitapcikSirasi(4)).toEqual([
      [4, 1],
      [2, 3],
    ]);
  });

  it("4'ün katı olmayan sayfa sayısını boş sayfayla tamamlar", () => {
    // 6 sayfa → 8'e tamamlanır; olmayan 7 ve 8 boş (null) kalır.
    const sira = kitapcikSirasi(6);
    expect(sira).toHaveLength(4);
    expect(sira[0]).toEqual([null, 1]);
    expect(sira[1]).toEqual([2, null]);
    expect(sira.flat().filter((n) => n !== null).sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("her sayfa tam bir kez kullanılır", () => {
    for (const n of [4, 8, 12, 16, 20]) {
      const kullanilan = kitapcikSirasi(n).flat().filter(Boolean) as number[];
      expect(new Set(kullanilan).size).toBe(n);
      expect(kullanilan).toHaveLength(n);
    }
  });

  it("orta yaprakta ardışık sayfalar yan yana gelir", () => {
    // 8 sayfalık kitapçıkta ortadaki yüz 4-5 olmalı; katlandığında kitabın ortası.
    const sira = kitapcikSirasi(8);
    expect(sira[sira.length - 1]).toEqual([4, 5]);
  });

  it("boş belgede sıra üretmez", () => {
    expect(kitapcikSirasi(0)).toEqual([]);
  });
});

describe("ızgara seçimi", () => {
  it("dikey kâğıtta satır sayısı fazladır", () => {
    expect(izgara(4, false)).toEqual({ sutun: 2, satir: 2 });
    expect(izgara(8, false)).toEqual({ sutun: 2, satir: 4 });
  });

  it("yatay kâğıtta sütun sayısı fazladır", () => {
    expect(izgara(8, true)).toEqual({ sutun: 4, satir: 2 });
    expect(izgara(2, true)).toEqual({ sutun: 2, satir: 1 });
  });
});

describe("N-up çıktısı", () => {
  it("4'lü düzende 8 sayfa 2 yaprağa iner", async () => {
    const cikti = await nUpYap(await belge(8), { adet: 4 });
    const pdf = await PDFDocument.load(cikti);
    expect(pdf.getPageCount()).toBe(2);
  });

  it("artan sayfalar için fazladan yaprak açar", async () => {
    // 9 sayfa, 4'lü düzen → 3 yaprak (son yaprakta tek sayfa).
    const pdf = await PDFDocument.load(await nUpYap(await belge(9), { adet: 4 }));
    expect(pdf.getPageCount()).toBe(3);
  });

  it("2'li düzende dikey belge için yaprağı yatay çevirir", async () => {
    const pdf = await PDFDocument.load(await nUpYap(await belge(4), { adet: 2 }));
    const s = pdf.getPage(0);
    expect(s.getWidth()).toBeGreaterThan(s.getHeight());
  });

  it("geçersiz adet 4'e düşürülür (çökme yerine makul varsayılan)", async () => {
    const pdf = await PDFDocument.load(await nUpYap(await belge(8), { adet: 5 }));
    expect(pdf.getPageCount()).toBe(2);
  });

  it("yerleştirilebilir sayfa yoksa anlaşılır hata verir", async () => {
    const bos = await PDFDocument.create();
    await expect(nUpYap(await bos.save(), { adet: 4 })).rejects.toThrow(/sayfa yok/i);
  });

  it("içeriği olmayan tek sayfa tüm işi bozmaz", async () => {
    // Gerçek belgelerde tamamen boş sayfa olabilir (ör. bölüm arası). Kütüphane
    // hepsini birden gömerken böyle bir sayfada tüm işlemi durduruyordu.
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 3; i++) {
      const s = pdf.addPage([400, 600]);
      s.drawRectangle({ x: 10, y: 10, width: 30, height: 30, color: rgb(0, 0, 0) });
    }
    pdf.addPage([400, 600]); // içeriksiz sayfa
    const cikti = await PDFDocument.load(await nUpYap(await pdf.save(), { adet: 4 }));
    expect(cikti.getPageCount()).toBe(1);
  });
});

describe("kitapçık çıktısı", () => {
  it("8 sayfa 4 yaprak yüzü üretir", async () => {
    const pdf = await PDFDocument.load(await kitapcikYap(await belge(8)));
    expect(pdf.getPageCount()).toBe(4);
  });

  it("yapraklar iki sayfa genişliğindedir", async () => {
    const pdf = await PDFDocument.load(await kitapcikYap(await belge(4)));
    const s = pdf.getPage(0);
    expect(Math.round(s.getWidth())).toBe(800); // 400 × 2
    expect(Math.round(s.getHeight())).toBe(600);
  });

  it("6 sayfa da 4'ün katına tamamlanır (2 yaprak = 4 yüz)", async () => {
    const pdf = await PDFDocument.load(await kitapcikYap(await belge(6)));
    expect(pdf.getPageCount()).toBe(4);
  });
});
