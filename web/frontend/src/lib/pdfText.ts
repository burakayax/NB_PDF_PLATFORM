import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved -- Vite ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/** Maliyet/istek sınırı: çıkarılan metin bu uzunlukta kesilir (~50K token sunucuda kırpılır). */
const MAX_TEXT_CHARS = 180_000;
const MAX_PAGES = 200;

/**
 * PDF'ten metni CİHAZDA çıkarır (pdf.js) — yalnız metin sunucuya gider (AI için),
 * PDF dosyası cihazda kalır. Şifreli/taranmış (metinsiz) PDF'lerde boş/az metin döner.
 */
export async function extractPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({ data, isEvalSupported: false });
  const doc = await task.promise;
  const pages = Math.min(doc.numPages, MAX_PAGES);
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
  return out.slice(0, MAX_TEXT_CHARS).trim();
}
