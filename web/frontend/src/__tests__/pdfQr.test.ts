import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PDFDocument, PDFName, PDFArray } from "pdf-lib";
import jsQR from "jsqr";
import {
  BOS_ALANLAR, buildPayload, contrastRatio, makeMatrix, normalizeTrPhone, normalizeUrl,
  parsePageList, qrOutputName, qrToSvg, resolvePages, stampQr, isInverted,
  type QrFields, type QrMatrix,
} from "../lib/pdfQr";

const f = (p: Partial<QrFields>): QrFields => ({ ...BOS_ALANLAR, ...p });

/** Matrisi piksele çevirip jsQR ile geri okur — "okutunca doğru içerik çıkıyor mu" kanıtı. */
function decode(m: QrMatrix): string | null {
  const scale = 6, quiet = 4, n = (m.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(n * n * 4).fill(255);
  for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) {
    if (!m.dark(r, c)) continue;
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
      const i = (((r + quiet) * scale + y) * n + (c + quiet) * scale + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  return jsQR(data, n, n)?.data ?? null;
}

function ok(kind: Parameters<typeof buildPayload>[0], fields: QrFields) {
  const r = buildPayload(kind, fields);
  if (!r.ok) throw new Error("payload failed");
  return r;
}

describe("QR içerik türleri", () => {
  it("link: https eklenir, geçersiz reddedilir", () => {
    expect(normalizeUrl("pdfplatform.app")).toBe("https://pdfplatform.app/");
    expect(normalizeUrl("kelime")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(buildPayload("url", f({ url: "" }))).toEqual({ ok: false, error: "empty" });
  });
  it("link QR'ı okununca aynı adresi verir", () => {
    const r = ok("url", f({ url: "pdfplatform.app/tools" }));
    expect(decode(makeMatrix(r.text, "M"))).toBe("https://pdfplatform.app/tools");
  });
  it("vCard: Türkçe karakterler bozulmadan okunur", () => {
    const r = ok("vcard", f({
      firstName: "Şükrü", lastName: "Çağlayan-Öğüt", org: "İğdır Ltd.", title: "Müdür",
      phone: "0532 123 45 67", email: "a@b.com", website: "firma.com.tr", address: "Gül Sk. No:1, Üsküdar",
    }));
    const okunan = decode(makeMatrix(r.text, "M"))!;
    expect(okunan).toContain("BEGIN:VCARD");
    expect(okunan).toContain("VERSION:3.0");
    expect(okunan).toContain("FN:Şükrü Çağlayan-Öğüt");
    expect(okunan).toContain("ORG:İğdır Ltd.");
    expect(okunan).toContain("TEL;TYPE=CELL:05321234567");
    expect(okunan).toContain("Üsküdar");
    expect(okunan).toContain("END:VCARD");
  });
  it("telefon, e-posta, WhatsApp", () => {
    expect(ok("phone", f({ phone: "+90 532 111-22-33" })).text).toBe("tel:+905321112233");
    expect(ok("email", f({ email: "x@y.com", mailSubject: "Merhaba dünya" })).text)
      .toBe("mailto:x@y.com?subject=Merhaba%20d%C3%BCnya");
    expect(buildPayload("email", f({ email: "bozuk" }))).toEqual({ ok: false, error: "invalid" });
    expect(normalizeTrPhone("0532 123 45 67")).toBe("905321234567");
    expect(normalizeTrPhone("532-123-45-67")).toBe("905321234567");
    expect(normalizeTrPhone("+49 170 1234567")).toBe("491701234567");
    expect(ok("whatsapp", f({ phone: "(0532) 123 45 67" })).text).toBe("https://wa.me/905321234567");
  });
  it("Wi-Fi: özel karakterler kaçırılır ve QR okunur", () => {
    const r = ok("wifi", f({ ssid: "Ev;Ağı", wifiPassword: "şifre:1,2", wifiType: "WPA" }));
    expect(r.text).toBe("WIFI:T:WPA;S:Ev\\;Ağı;P:şifre\\:1\\,2;;");
    expect(decode(makeMatrix(r.text, "M"))).toBe(r.text);
    expect(ok("wifi", f({ ssid: "Açık", wifiType: "nopass" })).text).toBe("WIFI:T:nopass;S:Açık;;");
    expect(buildPayload("wifi", f({ ssid: "x", wifiType: "WPA" }))).toEqual({ ok: false, error: "invalid" });
  });
  it("düz metin", () => {
    const r = ok("text", f({ text: "Merhaba Dünya ğüşiöç" }));
    expect(decode(makeMatrix(r.text, "H"))).toBe("Merhaba Dünya ğüşiöç");
  });
});

describe("renk ve sayfa seçimi", () => {
  it("kontrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#888888")).toBeLessThan(2);
    expect(isInverted("#ffffff", "#000000")).toBe(true);
  });
  it("sayfa listesi", () => {
    expect(parsePageList("1,3,5-7", 10)).toEqual([0, 2, 4, 5, 6]);
    expect(parsePageList("3,3,1", 10)).toEqual([0, 2]);
    expect(parsePageList("11", 10)).toBeNull();
    expect(parsePageList("5-3", 10)).toBeNull();
    expect(parsePageList("abc", 10)).toBeNull();
    expect(resolvePages({ mode: "last" }, 4)).toEqual([3]);
    expect(resolvePages({ mode: "all" }, 3)).toEqual([0, 1, 2]);
  });
  it("SVG vektör çıktısı", () => {
    const svg = qrToSvg(makeMatrix("https://a.co", "M"), { fg: "#000000", bg: "#ffffff", marginModules: 2 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<path");
  });
  it("dosya adı", () => expect(qrOutputName("Fatura 1.pdf")).toBe("Fatura 1_qr.pdf"));
});

describe("PDF'ye yerleştirme", () => {
  async function ornek(sayfa: number, boyut: [number, number][] = []) {
    const d = await PDFDocument.create();
    for (let i = 0; i < sayfa; i++) {
      const p = d.addPage(boyut[i] ?? [595, 842]);
      p.drawText(`Sayfa ${i + 1}`, { x: 50, y: 700 });
    }
    return new Uint8Array(await d.save());
  }
  const baz = {
    text: "https://pdfplatform.app/", link: "https://pdfplatform.app/", ecl: "M" as const,
    sizeMm: 25, marginModules: 2, fg: "#000000", bg: "#ffffff", fx: 1, fy: 1,
  };
  it("seçilen sayfalara ekler, diğerlerine dokunmaz, link ekler", async () => {
    const out = await stampQr(await ornek(4), { ...baz, pages: [0, 3] });
    const d = await PDFDocument.load(out);
    expect(d.getPageCount()).toBe(4);
    const annots = (i: number) => (d.getPage(i).node.lookup(PDFName.of("Annots")) as PDFArray | undefined)?.size() ?? 0;
    expect(annots(0)).toBe(1);
    expect(annots(3)).toBe(1);
    expect(annots(1)).toBe(0);
  });
  it("link yoksa link eklenmez; farklı sayfa boyutlarında çalışır", async () => {
    const out = await stampQr(await ornek(2, [[595, 842], [842, 595]]), { ...baz, link: null, pages: [0, 1], fx: 0.5, fy: 0.5 });
    const d = await PDFDocument.load(out);
    expect(d.getPage(1).getSize()).toEqual({ width: 842, height: 595 });
    expect((d.getPage(0).node.lookup(PDFName.of("Annots")) as PDFArray | undefined)?.size() ?? 0).toBe(0);
  });
  it("Türkçe açıklama yazısı gömülür", async () => {
    const font = new Uint8Array(readFileSync("public/fonts/Roboto-Regular.ttf"));
    const out = await stampQr(await ornek(1), { ...baz, pages: [0], caption: "Bizi takip edin: çğıİöşü", fontBytes: font });
    expect(out.length).toBeGreaterThan((await ornek(1)).length);
  });
  it("logo eklenir ve H düzeyli QR hâlâ okunur", async () => {
    const png = new Uint8Array(Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const out = await stampQr(await ornek(1), { ...baz, pages: [0], logoBytes: png });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
    expect(decode(makeMatrix(baz.text, "H"))).toBe(baz.text);
  });
});

describe("PDF içindeki vektör çizim gerçekten okunabilir QR", () => {
  it("içerik akışındaki dikdörtgenlerden QR yeniden kurulup okunur", async () => {
    const d0 = await PDFDocument.create();
    d0.addPage([595, 842]);
    const out = await stampQr(new Uint8Array(await d0.save()), {
      text: "https://pdfplatform.app/tools/pdf-qr-ekle", link: null, ecl: "M", pages: [0],
      sizeMm: 40, marginModules: 2, fg: "#000000", bg: "#ffffff", fx: 0.3, fy: 0.4,
    });
    const doc = await PDFDocument.load(out);
    const { PDFArray: A, decodePDFRawStream } = await import("pdf-lib");
    const contents = doc.getPage(0).node.Contents()!;
    const refs = contents instanceof A ? contents.asArray() : [contents];
    let text = "";
    for (const r of refs) {
      const s = doc.context.lookup(r as never) as unknown as import("pdf-lib").PDFRawStream;
      text += new TextDecoder().decode(decodePDFRawStream(s).decode()) + "\n";
    }

    const rects = [...text.matchAll(/([\d.\-]+) ([\d.\-]+) ([\d.\-]+) ([\d.\-]+) re/g)].map((m) => m.slice(1, 5).map(Number));
    const [bx, by, bw, bh] = rects[0]!; // zemin
    const px = 8;
    const scale = (px * 4) / (bw / (makeMatrix("https://pdfplatform.app/tools/pdf-qr-ekle", "M").size + 4));
    const n = Math.round(bw * scale);
    const data = new Uint8ClampedArray(n * n * 4).fill(255);
    for (const [x, y, w, h] of rects.slice(1)) {
      const x0 = Math.round((x! - bx!) * scale), x1 = Math.round((x! - bx! + w!) * scale);
      const y0 = Math.round((by! + bh! - y! - h!) * scale), y1 = Math.round((by! + bh! - y!) * scale);
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const i = (yy * n + xx) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
    expect(jsQR(data, n, n)?.data).toBe("https://pdfplatform.app/tools/pdf-qr-ekle");
  });
});
