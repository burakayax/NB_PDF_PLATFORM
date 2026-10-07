/**
 * AI FOTOĞRAF STÜDYOSU — kadraj hesabı, birleştirme, uygunluk denetimi ve dışa aktarma.
 * Tamamı tarayıcıda çalışır; hiçbir veri dışarı gönderilmez.
 */
import { computeMatte, detectFace, type FaceInfo, type ModelProgress } from "./ai";
import { SOLID_BG, type BgId, type PhotoPreset } from "./presets";

/** Çalışma çözünürlüğü sınırı — bellek ve hız için. Çıktılar bunun çok altında. */
const MAX_WORK_SIDE = 2600;

export type BaseAnalysis = {
  src: HTMLCanvasElement;
  matte: HTMLCanvasElement;
  face: FaceInfo | null;
  originalW: number;
  originalH: number;
};

export type Leveled = {
  src: HTMLCanvasElement;
  matte: HTMLCanvasElement;
  fg: HTMLCanvasElement;
  face: FaceInfo | null;
  crownY: number;
  chinY: number;
  centerX: number;
  headH: number;
  /** Yüz bulunamadıysa matte kutusundan tahmin edildi. */
  estimated: boolean;
  /** Uygulanan döndürme (derece). */
  rotatedBy: number;
  /** Yüz bölgesinin ortalama parlaklığı (0–1). */
  faceLuma: number;
};

export class PhotoLoadError extends Error {
  constructor(public code: "decode" | "tooSmall") {
    super(code);
  }
}

export async function loadToCanvas(file: Blob): Promise<{ canvas: HTMLCanvasElement; w: number; h: number }> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoLoadError("decode");
  }
  const w0 = bmp.width;
  const h0 = bmp.height;
  if (Math.min(w0, h0) < 200) {
    bmp.close();
    throw new PhotoLoadError("tooSmall");
  }
  const s = Math.min(1, MAX_WORK_SIDE / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.round(w0 * s);
  c.height = Math.round(h0 * s);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return { canvas: c, w: w0, h: h0 };
}

/** Yüklenen dosyayı bir kez çözümler: matte + yüz noktaları. */
export async function analyzeBase(file: Blob, onProgress?: ModelProgress): Promise<BaseAnalysis> {
  const { canvas, w, h } = await loadToCanvas(file);
  const [matte, face] = await Promise.all([computeMatte(canvas, onProgress), detectFace(canvas, onProgress)]);
  return { src: canvas, matte, face, originalW: w, originalH: h };
}

function rotateCanvas(c: HTMLCanvasElement, deg: number, cx: number, cy: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = c.width;
  out.height = c.height;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  ctx.drawImage(c, 0, 0);
  return out;
}

function buildFg(src: HTMLCanvasElement, matte: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const fg = document.createElement("canvas");
  fg.width = w;
  fg.height = h;
  const fctx = fg.getContext("2d", { willReadFrequently: true })!;
  fctx.drawImage(src, 0, 0);
  const img = fctx.getImageData(0, 0, w, h);
  const m = matte.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  const d = img.data;
  for (let i = 0; i < w * h; i++) d[i * 4 + 3] = m[i * 4];
  fctx.putImageData(img, 0, 0);
  return fg;
}

/** Matte'te, yüz bandındaki en üst dolu satır (saç tepesi). */
function findCrown(matte: HTMLCanvasElement, cx: number, halfBand: number, limitY: number): number | null {
  const w = matte.width;
  const x0 = Math.max(0, Math.floor(cx - halfBand));
  const x1 = Math.min(w, Math.ceil(cx + halfBand));
  const bw = x1 - x0;
  if (bw < 8) return null;
  const maxY = Math.max(1, Math.min(matte.height, Math.round(limitY)));
  const data = matte.getContext("2d", { willReadFrequently: true })!.getImageData(x0, 0, bw, maxY).data;
  const need = Math.max(3, Math.round(bw * 0.04));
  for (let y = 0; y < maxY; y++) {
    let n = 0;
    for (let x = 0; x < bw; x++) if (data[(y * bw + x) * 4] > 140) n++;
    if (n >= need) return y;
  }
  return null;
}

