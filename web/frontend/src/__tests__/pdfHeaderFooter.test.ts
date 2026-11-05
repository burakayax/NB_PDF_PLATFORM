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

  it("çok uzun metin küçültülmez (serbest boyut)", async () => {
    const src = await makePdf(1);
    const r = await addHeaderFooter(src, { header: { ...EMPTY_SLOT, left: "Bu çok uzun bir üst bilgi metnidir ".repeat(8) }, footer: EMPTY_SLOT, fonts });
    expect(r.shrunk).toBe(0);
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

describe("bölümler (farklı sayfalara farklı metin)", () => {
  const S = (center: string) => ({ left: "", center, right: "" });

  it("tek ve çift sayfalara ayrı metin yazar", async () => {
    const pdf = await makePdf(4);
    const r = await addHeaderFooter(pdf, {
      fonts,
      rules: [
        { header: S("TEK"), footer: EMPTY_SLOT, pages: "odd" },
        { header: S("CIFT"), footer: EMPTY_SLOT, pages: "even" },
      ],
    });
    expect(r.stamped).toBe(4);
    expect(await pageTexts(r.bytes)).toEqual(["TEK", "CIFT", "TEK", "CIFT"]);
  });

  it("sayfa aralığı bölümü yalnız o sayfalara yazar; sondaki bölüm kazanır", async () => {
    const pdf = await makePdf(5);
    const r = await addHeaderFooter(pdf, {
      fonts,
      rules: [
        { header: S("GENEL"), footer: EMPTY_SLOT, pages: "all" },
        { header: S("OZEL"), footer: EMPTY_SLOT, pages: "range", from: 2, to: 3 },
      ],
    });
    expect(await pageTexts(r.bytes)).toEqual(["GENEL", "OZEL", "OZEL", "GENEL", "GENEL"]);
  });

  it("boş bırakılan bölüm o sayfalara hiçbir şey yazmaz", async () => {
    const pdf = await makePdf(3);
    const r = await addHeaderFooter(pdf, {
      fonts,
      rules: [
        { header: S("X"), footer: EMPTY_SLOT, pages: "all" },
        { header: EMPTY_SLOT, footer: EMPTY_SLOT, pages: "range", from: 2, to: 2 },
      ],
    });
    expect(r.stamped).toBe(2);
    expect(await pageTexts(r.bytes)).toEqual(["X", "", "X"]);
  });

  it("önizleme: asPageIndex ile tek sayfalık belge asıl sayfa gibi işlenir", async () => {
    const pdf = await makePdf(1);
    const r = await addHeaderFooter(pdf, {
      fonts, asPageIndex: 4, totalPages: 12,
      rules: [{ header: EMPTY_SLOT, footer: S("{sayfa}/{toplam}"), pages: "all" }],
    });
    expect((await pageTexts(r.bytes))[0]).toBe("5/12");
  });

  it("üst ve alt bilgi ayrı boyut ve yan boşlukla çizilir", async () => {
    const pdf = await makePdf(1);
    const r = await addHeaderFooter(pdf, {
      fonts,
      rules: [{ header: { left: "UST", center: "", right: "" }, footer: { left: "ALT", center: "", right: "" }, pages: "all" }],
      headerStyle: { fontSize: 20, bold: true, edgeMm: 20, sideMm: 30 },
      footerStyle: { fontSize: 8, bold: false, edgeMm: 5, sideMm: 10 },
    });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: r.bytes.slice(), isEvalSupported: false, useWorkerFetch: false }).promise;
    const tc = await (await doc.getPage(1)).getTextContent();
    const it = (s: string) => tc.items.find((x) => "str" in x && x.str === s) as { transform: number[] };
    const up = it("UST");
    const down = it("ALT");
    expect(up.transform[0]).toBeCloseTo(20, 0); // yazı boyutu
    expect(down.transform[0]).toBeCloseTo(8, 0);
    expect(up.transform[4]).toBeCloseTo(30 * (72 / 25.4), 0); // soldan boşluk
    expect(down.transform[4]).toBeCloseTo(10 * (72 / 25.4), 0);
    expect(up.transform[5]).toBeGreaterThan(down.transform[5]);
  });
});

