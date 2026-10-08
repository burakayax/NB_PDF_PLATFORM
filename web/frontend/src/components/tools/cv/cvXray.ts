import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { TextItem } from "./cvAnalysis";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Üretilen PDF'ten metin öğelerini AKIŞ SIRASIYLA ve konumlarıyla çıkarır — bir başvuru
 * sisteminin ayrıştırıcısının gördüğü ham veri. Tamamı cihazda (pdf.js).
 */
export async function extractTextItems(bytes: Uint8Array): Promise<{ items: TextItem[]; pages: number }> {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  const items: TextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const raw of content.items) {
      const it = raw as { str?: string; transform?: number[]; width?: number; height?: number };
      if (typeof it.str !== "string" || !it.transform) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0, h: it.height ?? Math.abs(it.transform[3]) ?? 10, page: p });
    }
  }
  const pages = doc.numPages;
  await doc.destroy();
  return { items, pages };
}
