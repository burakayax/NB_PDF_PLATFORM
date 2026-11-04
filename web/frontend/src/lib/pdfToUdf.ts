/**
 * PDF'ten UDF'ye (metin tabanlı PDF). Cihazda çalışır; dosya sunucuya gitmez.
 *
 * pdf.js metin parçalarını satırlara, satırları paragraflara toplar: aynı yükseklikteki parçalar bir satır,
 * satırlar arası boşluk normal satır aralığından belirgin büyükse yeni paragraf. Sayfalar arasına sayfa kesmesi
 * konur. Yazı tipi/boyut/kalın bilgisi korunmaz (düz metin + paragraf); UYAP'ta yeniden biçimlenebilir.
 * Taranmış (metni olmayan) PDF'te `ScannedPdfError` fırlatılır: çağıran OCR'a yönlendirir.
 */
import type { UdfBlock, UdfDocument } from "./udf";
import { emptyParagraph } from "./udfWrite";
import { newUdfDocument } from "./udfConvert";

export type TextItem = { str: string; x: number; y: number; w: number; h: number };

export class ScannedPdfError extends Error {
  constructor() {
    super("PDF'te seçilebilir metin yok (taranmış olabilir).");
    this.name = "ScannedPdfError";
  }
}

/** Bir sayfanın metin parçalarını paragraf metinlerine çevirir (satır içi boşluklar korunur). */
export function itemsToParagraphs(items: TextItem[]): string[] {
  return itemsToParagraphsH(items).map((p) => p.text);
}

/** Aynı gruplama; her paragrafın yazı yüksekliği (en büyük satır) da döner (başlık tespiti için). */
export function itemsToParagraphsH(items: TextItem[]): { text: string; h: number }[] {
  const real = items.filter((i) => i.str.trim().length > 0);
  if (real.length === 0) return [];
  // Yukarıdan aşağı (PDF y yukarı doğru artar), aynı satırda soldan sağa.
  const sorted = [...real].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; h: number; items: TextItem[] }[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    const tol = Math.max(2, (last?.h ?? it.h) * 0.5);
    if (last && Math.abs(last.y - it.y) <= tol) {
      last.items.push(it);
      last.h = Math.max(last.h, it.h);
    } else {
      lines.push({ y: it.y, h: it.h || 10, items: [it] });
    }
  }
  const texts = lines.map((l) => {
    const row = l.items.sort((a, b) => a.x - b.x);
    let out = "";
    let prevEnd = -Infinity;
    for (const it of row) {
      const gap = it.x - prevEnd;
      if (out && gap > l.h * 0.15 && !out.endsWith(" ") && !it.str.startsWith(" ")) out += " ";
      out += it.str;
      prevEnd = it.x + it.w;
    }
    return out.replace(/\s+$/g, "");
  });
  // Paragraf ayrımı: satır aralığı tipik aralığın 1.6 katından büyükse.
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) gaps.push(lines[i - 1]!.y - lines[i]!.y);
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const typical = sortedGaps.length ? sortedGaps[Math.floor((sortedGaps.length - 1) / 2)]! : 0;
  const paras: { text: string; h: number }[] = [];
  let cur = texts[0] ?? "";
  let curH = lines[0]?.h ?? 10;
  for (let i = 1; i < texts.length; i++) {
    const newPara = typical > 0 && gaps[i - 1]! > typical * 1.6;
    if (newPara) {
      paras.push({ text: cur, h: curH });
      cur = texts[i]!;
      curH = lines[i]!.h;
    } else {
      // Satır sonu tire ile bölünmüş kelime birleştirilmez (Türkçede yanlış birleşme riski); boşlukla katılır.
      cur += ` ${texts[i]}`;
      curH = Math.max(curH, lines[i]!.h);
    }
  }
  paras.push({ text: cur, h: curH });
  return paras;
}

/** Sayfa başına paragraf metinlerinden UdfDocument kurar. */
export function pagesToUdf(pages: string[][]): UdfDocument {
  const blocks: UdfBlock[] = [];
  pages.forEach((paras, pi) => {
    if (pi > 0 && blocks.length) blocks.push({ kind: "page-break" });
    paras.forEach((t, i) => {
      blocks.push({ ...emptyParagraph(), alignment: "justify", runs: [{ text: t }] });
      if (i < paras.length - 1) blocks.push(emptyParagraph());
    });
  });
  return newUdfDocument(blocks);
}

/** PDF dosyasından UdfDocument. pdf.js yalnızca bu araç sayfasında yüklenir. */
export async function pdfToUdf(file: File): Promise<UdfDocument> {
  const pdfjsLib = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const pages: string[][] = [];
  let chars = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of content.items) {
      const t = it as { str?: string; transform?: number[]; width?: number; height?: number };
      if (typeof t.str !== "string" || !t.transform) continue;
      items.push({ str: t.str, x: t.transform[4] ?? 0, y: t.transform[5] ?? 0, w: t.width ?? 0, h: t.height || Math.abs(t.transform[3] ?? 10) });
    }
    const paras = itemsToParagraphs(items);
    chars += paras.join("").length;
    pages.push(paras);
  }
  if (chars < 20) throw new ScannedPdfError();
  return pagesToUdf(pages);
}
