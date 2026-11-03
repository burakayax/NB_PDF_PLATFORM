/**
 * PDF → sayfa sayfa OKUNACAK metin (cihazda). Paragraflar, pdfToUdf'deki satır/paragraf gruplamasıyla kurulur;
 * her paragraf noktalamayla bitirilir ki ses motoru paragraf sonunda doğal bir duraksama yapsın.
 */
import { itemsToParagraphs, type TextItem } from "./pdfToUdf";

/** Bir paragrafı konuşma için bitirir: sonunda nokta/ünlem/soru yoksa nokta ekler. */
export function endParagraph(p: string): string {
  const t = p.trim();
  if (!t) return "";
  return /[.!?…:;]$/.test(t) ? t : `${t}.`;
}

/** Sayfanın metin parçalarından okunacak metin. */
export function pageSpeechText(items: TextItem[]): string {
  return itemsToParagraphs(items).map(endParagraph).filter(Boolean).join(" ");
}

export async function readPdfPageTexts(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of content.items) {
      const t = it as { str?: string; transform?: number[]; width?: number; height?: number };
      if (typeof t.str !== "string" || !t.transform) continue;
      items.push({ str: t.str, x: t.transform[4] ?? 0, y: t.transform[5] ?? 0, w: t.width ?? 0, h: t.height || Math.abs(t.transform[3] ?? 10) });
    }
    pages.push(pageSpeechText(items));
  }
  return pages;
}
