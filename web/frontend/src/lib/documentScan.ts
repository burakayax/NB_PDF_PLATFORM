/**
 * Cihaz-içi BELGE TARAMA motoru — OpenCV.js (WASM) ile. Kamera karesinden belgenin
 * dört kenarını otomatik bulur, perspektifi düzeltir ("dümdüz" tarama görünümü) ve
 * isteğe bağlı olarak kontrastı artırır (gri / siyah-beyaz).
 *
 * OpenCV ~9 MB olduğundan bu modül SADECE tarayıcı ekranı açıldığında dinamik
 * import ile yüklenir → ana bundle şişmez (Vite ayrı chunk üretir). Görüntü
 * SUNUCUYA GİTMEZ; her şey cihazda işlenir → tam gizlilik.
 */

// OpenCV.js (emscripten) tipleri eksik olduğundan runtime'ı `any` olarak ele
// alıyoruz; API çağrıları elle doğrulanmıştır.
type CV = any;

let cvPromise: Promise<CV> | null = null;

/** OpenCV.js'i (bir kez) dinamik yükler ve WASM runtime'ı hazır olana dek bekler. */
export function loadOpenCv(): Promise<CV> {
  if (!cvPromise) {
    cvPromise = import("@techstark/opencv-js")
      .then(async (mod) => {
        const cv = ((mod as unknown as { default?: CV }).default ?? mod) as CV;
        await waitForRuntime(cv);
        return cv;
      })
      .catch((e) => {
        cvPromise = null; // sonraki denemeye izin ver
        throw e;
      });
  }
  return cvPromise;
}

function waitForRuntime(cv: CV): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (cv?.Mat) return resolve();
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    const prev = cv.onRuntimeInitialized;
    cv.onRuntimeInitialized = () => {
      try {
        prev?.();
      } finally {
        finish();
      }
    };
    // Bazı emscripten sürümleri callback'i atlayabilir → poll ile güvence altına al.
    const t = setInterval(() => {
      if (cv?.Mat) {
        clearInterval(t);
        finish();
      }
    }, 40);
    // WASM hiç hazır olmazsa (ör. CSP eval engeli, ağ) sonsuza dek bekleme.
    setTimeout(() => {
      clearInterval(t);
      if (cv?.Mat) finish();
      else if (!done) {
        done = true;
        reject(new Error("OpenCV runtime did not initialize (timeout)"));
      }
    }, 25000);
  });
}

export type Pt = { x: number; y: number };
/** Dört köşe SIRALI: sol-üst, sağ-üst, sağ-alt, sol-alt. */
export type Quad = [Pt, Pt, Pt, Pt];

export type EnhanceMode = "color" | "gray" | "bw" | "auto";

/**
 * "Sihirli" otomatik iyileştirme (Pro) — GÖLGE TEMİZLEME + kontrast normalizasyonu.
 * Her renk kanalı için arka plan (aydınlatma/gölge) tahmin edilip bölünür → belge
 * dümdüz beyaz zeminli, gölgesiz ve keskin görünür (renkler korunur). `dst` yerinde
 * güncellenir (RGBA).
 */
