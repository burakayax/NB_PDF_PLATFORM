import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved -- Vite ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { createWorker } from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MAX_OCR_PAGES = 30; // OCR yavaş — sayfa sınırı (maliyet/süre)
const MAX_TEXT_CHARS = 180_000;

export type OcrProgress = { page: number; totalPages: number; ratio: number };

/** PDF'in toplam sayfa sayısını hızlıca döndürür (render etmeden). Hata/şifre → 0. */
export async function getPdfPageCount(file: File): Promise<number> {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
    const n = doc.numPages;
    await doc.destroy();
    return n;
  } catch {
    return 0;
  }
}

/**
 * Bir PDF'in sayfalarını canvas'lara render eder (aranabilir PDF üretimi için).
 * `scale` OCR doğruluğu için ~2 önerilir. `maxPages` maliyet/süre sınırı.
 */
export async function renderPdfToCanvases(
  file: File,
  scale = 2,
  maxPages = MAX_OCR_PAGES,
): Promise<HTMLCanvasElement[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const n = Math.min(doc.numPages, maxPages);
  const canvases: HTMLCanvasElement[] = [];
  try {
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      canvases.push(canvas);
    }
  } finally {
    await doc.destroy();
  }
  return canvases;
}

/** Bir görsel dosyayı (JPG/PNG/WebP) canvas'a yükler. */
export function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Görsel okunamadı."));
    };
    img.src = url;
  });
}

/** OCR ile bulunan tek kelime — koordinatlar KAYNAK GÖRÜNTÜ pikselinde (sol-üst origin). */
export type OcrWord = { text: string; x0: number; y0: number; x1: number; y1: number };

/** Bir Tesseract sayfa sonucundan güvenli şekilde kelime+konum listesi çıkarır. */
function extractWords(d: unknown): OcrWord[] {
  const res: OcrWord[] = [];
  const push = (w: {
    text?: string;
    confidence?: number;
    bbox?: { x0: number; y0: number; x1: number; y1: number };
  }) => {
    const t = (w?.text ?? "").trim();
    if (!t) return;
    if (typeof w.confidence === "number" && w.confidence < 30) return; // güvensiz tanımayı atla
    const b = w.bbox;
    if (!b) return;
    res.push({ text: t, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
  };
  const data = d as { words?: unknown[]; blocks?: unknown[] };
  if (Array.isArray(data?.words) && data.words.length) {
    (data.words as Parameters<typeof push>[0][]).forEach(push);
  } else if (Array.isArray(data?.blocks)) {
    for (const bl of data.blocks as Array<{ paragraphs?: Array<{ lines?: Array<{ words?: unknown[] }> }> }>) {
      for (const p of bl.paragraphs ?? [])
        for (const ln of p.lines ?? [])
          for (const w of (ln.words ?? []) as Parameters<typeof push>[0][]) push(w);
    }
  }
  return res;
}

/**
 * Görüntüleri (taranan sayfalar) CİHAZDA OCR'lar ve her sayfa için kelime+konum
 * listesi döner (Tesseract.js, Türkçe + İngilizce). Aranabilir PDF üretmek için
 * kullanılır. Asset'ler self-host (`/tesseract/`) — dosya cihazdan çıkmaz.
 */
export async function ocrImagesToWords(
  sources: Array<HTMLCanvasElement | Blob>,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrWord[][]> {
  const totalPages = sources.length;
  let completed = 0;
  const worker = await createWorker("tur+eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        const ratio = Math.min(1, (completed + m.progress) / Math.max(1, totalPages));
        onProgress?.({ page: completed + 1, totalPages, ratio });
      }
    },
  });
  const out: OcrWord[][] = [];
  try {
    for (let i = 0; i < sources.length; i++) {
      // blocks:true → kelime kutuları (bbox) dolar.
      const ret = (await worker.recognize(
        sources[i] as Parameters<typeof worker.recognize>[0],
        {},
        { blocks: true },
      )) as { data: unknown };
      out.push(extractWords(ret.data));
      completed = i + 1;
      onProgress?.({ page: completed, totalPages, ratio: completed / Math.max(1, totalPages) });
    }
  } finally {
    await worker.terminate();
  }
  return out;
}

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

  let completedPages = 0;
  const worker = await createWorker("tur+eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
    // Sayfa-içi ilerlemeyi de yansıt → şerit akıcı ilerler (0'da takılı kalmaz).
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        const ratio = Math.min(1, (completedPages + m.progress) / totalPages);
        onProgress?.({ page: completedPages + 1, totalPages, ratio });
      }
    },
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
      completedPages = i;
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
