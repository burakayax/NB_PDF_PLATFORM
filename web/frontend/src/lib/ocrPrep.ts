/**
 * OCR ön işleme — Tesseract'a verilmeden ÖNCE görüntüyü düzeltir.
 *
 * Ölçüm (20 sayfalık Türkçe tarama seti: temiz / eğik / gürültülü / telefon fotoğrafı / soluk):
 *   - ~144 DPI girdi, ön işleme yok (eski hâl)   → karakter hatası %6,63; telefon fotoğrafında %30
 *   - ~300 DPI + arka plan düzleştirme + eğrilik düzeltme + "best" model → %0,56; telefonda %0,5
 * En büyük kazanç: (1) çözünürlüğü ~300 DPI'a getirmek, (2) eşit olmayan ışığı düzleştirmek,
 * (3) eğik sayfayı döndürmek. Tesseract kendi içinde ikili (siyah-beyaz) yapar; bizim eşiğimiz
 * soluk taramalarda ve gölgede daha kötü çıktığı için GRİ tonlu bırakılır.
 *
 * Çıktı görüntüsü kaynağa göre ölçeklenmiş + döndürülmüş olabilir; `unmap` OCR sonucundaki
 * koordinatları KAYNAK görüntü pikseline geri çevirir (aranabilir PDF'te kelimeler doğru yerde kalsın).
 */

/** A4'ün 300 DPI uzun kenarı ≈ 3508 px. Altındaki girdi büyütülür, üstündeki küçültülür. */
const MIN_LONG_SIDE = 2800;
const TARGET_LONG_SIDE = 3500;
const MAX_LONG_SIDE = 4200;
/** Eğrilik taraması: ±4°, 0,25° adım; sonra en iyi çevresinde 0,05° ince tarama. */
const SKEW_RANGE_DEG = 4;
/** Bundan küçük eğrilik düzeltilmez (Tesseract tek başına taşır; gereksiz yeniden örnekleme yapma). */
const MIN_SKEW_DEG = 0.25;

/** Gri tonlu görüntüde yaprağın "kağıt rengi" haritasını çıkarıp böler → gölge/ışık gradyanı kalkar. */
export function flattenBackground(gray: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const f = 8;
  const gw = Math.max(1, Math.ceil(w / f));
  const gh = Math.max(1, Math.ceil(h / f));
  // 1) Blok maksimumu: yazı çizgileri (< f px) silinir, geriye kağıt parlaklığı kalır.
  const blockMax = new Float32Array(gw * gh);
  for (let by = 0; by < gh; by++) {
    for (let bx = 0; bx < gw; bx++) {
      let m = 0;
      const y1 = Math.min(h, (by + 1) * f);
      const x1 = Math.min(w, (bx + 1) * f);
      for (let y = by * f; y < y1; y++) {
        const row = y * w;
        for (let x = bx * f; x < x1; x++) if (gray[row + x] > m) m = gray[row + x];
      }
      blockMax[by * gw + bx] = m;
    }
  }
  // 2) Büyük harf / kalın başlık bloklarını da silmek için 3×3 maksimum, sonra yumuşatma.
  const dil = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let m = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = Math.min(gh - 1, Math.max(0, y + dy));
        for (let dx = -2; dx <= 2; dx++) {
          const v = blockMax[yy * gw + Math.min(gw - 1, Math.max(0, x + dx))];
          if (v > m) m = v;
        }
      }
      dil[y * gw + x] = m;
    }
  }
  const bg = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let s = 0;
      let c = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= gh) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= gw) continue;
          s += dil[yy * gw + xx];
          c++;
        }
      }
      bg[y * gw + x] = s / c;
    }
  }
  // 3) Bölme: piksel / kağıt rengi (çift doğrusal örnekleme ile blok izi kalmaz).
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / f - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(gh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / f - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(gw - 1, x0 + 1);
      const tx = fx - x0;
      const b =
        (bg[y0 * gw + x0] * (1 - tx) + bg[y0 * gw + x1] * tx) * (1 - ty) +
        (bg[y1 * gw + x0] * (1 - tx) + bg[y1 * gw + x1] * tx) * ty;
      out[y * w + x] = (gray[y * w + x] * 255) / Math.max(b, 24);
    }
  }
  return out;
}

