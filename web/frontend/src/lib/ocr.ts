import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved -- Vite ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { createWorker } from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MAX_OCR_PAGES = 30; // OCR yavaş — sayfa sınırı (maliyet/süre)
const MAX_TEXT_CHARS = 180_000;

export type OcrProgress = { page: number; totalPages: number; ratio: number };

/**
 * Taranmış / görüntü ağırlıklı PDF'i CİHAZDA OCR ile metne çevirir (Tesseract.js,
 * Türkçe + İngilizce). Asset'ler self-host (`/tesseract/`) — CSP `worker-src
 * 'self' blob:` ile uyumlu, CDN'e gitmez. Dosya cihazdan çıkmaz. Yavaştır
 * (sayfa başına birkaç saniye); ilk kullanımda dil verisi bir kez indirilir.
 */
export async function ocrPdfToText(
  file: File,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const totalPages = Math.min(doc.numPages, MAX_OCR_PAGES);

  const worker = await createWorker("tur+eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
  });

  let out = "";
  try {
    for (let i = 1; i <= totalPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const {
        data: { text },
      } = await worker.recognize(canvas);
      out += text + "\n\n";
      onProgress?.({ page: i, totalPages, ratio: i / totalPages });
      canvas.width = 0;
      canvas.height = 0; // belleği serbest bırak
      if (out.length > MAX_TEXT_CHARS) break;
    }
  } finally {
    await worker.terminate();
    await doc.destroy();
  }
  return out.slice(0, MAX_TEXT_CHARS).trim();
}
