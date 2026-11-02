import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef } from "pdf-lib";
import {
  TocFileError, defaultTitle, inspectPdf, mergeWithToc, paginate, type TocOptions,
} from "../lib/pdfToc";

const fontBytes = new Uint8Array(readFileSync("public/fonts/Roboto-Regular.ttf"));
const boldBytes = new Uint8Array(readFileSync("public/fonts/Roboto-Bold.ttf"));

const OPT: TocOptions = {
  heading: "İçindekiler", continued: "(devam)", numbering: true, pageFooter: true,
  pageWord: "Sayfa", backLinks: true, backLabel: "İçindekilere dön", fontBytes, boldBytes,
};

async function pdf(sayfa: number, boyut: [number, number] = [595, 842]) {
  const d = await PDFDocument.create();
  for (let i = 0; i < sayfa; i++) d.addPage(boyut).drawText(`p${i + 1}`, { x: 40, y: 40 });
  return new Uint8Array(await d.save());
}
const dosya = async (ad: string, n: number, boyut?: [number, number]) => ({
  name: ad, title: defaultTitle(ad), bytes: await pdf(n, boyut),
});

/** Yer imlerini (başlık, hedef sayfa indeksi) olarak okur. */
function yerImleri(doc: PDFDocument) {
  const pages = doc.getPages().map((p) => p.ref.tag);
  const root = doc.catalog.lookup(PDFName.of("Outlines"), PDFDict);
  const sonuc: { title: string; page: number }[] = [];
  let ref = root.get(PDFName.of("First")) as PDFRef | undefined;
  while (ref) {
    const item = doc.context.lookup(ref, PDFDict);
    const dest = item.lookup(PDFName.of("Dest"), PDFArray);
    const title = (item.lookup(PDFName.of("Title")) as PDFHexString).decodeText();
    sonuc.push({ title, page: pages.indexOf((dest.get(0) as PDFRef).tag) });
    ref = item.get(PDFName.of("Next")) as PDFRef | undefined;
  }
  return sonuc;
}

/** Belirli sayfadaki dahili bağlantıların hedef sayfa indeksleri. */
function baglantilar(doc: PDFDocument, sayfa: number) {
  const pages = doc.getPages().map((p) => p.ref.tag);
  const annots = doc.getPage(sayfa).node.lookup(PDFName.of("Annots")) as PDFArray | undefined;
  if (!annots) return [];
  return annots.asArray().map((r) => {
    const a = doc.context.lookup(r, PDFDict);
    const dest = a.lookup(PDFName.of("Dest"), PDFArray);
    return pages.indexOf((dest.get(0) as PDFRef).tag);
  });
}

describe("başlık ve doğrulama", () => {
  it("varsayılan başlık", () => {
    expect(defaultTitle("Ek-1_Kira_Sözleşmesi.pdf")).toBe("Ek 1 Kira Sözleşmesi");
  });
  it("bozuk dosya hata verir ve dosya sırasını söyler", async () => {
    await expect(inspectPdf(new Uint8Array([1, 2, 3]), 2)).rejects.toMatchObject({ kind: "broken", index: 2 });
  });
  it("şifreli dosya tanınır", async () => {
    // Şifreli PDF'in en küçük örneği: Encrypt sözlüğü olan gövde
    const d = await PDFDocument.create();
    d.addPage();
    const bytes = await d.save();
    const metin = new TextDecoder("latin1").decode(bytes).replace("/Root", "/Encrypt << /Filter /Standard /V 1 /R 2 /O (aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) /U (aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) /P -4 >> /Root");
    const sifreli = new Uint8Array([...metin].map((c) => c.charCodeAt(0)));
    await expect(inspectPdf(sifreli, 0)).rejects.toBeInstanceOf(TocFileError);
  });
});