/** Histogramdan en koyu/en açık %0,05'i atarak [0,255] aralığına gererek kontrastı açar. */
export function stretchContrast(gray: Uint8ClampedArray): void {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const cut = Math.max(1, Math.floor(gray.length * 0.0005));
  let lo = 0;
  let acc = 0;
  while (lo < 255 && (acc += hist[lo]) <= cut) lo++;
  let hi = 255;
  acc = 0;
  while (hi > lo && (acc += hist[hi]) <= cut) hi--;
  if (hi - lo < 32) return; // neredeyse düz görüntü — dokunma
  const k = 255 / (hi - lo);
  for (let i = 0; i < gray.length; i++) gray[i] = (gray[i] - lo) * k;
}

function otsuThreshold(gray: Uint8ClampedArray): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  return thr;
}

/**
 * Sayfanın eğriliğini derece olarak bulur (pozitif = saat yönünün tersine döndürmek gerekir).
 * Yöntem: yazı piksellerini açıya göre satır eksenine izdüşür; doğru açıda satırlar keskin
 * (varyans en yüksek) olur. Yeterince yazı yoksa ya da net bir tepe çıkmazsa 0 döner.
 */
export function estimateSkewDeg(gray: Uint8ClampedArray, w: number, h: number): number {
  const f = 4;
  const sw = Math.floor(w / f);
  const sh = Math.floor(h / f);
  if (sw < 64 || sh < 64) return 0;
  const small = new Uint8ClampedArray(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let m = 255;
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
        const v = gray[(y * f + dy) * w + x * f + dx];
        if (v < m) m = v;
      }
      small[y * sw + x] = m; // blok minimumu → ince yazı çizgisi silinmesin
    }
  }
  const thr = otsuThreshold(small);
  const pts: number[] = [];
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (small[y * sw + x] <= thr) pts.push(x, y);
  const n = pts.length / 2;
  if (n < 800 || n > sw * sh * 0.5) return 0; // yazı yok / sayfa neredeyse tamamen koyu
  const stride = Math.max(1, Math.floor(n / 60000));
  const bins = sh * 2 + sw * 2; // dönmüş y aralığını karşılar
  const off = sw; // negatif indeksleri önle
  const hist = new Float64Array(bins);
  const score = (deg: number): number => {
    const r = (deg * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    hist.fill(0);
    for (let i = 0; i < n; i += stride) {
      const yy = Math.round(-s * pts[2 * i] + c * pts[2 * i + 1]) + off;
      if (yy >= 0 && yy < bins) hist[yy]++;
    }
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < bins; i++) {
      sum += hist[i];
      sq += hist[i] * hist[i];
    }
    const mean = sum / bins;
    return sq / bins - mean * mean;
  };
  let best = 0;
  let bestScore = -1;
  for (let a = -SKEW_RANGE_DEG; a <= SKEW_RANGE_DEG + 1e-9; a += 0.25) {
    const sc = score(a);
    if (sc > bestScore) {
      bestScore = sc;
      best = a;
    }
  }
  for (let a = best - 0.25; a <= best + 0.25 + 1e-9; a += 0.05) {
    const sc = score(a);
    if (sc > bestScore) {
      bestScore = sc;
      best = a;
    }
  }
  // Tepe, 0° skoruna göre anlamlı derecede keskin değilse (düz sayfa / fotoğraf) dokunma.
  if (Math.abs(best) < MIN_SKEW_DEG || bestScore < score(0) * 1.03) return 0;
  return best;
}

