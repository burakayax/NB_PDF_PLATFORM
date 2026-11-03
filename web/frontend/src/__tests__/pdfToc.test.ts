import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef } from "pdf-lib";
import {
  TocFileError, defaultTitle, inspectPdf, mergeWithToc, paginate, readOutline, type TocOptions,
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

describe("alt başlıklar ve kaynak yer imleri", () => {
  it("alt başlık içindekilerde ve iç içe yer iminde doğru sayfaya gider", async () => {
    const a = { ...(await dosya("A.pdf", 4)), subs: [{ title: "Madde 2", page: 3 }, { title: "Madde 1", page: 2 }, { title: "Geçersiz", page: 99 }] };
    const b = await dosya("B.pdf", 2);
    const r = await mergeWithToc([a, b], OPT);
    const d = await PDFDocument.load(r.bytes);
    expect(r.tocPages).toBe(1);
    expect(d.getPageCount()).toBe(1 + 4 + 2);
    // içindekiler: A, A.1(sayfa 2 → 3. sayfa), A.2, B  → 4 bağlantı
    expect(baglantilar(d, 0)).toEqual([1, 2, 3, 5]);
    // yer imleri: üst düzeyde yalnız A ve B; A'nın 2 çocuğu var
    expect(yerImleri(d).map((y) => y.title)).toEqual(["A", "B"]);
    const alt = await readOutline(r.bytes); // üst düzey = bölümler
    expect(alt.map((x) => x.page)).toEqual([2, 6]);
  });

  it("readOutline: kaynak yer imlerini sayfalarıyla verir, yer imi yoksa boş döner", async () => {
    const f = await dosya("X.pdf", 3);
    expect(await readOutline(f.bytes)).toEqual([]);
    const merged = await mergeWithToc([f, await dosya("Y.pdf", 1)], OPT);
    const o = await readOutline(merged.bytes);
    expect(o.map((x) => x.title)).toEqual(["X", "Y"]);
  });

  it("çok alt başlık içindekileri sonraki sayfaya taşırır", async () => {
    const subs = Array.from({ length: 55 }, (_, i) => ({ title: `Madde ${i + 1}`, page: 1 + (i % 3) }));
    const r = await mergeWithToc([{ ...(await dosya("Uzun.pdf", 3)), subs }, await dosya("Z.pdf", 1)], OPT);
    expect(r.tocPages).toBeGreaterThan(1);
    expect(r.sections[0]!.startPage).toBe(r.tocPages + 1);
  });
});

describe("içindekiler başlığı ve yazı tipi", () => {
  it("başlık sayfada ortalanır", async () => {
    const r = await mergeWithToc([await dosya("a.pdf", 1), await dosya("b.pdf", 1)], OPT);
    const doc = await PDFDocument.load(r.bytes);
    const { decodePDFRawStream } = await import("pdf-lib");
    const icerik = doc.getPage(0).node.Contents();
    const parcalar = icerik instanceof PDFArray
      ? Array.from({ length: icerik.size() }, (_, i) => icerik.lookup(i))
      : [icerik];
    const metin = parcalar
      .map((c) => Buffer.from(decodePDFRawStream(c as import("pdf-lib").PDFRawStream).decode()).toString("latin1"))
      .join(" ");
    const m = metin.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);
    expect(m).not.toBeNull();
    const x = Number(m![1]);
    // A4 genişliği 595.28; başlık ortalıysa sol boşluk yaklaşık sağ boşluğa eşittir (sol kenar 56 değil)
    expect(x).toBeGreaterThan(150);
    expect(x).toBeLessThan(300);
  });

  it.each(["LiberationSans", "LiberationSerif", "Carlito", "Caladea", "Gelasio"])("%s ile Türkçe başlıklar üretilir", async (aile) => {
    const f = new Uint8Array(readFileSync(`public/fonts/cv/${aile}-Regular.ttf`));
    const b = new Uint8Array(readFileSync(`public/fonts/cv/${aile}-Bold.ttf`));
    const a = { ...(await dosya("a.pdf", 1)), title: "Çağrı Şişli İğne Öğün" };
    const r = await mergeWithToc([a, await dosya("b.pdf", 1)], { ...OPT, fontBytes: f, boldBytes: b });
    expect(r.sections).toHaveLength(2);
  });
});

