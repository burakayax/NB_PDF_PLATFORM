import { describe, it, expect } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString } from "pdf-lib";
import { unzipSync } from "fflate";
import { deletePages, reorderPages, splitEveryNToZip, rotatePdf } from "../lib/clientPdf";

/** 4 sayfalı, 2 seviyeli yer imli PDF: A(s1) > A1(s2), B(s3), C(s4). */
async function yerimliPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 4; i++) doc.addPage([300, 400]);
  const ctx = doc.context;
  const sayfa = (i: number) => doc.getPages()[i]!.ref;
  const kok = ctx.nextRef();
  const a = ctx.nextRef();
  const a1 = ctx.nextRef();
  const b = ctx.nextRef();
  const c = ctx.nextRef();
  const hedef = (i: number) => [sayfa(i), PDFName.of("Fit")];
  ctx.assign(a1, ctx.obj({ Title: PDFHexString.fromText("A1"), Parent: a, Dest: hedef(1) }));
  ctx.assign(a, ctx.obj({ Title: PDFString.of("A"), Parent: kok, Dest: hedef(0), Next: b, First: a1, Last: a1, Count: 1 }));
  ctx.assign(b, ctx.obj({ Title: PDFString.of("B"), Parent: kok, Dest: hedef(2), Prev: a, Next: c }));
  ctx.assign(c, ctx.obj({ Title: PDFString.of("C"), Parent: kok, Dest: hedef(3), Prev: b }));
  ctx.assign(kok, ctx.obj({ Type: "Outlines", First: a, Last: c, Count: 4 }));
  doc.catalog.set(PDFName.of("Outlines"), kok);
  return doc.save();
}

type Madde = { baslik: string; sayfa: number; alt: Madde[] };

async function yerImleri(bytes: Uint8Array): Promise<Madde[]> {
  const doc = await PDFDocument.load(bytes);
  const idx = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i]));
  const oku = (ilk: unknown): Madde[] => {
    const sonuc: Madde[] = [];
    let cur = ilk;
    while (cur instanceof PDFRef) {
      const d = doc.context.lookup(cur, PDFDict)!;
      const t = d.lookup(PDFName.of("Title")) as PDFString | PDFHexString;
      const dest = d.lookup(PDFName.of("Dest")) as PDFArray;
      sonuc.push({
        baslik: t instanceof PDFHexString ? t.decodeText() : t.decodeText(),
        sayfa: idx.get((dest.get(0) as PDFRef).toString())!,
        alt: oku(d.get(PDFName.of("First"))),
      });
      cur = d.get(PDFName.of("Next"));
    }
    return sonuc;
  };
  const kok = doc.catalog.lookup(PDFName.of("Outlines"));
  return kok instanceof PDFDict ? oku(kok.get(PDFName.of("First"))) : [];
}

describe("yer imlerinin korunması", () => {
  it("kaynak dosyada 4 yer imi var (test düzeneği)", async () => {
    const m = await yerImleri(await yerimliPdf());
    expect(m.map((x) => x.baslik)).toEqual(["A", "B", "C"]);
    expect(m[0]!.alt[0]!.baslik).toBe("A1");
  });

  it("Sırala: yer imleri yeni sayfa numaralarına taşınır", async () => {
    // Yeni sıra: eski 4,3,2,1 → C s0, B s1, A1 s2, A s3
    const out = await reorderPages(await yerimliPdf(), [3, 2, 1, 0]);
    const m = await yerImleri(out);
    const bul = (b: string) => [...m, ...m.flatMap((x) => x.alt)].find((x) => x.baslik === b)!;
    expect(bul("C").sayfa).toBe(0);
    expect(bul("B").sayfa).toBe(1);
    expect(bul("A1").sayfa).toBe(2);
    expect(bul("A").sayfa).toBe(3);
  });

  it("Sayfa Sil: silinen sayfanın yer imi düşer, kalanlar kayar", async () => {
    // 3. sayfa (B) silinir → A s0 (A1 s1), C s2
    const out = await deletePages(await yerimliPdf(), [2]);
    const m = await yerImleri(out);
    expect(m.map((x) => [x.baslik, x.sayfa])).toEqual([["A", 0], ["C", 2]]);
    expect(m[0]!.alt.map((x) => [x.baslik, x.sayfa])).toEqual([["A1", 1]]);
  });

  it("Böl: her parça yalnızca kendi sayfalarının yer imlerini taşır", async () => {
    const zip = unzipSync(await splitEveryNToZip(await yerimliPdf(), 2));
    const adlar = Object.keys(zip).sort();
    expect(adlar).toHaveLength(2);
    const ilk = await yerImleri(zip[adlar[0]!]!);
    const ikinci = await yerImleri(zip[adlar[1]!]!);
    expect(ilk.map((x) => [x.baslik, x.sayfa])).toEqual([["A", 0]]);
    expect(ilk[0]!.alt.map((x) => [x.baslik, x.sayfa])).toEqual([["A1", 1]]);
    expect(ikinci.map((x) => [x.baslik, x.sayfa])).toEqual([["B", 0], ["C", 1]]);
  });

  it("Döndür yer imlerini zaten koruyor (karşılaştırma)", async () => {
    const m = await yerImleri(await rotatePdf(await yerimliPdf(), { 0: 90 }));
    expect(m.map((x) => x.baslik)).toEqual(["A", "B", "C"]);
  });

  it("yer imsiz PDF'te hata vermez", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]);
    doc.addPage([300, 400]);
    const out = await reorderPages(await doc.save(), [1, 0]);
    expect(await yerImleri(out)).toEqual([]);
  });
});
