/**
 * Genel bir fotoğraftan KİMLİK KARTINI bulup düzeltir (kenar bulma + perspektif). Cihazda.
 *
 * Belge Tarayıcı'nın motorunu (Scanic, WASM + sinir ağı) kullanır. Kimlik fotoğrafın
 * küçük bir bölümünü kaplayabildiği için Belge Tarayıcı'nın "belge en az %4" filtresi
 * burada kullanılmaz; yerine "kart oranına benziyor mu" denetimi vardır.
 */
import type { Quad } from "./documentScan";

export type DetectResult = {
  /** Kırpılıp düzeltilmiş kart (yatay). Bulunamazsa null. */
  blob: Blob | null;
  /** Kartın fotoğrafın ne kadarını kapladığı (0–1); bulunamazsa 0. */
  coverage: number;
  /** Düzeltilmiş kartın piksel genişliği; 85,6 mm'de ~810 px = 240 dpi. */
  cardWidthPx: number;
  /** Uyarı ya da bilgi kodu. */
  reason: "ok" | "not-found" | "not-card-shaped";
};

const MIN_RATIO = 1.25;
const MAX_RATIO = 1.95;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Dörtgenin en/boy oranı (>= 1). Perspektif için karşılıklı kenarların ortalaması alınır. */
export function quadAspect(q: Quad): number {
  const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
  const h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
  if (w <= 0 || h <= 0) return 0;
  return Math.max(w, h) / Math.min(w, h);
}

/** Kimlik/ehliyet/pasaport oranına benziyor mu (1,25–1,95). */
export function isCardShaped(q: Quad): boolean {
  const r = quadAspect(q);
  return r >= MIN_RATIO && r <= MAX_RATIO;
}

/** Dörtgenin alanı (shoelace). */
export function quadArea(q: Quad): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i]!;
    const b = q[(i + 1) % 4]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Küçültülmüş görüntüde bulunan dörtgeni gerçek boyuta ölçekler. */
export function scaleQuad(q: Quad, k: number): Quad {
  return q.map((p) => ({ x: p.x * k, y: p.y * k })) as Quad;
}

/** Kullanıcıya gösterilecek çekim kalitesi uyarısı: null = sorun yok. */
export function qualityHint(r: Pick<DetectResult, "coverage" | "cardWidthPx" | "reason">): "closer" | "low-res" | null {
  if (r.reason !== "ok") return null;
  if (r.cardWidthPx > 0 && r.cardWidthPx < 700) return "low-res";
  if (r.coverage > 0 && r.coverage < 0.2) return "closer";
  return null;
}

function drawScaled(bmp: ImageBitmap, maxEdge: number): { canvas: HTMLCanvasElement; k: number } {
  const k = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return { canvas: c, k };
}

export async function detectIdCard(file: Blob): Promise<DetectResult> {
  const notFound: DetectResult = { blob: null, coverage: 0, cardWidthPx: 0, reason: "not-found" };
  const { detectDocumentQuad, warpDocument } = await import("./documentScan");
  const bmp = await createImageBitmap(file);
  // Tespit küçük görüntüde (hızlı), düzeltme büyük görüntüde (kaliteli).
  const small = drawScaled(bmp, 1280);
  const quadSmall = await detectDocumentQuad(small.canvas, true);
  if (!quadSmall) return notFound;
  const coverage = quadArea(quadSmall) / (small.canvas.width * small.canvas.height);
  if (coverage < 0.01) return notFound;
  if (!isCardShaped(quadSmall)) return { ...notFound, coverage, reason: "not-card-shaped" };

  const full = drawScaled(bmp, 3200);
  const quad = scaleQuad(quadSmall, (full.k / small.k) as number);
  let out = await warpDocument(full.canvas, quad, "color");
  // Kart yatay olmalı; dik çıktıysa 90° çevir.
  if (out.height > out.width) {
    const r = document.createElement("canvas");
    r.width = out.height;
    r.height = out.width;
    const ctx = r.getContext("2d")!;
    ctx.translate(r.width / 2, r.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(out, -out.width / 2, -out.height / 2);
    out = r;
  }
  const blob: Blob = await new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/jpeg", 0.95));
  return { blob, coverage, cardWidthPx: out.width, reason: "ok" };
}