function matteBox(matte: HTMLCanvasElement): { x0: number; y0: number; x1: number; y1: number } | null {
  // Hızlı: 1/8 ölçekte tara
  const s = 8;
  const w = Math.max(1, Math.floor(matte.width / s));
  const h = Math.max(1, Math.floor(matte.height / s));
  const t = document.createElement("canvas");
  t.width = w;
  t.height = h;
  const c = t.getContext("2d", { willReadFrequently: true })!;
  c.drawImage(matte, 0, 0, w, h);
  const d = c.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4] > 140) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  return { x0: x0 * s, y0: y0 * s, x1: (x1 + 1) * s, y1: (y1 + 1) * s };
}

function meanLuma(src: HTMLCanvasElement, cx: number, cy: number, r: number): number {
  const x = Math.max(0, Math.round(cx - r));
  const y = Math.max(0, Math.round(cy - r));
  const w = Math.max(2, Math.min(src.width - x, Math.round(r * 2)));
  const h = Math.max(2, Math.min(src.height - y, Math.round(r * 2)));
  const d = src.getContext("2d", { willReadFrequently: true })!.getImageData(x, y, w, h).data;
  let s = 0;
  const n = w * h;
  for (let i = 0; i < n; i++) s += 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
  return s / n / 255;
}

/** Başı düzelt (isteğe bağlı) ve kadraj ölçülerini hesapla. */
export async function level(base: BaseAnalysis, straighten: boolean): Promise<Leveled> {
  let src = base.src;
  let matte = base.matte;
  let face = base.face;
  let rotatedBy = 0;

  if (face && straighten && Math.abs(face.rollDeg) > 0.6 && Math.abs(face.rollDeg) < 25) {
    const cx = (face.eyeL.x + face.eyeR.x) / 2;
    const cy = (face.eyeL.y + face.eyeR.y) / 2;
    rotatedBy = -face.rollDeg;
    src = rotateCanvas(base.src, rotatedBy, cx, cy);
    matte = rotateCanvas(base.matte, rotatedBy, cx, cy);
    face = await detectFace(src);
  }

  const fg = buildFg(src, matte);
  let crownY: number;
  let chinY: number;
  let centerX: number;
  let estimated = false;
  let faceLuma = 0.55;

  if (face) {
    const eyeMidX = (face.eyeL.x + face.eyeR.x) / 2;
    centerX = eyeMidX * 0.55 + face.chin.x * 0.45;
    chinY = face.chin.y;
    const faceH = face.chin.y - face.foreheadTop.y;
    const found = findCrown(matte, centerX, face.faceWidth * 0.62, face.foreheadTop.y + faceH * 0.05);
    // Saç tepesi, alın üstünden makul uzaklıktaysa matte'ten; değilse oransal tahmin.
    const fallback = face.foreheadTop.y - faceH * 0.14;
    crownY = found !== null && found < face.foreheadTop.y - faceH * 0.02 && found > face.foreheadTop.y - faceH * 0.7 ? found : fallback;
    faceLuma = meanLuma(src, (face.eyeL.x + face.eyeR.x) / 2, (face.eyeL.y + face.chin.y) / 2, face.faceWidth * 0.3);
  } else {
    estimated = true;
    const box = matteBox(matte);
    if (box) {
      crownY = box.y0;
      centerX = (box.x0 + box.x1) / 2;
      chinY = box.y0 + Math.min((box.y1 - box.y0) * 0.42, (box.x1 - box.x0) * 0.9);
      faceLuma = meanLuma(src, centerX, (crownY + chinY) / 2, (chinY - crownY) * 0.3);
    } else {
      crownY = src.height * 0.12;
      chinY = src.height * 0.5;
      centerX = src.width / 2;
    }
  }
  return { src, matte, fg, face, crownY, chinY, centerX, headH: Math.max(20, chinY - crownY), estimated, rotatedBy, faceLuma };
}

// ── Ton düzeltme ───────────────────────────────────────────────────────────

export type Tone = { gamma: number; contrast: number; saturation: number; brightness: number };

export function autoTone(faceLuma: number, enhance: boolean, brightnessSlider: number): Tone {
  let gamma = 1;
  let contrast = 1;
  let saturation = 1;
  if (enhance) {
    const target = 0.6;
    const l = Math.min(0.9, Math.max(0.12, faceLuma));
    gamma = Math.min(1.6, Math.max(0.65, Math.log(target) / Math.log(l)));
    contrast = 1.05;
    saturation = 1.04;
  }
  return { gamma, contrast, saturation, brightness: brightnessSlider / 100 };
}

