/**
 * Cihaz-içi BELGE TARAMA motoru — Scanic (Rust→WebAssembly). Kamera karesinden
 * belgenin dört köşesini otomatik bulur ve perspektifi düzeltir. Scanic yalnız
 * WASM kullanır (CSP `wasm-unsafe-eval` yeterli; `unsafe-eval` GEREKMEZ) ve
 * ~100KB'dır — OpenCV.js'in 15MB'ı ve CSP `eval` sorunu yok. Görüntü SUNUCUYA
 * GİTMEZ; her şey cihazda işlenir.
 *
 * İyileştirme (gri/s-b/oto) Scanic'te olmadığından warp sonrası cihazda uygulanır.
 * Warp başarısız olursa CSP-safe CPU warp'a (perspectiveWarp) düşülür.
 */
import type { CornerPoints, Scanner as ScannerType } from "scanic";
import { warpPerspective, type WarpEnhance, type WarpQuad } from "./perspectiveWarp";

export type Pt = { x: number; y: number };
/** Dört köşe SIRALI: sol-üst, sağ-üst, sağ-alt, sol-alt. */
export type Quad = [Pt, Pt, Pt, Pt];
export type EnhanceMode = "color" | "gray" | "bw" | "auto";

// Scanic'i DİNAMİK yükle → ayrı chunk (ana bundle şişmez; yalnız tarayıcı açılınca iner).
let scanicPromise: Promise<typeof import("scanic")> | null = null;
function loadScanic() {
  return (scanicPromise ??= import("scanic"));
}

// Kalıcı WASM örneği (canlı/tekrarlı tarama için yeniden init maliyeti yok).
let scanner: ScannerType | null = null;
async function getScanner(): Promise<ScannerType> {
  const m = await loadScanic();
  if (!scanner) scanner = new m.Scanner();
  return scanner;
}

function cornersToQuad(c: CornerPoints): Quad {
  return [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft];
}
function quadToCorners(q: Quad): CornerPoints {
  return { topLeft: q[0], topRight: q[1], bottomRight: q[2], bottomLeft: q[3] };
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
 * Scanic WASM yoksa/başarısızsa hata fırlatır (çağıran taraf manuel moda düşer).
 */
export async function detectDocumentQuad(
  canvas: HTMLCanvasElement,
  useMl = false,
): Promise<Quad | null> {
  const s = await getScanner();
  // ML (nöral) dedektör: zorlu fotoğraflarda daha isabetli. Model + ORT wasm KENDİ
  // sunucumuzdan (self-host) iner → gizlilik + CSP korunur. Yüklenemez/bulamazsa
  // sessizce classical'a düşer. Canlı tespitte kullanılmaz (yavaş); yalnız çekimde.
  if (useMl) {
    try {
      const r = await s.scan(canvas, {
        mode: "detect",
        detector: "ml",
        ml: { assetBaseUrl: "/scanic-ml/", wasmPaths: "/scanic-ml/" },
      });
      if (r.success && r.corners) return cornersToQuad(r.corners);
    } catch {
      /* ML yüklenemedi → aşağıdaki classical'a düş */
    }
  }
  const r = await s.scan(canvas, {
    mode: "detect",
    maxProcessingDimension: 900,
  });
  if (!r.success || !r.corners) return null;
  return cornersToQuad(r.corners);
}

/**
 * Verilen dörtgeni "dümdüz" bir belgeye çevirir (perspektif düzeltme) ve isteğe
 * göre gri/siyah-beyaz/otomatik iyileştirir. Önce Scanic (WASM, hızlı); başarısızsa
 * CSP-safe CPU warp'a düşer. Sonuç yeni bir <canvas>.
 */
export async function warpDocument(
  canvas: HTMLCanvasElement,
  quad: Quad,
  enhance: EnhanceMode = "color",
): Promise<HTMLCanvasElement> {
  try {
    const m = await loadScanic();
    const r = await m.extractDocument(canvas, quadToCorners(quad), {
      output: "canvas",
    });
    if (r.success && r.output instanceof HTMLCanvasElement) {
      enhanceCanvasInPlace(r.output, enhance);
      return r.output;
    }
  } catch {
    /* WASM yoksa/başarısızsa aşağıdaki CPU warp'a düş */
  }
  return warpPerspective(canvas, quad as unknown as WarpQuad, enhance as WarpEnhance);
}

/** Warp edilmiş canvas'a gri / siyah-beyaz / otomatik (kontrast) iyileştirmeyi
 *  cihazda uygular (Scanic yalnız geometri yapar). `color` ise dokunmaz. */
function enhanceCanvasInPlace(canvas: HTMLCanvasElement, enhance: EnhanceMode): void {
  if (enhance === "color") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const a = img.data;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i]!;
    const g = a[i + 1]!;
    const b = a[i + 2]!;
    if (enhance === "gray" || enhance === "bw") {
      let lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (enhance === "bw") lum = lum < 128 ? 0 : 255;
      a[i] = a[i + 1] = a[i + 2] = lum;
    } else if (enhance === "auto") {
      a[i] = clamp255((r - 46) * 1.45 + 20);
      a[i + 1] = clamp255((g - 46) * 1.45 + 20);
      a[i + 2] = clamp255((b - 46) * 1.45 + 20);
    }
  }
  ctx.putImageData(img, 0, 0);
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * YEDEK kırpma: dörtgenin sınırlayıcı kutusunu 2D canvas ile kırpar (perspektifsiz).
 * Warp bir şekilde başarısız olsa bile en azından belge kırpılır.
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
