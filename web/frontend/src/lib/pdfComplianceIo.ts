/**
 * Uyumluluk aracının dosya okuyan / düzelten tarafı (pdf.js + pdf-lib, ikisi de tembel yüklenir).
 *
 * DÜRÜSTLÜK: boyut düzeltmesi sayfaları görüntüye çevirir → yazı artık seçilemez ve
 * e-imza/kaşe korunmaz. Arayüz bunu kullanıcıya düğmeden ÖNCE söyler.
 */
import type { Limits, PdfFacts } from "./pdfCompliance";
import { A4_H, A4_W, isA4 } from "./pdfCompliance";

async function loadPdfjs() {
  const lib = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  lib.GlobalWorkerOptions.workerSrc = worker;
  return lib;
}

export async function readPdfFacts(file: File): Promise<PdfFacts> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  let doc;
  try {
    doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  } catch (e) {
    if ((e as { name?: string }).name === "PasswordException") {
      return { bytes: file.size, pages: 0, encrypted: true, pageSizes: [], hasText: false };
    }
    throw e;
  }
  const pageSizes: { w: number; h: number }[] = [];
  let chars = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    pageSizes.push({ w: vp.width, h: vp.height });
    if (n <= 5 && chars < 20) {
      const tc = await page.getTextContent();
      for (const it of tc.items) chars += ((it as { str?: string }).str ?? "").trim().length;
    }
  }
  return { bytes: file.size, pages: doc.numPages, encrypted: false, pageSizes, hasText: chars >= 20 };
}

export type FixResult = { bytes: Uint8Array; rasterized: boolean; reachedSize: boolean };

/** Sayfaları A4'e sığdırır (metin korunur). Sayfa yönü kaynağa göre seçilir. */
export async function fixToA4(file: File): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(await file.arrayBuffer());
  const out = await PDFDocument.create();
  for (const p of src.getPages()) {
    const { width: w, height: h } = p.getSize();
    const embedded = await out.embedPage(p);
    if (isA4(w, h)) {
      const pg = out.addPage([w, h]);
      pg.drawPage(embedded);
      continue;
    }
    const landscape = w > h;
    const pw = landscape ? A4_H : A4_W;
    const ph = landscape ? A4_W : A4_H;
    const k = Math.min(pw / w, ph / h);
    const pg = out.addPage([pw, ph]);
    pg.drawPage(embedded, { x: (pw - w * k) / 2, y: (ph - h * k) / 2, width: w * k, height: h * k });
  }
  return out.save();
}

/**
 * Boyutu küçültür: sayfaları görüntüye çevirip JPEG kalitesini ve çözünürlüğü kademeli
 * düşürür; sınırın altına inen İLK (en yüksek kaliteli) sonucu verir. İnemezse en küçüğünü.
 */
export async function fixSize(file: File, limits: Limits, onProgress?: (p: number) => void): Promise<FixResult> {
  const pdfjs = await loadPdfjs();
  const { PDFDocument } = await import("pdf-lib");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const max = limits.maxBytes ?? Infinity;
  const ladder: [number, number][] = [[1.6, 0.8], [1.4, 0.65], [1.2, 0.5], [1.0, 0.4], [0.8, 0.3], [0.65, 0.25]];
  let best: Uint8Array | null = null;
  for (let step = 0; step < ladder.length; step++) {
    const [scale, q] = ladder[step]!;
    const out = await PDFDocument.create();
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.ceil(vp.width);
      c.height = Math.ceil(vp.height);
      await page.render({ canvasContext: c.getContext("2d")!, viewport: vp, canvas: c } as never).promise;
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("jpeg"))), "image/jpeg", q));
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      let pw = base.width;
      let ph = base.height;
      if (limits.a4Only) {
        const landscape = base.width > base.height;
        pw = landscape ? A4_H : A4_W;
        ph = landscape ? A4_W : A4_H;
      }
      const k = Math.min(pw / base.width, ph / base.height);
      const pg = out.addPage([pw, ph]);
      pg.drawImage(img, { x: (pw - base.width * k) / 2, y: (ph - base.height * k) / 2, width: base.width * k, height: base.height * k });
      onProgress?.((step + n / doc.numPages) / ladder.length);
    }
    const bytes = await out.save();
    best = bytes;
    if (bytes.length <= max) return { bytes, rasterized: true, reachedSize: true };
  }
  return { bytes: best!, rasterized: true, reachedSize: (best?.length ?? Infinity) <= max };
}
