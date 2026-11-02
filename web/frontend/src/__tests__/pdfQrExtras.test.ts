import { describe, expect, it } from "vitest";
import { PDFArray, PDFDocument, PDFName } from "pdf-lib";
import { findFreeSpot } from "../lib/pdfFreeSpot";
import { parseBatchLines, stampQrBatch, QR_TEMPLATES } from "../lib/pdfQr";

function sayfa(W: number, H: number, doldur: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!doldur(x, y)) continue;
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  return { data, width: W, height: H };
}

describe("boş yer önerisi", () => {
  it("içerik üstte ve ortadaysa alt köşelerden birini önerir", () => {
    const img = sayfa(300, 420, (x, y) => y < 300 && x > 30 && x < 270);
    const s = findFreeSpot(img, 0.15, 0.1)!;
    expect(s.fy).toBeGreaterThan(0.8);
  });
  it("sağ alt dolu, sol alt boşsa sol alta koyar", () => {
    const img = sayfa(300, 420, (x, y) => y < 330 || (x > 150 && y >= 330));
    const s = findFreeSpot(img, 0.15, 0.1)!;
    expect(s.fx).toBeLessThan(0.3);
    expect(s.fy).toBeGreaterThan(0.8);
  });
  it("önerilen yer gerçekten boş", () => {
    const dolu = (x: number, y: number) => y < 330 || (x > 150 && y >= 330);
    const img = sayfa(300, 420, dolu);
    const s = findFreeSpot(img, 0.15, 0.1)!;
    const x0 = s.fx * (300 - 45);
    const y0 = s.fy * (420 - 42);
    for (let y = Math.floor(y0); y < y0 + 42; y += 3) for (let x = Math.floor(x0); x < x0 + 45; x += 3) expect(dolu(x, y)).toBe(false);
  });
  it("sayfa tamamen doluysa null", () => {
    expect(findFreeSpot(sayfa(300, 420, () => true), 0.15, 0.1)).toBeNull();
  });
});

describe("toplu QR", () => {
  it("satırları ayrıştırır", () => {
    const r = parseBatchLines("1 | pdfplatform.app\n2,4-5 | example.com/x\n\n", 5, "url");
    expect(r.ok && r.rules.map((x) => x.pages)).toEqual([[0], [1, 3, 4]]);
    expect(r.ok && r.rules[0]!.link).toBe("https://pdfplatform.app/");
  });
  it("hataları satır numarasıyla bildirir", () => {
    expect(parseBatchLines("1 pdfplatform.app", 5, "url")).toMatchObject({ ok: false, line: 1, error: "format" });
    expect(parseBatchLines("1 | a.com\n9 | b.com", 5, "url")).toMatchObject({ ok: false, line: 2, error: "pages" });
    expect(parseBatchLines("1 | kelime", 5, "url")).toMatchObject({ ok: false, line: 1, error: "content" });
    expect(parseBatchLines("", 5, "text")).toMatchObject({ ok: false, error: "empty" });
  });
  it("her sayfaya kendi QR'ı konur", async () => {
    const d = await PDFDocument.create();
    d.addPage();
    d.addPage();
    d.addPage();
    const parsed = parseBatchLines("1 | a.com\n3 | b.com", 3, "url");
    if (!parsed.ok) throw new Error("x");
    const out = await stampQrBatch(new Uint8Array(await d.save()), parsed.rules, {
      ecl: "M", sizeMm: 20, marginModules: 2, fg: "#000000", bg: "#ffffff", fx: 1, fy: 1,
    });
    const doc = await PDFDocument.load(out);
    const n = (i: number) => (doc.getPage(i).node.lookup(PDFName.of("Annots")) as PDFArray | undefined)?.size() ?? 0;
    expect([n(0), n(1), n(2)]).toEqual([1, 0, 1]);
  });
});

describe("şablonlar", () => {
  it("üç şablon var ve boyutları okunabilir sınırın üstünde", () => {
    expect(QR_TEMPLATES.map((t) => t.id)).toEqual(["card", "menu", "invoice"]);
    expect(QR_TEMPLATES.every((t) => t.sizeMm >= 15)).toBe(true);
  });
});
