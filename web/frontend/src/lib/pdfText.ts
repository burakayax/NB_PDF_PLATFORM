import * as pdfjsLib from "pdfjs-dist";
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
  let pagesWithText = 0;
  let pagesRead = 0;
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => (typeof (it as { str?: unknown }).str === "string" ? (it as { str: string }).str : ""))
      .join(" ");
    out += line + "\n\n";
    pagesRead++;
    if (line.replace(/\s+/g, "").length >= 30) pagesWithText++;
    if (out.length > MAX_TEXT_CHARS) break;
  }
  await doc.destroy();
  const text = out.slice(0, MAX_TEXT_CHARS).trim();
  // Taranmış sayılması için metnin neredeyse hiç olmaması ya da sayfaların çoğunun metinsiz olması
  // gerekir. Eskiden "sayfa başına 250 karakter" kuralı kısa notları ve slayt PDF'lerini yanlışlıkla
  // "taranmış" sayıyordu.
  const likelyScanned = text.replace(/\s+/g, "").length < 30 || pagesWithText / Math.max(1, pagesRead) < 0.4;
  return { text, pageCount, likelyScanned };
}