describe("sütun bazlı yazı stili ve çizgi", () => {
  it("sol/orta/sağ sütunlar ayrı boyut ve kalınlıkla çizilir", async () => {
    const pdf = await makePdf(1);
    const r = await addHeaderFooter(pdf, {
      fonts,
      rules: [{ header: { left: "SOL", center: "ORTA", right: "SAG" }, footer: EMPTY_SLOT, pages: "all" }],
      headerStyle: { cols: { left: { fontSize: 8 }, center: { fontSize: 14, bold: true }, right: { fontSize: 20, color: "#ff0000" } } },
    });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: r.bytes.slice(), isEvalSupported: false, useWorkerFetch: false }).promise;
    const tc = await (await doc.getPage(1)).getTextContent();
    const sz = (s: string) => (tc.items.find((x) => "str" in x && x.str === s) as { transform: number[] }).transform[0];
    expect(sz("SOL")).toBeCloseTo(8, 0);
    expect(sz("ORTA")).toBeCloseTo(14, 0);
    expect(sz("SAG")).toBeCloseTo(20, 0);
  });

  it("üst bilgide çizgi yazının altına, alt bilgide üstüne çizilir", async () => {
    const pdf = await makePdf(1);
    const r = await addHeaderFooter(pdf, {
      fonts,
      rules: [{ header: { left: "UST", center: "", right: "" }, footer: { left: "ALT", center: "", right: "" }, pages: "all" }],
      headerStyle: { rule: true, ruleColor: "#00ff00", ruleWidth: 2 },
      footerStyle: { rule: true },
    });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: r.bytes.slice(), isEvalSupported: false, useWorkerFetch: false }).promise;
    const page = await doc.getPage(1);
    const tc = await page.getTextContent();
    const y = (s: string) => (tc.items.find((x) => "str" in x && x.str === s) as { transform: number[] }).transform[5];
    const ops = await page.getOperatorList();
    // constructPath: [alt işlemler, koordinatlar] — çizgilerin y değerleri
    const ys: number[] = [];
    ops.fnArray.forEach((fn, k) => {
      if (fn === pdfjs.OPS.constructPath) {
        const coords = ops.argsArray[k][1] as number[];
        for (let c = 1; c < coords.length; c += 2) ys.push(coords[c]!);
      }
    });
    const upLine = ys.find((v) => v < y("UST") && v > y("UST") - 12);
    const downLine = ys.find((v) => v > y("ALT") && v < y("ALT") + 20);
    expect(upLine).toBeDefined(); // üst bilgi: çizgi yazının ALTINDA
    expect(downLine).toBeDefined(); // alt bilgi: çizgi yazının ÜSTÜNDE
  });
});

/** Görünen (döndürülmüş) sayfada her metnin sol-üst köşeye göre konumunu verir: { str, x, y, w, h } (px, y aşağı). */
async function visiblePositions(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, useWorkerFetch: false }).promise;
  const out: { w: number; h: number; items: { str: string; x: number; y: number }[] }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items
      .filter((it) => "str" in it && it.str.trim())
      .map((it) => {
        const t = (it as { transform: number[]; str: string }).transform;
        const [x, y] = vp.convertToViewportPoint(t[4]!, t[5]!);
        return { str: (it as { str: string }).str, x, y };
      });
    out.push({ w: vp.width, h: vp.height, items });
  }
  return out;
}

describe("döndürülmüş / kırpılmış sayfada konum", () => {
  const opts = { header: { left: "SOL", center: "", right: "SAĞ" }, footer: { left: "", center: "ALT", right: "" }, fonts };

  it.each([0, 90, 180, 270])("%i° sayfada üst bilgi görünen üstte, alt bilgi görünen altta, sol/sağ doğru yönde", async (rot) => {
    const src = await makePdf(1, [rot]);
    const r = await addHeaderFooter(src, opts);
    const [pg] = await visiblePositions(r.bytes);
    const by = (s: string) => pg!.items.find((i) => i.str === s)!;
    expect(by("SOL").y).toBeLessThan(pg!.h * 0.12);
    expect(by("SAĞ").y).toBeLessThan(pg!.h * 0.12);
    expect(by("ALT").y).toBeGreaterThan(pg!.h * 0.88);
    expect(by("SOL").x).toBeLessThan(pg!.w * 0.2);
    expect(by("SAĞ").x).toBeGreaterThan(pg!.w * 0.7);
    expect(Math.abs(by("ALT").x - pg!.w / 2)).toBeLessThan(pg!.w * 0.1);
  });

  it("yatay sayfa (MediaBox yatay) + 90° ve ofsetli CropBox doğru yere yazar", async () => {
    const d = await PDFDocument.create();
    const p = d.addPage([842, 595]);
    p.setMediaBox(0, 0, 842, 595);
    p.setCropBox(40, 30, 700, 500);
    p.setRotation(degrees(90));
    const r = await addHeaderFooter(await d.save(), opts);
    const [pg] = await visiblePositions(r.bytes);
    const by = (s: string) => pg!.items.find((i) => i.str === s)!;
    expect(by("SOL").y).toBeLessThan(pg!.h * 0.15);
    expect(by("ALT").y).toBeGreaterThan(pg!.h * 0.85);
    expect(by("SOL").x).toBeLessThan(pg!.w * 0.2);
    expect(by("SAĞ").x).toBeGreaterThan(pg!.w * 0.7);
  });
});
