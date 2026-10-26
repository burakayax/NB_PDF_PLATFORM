import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { createWorker } from "tesseract.js";
import { prepareForOcr, type OcrPrepared } from "./ocrPrep";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MAX_OCR_PAGES = 30; // OCR yavaş — sayfa sınırı (maliyet/süre)
const MAX_TEXT_CHARS = 180_000;

/**
 * Self-host dil verisi: tessdata_best (float LSTM). Ölçümde tessdata 4.0.0'a göre belirgin daha az hata
 * (soluk taramada %1,8 → %0,8), indirme boyutu da küçük (tur 4,8 + eng 12,8 MB sıkıştırılmış).
 * Klasör adı bilerek değişti: tarayıcıda IndexedDB'de önbelleklenmiş ESKİ model aynı adla kalıp
 * yeni modelin yerine geçmesin.
 */
const TESS_LANG_PATH = "/tesseract/lang-best";
/** Ön işleme görüntüyü ~300 DPI'a getirir; Tesseract'a bunu söyle (aksi hâlde DPI tahmin edip uyarı basar). */
const TESS_PARAMS = { user_defined_dpi: "300" } as const;

/** pdf.js ile sayfayı OCR için ~250 DPI'da çizer (en fazla ~12 MP) — 144 DPI'da küçük yazı okunmuyordu. */
const OCR_RENDER_SCALE = 3.5;
const OCR_MAX_PIXELS = 12_000_000;

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
 * PDF'in TÜM sayfalarında zaten yazı katmanı var mı? (İlk MAX_OCR_PAGES sayfa bakılır.)
 * Varsa OCR gereksizdir: sayfaları resme çevirip yeniden taramak hem kaliteyi hem boyutu bozar.
 * Okunamayan/şifreli dosyada false döner (araç eskisi gibi OCR'a devam eder).
 */
export async function pdfAlreadyHasText(file: File, minChars = 20): Promise<boolean> {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
    try {
      const n = Math.min(doc.numPages, MAX_OCR_PAGES);
      if (n === 0) return false;
      for (let i = 1; i <= n; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const chars = content.items.reduce(
          (sum, it) => sum + ("str" in it ? it.str.trim().length : 0),
          0,
        );
        if (chars < minChars) return false;
      }
      return true;
    } finally {
      await doc.destroy();
    }
  } catch {
    return false;
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

/**
 * Önizleme: her sayfayı canvas'a render edip JPEG data URL üretir; AYRICA pdf.js belgesini
 * AÇIK bırakır (döner) ki çağıran taraf her sayfa için metin katmanı (getTextContent + viewport)
 * kurabilsin. Belge iş bitince `doc.destroy()` ile kapatılmalı (bellek). `baseW/baseH` = ölçek-1
 * viewport boyutu → metin katmanı bu koordinatta kurulup görüntü genişliğine ölçeklenir.
 */
export type PdfPreviewPage = { dataUrl: string; baseW: number; baseH: number };
export async function renderPdfPreview(
  file: File,
  scale = 2,
  maxPages = MAX_OCR_PAGES,
): Promise<{ doc: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>; pages: PdfPreviewPage[] }> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const n = Math.min(doc.numPages, maxPages);
  const pages: PdfPreviewPage[] = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext("2d");
    if (ctx) await page.render({ canvasContext: ctx, viewport: vp }).promise;
    pages.push({ dataUrl: canvas.toDataURL("image/jpeg", 0.85), baseW: vp1.width, baseH: vp1.height });
  }
  return { doc, pages };
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

/** İşlenmiş görüntüdeki kutuyu kaynak görüntü pikselindeki (eksen hizalı) kutuya çevirir. */
function unmapBox(b: { x0: number; y0: number; x1: number; y1: number }, prep: OcrPrepared) {
  const pts = [prep.unmap(b.x0, b.y0), prep.unmap(b.x1, b.y0), prep.unmap(b.x0, b.y1), prep.unmap(b.x1, b.y1)];
  return {
    x0: Math.min(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    x1: Math.max(...pts.map((p) => p.x)),
    y1: Math.max(...pts.map((p) => p.y)),
  };
}

function unmapWords(words: OcrWord[], prep: OcrPrepared): OcrWord[] {
  if (prep.scale === 1 && prep.unmap(10, 20).x === 10 && prep.unmap(10, 20).y === 20) return words;
  return words.map((w) => ({ ...w, ...unmapBox(w, prep) }));
}

/** OCR satırı — Tesseract'ın KENDİ satır yapısı (kelime sırası + taban çizgisi + satır ölçüleri).
 * Koordinatlar kaynak görüntü pikselinde. */
export type OcrLineWord = OcrWord & { by: number | null; /** Tesseract güveni (0-100); yoksa 100. */ conf: number };
export type OcrLine = {
  words: OcrLineWord[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
  baseline: { x0: number; y0: number; x1: number; y1: number; has_baseline: boolean } | null;
  rowHeight: number;
  ascenders: number;
  descenders: number;
};

function extractLines(d: unknown): OcrLine[] {
  const out: OcrLine[] = [];
  type W = { text?: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number }; baseline?: { x0: number; y0: number; x1: number; y1: number; has_baseline?: boolean } };
  type L = { words?: W[]; bbox?: OcrLine["bbox"]; baseline?: OcrLine["baseline"]; rowAttributes?: { row_height?: number; ascenders?: number; descenders?: number } };
  const data = d as { blocks?: Array<{ paragraphs?: Array<{ lines?: L[] }> }> };
  for (const bl of data?.blocks ?? []) {
    for (const p of bl.paragraphs ?? []) {
      for (const ln of p.lines ?? []) {
        const words: OcrLineWord[] = [];
        for (const w of ln.words ?? []) {
          const t = (w?.text ?? "").trim();
          if (!t || !w.bbox) continue;
          // Düşük güvenli kelimeler ATILMAZ (sunucudaki OCR gibi): ölçümde eşik (30) formül/alt
          // simge gibi gerçek metni düşürüyordu; eşiksiz karakter hatası 4 test belgesinin hepsinde düştü.
          // Kelimenin KENDİ taban çizgisi (orta noktada) — iki sütunu birleştiren satırlarda doğru konum.
          const b = w.baseline;
          const mid = (w.bbox.x0 + w.bbox.x1) / 2;
          const by = b && b.has_baseline !== false && Number.isFinite(b.y0)
            ? (b.x1 !== b.x0 ? b.y0 + ((b.y1 - b.y0) * (mid - b.x0)) / (b.x1 - b.x0) : b.y0)
            : null;
          words.push({ text: t, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, by, conf: typeof w.confidence === "number" ? w.confidence : 100 });
        }
        if (!words.length || !ln.bbox) continue;
        out.push({
          words,
          bbox: ln.bbox,
          baseline: ln.baseline ?? null,
          rowHeight: Number(ln.rowAttributes?.row_height) || 0,
          ascenders: Number(ln.rowAttributes?.ascenders) || 0,
          descenders: Number(ln.rowAttributes?.descenders) || 0,
        });
      }
    }
  }
  return out;
}

function unmapLines(lines: OcrLine[], prep: OcrPrepared): OcrLine[] {
  const k = prep.scale;
  return lines.map((ln) => {
    const mid = (a: number, b: number) => (a + b) / 2;
    const words = ln.words.map((w) => {
      const bx = unmapBox(w, prep);
      const by = w.by == null ? null : prep.unmap(mid(w.x0, w.x1), w.by).y;
      return { ...w, ...bx, by };
    });
    let baseline = ln.baseline;
    if (baseline) {
      const a = prep.unmap(baseline.x0, baseline.y0);
      const b = prep.unmap(baseline.x1, baseline.y1);
      baseline = { ...baseline, x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    }
    return {
      ...ln,
      words,
      bbox: unmapBox(ln.bbox, prep),
      baseline,
      rowHeight: ln.rowHeight / k,
      ascenders: ln.ascenders / k,
      descenders: ln.descenders / k,
    };
  });
}

/**
 * Görüntüleri CİHAZDA OCR'lar; her sayfa için Tesseract'ın satır yapısını döner (kelime sırası
 * satır içinde korunur — kendi gruplamamız inen harfli kelimeleri ayrı satıra düşürüyordu).
 */
export async function ocrImagesToLines(
  sources: Array<HTMLCanvasElement | Blob>,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrLine[][]> {
  const totalPages = sources.length;
  let completed = 0;
  const worker = await createWorker("tur+eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: TESS_LANG_PATH,
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        const ratio = Math.min(1, (completed + m.progress) / Math.max(1, totalPages));
        onProgress?.({ page: completed + 1, totalPages, ratio });
      }
    },
  });
  const out: OcrLine[][] = [];
  try {
    await worker.setParameters(TESS_PARAMS);
    for (let i = 0; i < sources.length; i++) {
      const prep = await prepareForOcr(sources[i]);
      const ret = (await worker.recognize(
        prep.canvas as Parameters<typeof worker.recognize>[0],
        {},
        { blocks: true },
      )) as { data: unknown };
      out.push(unmapLines(extractLines(ret.data), prep));
      completed = i + 1;
      onProgress?.({ page: completed, totalPages, ratio: completed / Math.max(1, totalPages) });
    }
  } finally {
    await worker.terminate();
  }
  return out;
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
    langPath: TESS_LANG_PATH,
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        const ratio = Math.min(1, (completed + m.progress) / Math.max(1, totalPages));
        onProgress?.({ page: completed + 1, totalPages, ratio });
      }
    },
  });
  const out: OcrWord[][] = [];
  try {
    await worker.setParameters(TESS_PARAMS);
    for (let i = 0; i < sources.length; i++) {
      // Ön işleme (300 DPI'a ölçekle, ışığı düzleştir, eğriliği düzelt) → sonuç kaynak piksele geri çevrilir.
      const prep = await prepareForOcr(sources[i]);
      // blocks:true → kelime kutuları (bbox) dolar.
      const ret = (await worker.recognize(
        prep.canvas as Parameters<typeof worker.recognize>[0],
        {},
        { blocks: true },
      )) as { data: unknown };
      out.push(unmapWords(extractWords(ret.data), prep));
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
  /** true → her sayfa `<<<SAYFA n>>>` satırıyla başlar (sözleşme denetçisi sayfa no hesaplar). */
  pageMarkers = false,
): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const totalPages = Math.min(doc.numPages, MAX_OCR_PAGES);

  let completedPages = 0;
  const worker = await createWorker("tur+eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: TESS_LANG_PATH,
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
    await worker.setParameters(TESS_PARAMS);
    for (let i = 1; i <= totalPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(OCR_RENDER_SCALE, Math.sqrt(OCR_MAX_PIXELS / Math.max(1, base.width * base.height))),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const prep = await prepareForOcr(canvas);
      const {
        data: { text },
      } = await worker.recognize(prep.canvas);
      prep.canvas.width = 0;
      prep.canvas.height = 0;
      out += (pageMarkers ? `<<<SAYFA ${i}>>>\n` : "") + text + "\n\n";
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
