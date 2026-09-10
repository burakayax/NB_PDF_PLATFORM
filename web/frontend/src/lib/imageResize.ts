import { decodeImage, extForFormat, type OutputFormat } from "./imageCompress";

/**
 * GÖRSEL YENİDEN BOYUTLANDIRMA ÇEKİRDEĞİ — tamamen cihazda.
 *
 * Ölçekleme `pica` ile yapılır: tarayıcının `drawImage` ölçeklemesi hızlı ama
 * kabadır (küçültmede detay kaybı/tırtık); pica Lanczos ailesinden `mks2013`
 * süzgecini kullanır — küçültmeyi ve keskinliği birlikte yürütür, sonuç gözle
 * görülür biçimde daha net olur. pica WebAssembly + Web Worker kullandığı için
 * arayüz donmaz ve iş ana iş parçacığından çıkar.
 *
 * pica YALNIZCA bu araç açıldığında indirilir (dinamik import) — ana paket şişmez.
 */

export type FitMode = "cover" | "contain" | "stretch";

export type ResizeOptions = {
  width: number;
  height: number;
  fit: FitMode;
  format: OutputFormat;
  /** 0.2–0.95 (PNG'de yok sayılır). */
  quality: number;
  /** "contain" modunda boşlukların rengi; "transparent" → saydam (PNG/WebP). */
  background: string;
};

export type ResizeOutcome = {
  blob: Blob;
  type: string;
  ext: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  originalSize: number;
  /** Kaynaktan büyütüldü mü (kalite yaratılamaz, yalnızca esnetilir). */
  upscaled: boolean;
};

type PicaInstance = {
  resize: (
    from: HTMLCanvasElement | ImageBitmap | HTMLImageElement,
    to: HTMLCanvasElement,
    options?: { filter?: string; unsharpAmount?: number; unsharpRadius?: number; unsharpThreshold?: number },
  ) => Promise<HTMLCanvasElement>;
};

let picaPromise: Promise<PicaInstance> | null = null;

/** pica'yı bir kez yükle ve tek örneği paylaş (her işte worker havuzu kurmasın). */
async function getPica(): Promise<PicaInstance> {
  if (!picaPromise) {
    picaPromise = import("pica").then((m) => {
      const factory = (m.default ?? m) as unknown as (o?: unknown) => PicaInstance;
      return factory();
    });
  }
  return picaPromise;
}

/** Kaynaktan hangi bölgenin alınacağı + hedefte nereye çizileceği. */
function planGeometry(sw: number, sh: number, opts: ResizeOptions) {
  const tw = Math.max(1, Math.round(opts.width));
  const th = Math.max(1, Math.round(opts.height));

  if (opts.fit === "stretch") {
    return { crop: { x: 0, y: 0, w: sw, h: sh }, draw: { x: 0, y: 0, w: tw, h: th }, tw, th };
  }

  if (opts.fit === "cover") {
    // Hedef oranı kaynaktan ortadan kırparak yakala — boşluk kalmaz.
    const scale = Math.max(tw / sw, th / sh);
    const cw = Math.min(sw, Math.round(tw / scale));
    const ch = Math.min(sh, Math.round(th / scale));
    return {
      crop: { x: Math.round((sw - cw) / 2), y: Math.round((sh - ch) / 2), w: cw, h: ch },
      draw: { x: 0, y: 0, w: tw, h: th },
      tw,
      th,
    };
  }

  // contain: tamamı sığar, artan yerler zemin rengiyle dolar.
  const scale = Math.min(tw / sw, th / sh);
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  return {
    crop: { x: 0, y: 0, w: sw, h: sh },
    draw: { x: Math.round((tw - dw) / 2), y: Math.round((th - dh) / 2), w: dw, h: dh },
    tw,
    th,
  };
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

function releaseCanvas(c: HTMLCanvasElement): void {
  c.width = 0;
  c.height = 0;
}

function encode(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (b) => resolve(b && b.type === format ? b : null),
      format,
      format === "image/png" ? undefined : quality,
    );
  });
}

/**
 * Görseli istenen piksel ölçüsüne getir. Kalite önceliklidir: kırpma kaynağın
 * kendi çözünürlüğünde yapılır, ölçekleme tek adımda pica ile uygulanır.
 */
