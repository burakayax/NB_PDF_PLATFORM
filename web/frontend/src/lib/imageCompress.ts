/**
 * GÖRSEL SIKIŞTIRMA ÇEKİRDEĞİ — tamamen cihazda (tarayıcı codec'leri).
 *
 * Tasarım kuralı: ÇIKTI ASLA GİRDİDEN BÜYÜK OLMAZ. Tarayıcının kendi
 * kodlayıcısı bazı görsellerde (zaten optimize edilmiş JPEG, küçük PNG,
 * kayıpsız PNG çıkışı) orijinalden büyük dosya üretebilir; bu yüzden:
 *   1) hedef kalitede kodla,
 *   2) küçülmediyse kaliteyi kademeli düşürerek tekrar dene,
 *   3) yine küçülmediyse ORİJİNAL baytları koru (`kept: true`).
 */

export type OutputFormat = "image/jpeg" | "image/webp" | "image/png";

export type CompressOptions = {
  /** 0.2–0.95 arası hedef kalite (PNG'de yok sayılır). */
  quality: number;
  /** Uzun kenar üst sınırı; 0 = orijinal boyut korunur. */
  maxDim: number;
  format: OutputFormat;
  /**
   * HEDEF BOYUT (bayt). Verildiğinde kalite kaydırağı yok sayılır: dosyayı bu
   * boyutun ALTINA indiren en yüksek kalite aranır.
   *
   * Neden gerekli: kurumlar şartı kalite olarak değil boyut olarak yazar
   * ("en fazla 60 KB"). Kullanıcı bunu kalite yüzdesine çeviremez ve deneme
   * yanılmayla uğraşır; çoğu da boyutu düşürmek için görseli kırpar — yanlış
   * çözüm, çünkü görüntü kaybolur.
   */
  targetBytes?: number;
};

export type CompressOutcome = {
  blob: Blob;
  /** Çıktının gerçek MIME türü (orijinal korunduysa kaynağınki). */
  type: string;
  ext: string;
  originalSize: number;
  /** Sıkıştırma kazanç sağlamadı → orijinal baytlar korundu. */
  kept: boolean;
  /** Gerçekten kullanılan kalite (orijinal korunduysa null). */
  usedQuality: number | null;
  width: number;
  height: number;
  /**
   * Hedef boyut modunda sonuç: hedefin altına inilebildi mi?
   * `undefined` → hedef boyut istenmemişti.
   *
   * Arayüz bunu kullanıcıya AÇIKÇA söylemek zorundadır; "indirdim" deyip
   * hedefin üstünde dosya vermek, kullanıcıyı başvuru ekranında hataya sokar.
   */
  targetMet?: boolean;
  /** Hedefe inebilmek için görsel küçültüldü mü? (piksel ölçüsü düştü) */
  downscaledForTarget?: boolean;
};

export function extForFormat(f: OutputFormat): string {
  return f === "image/webp" ? "webp" : f === "image/png" ? "png" : "jpg";
}

/** Dosya adındaki uzantı (noktasız, küçük harf). */
export function extOfName(name: string): string {
  const m = /\.([^.]+)$/.exec(name);
  return m ? m[1]!.toLowerCase() : "";
}

/** Tarayıcı bu biçimde KODLAMA yapabiliyor mu? (toBlob sessizce PNG'ye düşebilir) */
export async function canEncode(format: OutputFormat): Promise<boolean> {
  try {
    const c = document.createElement("canvas");
    c.width = 2;
    c.height = 2;
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, format, 0.8));
    return !!blob && blob.type === format;
  } catch {
    return false;
  }
}

export type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

/**
 * Görseli çöz. `createImageBitmap` tercih edilir: <img>'den hızlıdır ve
 * `imageOrientation` ile EXIF dönüşünü uygular (yan yatmış fotoğraf sorunu).
 */
