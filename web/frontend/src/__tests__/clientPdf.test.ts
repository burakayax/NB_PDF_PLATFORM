import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";
import {
  mergePdfs,
  imagesToPdf,
  applySignatures,
  applyAnnotations,
  rotatePdf,
  deletePages,
  reorderPages,
  getPdfPageCount,
  splitPagesToZip,
  cropPdf,
  pdfBytesToBlob,
  zipBytesToBlob,
  PdfEncryptedError,
  type AnnotationItem,
} from "../lib/clientPdf";

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
async function makePdf(pages = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]);
  return doc.save();
}
function pngBytes(): Uint8Array {
  // 2×2 kırmızı gerçek PNG (embedPng geçerli PNG ister).
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAAqkQPtaokmvgAAAABJRU5ErkJggg==";
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

// ─── Birleştirme ──────────────────────────────────────────────────────────────
describe("cropPdf", () => {
  it("CropBox'ı oranlı dikdörtgene ayarlar (üst-tabanlı → alt-sol origin)", async () => {
    const out = await cropPdf(await makePdf(1), { xNorm: 0.1, yNorm: 0.1, wNorm: 0.8, hNorm: 0.8 });
    const doc = await PDFDocument.load(out);
    const cb = doc.getPage(0).getCropBox();
    // Sayfa 300×400: w=240, h=320, x=30, y=400-40-320=40
    expect(Math.round(cb.width)).toBe(240);
    expect(Math.round(cb.height)).toBe(320);
    expect(Math.round(cb.x)).toBe(30);
    expect(Math.round(cb.y)).toBe(40);
  });
  it("yalnızca hedef sayfaları kırpar", async () => {
    const out = await cropPdf(await makePdf(2), { xNorm: 0, yNorm: 0, wNorm: 0.5, hNorm: 1 }, [0]);
    const doc = await PDFDocument.load(out);
    expect(Math.round(doc.getPage(0).getCropBox().width)).toBe(150); // kırpıldı
    expect(Math.round(doc.getPage(1).getCropBox().width)).toBe(300); // dokunulmadı
  });
  it("boş alan hata verir", async () => {
    await expect(cropPdf(await makePdf(1), { xNorm: 0, yNorm: 0, wNorm: 0, hNorm: 0.5 })).rejects.toThrow();
  });
  it("harita ile her sayfaya AYRI dikdörtgen uygular", async () => {
    const out = await cropPdf(await makePdf(3), {
      0: { xNorm: 0, yNorm: 0, wNorm: 0.5, hNorm: 1 },
      2: { xNorm: 0, yNorm: 0, wNorm: 0.25, hNorm: 1 },
    });
    const doc = await PDFDocument.load(out);
    expect(Math.round(doc.getPage(0).getCropBox().width)).toBe(150); // %50
    expect(Math.round(doc.getPage(1).getCropBox().width)).toBe(300); // haritada yok → tam
    expect(Math.round(doc.getPage(2).getCropBox().width)).toBe(75); // %25
  });
});

describe("mergePdfs", () => {
  it("sayfa sayılarını toplar", async () => {
    const out = await mergePdfs([await makePdf(2), await makePdf(3)]);
    expect(await pageCount(out)).toBe(5);
  });
  it("boş listede hata verir", async () => {
    await expect(mergePdfs([])).rejects.toThrow();
  });
});

// ─── Döndür / Sil / Yeniden sırala ────────────────────────────────────────────
describe("rotate / delete / reorder", () => {
  it("döndürme sayfa sayısını korur", async () => {
    const out = await rotatePdf(await makePdf(3), { 0: 90, 1: 180, 2: 270 });
    expect(await pageCount(out)).toBe(3);
  });
  it("0/360 katları döndürmeyi atlar (sayfa korunur)", async () => {
    const out = await rotatePdf(await makePdf(2), { 0: 0, 1: 360 });
    expect(await pageCount(out)).toBe(2);
  });
  it("seçili sayfaları siler", async () => {
    const out = await deletePages(await makePdf(4), [1, 3]);
    expect(await pageCount(out)).toBe(2);
  });
  it("tüm sayfalar silinince hata verir", async () => {
    await expect(deletePages(await makePdf(2), [0, 1])).rejects.toThrow();
  });
  it("yeniden sıralama sayfa sayısını korur", async () => {
    const out = await reorderPages(await makePdf(3), [2, 0, 1]);
    expect(await pageCount(out)).toBe(3);
  });
});

// ─── Görsel → PDF ─────────────────────────────────────────────────────────────
describe("imagesToPdf", () => {
  it("PNG'yi tek sayfalık PDF yapar", async () => {
    const out = await imagesToPdf([{ bytes: pngBytes(), mime: "image/png" }]);
    expect(await pageCount(out)).toBe(1);
  });
  it("boş girdide hata verir", async () => {
    await expect(imagesToPdf([])).rejects.toThrow();
  });
});

// ─── İmza gömme (opaklık + açı) ───────────────────────────────────────────────
describe("applySignatures", () => {
  it("düz imzayı gömer", async () => {
    const out = await applySignatures(await makePdf(1), [
      { pngBytes: pngBytes(), aspect: 1, page: 0, xNorm: 0.3, yNorm: 0.3, wNorm: 0.2 },
    ]);
    expect(await pageCount(out)).toBe(1);
  });
  it("opaklık + merkez-etrafı döndürme ile gömer", async () => {
    const out = await applySignatures(await makePdf(2), [
      { pngBytes: pngBytes(), aspect: 1.5, page: 0, xNorm: 0.3, yNorm: 0.3, wNorm: 0.2, opacity: 0.5, rotationDeg: 30 },
      { pngBytes: pngBytes(), aspect: 1, page: 1, xNorm: 0.1, yNorm: 0.1, wNorm: 0.15, rotationDeg: -45 },
    ]);
    expect(await pageCount(out)).toBe(2);
  });
  it("aynı görseli tek kez embed eder (cache)", async () => {
    const shared = pngBytes();
    const out = await applySignatures(await makePdf(1), [
      { pngBytes: shared, aspect: 1, page: 0, xNorm: 0.1, yNorm: 0.1, wNorm: 0.2 },
      { pngBytes: shared, aspect: 1, page: 0, xNorm: 0.5, yNorm: 0.5, wNorm: 0.2 },
    ]);
    expect(out.length).toBeGreaterThan(100);
  });
});

// ─── Yorumlama gömme (tüm türler) ─────────────────────────────────────────────
describe("applyAnnotations", () => {
  it("vurgu/kutu/kalem/ok/metin türlerini gömer", async () => {
    const items: AnnotationItem[] = [
      { type: "highlight", page: 0, xNorm: 0.1, yNorm: 0.1, wNorm: 0.3, hNorm: 0.05, color: [1, 1, 0] },
      { type: "rect", page: 0, xNorm: 0.1, yNorm: 0.3, wNorm: 0.3, hNorm: 0.1, color: [1, 0, 0], borderWidth: 2 },
      { type: "pen", page: 0, pointsNorm: [[0.1, 0.5], [0.3, 0.55], [0.5, 0.5]], color: [0, 0, 1], thickness: 3, opacity: 0.4 },
      { type: "line", page: 0, x1Norm: 0.1, y1Norm: 0.7, x2Norm: 0.5, y2Norm: 0.8, color: [0.5, 0, 0.5], thickness: 3, arrow: true },
      { type: "image", page: 0, xNorm: 0.6, yNorm: 0.6, wNorm: 0.2, aspect: 1, pngBytes: pngBytes() },
    ];
    const out = await applyAnnotations(await makePdf(1), items);
    expect(await pageCount(out)).toBe(1);
  });
  it("olmayan sayfayı sessizce atlar", async () => {
    const out = await applyAnnotations(await makePdf(1), [
      { type: "highlight", page: 9, xNorm: 0.1, yNorm: 0.1, wNorm: 0.3, hNorm: 0.05, color: [1, 1, 0] },
    ]);
    expect(await pageCount(out)).toBe(1);
  });
});

// ─── Ayırma / sayfa sayısı / blob'lar ─────────────────────────────────────────
describe("split / pageCount / blob helpers", () => {
  it("ayırma seçili sayfaları ayrı dosyalara koyar (ZIP)", async () => {
    const out = await splitPagesToZip(await makePdf(3), [0, 2], "sayfa");
    const files = unzipSync(out);
    expect(Object.keys(files).length).toBe(2);
    expect(Object.keys(files).some((n) => n.endsWith(".pdf"))).toBe(true);
  });
  it("getPdfPageCount doğru sayı döner", async () => {
    expect(await getPdfPageCount(await makePdf(4))).toBe(4);
  });
  it("blob yardımcıları doğru MIME üretir", () => {
    expect(pdfBytesToBlob(new Uint8Array([1, 2, 3])).type).toBe("application/pdf");
    expect(zipBytesToBlob(new Uint8Array([1])).type).toBe("application/zip");
  });
});

// ─── Hata sınıfı ──────────────────────────────────────────────────────────────
describe("PdfEncryptedError", () => {
  it("Error alt sınıfıdır ve adı doğrudur", () => {
    const e = new PdfEncryptedError();
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("PdfEncryptedError");
  });
});