export async function resizeImage(file: File, opts: ResizeOptions): Promise<ResizeOutcome> {
  const dec = await decodeImage(file);
  let cropCanvas: HTMLCanvasElement | null = null;
  let scaledCanvas: HTMLCanvasElement | null = null;
  let outCanvas: HTMLCanvasElement | null = null;
  try {
    const sw = dec.width;
    const sh = dec.height;
    const plan = planGeometry(sw, sh, opts);

    // 1) Gerekliyse kaynağı kendi çözünürlüğünde kırp (yeniden örnekleme YOK).
    let source: HTMLCanvasElement | ImageBitmap | HTMLImageElement;
    if (plan.crop.w !== sw || plan.crop.h !== sh) {
      cropCanvas = makeCanvas(plan.crop.w, plan.crop.h);
      const cctx = cropCanvas.getContext("2d");
      if (!cctx) throw new Error("canvas 2d context yok");
      cctx.drawImage(
        dec.source,
        plan.crop.x,
        plan.crop.y,
        plan.crop.w,
        plan.crop.h,
        0,
        0,
        plan.crop.w,
        plan.crop.h,
      );
      source = cropCanvas;
    } else {
      source = dec.source as HTMLCanvasElement | ImageBitmap | HTMLImageElement;
    }

    // 2) Asıl ölçekleme — pica (mks2013: ölçekleme + keskinleştirme birlikte).
    scaledCanvas = makeCanvas(plan.draw.w, plan.draw.h);
    const pica = await getPica();
    await pica.resize(source, scaledCanvas, { filter: "mks2013" });

    // 3) Hedef tuvale yerleştir (contain'de zemin, JPEG'de saydamlık yok).
    const opaque = opts.format === "image/jpeg" || opts.background !== "transparent";
    const needsCompose = plan.draw.w !== plan.tw || plan.draw.h !== plan.th || opaque;
    if (needsCompose) {
      outCanvas = makeCanvas(plan.tw, plan.th);
      const octx = outCanvas.getContext("2d");
      if (!octx) throw new Error("canvas 2d context yok");
      if (opaque) {
        octx.fillStyle = opts.background === "transparent" ? "#ffffff" : opts.background;
        octx.fillRect(0, 0, plan.tw, plan.th);
      }
      octx.drawImage(scaledCanvas, plan.draw.x, plan.draw.y);
    } else {
      outCanvas = scaledCanvas;
      scaledCanvas = null;
    }

    const blob = await encode(outCanvas, opts.format, opts.quality);
    if (!blob) throw new Error("encode failed");

    return {
      blob,
      type: opts.format,
      ext: extForFormat(opts.format),
      width: plan.tw,
      height: plan.th,
      sourceWidth: sw,
      sourceHeight: sh,
      originalSize: file.size,
      upscaled: plan.draw.w > plan.crop.w || plan.draw.h > plan.crop.h,
    };
  } finally {
    if (cropCanvas) releaseCanvas(cropCanvas);
    if (scaledCanvas) releaseCanvas(scaledCanvas);
    if (outCanvas) releaseCanvas(outCanvas);
    dec.release();
  }
}

/**
 * Sosyal medya ölçüleri — platformların 2026'daki güncel önerileri.
 * Kullanıcı ölçüyü ezberlemek zorunda kalmasın diye hazır seçenekler.
 */
export type SizePreset = {
  id: string;
  tr: string;
  en: string;
  w: number;
  h: number;
  group: "instagram" | "facebook" | "x" | "linkedin" | "youtube" | "web";
};

export const SIZE_PRESETS: SizePreset[] = [
  { id: "ig-square", tr: "Instagram gönderi (kare)", en: "Instagram post (square)", w: 1080, h: 1080, group: "instagram" },
  { id: "ig-portrait", tr: "Instagram gönderi (dikey 4:5)", en: "Instagram post (portrait 4:5)", w: 1080, h: 1350, group: "instagram" },
  { id: "ig-story", tr: "Instagram hikâye / Reels", en: "Instagram story / Reels", w: 1080, h: 1920, group: "instagram" },
  { id: "fb-shared", tr: "Facebook paylaşım görseli", en: "Facebook shared image", w: 1200, h: 630, group: "facebook" },
  { id: "fb-cover", tr: "Facebook kapak fotoğrafı", en: "Facebook cover photo", w: 851, h: 315, group: "facebook" },
  { id: "fb-story", tr: "Facebook hikâye", en: "Facebook story", w: 1080, h: 1920, group: "facebook" },
  { id: "x-post", tr: "X (Twitter) gönderi", en: "X (Twitter) in-stream", w: 1600, h: 900, group: "x" },
  { id: "x-header", tr: "X (Twitter) kapak", en: "X (Twitter) header", w: 1500, h: 500, group: "x" },
  { id: "li-post", tr: "LinkedIn gönderi (kare)", en: "LinkedIn post (square)", w: 1200, h: 1200, group: "linkedin" },
  { id: "li-cover", tr: "LinkedIn şirket kapağı", en: "LinkedIn company cover", w: 1128, h: 191, group: "linkedin" },
  { id: "yt-thumb", tr: "YouTube küçük resmi", en: "YouTube thumbnail", w: 1280, h: 720, group: "youtube" },
  { id: "yt-banner", tr: "YouTube kanal başlığı", en: "YouTube channel banner", w: 2560, h: 1440, group: "youtube" },
  { id: "web-fullhd", tr: "Web görseli (Full HD)", en: "Web image (Full HD)", w: 1920, h: 1080, group: "web" },
  { id: "web-og", tr: "Site önizleme görseli (OG)", en: "Link preview image (OG)", w: 1200, h: 630, group: "web" },
];
