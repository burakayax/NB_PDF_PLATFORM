import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved -- Vite ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/** Maliyet/istek sınırı: çıkarılan metin bu uzunlukta kesilir (~50K token sunucuda kırpılır). */
const MAX_TEXT_CHARS = 180_000;
const MAX_PAGES = 200;

export type PdfTextResult = {
  text: string;
  pageCount: number;
  /** Taranmış/görüntü PDF olma ihtimali yüksek mi (metin yoğunluğu çok düşük)? */
  likelyScanned: boolean;
};

/**
 * PDF'ten metni CİHAZDA çıkarır (pdf.js) — yalnız metin sunucuya gider (AI için),
 * PDF dosyası cihazda kalır. Şifreli/taranmış (metinsiz) PDF'lerde boş/az metin döner.
 * `likelyScanned`: sayfa başına metin çok az → içerik büyük olasılıkla görüntü (OCR gerek).
 */
export async function extractPdfText(file: File): Promise<PdfTextResult> {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({ data, isEvalSupported: false });
  const doc = await task.promise;
  const pageCount = doc.numPages;
  const pages = Math.min(pageCount, MAX_PAGES);
  let out = "";
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => (typeof (it as { str?: unknown }).str === "string" ? (it as { str: string }).str : ""))
      .join(" ");
    out += line + "\n\n";
    if (out.length > MAX_TEXT_CHARS) break;
  }
  await doc.destroy();
  const text = out.slice(0, MAX_TEXT_CHARS).trim();
  // Sayfa başına ~250 karakterden az gerçek metin → içerik muhtemelen görüntü (taranmış).
  const likelyScanned = text.length < Math.max(250, pages * 250);
  return { text, pageCount, likelyScanned };
}