function applyTone(c: HTMLCanvasElement, t: Tone): void {
  if (t.gamma === 1 && t.contrast === 1 && t.saturation === 1 && t.brightness === 0) return;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    let v = Math.pow(i / 255, 1 / t.gamma);
    v = (v - 0.5) * t.contrast + 0.5 + t.brightness * 0.5;
    lut[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let r = lut[d[i]];
    let g = lut[d[i + 1]];
    let b = lut[d[i + 2]];
    if (t.saturation !== 1) {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      r = y + (r - y) * t.saturation;
      g = y + (g - y) * t.saturation;
      b = y + (b - y) * t.saturation;
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
}

// ── Birleştirme ────────────────────────────────────────────────────────────

export type ComposeOptions = {
  outW: number;
  outH: number;
  head: [number, number];
  topShare: number;
  /** Baş oranı (preset aralığında). Boşsa aralık ortası. */
  headRatio?: number;
  /** Kadraj kaydırma (kadraj yüksekliğinin kesri). */
  offsetX: number;
  offsetY: number;
  bg: BgId;
  customColor: string;
  circle: boolean;
  enhance: boolean;
  brightness: number;
};

export type Guides = {
  crownY: number;
  chinY: number;
  eyeY: number | null;
  /** Çıktıdaki gerçek baş oranı. */
  headRatio: number;
  /** Kadrajın kaynak görüntü içinde kalan oranı (0–1). */
  coverage: number;
};

export function bgFill(bg: BgId, custom: string): string | null {
  if (bg === "custom") return custom;
  return SOLID_BG[bg] ?? null;
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, o: ComposeOptions, L: Leveled, crop: { x: number; y: number; s: number }): void {
  const solid = bgFill(o.bg, o.customColor);
  if (solid) {
    ctx.fillStyle = solid;
    ctx.fillRect(0, 0, w, h);
  } else if (o.bg === "studio") {
    const g = ctx.createRadialGradient(w / 2, h * 0.38, Math.min(w, h) * 0.08, w / 2, h * 0.5, Math.max(w, h) * 0.78);
    g.addColorStop(0, "#f3f4f6");
    g.addColorStop(1, "#aeb4be");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (o.bg === "blur" || o.bg === "original") {
    // Kaynağı kadraja göre çiz. Kadraj görüntü dışına taşarsa altta yumuşak bir dolgu olsun.
    const tiny = document.createElement("canvas");
    const bw = Math.max(8, Math.round(w / 28));
    const bh = Math.max(8, Math.round(h / 28));
    tiny.width = bw;
    tiny.height = bh;
    const tctx = tiny.getContext("2d")!;
    tctx.imageSmoothingQuality = "high";
    tctx.drawImage(L.src, crop.x, crop.y, w / crop.s, h / crop.s, 0, 0, bw, bh);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(tiny, 0, 0, w, h);
    if (o.bg === "original") {
      ctx.save();
      ctx.translate(-crop.x * crop.s, -crop.y * crop.s);
      ctx.scale(crop.s, crop.s);
      ctx.drawImage(L.src, 0, 0);
      ctx.restore();
    }
  }
  // transparent: boş bırak
}

export function compose(L: Leveled, o: ComposeOptions): { canvas: HTMLCanvasElement; guides: Guides } {
  const { outW: w, outH: h } = o;
  const mid = (o.head[0] + o.head[1]) / 2;
  const ratio = Math.min(0.95, Math.max(0.15, o.headRatio ?? mid));
  const cropH = L.headH / ratio; // kaynak pikseli
  const cropW = (cropH * w) / h;
  const s = h / cropH; // kaynak → çıktı ölçeği
  let x = L.centerX - cropW / 2 + o.offsetX * cropW;
  let y = L.crownY - (cropH - L.headH) * o.topShare + o.offsetY * cropH;

  // Kadraj görüntü dışına taşıyorsa, mümkünse kaydırıp içeri al (baş oranı bozulmasın)
  const slackX = L.src.width - cropW;
  const slackY = L.src.height - cropH;
  if (slackX >= 0) x = Math.min(Math.max(0, x), slackX);
  if (slackY >= 0) y = Math.min(Math.max(0, y), slackY);

  const ix0 = Math.max(0, x), iy0 = Math.max(0, y);
  const ix1 = Math.min(L.src.width, x + cropW), iy1 = Math.min(L.src.height, y + cropH);
  const coverage = Math.max(0, ix1 - ix0) * Math.max(0, iy1 - iy0) / (cropW * cropH);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  paintBackground(ctx, w, h, o, L, { x, y, s });

  if (o.bg !== "original") {
    const layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
    const lctx = layer.getContext("2d", { willReadFrequently: true })!;
    lctx.imageSmoothingEnabled = true;
    lctx.imageSmoothingQuality = "high";
    lctx.drawImage(L.fg, x, y, cropW, cropH, 0, 0, w, h);
    applyTone(layer, autoTone(L.faceLuma, o.enhance, o.brightness));
    ctx.drawImage(layer, 0, 0);
  } else if (o.enhance || o.brightness !== 0) {
    applyTone(out, autoTone(L.faceLuma, o.enhance, o.brightness));
  }

  if (o.circle) {
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const mctx = mask.getContext("2d")!;
    mctx.fillStyle = "#000";
    mctx.beginPath();
    mctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    mctx.fill();
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  const toOut = (sy: number) => (sy - y) * s;
  return {
    canvas: out,
    guides: {
      crownY: toOut(L.crownY),
      chinY: toOut(L.chinY),
      eyeY: L.face ? toOut((L.face.eyeL.y + L.face.eyeR.y) / 2) : null,
      headRatio: (L.headH * s) / h,
      coverage,
    },
  };
}

// ── Uygunluk denetimi ──────────────────────────────────────────────────────

export type CheckLevel = "ok" | "warn" | "bad";
export type Check = { id: string; level: CheckLevel; tr: string; en: string };

export function runChecks(L: Leveled, base: BaseAnalysis, preset: Pick<PhotoPreset, "head" | "strict">, o: ComposeOptions, g: Guides): Check[] {
  const out: Check[] = [];
  const add = (id: string, level: CheckLevel, tr: string, en: string) => out.push({ id, level, tr, en });
  const f = L.face;

  if (!f) {
    add("face", "bad", "Yüz bulunamadı. Kadraj tahmini yapıldı; karşıdan, yüzü net görünen bir fotoğraf deneyin.", "No face found. Framing was estimated; try a front-facing photo with a clear face.");
  } else {
    add("face", f.faces > 1 ? "warn" : "ok", f.faces > 1 ? "Birden fazla yüz var; en büyüğü esas alındı." : "Yüz bulundu ve ortalandı.", f.faces > 1 ? "Several faces found; the largest was used." : "Face found and centred.");
    if (Math.abs(f.rollDeg) > 3 && L.rotatedBy === 0) add("tilt", "warn", `Baş yaklaşık ${Math.abs(f.rollDeg).toFixed(0)}° eğik. "Başı düzelt" seçeneğini açın.`, `Head is tilted about ${Math.abs(f.rollDeg).toFixed(0)}°. Turn on "Straighten head".`);
    else if (L.rotatedBy !== 0) add("tilt", "ok", `Baş eğikliği düzeltildi (${Math.abs(L.rotatedBy).toFixed(1)}°).`, `Head tilt corrected (${Math.abs(L.rotatedBy).toFixed(1)}°).`);
    if (f.yawRatio > 0.12) add("yaw", "warn", "Yüz kameraya tam dönük değil. Resmî başvurularda doğrudan karşıdan çekim gerekir.", "Face isn't fully frontal. Official applications need a straight-on shot.");
    if (preset.strict) {
      if (f.eyesClosed > 0.45) add("eyes", "bad", "Gözler kapalı veya yarı kapalı görünüyor.", "Eyes look closed or half-closed.");
      else add("eyes", "ok", "Gözler açık.", "Eyes are open.");
      if (f.mouthOpen > 0.18 || f.smile > 0.5) add("expr", "warn", "Ağız açık ya da geniş gülümseme var; resmî belgelerde nötr ifade istenir.", "Mouth open or a broad smile; official documents require a neutral expression.");
      else add("expr", "ok", "Nötr ifade.", "Neutral expression.");
    }
  }

  const [lo, hi] = preset.head;
  const hr = g.headRatio;
  if (hr < lo - 0.015 || hr > hi + 0.015) add("head", "warn", `Baş oranı %${Math.round(hr * 100)}; bu ölçü için %${Math.round(lo * 100)}–${Math.round(hi * 100)} istenir. Baş boyutu ayarını kullanın.`, `Head is ${Math.round(hr * 100)}%; this size needs ${Math.round(lo * 100)}–${Math.round(hi * 100)}%. Use the head size control.`);
  else add("head", "ok", `Baş oranı %${Math.round(hr * 100)} — uygun aralıkta.`, `Head ratio ${Math.round(hr * 100)}% — within range.`);

  if (g.coverage < 0.985) add("cover", "warn", "Fotoğraf kadrajı tam doldurmuyor (kenarda boşluk kaldı). Daha geniş çekilmiş bir fotoğraf daha iyi sonuç verir.", "The photo doesn't fill the frame (gaps at the edge). A wider shot gives a better result.");

  if (L.faceLuma < 0.28) add("light", "warn", "Yüz çok karanlık. Işığı otomatik iyileştirmeyi açın ya da aydınlık bir yerde çekin.", "Face is quite dark. Turn on auto-enhance or shoot in better light.");
  else if (L.faceLuma > 0.85) add("light", "warn", "Yüz aşırı parlak (patlamış). Daha yumuşak bir ışıkta çekin.", "Face is overexposed. Shoot in softer light.");
  else add("light", "ok", "Işık dengeli.", "Lighting is balanced.");

  const cropH = L.headH / Math.max(0.15, g.headRatio); // kaynakta kadraj yüksekliği
  if (cropH < o.outH * 0.55) add("res", "warn", "Fotoğrafın çözünürlüğü bu ölçü için düşük; sonuç bulanık çıkabilir.", "The photo's resolution is low for this size; the result may look soft.");
  void base;
  return out;
}

// ── Dışa aktarma ───────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function setDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (blob.type === "image/jpeg") {
    // JFIF APP0: FFD8 FFE0 len(2) 'JFIF\0' ver(2) units(1) xd(2) yd(2)
    if (buf[2] === 0xff && buf[3] === 0xe0 && buf[6] === 0x4a && buf[7] === 0x46) {
      buf[13] = 1;
      buf[14] = dpi >> 8;
      buf[15] = dpi & 255;
      buf[16] = dpi >> 8;
      buf[17] = dpi & 255;
      return new Blob([buf], { type: "image/jpeg" });
    }
    return blob;
  }
  if (blob.type === "image/png") {
    const ppm = Math.round(dpi / 0.0254);
    const chunk = new Uint8Array(21);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
    dv.setUint32(8, ppm);
    dv.setUint32(12, ppm);
    chunk[16] = 1;
    dv.setUint32(17, crc32(chunk.subarray(4, 17)));
    const at = 8 + 25; // imza + IHDR(25)
    const out = new Uint8Array(buf.length + chunk.length);
    out.set(buf.subarray(0, at), 0);
    out.set(chunk, at);
    out.set(buf.subarray(at), at + chunk.length);
    return new Blob([out], { type: "image/png" });
  }
  return blob;
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), type, q));

