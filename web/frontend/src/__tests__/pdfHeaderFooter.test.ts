import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PDFDocument, degrees } from "pdf-lib";
import {
  EMPTY_SLOT, addHeaderFooter, fillPlaceholders, formatDateTr, headerFooterOutputName, resolveRange,
} from "../lib/pdfHeaderFooter";

// jsdom ortamında Buffer başka bir "realm"den gelir; pdf-lib'in tür denetimini geçmesi için kopyalanır.
const load = (p: string) => Uint8Array.from(readFileSync(p));
const fonts = { regular: load("public/fonts/Roboto-Regular.ttf"), bold: load("public/fonts/Roboto-Bold.ttf") };

async function makePdf(pages: number, rotations: number[] = []): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const p = d.addPage([595, 842]);
    if (rotations[i]) p.setRotation(degrees(rotations[i]!));
  }
  return d.save();
}

/** pdf.js ile sayfa metnini okur (üretilen PDF'i bağımsız bir okuyucuyla doğrular). */
async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, useWorkerFetch: false }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    out.push(tc.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return out;
}

describe("yer tutucular", () => {
  const v = { page: 3, total: 12, date: "03.11.2026", file: "rapor" };
  it("Türkçe ve İngilizce yer tutucuları doldurur", () => {
    expect(fillPlaceholders("Sayfa {sayfa} / {toplam}", v)).toBe("Sayfa 3 / 12");
    expect(fillPlaceholders("{PAGE} of {total} – {date} – {file}", v)).toBe("3 of 12 – 03.11.2026 – rapor");
  });
  it("bilinmeyen {…} olduğu gibi kalır", () => {
    expect(fillPlaceholders("{bilinmeyen} {sayfa}", v)).toBe("{bilinmeyen} 3");
  });
  it("tarih gün.ay.yıl biçiminde", () => {
    expect(formatDateTr(new Date(2026, 0, 5))).toBe("05.01.2026");
  });
});

describe("sayfa aralığı", () => {
  it("varsayılan tüm sayfalar", () => expect(resolveRange(5)).toEqual([1, 5]));
  it("aralık sayfa sayısına kırpılır", () => expect(resolveRange(5, 2, 99)).toEqual([2, 5]));
  it("kapağı atla 2'den başlatır", () => expect(resolveRange(5, undefined, undefined, true)).toEqual([2, 5]));
  it("tek sayfalı belgede kapağı atlamak boş aralık verir", () => expect(resolveRange(1, 1, 1, true)).toBeNull());
  it("başlangıç bitişten büyükse boş", () => expect(resolveRange(5, 4, 2)).toBeNull());
});

describe("üst / alt bilgi ekleme", () => {
  it("her sayfaya numarayı ve Türkçe karakterleri yazar", async () => {
    const src = await makePdf(3);
    const r = await addHeaderFooter(src, {
      header: { left: "Çalışma Raporu", center: "", right: "{tarih}" },
      footer: { left: "", center: "Sayfa {sayfa} / {toplam}", right: "" },
      date: new Date(2026, 10, 3),
      fonts,
    });
    expect(r.stamped).toBe(3);
    const texts = await pageTexts(r.bytes);
    expect(texts).toHaveLength(3);
    expect(texts[0]).toContain("Çalışma Raporu");
    expect(texts[0]).toContain("03.11.2026");
    expect(texts[0]).toContain("Sayfa 1 / 3");
    expect(texts[2]).toContain("Sayfa 3 / 3");
  });

  it("ilk sayfayı atlayınca kapağa yazmaz, sayaç ikinci sayfadan başlar", async () => {
    const src = await makePdf(3);
    const r = await addHeaderFooter(src, {
      header: EMPTY_SLOT,
      footer: { ...EMPTY_SLOT, center: "{sayfa}" },
      skipFirst: true,
      fonts,
    });
    expect(r.stamped).toBe(2);
    const t = await pageTexts(r.bytes);
    expect(t[0]!.trim()).toBe("");
    expect(t[1]).toContain("1");
    expect(t[2]).toContain("2");
  });

  it("başlangıç numarası verilebilir", async () => {
    const src = await makePdf(2);
    const r = await addHeaderFooter(src, { header: EMPTY_SLOT, footer: { ...EMPTY_SLOT, right: "S.{sayfa}" }, startNumber: 10, fonts });
    const t = await pageTexts(r.bytes);
    expect(t[0]).toContain("S.10");
    expect(t[1]).toContain("S.11");
  });

  it("sayfa aralığı dışındaki sayfalara dokunmaz", async () => {
    const src = await makePdf(4);
    const r = await addHeaderFooter(src, { header: { ...EMPTY_SLOT, left: "GİZLİ" }, footer: EMPTY_SLOT, fromPage: 2, toPage: 3, fonts });
    expect(r.stamped).toBe(2);
    const t = await pageTexts(r.bytes);
    expect(t.map((x) => x.includes("GİZLİ"))).toEqual([false, true, true, false]);
  });

  it("metin yoksa dosyayı olduğu gibi döndürür", async () => {
    const src = await makePdf(2);
    const r = await addHeaderFooter(src, { header: EMPTY_SLOT, footer: EMPTY_SLOT, fonts });
    expect(r.stamped).toBe(0);
  });

  it("döndürülmüş sayfada da yazar ve sayfa sayısını/ölçüsünü bozmaz", async () => {
    const src = await makePdf(4, [0, 90, 180, 270]);
    const r = await addHeaderFooter(src, { header: { ...EMPTY_SLOT, center: "ÜST" }, footer: { ...EMPTY_SLOT, center: "ALT" }, fonts });
    expect(r.stamped).toBe(4);
    const out = await PDFDocument.load(r.bytes);
    expect(out.getPageCount()).toBe(4);
    expect(out.getPage(1).getRotation().angle).toBe(90);
    const t = await pageTexts(r.bytes);
    t.forEach((x) => { expect(x).toContain("ÜST"); expect(x).toContain("ALT"); });
  });

  it("çok uzun metin taşmasın diye küçültülür", async () => {
    const src = await makePdf(1);
    const r = await addHeaderFooter(src, { header: { ...EMPTY_SLOT, left: "Bu çok uzun bir üst bilgi metnidir ".repeat(8) }, footer: EMPTY_SLOT, fonts });
    expect(r.shrunk).toBe(1);
  });

  it("fontta olmayan karakter belgeyi bozmaz", async () => {
    const src = await makePdf(1);
    const r = await addHeaderFooter(src, { header: { ...EMPTY_SLOT, center: "Merhaba 😀 dünya" }, footer: EMPTY_SLOT, fonts });
    expect(r.stamped).toBe(1);
  });
});

describe("çıktı adı", () => {
  it("uzantıyı değiştirir", () => {
    expect(headerFooterOutputName("rapor.pdf")).toBe("rapor_ustbilgi.pdf");
    expect(headerFooterOutputName("")).toBe("belge_ustbilgi.pdf");
  });
});
