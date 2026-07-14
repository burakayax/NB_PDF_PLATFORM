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
import { warpPerspective, type WarpEnhance, type WarpQuad } from "./perspectiveWarp";

type CV = any;

let cvPromise: Promise<CV> | null = null;
// Bir kez yüklenemezse (ör. tarayıcı güvenlik ayarı / CSP eval engeli) TEKRAR
// DENEME — 15 MB chunk'ı her karede yeniden indirmeye çalışmayı önler.
let cvUnavailable = false;

/** OpenCV.js'i (bir kez) dinamik yükler ve WASM runtime'ı hazır olana dek bekler.
 *  Otomatik kenar tespiti için OPSİYONELDİR; perspektif düzeltme OpenCV'siz çalışır. */
export function loadOpenCv(): Promise<CV> {
  if (cvUnavailable) return Promise.reject(new Error("OpenCV unavailable"));
  if (!cvPromise) {
    cvPromise = import("@techstark/opencv-js")
      .then(async (mod) => {
        const cv = ((mod as unknown as { default?: CV }).default ?? mod) as CV;
        await waitForRuntime(cv);
        return cv;
      })
      .catch((e) => {
        cvUnavailable = true; // kalıcı olarak devre dışı → tekrar deneme yok
        cvPromise = null;
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
    }, 8000);
  });
}

export type Pt = { x: number; y: number };
/** Dört köşe SIRALI: sol-üst, sağ-üst, sağ-alt, sol-alt. */
export type Quad = [Pt, Pt, Pt, Pt];

export type EnhanceMode = "color" | "gray" | "bw" | "auto";

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
 * göre gri/siyah-beyaz/otomatik iyileştirir. OpenCV GEREKTİRMEZ — CSP-uyumlu
 * CPU warp (perspectiveWarp). Sonuç yeni bir <canvas>.
 */
export function warpDocument(
  canvas: HTMLCanvasElement,
  quad: Quad,
  enhance: EnhanceMode = "color",
): HTMLCanvasElement {
  return warpPerspective(canvas, quad as unknown as WarpQuad, enhance as WarpEnhance);
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