export type ExportResult = { blob: Blob; width: number; height: number; quality: number | null; downscaled: boolean; mime: string };

export async function exportCanvas(
  canvas: HTMLCanvasElement,
  opts: { format: "jpg" | "png"; dpi: number; maxKb: number | null; flattenColor: string },
): Promise<ExportResult> {
  const mime = opts.format === "png" ? "image/png" : "image/jpeg";
  let work = canvas;
  if (opts.format === "jpg") {
    work = document.createElement("canvas");
    work.width = canvas.width;
    work.height = canvas.height;
    const c = work.getContext("2d")!;
    c.fillStyle = opts.flattenColor;
    c.fillRect(0, 0, work.width, work.height);
    c.drawImage(canvas, 0, 0);
  }
  if (opts.format === "png") {
    const blob = await setDpi(await toBlob(work, mime), opts.dpi);
    return { blob, width: work.width, height: work.height, quality: null, downscaled: false, mime };
  }
  const limit = opts.maxKb ? opts.maxKb * 1024 : null;
  let cur = work;
  let downscaled = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    if (!limit) {
      const b = await setDpi(await toBlob(cur, mime, 0.93), opts.dpi);
      return { blob: b, width: cur.width, height: cur.height, quality: 0.93, downscaled, mime };
    }
    let lo = 0.35, hi = 0.95, best: Blob | null = null, bestQ = lo;
    const top = await toBlob(cur, mime, hi);
    if (top.size <= limit) {
      best = top;
      bestQ = hi;
    } else {
      for (let i = 0; i < 6; i++) {
        const q = (lo + hi) / 2;
        const b = await toBlob(cur, mime, q);
        if (b.size <= limit) {
          best = b;
          bestQ = q;
          lo = q;
        } else hi = q;
      }
    }
    if (best) return { blob: await setDpi(best, opts.dpi), width: cur.width, height: cur.height, quality: bestQ, downscaled, mime };
    // Kalite tek başına yetmedi → ölçüyü hafifçe küçült
    const n = document.createElement("canvas");
    n.width = Math.round(cur.width * 0.88);
    n.height = Math.round(cur.height * 0.88);
    const nctx = n.getContext("2d")!;
    nctx.imageSmoothingQuality = "high";
    nctx.drawImage(cur, 0, 0, n.width, n.height);
    cur = n;
    downscaled = true;
  }
  const b = await setDpi(await toBlob(cur, mime, 0.35), opts.dpi);
  return { blob: b, width: cur.width, height: cur.height, quality: 0.35, downscaled, mime };
}