describe("grup başlıkları", () => {
  it("yer imleri grup → dosya → alt başlık olarak iç içe gelir", async () => {
    const a = { ...(await dosya("telefon.pdf", 1)), group: "FATURALAR" };
    const b = { ...(await dosya("internet.pdf", 2)), subs: [{ title: "Ocak", page: 2 }] };
    const c = { ...(await dosya("ihale.pdf", 1)), group: "SÖZLEŞMELER" };
    const r = await mergeWithToc([a, b, c], OPT);
    const doc = await PDFDocument.load(r.bytes);
    const kok = doc.catalog.lookup(PDFName.of("Outlines"), PDFDict);
    const baslik = (ref: PDFRef) => (doc.context.lookup(ref, PDFDict).lookup(PDFName.of("Title")) as PDFHexString).decodeText();
    const ust: string[] = [];
    let ref = kok.get(PDFName.of("First")) as PDFRef | undefined;
    const cocuk: number[] = [];
    while (ref) {
      const d = doc.context.lookup(ref, PDFDict);
      ust.push(baslik(ref));
      cocuk.push((d.get(PDFName.of("Count")) as { asNumber(): number } | undefined)?.asNumber() ?? 0);
      ref = d.get(PDFName.of("Next")) as PDFRef | undefined;
    }
    expect(ust).toEqual(["FATURALAR", "SÖZLEŞMELER"]);
    expect(cocuk).toEqual([3, 1]); // FATURALAR: telefon + internet + Ocak, SÖZLEŞMELER: ihale
    // Bölüm başlangıç sayfaları grup başlıkları yüzünden kaymaz
    expect(r.sections.map((x) => x.startPage)).toEqual([2, 3, 5]);
  });

  it("grup yoksa yer imleri eskisi gibi düz kalır", async () => {
    const r = await mergeWithToc([await dosya("a.pdf", 1), await dosya("b.pdf", 1)], OPT);
    expect(yerImleri(await PDFDocument.load(r.bytes)).map((x) => x.title)).toEqual(["a", "b"]);
  });

  it("çok grup ve dosya içindekileri birden çok sayfaya taşırsa başlık sayfa sonunda yalnız kalmaz", async () => {
    const dosyalar = [];
    for (let i = 0; i < 20; i++) {
      dosyalar.push({ ...(await dosya(`f${i}.pdf`, 1)), group: i % 2 === 0 ? `GRUP ${i}` : undefined });
    }
    const r = await mergeWithToc(dosyalar, OPT);
    expect(r.sections).toHaveLength(20);
    expect(r.tocPages).toBeGreaterThanOrEqual(1);
  });
});

describe("alt başlık ve ayırıcı sayfa", () => {
  const hazirla = async () => [
    { ...(await dosya("internet.pdf", 1)), group: "FATURALAR", subgroup: "İnternet" },
    { ...(await dosya("telefon.pdf", 2)), group: "FATURALAR", subgroup: "Telefon" },
    { ...(await dosya("ihale.pdf", 1)), group: "SÖZLEŞMELER" },
  ];
  const agac = (doc: PDFDocument) => {
    const baslik = (ref: PDFRef) => (doc.context.lookup(ref, PDFDict).lookup(PDFName.of("Title")) as PDFHexString).decodeText();
    const oku = (ilk: PDFRef | undefined): unknown[] => {
      const s: unknown[] = [];
      let ref = ilk;
      while (ref) {
        const d = doc.context.lookup(ref, PDFDict);
        const kids = oku(d.get(PDFName.of("First")) as PDFRef | undefined);
        s.push(kids.length ? { [baslik(ref)]: kids } : baslik(ref));
        ref = d.get(PDFName.of("Next")) as PDFRef | undefined;
      }
      return s;
    };
    return oku(doc.catalog.lookup(PDFName.of("Outlines"), PDFDict).get(PDFName.of("First")) as PDFRef);
  };

  it("yer imleri grup → alt başlık → dosya olarak üç katlı gelir", async () => {
    const r = await mergeWithToc(await hazirla(), OPT);
    expect(agac(await PDFDocument.load(r.bytes))).toEqual([
      { FATURALAR: [{ "İnternet": ["internet"] }, { Telefon: ["telefon"] }] },
      { "SÖZLEŞMELER": ["ihale"] },
    ]);
  });

  it("ayırıcı sayfa açıkken her grubun önüne bir sayfa eklenir ve sayfa numaraları kaymaz", async () => {
    const kapali = await mergeWithToc(await hazirla(), OPT);
    const acik = await mergeWithToc(await hazirla(), { ...OPT, separators: true });
    expect(acik.totalPages).toBe(kapali.totalPages + 2);
    const doc = await PDFDocument.load(acik.bytes);
    expect(doc.getPageCount()).toBe(acik.totalPages);
    // içindekiler(1) + ayırıcı(1) → internet 3. sayfada; telefon 4-5; ayırıcı 6; ihale 7
    expect(acik.sections.map((x) => x.startPage)).toEqual([3, 4, 7]);
    // Yer imi: grup başlığı ayırıcı sayfaya gider
    const kok = doc.catalog.lookup(PDFName.of("Outlines"), PDFDict);
    const ilk = doc.context.lookup(kok.get(PDFName.of("First")) as PDFRef, PDFDict);
    const pages = doc.getPages().map((p) => p.ref.tag);
    expect(pages.indexOf(((ilk.lookup(PDFName.of("Dest"), PDFArray)).get(0) as PDFRef).tag)).toBe(1);
  });

  it("hiç grup yokken ayırıcı seçeneği sayfa eklemez", async () => {
    const r = await mergeWithToc([await dosya("a.pdf", 1), await dosya("b.pdf", 1)], { ...OPT, separators: true });
    expect(r.totalPages).toBe(3);
  });
});