function autoEnhance(cv: CV, dst: CV): void {
  const rgb: CV = new cv.Mat();
  cv.cvtColor(dst, rgb, cv.COLOR_RGBA2RGB);
  const channels: CV = new cv.MatVector();
  cv.split(rgb, channels);
  const out: CV = new cv.MatVector();
  const kernel: CV = cv.Mat.ones(7, 7, cv.CV_8U);
  const tmp: CV[] = [];
  try {
    for (let i = 0; i < 3; i++) {
      const ch: CV = channels.get(i);
      const dil: CV = new cv.Mat();
      const bg: CV = new cv.Mat();
      const diff: CV = new cv.Mat();
      const norm: CV = new cv.Mat();
      cv.dilate(ch, dil, kernel);
      cv.medianBlur(dil, bg, 17); // aydınlatma/gölge tahmini
      cv.absdiff(ch, bg, diff);
      cv.bitwise_not(diff, diff); // 255 - fark → beyaz zemin
      cv.normalize(diff, norm, 0, 255, cv.NORM_MINMAX);
      out.push_back(norm);
      tmp.push(dil, bg, diff, norm, ch);
    }
    const merged: CV = new cv.Mat();
    cv.merge(out, merged);
    cv.cvtColor(merged, dst, cv.COLOR_RGB2RGBA);
    merged.delete();
  } finally {
    rgb.delete();
    channels.delete();
    out.delete();
    kernel.delete();
    tmp.forEach((m) => {
      try {
        m.delete();
      } catch {
        /* zaten silinmiş olabilir */
      }
    });
  }
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Gelişigüzel 4 noktayı tl, tr, br, bl sırasına dizer. */
function orderQuad(pts: Pt[]): Quad {
  const bySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y));
  const tl = bySum[0]!;
  const br = bySum[bySum.length - 1]!;
  const byDiff = [...pts].sort((a, b) => a.y - a.x - (b.y - b.x));
  const tr = byDiff[0]!; // x büyük, y küçük → (y-x) en küçük
  const bl = byDiff[byDiff.length - 1]!;
  return [tl, tr, br, bl];
}

/** Görüntünün kenarına küçük pay bırakan tam-kare dörtgeni (tespit başarısız olursa). */
export function fullFrameQuad(w: number, h: number): Quad {
  const m = Math.round(Math.min(w, h) * 0.03);
  return [
    { x: m, y: m },
    { x: w - m, y: m },
    { x: w - m, y: h - m },
    { x: m, y: h - m },
  ];
}

/**
 * Bir görüntüden (canvas) belge dörtgenini otomatik tespit eder. Bulamazsa `null`.
 * Performans için tespit küçültülmüş kopyada yapılır; köşeler orijinal ölçeğe
 * geri çevrilir.
 */
export async function detectDocumentQuad(
  canvas: HTMLCanvasElement,
): Promise<Quad | null> {
  const cv = await loadOpenCv();
  const src: CV = cv.imread(canvas);
  const work: CV = new cv.Mat();
  const gray: CV = new cv.Mat();
  const edges: CV = new cv.Mat();
  const kernel: CV = cv.Mat.ones(3, 3, cv.CV_8U);
  const contours: CV = new cv.MatVector();
  const hierarchy: CV = new cv.Mat();
  try {
    const scale = Math.min(1, 900 / Math.max(src.rows, src.cols));
    if (scale < 1) {
      cv.resize(
        src,
        work,
        new cv.Size(Math.round(src.cols * scale), Math.round(src.rows * scale)),
        0,
        0,
        cv.INTER_AREA,
      );
    } else {
      src.copyTo(work);
    }
    cv.cvtColor(work, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edges, 40, 120);
    // Kenar boşluklarını kapat — belge kenarı gölge/düşük kontrastta kesintili çıkar.
    cv.dilate(edges, edges, kernel);
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
    cv.findContours(
      edges,
      contours,
      hierarchy,
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE,
    );

    const imgArea = work.rows * work.cols;
    // Yeterince büyük konturları topla (eşik gevşek) ve alana göre azalan sırala.
    const cand: Array<{ c: CV; area: number }> = [];
    for (let i = 0; i < contours.size(); i++) {
      const c: CV = contours.get(i);
      const area = cv.contourArea(c);
      if (area > imgArea * 0.1) cand.push({ c, area });
      else c.delete();
    }
    cand.sort((a, b) => b.area - a.area);

    // En büyük 6 konturu, birden çok yaklaşım toleransıyla (epsilon) 4-köşe için dene.
    let best: Pt[] | null = null;
    for (const { c } of cand.slice(0, 6)) {
      if (best) break;
      const peri = cv.arcLength(c, true);
      for (const eps of [0.02, 0.04, 0.06, 0.08]) {
        const approx: CV = new cv.Mat();
        cv.approxPolyDP(c, approx, eps * peri, true);
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const pts: Pt[] = [];
          for (let r = 0; r < 4; r++) {
            pts.push({ x: approx.intPtr(r, 0)[0], y: approx.intPtr(r, 0)[1] });
          }
          best = pts;
        }
        approx.delete();
        if (best) break;
      }
    }
    cand.forEach(({ c }) => c.delete());

    if (!best) return null;
    const inv = scale < 1 ? 1 / scale : 1;
    return orderQuad(best.map((p) => ({ x: p.x * inv, y: p.y * inv })));
  } finally {
    src.delete();
    work.delete();
    gray.delete();
    edges.delete();
    kernel.delete();
    contours.delete();
    hierarchy.delete();
  }
}