export async function decodeImage(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      /* <img> yoluna düş */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image decode failed"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Hedef boyuta indir. Tek adımda büyük küçültme tarayıcıda kum gibi (aliasing)
 * sonuç verir; yarı yarıya adımlarla inmek hem daha net hem daha küçük dosya üretir.
 */
function drawScaled(src: CanvasImageSource, sw: number, sh: number, tw: number, th: number): HTMLCanvasElement {
  let curW = sw;
  let curH = sh;
  let cur: CanvasImageSource = src;
  let scratch: HTMLCanvasElement | null = null;

  while (curW / 2 >= tw && curH / 2 >= th) {
    const next = document.createElement("canvas");
    next.width = Math.max(1, Math.round(curW / 2));
    next.height = Math.max(1, Math.round(curH / 2));
    const nctx = next.getContext("2d");
    if (!nctx) break;
    nctx.imageSmoothingEnabled = true;
    nctx.imageSmoothingQuality = "high";
    nctx.drawImage(cur, 0, 0, next.width, next.height);
    cur = next;
    curW = next.width;
    curH = next.height;
    scratch = next;
  }

  const out = document.createElement("canvas");
  out.width = Math.max(1, tw);
  out.height = Math.max(1, th);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context yok");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cur, 0, 0, out.width, out.height);
  if (scratch) {
    scratch.width = 0;
    scratch.height = 0;
  }
  return out;
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

/** Şeffaflık var mı? (küçük bir örnek üzerinden — büyük görselde de ucuz) */
function hasAlpha(src: CanvasImageSource, w: number, h: number): boolean {
  try {
    const s = Math.min(1, 64 / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 250) return true;
    }
    return false;
  } catch {
    return false; // farklı kaynaktan gelen görsel (tainted canvas) → varsayma, kapat
  }
}

/**
 * Tek görseli sıkıştır. Çıktı girdiden büyük çıkarsa orijinal korunur —
 * kullanıcı hiçbir durumda "sıkıştırdım, dosya büyüdü" ile karşılaşmaz.
 */
export async function compressImage(file: File, opts: CompressOptions): Promise<CompressOutcome> {
  const dec = await decodeImage(file);
  try {
    const { width: sw, height: sh } = dec;
    let tw = sw;
    let th = sh;
    if (opts.maxDim > 0 && Math.max(sw, sh) > opts.maxDim) {
      const s = opts.maxDim / Math.max(sw, sh);
      tw = Math.max(1, Math.round(sw * s));
      th = Math.max(1, Math.round(sh * s));
    }

    // JPEG şeffaflığı taşımaz: alfa varsa altına beyaz zemin koymak gerekir,
    // yoksa saydam alanlar siyaha döner.
    const alpha = opts.format === "image/jpeg" && hasAlpha(dec.source, sw, sh);
    const renderAt = (w: number, h: number): HTMLCanvasElement => {
      if (!alpha) return drawScaled(dec.source, sw, sh, w, h);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context yok");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(dec.source, 0, 0, w, h);
      return c;
    };
    const release = (c: HTMLCanvasElement) => {
      c.width = 0;
      c.height = 0;
    };

    const original = { blob: file as Blob, type: file.type || "application/octet-stream", ext: extOfName(file.name) };
    let best: { blob: Blob; quality: number | null } | null = null;
    let targetMet: boolean | undefined;
    let downscaledForTarget = false;

    if (opts.targetBytes && opts.targetBytes > 0) {
      const hedef = opts.targetBytes;
      // Hedef boyut modu. Kaliteyi ikili arama ile daraltıyoruz: dosya boyutu
      // kaliteyle birlikte arttığı için hedefin altında kalan EN YÜKSEK kalite
      // aranabilir. Doğrusal merdiven ya gereksiz kalite feda eder ya hedefi ıskalar.
      let w = tw;
      let h = th;
      // `best` hangi ölçüde üretildiyse onu taşırız; döngü sonunda bildirilen
      // piksel ölçüsü ile indirilen dosya böylece ASLA ayrışmaz.
      let bestW = tw;
      let bestH = th;
      // Kalite tek başına yetmezse görseli küçültmek gerekir; her tur uzun kenarı
      // %15 kısaltır. Altı tur ≈ %38'e iner — bunun altında görsel kullanılamaz hâle
      // geldiği için durulur ve kullanıcıya hedefe inilemediği söylenir.
      for (let tur = 0; tur < 7; tur += 1) {
        const canvas = renderAt(w, h);
        try {
          if (opts.format === "image/png") {
            // PNG kayıpsız: kaliteyle oynanamaz, tek yol küçültmek.
            const b = await encode(canvas, "image/png", 1);
            if (b && (b.size <= hedef || !best || b.size < best.blob.size)) {
              best = { blob: b, quality: null };
              bestW = w;
              bestH = h;
            }
          } else {
            let lo = 0.3;
            let hi = 0.95;
            let uygun: { blob: Blob; quality: number } | null = null;
            for (let i = 0; i < 7; i += 1) {
              const mid = (lo + hi) / 2;
              const b = await encode(canvas, opts.format, mid);
              if (!b) break;
              if (b.size <= hedef) {
                uygun = { blob: b, quality: mid };
                lo = mid; // daha yüksek kalite denenebilir
              } else {
                hi = mid;
              }
            }
            if (uygun) {
              best = uygun;
              bestW = w;
              bestH = h;
            } else {
              // Bu ölçüde hedefe inilemedi; en iyi denemeyi yedekte tut.
              const enDusuk = await encode(canvas, opts.format, 0.3);
              if (enDusuk && (!best || enDusuk.size < best.blob.size)) {
                best = { blob: enDusuk, quality: 0.3 };
                bestW = w;
                bestH = h;
              }
            }
          }
        } finally {
          release(canvas);
        }

        if (best && best.blob.size <= hedef) {
          targetMet = true;
          break;
        }
        // Sığmadı → küçült ve yeniden dene.
        const nw = Math.max(1, Math.round(w * 0.85));
        const nh = Math.max(1, Math.round(h * 0.85));
        if (nw === w && nh === h) break;
        w = nw;
        h = nh;
      }
      if (targetMet === undefined) targetMet = false;
      // Bildirilen ölçü, indirilen dosyanın gerçek ölçüsüdür.
      downscaledForTarget = bestW !== tw || bestH !== th;
      tw = bestW;
      th = bestH;
    } else {
      const canvas = renderAt(tw, th);
      try {
        if (opts.format === "image/png") {
          // PNG kayıpsızdır: kalite düğmesi işlemez, tek deneme yeter.
          const b = await encode(canvas, "image/png", 1);
          if (b) best = { blob: b, quality: null };
        } else {
          // Kalite merdiveni: hedeften başla, küçülmediyse kademeli in.
          const ladder = [opts.quality, opts.quality - 0.15, opts.quality - 0.3, 0.35].filter(
            (q, i, arr) => q >= 0.3 && arr.indexOf(q) === i,
          );
          for (const q of ladder) {
            const b = await encode(canvas, opts.format, q);
            if (!b) continue;
            if (!best || b.size < best.blob.size) best = { blob: b, quality: q };
            // Boyut küçüldüyse daha fazla kalite feda etme.
            if (b.size < file.size) break;
          }
        }
      } finally {
        release(canvas);
      }
    }

    // Küçülmediyse orijinali koru (boyutu ASLA büyütme). Boyut değiştiyse
    // (küçültme istendiyse) çıktı zaten farklı bir görsel — o zaman kodlanmışı ver.
    // Hedef boyut modunda bu korumayı uygulamıyoruz: kullanıcı açıkça bir boyut
    // istedi, orijinali geri vermek o isteği sessizce yok saymak olurdu.
    const resized = tw !== sw || th !== sh;
    const hedefModu = !!(opts.targetBytes && opts.targetBytes > 0);
    if (!best || (!hedefModu && !resized && best.blob.size >= file.size)) {
      return {
        blob: original.blob,
        type: original.type,
        ext: original.ext || extForFormat(opts.format),
        originalSize: file.size,
        kept: true,
        usedQuality: null,
        width: sw,
        height: sh,
        ...(hedefModu ? { targetMet: file.size <= (opts.targetBytes ?? 0), downscaledForTarget: false } : {}),
      };
    }

    return {
      blob: best.blob,
      type: opts.format,
      ext: extForFormat(opts.format),
      originalSize: file.size,
      kept: false,
      usedQuality: best.quality,
      width: tw,
      height: th,
      ...(hedefModu ? { targetMet, downscaledForTarget } : {}),
    };
  } finally {
    dec.release();
  }
}