export type OcrPrepared = {
  /** Tesseract'a verilecek (ölçeklenmiş, düzleştirilmiş, döndürülmüş) tuval. */
  canvas: HTMLCanvasElement;
  /** İşlenmiş görüntüdeki noktayı KAYNAK görüntü pikseline çevirir. */
  unmap: (x: number, y: number) => { x: number; y: number };
  /** İşlenmiş / kaynak uzunluk oranı (satır yüksekliği gibi boyutları geri ölçeklemek için). */
  scale: number;
};

export function scaleForOcr(srcW: number, srcH: number): number {
  const long = Math.max(srcW, srcH);
  if (long < MIN_LONG_SIDE) return TARGET_LONG_SIDE / long;
  if (long > MAX_LONG_SIDE) return MAX_LONG_SIDE / long;
  return 1;
}

/** Kaynak (tuval veya görüntü Blob'u) → OCR'a hazır görüntü. Hata olursa kaynağı olduğu gibi döner. */
export async function prepareForOcr(source: HTMLCanvasElement | Blob): Promise<OcrPrepared> {
  const identity = (canvas: HTMLCanvasElement): OcrPrepared => ({ canvas, unmap: (x, y) => ({ x, y }), scale: 1 });
  try {
    let bmp: ImageBitmap | HTMLCanvasElement;
    let sw: number;
    let sh: number;
    if (source instanceof Blob) {
      bmp = await createImageBitmap(source);
      sw = bmp.width;
      sh = bmp.height;
    } else {
      bmp = source;
      sw = source.width;
      sh = source.height;
    }
    const k = scaleForOcr(sw, sh);
    const w = Math.max(1, Math.round(sw * k));
    const h = Math.max(1, Math.round(sh * k));
    const work = document.createElement("canvas");
    work.width = w;
    work.height = h;
    const ctx = work.getContext("2d", { willReadFrequently: true });
    if (!ctx) return source instanceof Blob ? identity(await blobToCanvas(source)) : identity(source);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    if ("close" in bmp) bmp.close();

    const img = ctx.getImageData(0, 0, w, h);
    const px = img.data;
    let gray: Uint8ClampedArray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
      // Saydam piksel beyaz sayılır (PNG).
      const a = px[j + 3] / 255;
      const lum = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2];
      gray[i] = lum * a + 255 * (1 - a);
    }
    gray = flattenBackground(gray, w, h);
    stretchContrast(gray);
    const skew = estimateSkewDeg(gray, w, h);

    for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
      px[j] = px[j + 1] = px[j + 2] = gray[i];
      px[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    if (!skew) {
      return { canvas: work, unmap: (x, y) => ({ x: x / k, y: y / k }), scale: k };
    }
    const r = (skew * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const cx = w / 2;
    const cy = h / 2;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d");
    if (!octx) return { canvas: work, unmap: (x, y) => ({ x: x / k, y: y / k }), scale: k };
    octx.fillStyle = "#fff";
    octx.fillRect(0, 0, w, h);
    octx.imageSmoothingQuality = "high";
    // cv2.getRotationMatrix2D(skew) ile aynı yön: x' = c·dx + s·dy, y' = −s·dx + c·dy (merkeze göre).
    octx.setTransform(c, -s, s, c, cx - (c * cx + s * cy), cy - (-s * cx + c * cy));
    octx.drawImage(work, 0, 0);
    octx.setTransform(1, 0, 0, 1, 0, 0);
    // Ters dönüşüm: döndürülmüş görüntüden döndürülmemiş (ölçekli) görüntüye, sonra kaynağa.
    const unmap = (x: number, y: number) => {
      const dx = x - cx;
      const dy = y - cy;
      return { x: (c * dx - s * dy + cx) / k, y: (s * dx + c * dy + cy) / k };
    };
    return { canvas: out, unmap, scale: k };
  } catch {
    return source instanceof Blob ? identity(await blobToCanvas(source)) : identity(source);
  }
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")?.drawImage(bmp, 0, 0);
  bmp.close();
  return c;
}