/**
 * Verilen dörtgeni "dümdüz" bir belgeye çevirir (perspektif düzeltme) ve isteğe
 * göre gri/siyah-beyaz iyileştirir. Sonuç yeni bir <canvas> olarak döner.
 */
export async function warpDocument(
  canvas: HTMLCanvasElement,
  quad: Quad,
  enhance: EnhanceMode = "color",
): Promise<HTMLCanvasElement> {
  const cv = await loadOpenCv();
  const src: CV = cv.imread(canvas);
  const dst: CV = new cv.Mat();
  let srcTri: CV | null = null;
  let dstTri: CV | null = null;
  let M: CV | null = null;
  try {
    const [tl, tr, br, bl] = quad;
    const widthTop = dist(tr, tl);
    const widthBottom = dist(br, bl);
    const heightLeft = dist(bl, tl);
    const heightRight = dist(br, tr);
    const dstW = Math.max(1, Math.round(Math.max(widthTop, widthBottom)));
    const dstH = Math.max(1, Math.round(Math.max(heightLeft, heightRight)));

    srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x, tl.y,
      tr.x, tr.y,
      br.x, br.y,
      bl.x, bl.y,
    ]);
    dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      dstW, 0,
      dstW, dstH,
      0, dstH,
    ]);
    M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(
      src,
      dst,
      M,
      new cv.Size(dstW, dstH),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255),
    );

    if (enhance === "auto") {
      autoEnhance(cv, dst);
    } else if (enhance !== "color") {
      const g: CV = new cv.Mat();
      cv.cvtColor(dst, g, cv.COLOR_RGBA2GRAY);
      if (enhance === "bw") {
        cv.adaptiveThreshold(
          g,
          g,
          255,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY,
          15,
          10,
        );
      }
      cv.cvtColor(g, dst, cv.COLOR_GRAY2RGBA);
      g.delete();
    }

    const out = document.createElement("canvas");
    out.width = dstW;
    out.height = dstH;
    cv.imshow(out, dst);
    return out;
  } finally {
    src.delete();
    dst.delete();
    srcTri?.delete();
    dstTri?.delete();
    M?.delete();
  }
}

/**
 * OpenCV yoksa YEDEK kırpma: dörtgenin sınırlayıcı kutusunu 2D canvas ile kırpar.
 * Perspektif düzeltme YOK, ama en azından belge kırpılır (arka plan atılır) →
 * kullanıcı "orijinal işlendi" sorunu yaşamaz. `enhance` gri/s-b için basit uygulanır.
 */
export function cropQuadFallback(
  canvas: HTMLCanvasElement,
  quad: Quad,
  enhance: EnhanceMode = "color",
): HTMLCanvasElement {
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxX = Math.min(canvas.width, Math.ceil(Math.max(...xs)));
  const maxY = Math.min(canvas.height, Math.ceil(Math.max(...ys)));
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (ctx) {
    if (enhance === "gray") ctx.filter = "grayscale(1)";
    else if (enhance === "bw") ctx.filter = "grayscale(1) contrast(1.7) brightness(1.05)";
    else if (enhance === "auto") ctx.filter = "grayscale(0.15) contrast(1.25) brightness(1.12)";
    ctx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
  }
  return out;
}

/** Canvas'ı JPEG Blob'a çevirir (imagesToPdf için). */
export function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas boş."))),
      "image/jpeg",
      quality,
    );
  });
}
