/**
 * PERSPEKTİF DÜZELTME — OpenCV'siz, CSP-uyumlu (unsafe-eval / WASM gerekmez).
 * 4 köşeli bir dörtgeni "dümdüz" bir dikdörtgene çevirir (belge tarama) ve isteğe
 * göre gri / siyah-beyaz / otomatik (kontrast) iyileştirir. Ters homografi + 2D
 * ImageData ile CPU'da çalışır: her cihazda kesin, ağır bağımlılık yok.
 */

export type WarpPt = { x: number; y: number };
export type WarpQuad = [WarpPt, WarpPt, WarpPt, WarpPt]; // tl, tr, br, bl
export type WarpEnhance = "color" | "gray" | "bw" | "auto";

function dist(a: WarpPt, b: WarpPt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Birim kare (0,0)(1,0)(1,1)(0,1) → verilen dörtgen homografisi (Heckbert).
 * Mantıksal matris satırları: X = a11·u + a21·v + a31, Y = a12·u + a22·v + a32,
 * W = a13·u + a23·v + 1. Döndürülen dizi: [a11,a12,a13,a21,a22,a23,a31,a32].
 */
function squareToQuad(q: WarpQuad): number[] {
  const [p0, p1, p2, p3] = q; // (0,0)->p0, (1,0)->p1, (1,1)->p2, (0,1)->p3
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  let a13 = 0;
  let a23 = 0;
  if (dx3 !== 0 || dy3 !== 0) {
    const det = dx1 * dy2 - dx2 * dy1;
    a13 = det !== 0 ? (dx3 * dy2 - dx2 * dy3) / det : 0;
    a23 = det !== 0 ? (dx1 * dy3 - dx3 * dy1) / det : 0;
  }
  const a11 = p1.x - p0.x + a13 * p1.x;
  const a21 = p3.x - p0.x + a23 * p3.x;
  const a31 = p0.x;
  const a12 = p1.y - p0.y + a13 * p1.y;
  const a22 = p3.y - p0.y + a23 * p3.y;
  const a32 = p0.y;
  return [a11, a12, a13, a21, a22, a23, a31, a32];
}

/**
 * `source` görüntüsündeki `quad` bölgesini perspektif düzeltmeyle yeni bir
 * <canvas>'a çıkarır. Hedef boyut, dörtgenin kenar uzunluklarından hesaplanır.
 */
export function warpPerspective(
  source: HTMLCanvasElement,
  quad: WarpQuad,
  enhance: WarpEnhance = "color",
): HTMLCanvasElement {
  const [tl, tr, br, bl] = quad;
  const dstW = Math.max(1, Math.round(Math.max(dist(tr, tl), dist(br, bl))));
  const dstH = Math.max(1, Math.round(Math.max(dist(bl, tl), dist(br, tr))));

  const sctx = source.getContext("2d");
  if (!sctx) throw new Error("2D context unavailable");
  const sw = source.width;
  const sh = source.height;
  const sd = sctx.getImageData(0, 0, sw, sh).data;

  const out = document.createElement("canvas");
  out.width = dstW;
  out.height = dstH;
  const octx = out.getContext("2d")!;
  const oImg = octx.createImageData(dstW, dstH);
  const od = oImg.data;

  // Hedef birim kare (u=x/dstW, v=y/dstH) → kaynak piksel homografisi.
  const [a11, a12, a13, a21, a22, a23, a31, a32] = squareToQuad(quad);

  for (let y = 0; y < dstH; y++) {
    const v = y / dstH;
    for (let x = 0; x < dstW; x++) {
      const u = x / dstW;
      const w = a13 * u + a23 * v + 1;
      const sx = (a11 * u + a21 * v + a31) / w;
      const sy = (a12 * u + a22 * v + a32) / w;
      const oi = (y * dstW + x) * 4;

      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) {
        od[oi] = 255;
        od[oi + 1] = 255;
        od[oi + 2] = 255;
        od[oi + 3] = 255;
        continue;
      }
      // Bilinear örnekleme
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, sw - 1);
      const y1 = Math.min(y0 + 1, sh - 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      let r = lerp2(sd[i00], sd[i10], sd[i01], sd[i11], fx, fy);
      let g = lerp2(sd[i00 + 1], sd[i10 + 1], sd[i01 + 1], sd[i11 + 1], fx, fy);
      let b = lerp2(sd[i00 + 2], sd[i10 + 2], sd[i01 + 2], sd[i11 + 2], fx, fy);

      if (enhance === "gray" || enhance === "bw") {
        let lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (enhance === "bw") lum = lum < 128 ? 0 : 255;
        r = g = b = lum;
      } else if (enhance === "auto") {
        r = clamp255((r - 46) * 1.45 + 20);
        g = clamp255((g - 46) * 1.45 + 20);
        b = clamp255((b - 46) * 1.45 + 20);
      }
      od[oi] = r;
      od[oi + 1] = g;
      od[oi + 2] = b;
      od[oi + 3] = 255;
    }
  }
  octx.putImageData(oImg, 0, 0);
  return out;
}

function lerp2(p00: number, p10: number, p01: number, p11: number, fx: number, fy: number): number {
  const top = p00 + (p10 - p00) * fx;
  const bot = p01 + (p11 - p01) * fx;
  return top + (bot - top) * fy;
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