describe("birleştirme + içindekiler", () => {
  it("sayfa sayısı, yer imi sayfaları ve bağlantı hedefleri doğru", async () => {
    const files = [await dosya("A_giris.pdf", 3), await dosya("B-ek.pdf", 1), await dosya("C.pdf", 5)];
    const r = await mergeWithToc(files, OPT);
    const d = await PDFDocument.load(r.bytes);
    expect(r.tocPages).toBe(1);
    expect(d.getPageCount()).toBe(1 + 3 + 1 + 5);
    expect(r.sections.map((s) => s.startPage)).toEqual([2, 5, 6]);
    expect(yerImleri(d).map((y) => y.page + 1)).toEqual([2, 5, 6]);
    expect(yerImleri(d).map((y) => y.title)).toEqual(["A giris", "B ek", "C"]);
    expect(baglantilar(d, 0)).toEqual([1, 4, 5]); // içindekiler sayfasındaki 3 satır
  });

  it("tek dosyada da çalışır", async () => {
    const r = await mergeWithToc([await dosya("tek.pdf", 2)], OPT);
    const d = await PDFDocument.load(r.bytes);
    expect(d.getPageCount()).toBe(3);
    expect(yerImleri(d)).toHaveLength(1);
  });

  it("20 dosya: içindekiler taşar, numaralar yine doğru", async () => {
    const files = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        dosya(`Bölüm ${i + 1} - ${"çok uzun başlık ".repeat(8)}.pdf`, 2)),
    );
    const r = await mergeWithToc(files, OPT);
    const d = await PDFDocument.load(r.bytes);
    expect(r.tocPages).toBeGreaterThan(1);
    expect(d.getPageCount()).toBe(r.tocPages + 40);
    const ilk = r.tocPages + 1;
    expect(r.sections[0]!.startPage).toBe(ilk);
    expect(r.sections[19]!.startPage).toBe(ilk + 38);
    expect(yerImleri(d).map((y) => y.page + 1)).toEqual(r.sections.map((s) => s.startPage));
    // Tüm içindekiler sayfalarındaki bağlantılar toplamı 20 ve sırayla doğru bölümlere gidiyor
    const hepsi = Array.from({ length: r.tocPages }, (_, p) => baglantilar(d, p)).flat();
    expect(hepsi).toEqual(r.sections.map((s) => s.startPage - 1));
  });

  it("karışık sayfa boyutları korunur, içindekiler A4 dikey", async () => {
    const r = await mergeWithToc(
      [await dosya("a.pdf", 1, [612, 792]), await dosya("b.pdf", 1, [842, 595])],
      OPT,
    );
    const d = await PDFDocument.load(r.bytes);
    expect(d.getPage(0).getSize().width).toBeCloseTo(595.28, 1);
    expect(d.getPage(1).getSize()).toEqual({ width: 612, height: 792 });
    expect(d.getPage(2).getSize()).toEqual({ width: 842, height: 595 });
  });

  it("döndürülmüş sayfa ve seçenekler kapalıyken de çökmez", async () => {
    const d0 = await PDFDocument.create();
    d0.addPage([400, 600]).setRotation({ type: "degrees" as never, angle: 90 } as never);
    const bytes = new Uint8Array(await d0.save());
    const r = await mergeWithToc([{ name: "r.pdf", title: "R", bytes }], OPT);
    expect((await PDFDocument.load(r.bytes)).getPageCount()).toBe(2);
    const r2 = await mergeWithToc([await dosya("x.pdf", 1)], { ...OPT, numbering: false, pageFooter: false, backLinks: false });
    expect((await PDFDocument.load(r2.bytes)).getPageCount()).toBe(2);
  });

  it("bozuk dosya hangisi olduğunu bildirir", async () => {
    const files = [await dosya("iyi.pdf", 1), { name: "kotu.pdf", title: "k", bytes: new Uint8Array([9, 9, 9]) }];
    await expect(mergeWithToc(files, OPT)).rejects.toMatchObject({ kind: "broken", index: 1 });
  });

  it("Türkçe başlıklar yer iminde bozulmadan kalır", async () => {
    const f = { name: "x.pdf", title: "Şükrü'nün İğdır Çağrısı", bytes: await pdf(1) };
    const r = await mergeWithToc([f], OPT);
    expect(yerImleri(await PDFDocument.load(r.bytes))[0]!.title).toBe("Şükrü'nün İğdır Çağrısı");
  });

  it("sayfalama: yüksek girdiler yeni sayfaya geçer", () => {
    expect(paginate([20, 20, 20])).toEqual([0, 0, 0]);
    const cok = paginate(new Array(60).fill(22));
    expect(cok[cok.length - 1]).toBeGreaterThan(0);
  });
});