/** Baskı sayfası: fotoğrafı gerçek boyutunda (mm) kâğıda dizer, kesim çizgileri ekler. */
export function makeSheet(photo: HTMLCanvasElement, photoMm: { w: number; h: number }, sheetMm: { w: number; h: number }, bgColor: string): { canvas: HTMLCanvasElement; count: number } {
  const dpi = 300;
  const px = (mm: number) => Math.round((mm / 25.4) * dpi);
  const SW = px(sheetMm.w), SH = px(sheetMm.h);
  // Kâğıda EN ÇOK kopya sığdıran dizilimi seç: düz/döndürülmüş × (geniş boşluk → kenarlıksız).
  // 10×15 cm'ye 50×60 mm yalnızca kenar boşluksuz dizilimle 4 adet sığar; fotoğrafçılar
  // kenarlıksız basar. Eşitlikte daha ferah (boşluklu) dizilim tercih edilir.
  const layouts = [{ margin: px(5), gap: px(2.5) }, { margin: px(2), gap: px(1) }, { margin: 0, gap: 0 }];
  let best = { count: 0, rotate: false, pw: 0, ph: 0, cols: 1, rows: 1, gap: 0 };
  for (const rotate of [false, true]) {
    const pw0 = rotate ? px(photoMm.h) : px(photoMm.w);
    const ph0 = rotate ? px(photoMm.w) : px(photoMm.h);
    for (const L of layouts) {
      // +2 px: mm→piksel yuvarlaması yüzünden 2×50 mm tam 100 mm'ye 1 px fazla çıkıyordu
      const cols = Math.floor((SW - L.margin * 2 + L.gap + 2) / (pw0 + L.gap));
      const rows = Math.floor((SH - L.margin * 2 + L.gap + 2) / (ph0 + L.gap));
      if (cols >= 1 && rows >= 1 && cols * rows > best.count) best = { count: cols * rows, rotate, pw: pw0, ph: ph0, cols, rows, gap: L.gap };
    }
  }
  if (best.count === 0) best = { count: 1, rotate: false, pw: Math.min(px(photoMm.w), SW), ph: Math.min(px(photoMm.h), SH), cols: 1, rows: 1, gap: 0 };
  const { rotate, pw, ph, cols, rows, gap } = best;
  const sheet = document.createElement("canvas");
  sheet.width = SW;
  sheet.height = SH;
  const c = sheet.getContext("2d")!;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, SW, SH);
  const totalW = cols * pw + (cols - 1) * gap;
  const totalH = rows * ph + (rows - 1) * gap;
  const ox = Math.max(0, Math.round((SW - totalW) / 2));
  const oy = Math.max(0, Math.round((SH - totalH) / 2));
  c.imageSmoothingQuality = "high";
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const x = ox + k * (pw + gap);
      const y = oy + r * (ph + gap);
      c.fillStyle = bgColor;
      c.fillRect(x, y, pw, ph);
      if (rotate) {
        c.save();
        c.translate(x + pw / 2, y + ph / 2);
        c.rotate(Math.PI / 2);
        c.drawImage(photo, -ph / 2, -pw / 2, ph, pw);
        c.restore();
      } else c.drawImage(photo, x, y, pw, ph);
      c.strokeStyle = "rgba(0,0,0,0.25)";
      c.lineWidth = 1;
      c.strokeRect(x - 0.5, y - 0.5, pw + 1, ph + 1);
    }
  return { canvas: sheet, count: rows * cols };
}
