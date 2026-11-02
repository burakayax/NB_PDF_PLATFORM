/**
 * Cihazda (pdf.js) sayfa küçük resmi çıkarma — QR ve İçindekiler araçlarının önizlemesi için.
 * Dosya sunucuya gitmez. Şifreli/bozuk dosyada `PdfThumbError` fırlatır.
 */
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export class PdfThumbError extends Error {
  constructor(public readonly kind: "encrypted" | "broken") {
    super(kind);
    this.name = "PdfThumbError";
  }
}

export type PdfThumb = {
  pageCount: number;
  /** İlk sayfa (ya da istenen sayfa) küçük resmi — data URL. */
  dataUrl: string;
  /** Sayfa ölçüsü, nokta (pt). */
  widthPt: number;
  heightPt: number;
};

async function open(bytes: Uint8Array) {
  try {
    // pdf.js veriyi devralabilir; çağıranın bayt dizisi bozulmasın.
    return await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  } catch (e) {
    const ad = (e as { name?: string })?.name;
    throw new PdfThumbError(ad === "PasswordException" ? "encrypted" : "broken");
  }
}

/** Belgeyi açar, sayfa sayısını ve istenen sayfanın küçük resmini döndürür. */
export async function renderPdfPage(
  bytes: Uint8Array,
  pageIndex: number,
  maxWidthPx: number,
): Promise<PdfThumb> {
  const doc = await open(bytes);
  try {
    const n = doc.numPages;
    const page = await doc.getPage(Math.min(Math.max(pageIndex, 0), n - 1) + 1);
    const base = page.getViewport({ scale: 1 });
    const scale = maxWidthPx / base.width;
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PdfThumbError("broken");
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return {
      pageCount: n,
      dataUrl: canvas.toDataURL("image/jpeg", 0.8),
      widthPt: base.width,
      heightPt: base.height,
    };
  } finally {
    void doc.destroy();
  }
}
