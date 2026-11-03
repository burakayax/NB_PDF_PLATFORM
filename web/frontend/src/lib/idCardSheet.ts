/**
 * Kimlik / ehliyet / pasaport ön–arka yüzünü TEK A4 sayfaya yerleştirir. Tamamen cihazda.
 * Kimlik belgesi görüntüsü sunucuya GİTMEZ (bu araçta gizlilik zorunluluktur).
 *
 * Yerleşim saf hesaptır (`layoutSheet`) ve test edilir; çizim tarayıcı canvas'ı + pdf-lib ile yapılır.
 */

export type CardKind = "id1" | "id3";
/** İki yüz alt alta mı, tek yüz mü. */
export type SheetMode = "two" | "one";

/** Gerçek belge ölçüleri (mm): ID-1 = kimlik kartı/ehliyet, ID-3 = pasaport. */
export const CARD_MM: Record<CardKind, { w: number; h: number }> = {
  id1: { w: 85.6, h: 54 },
  id3: { w: 125, h: 88 },
};

export const A4_MM = { w: 210, h: 297 };
const MM_TO_PT = 72 / 25.4;
const GAP_MM = 12;
const TOP_MM = 28;

export type Rect = { x: number; y: number; w: number; h: number };

/** Sayfa (pt, sol-üst başlangıç) üzerindeki kart dikdörtgenleri. Gerçek boyut. */
export function layoutSheet(kind: CardKind, mode: SheetMode): { page: { w: number; h: number }; cards: Rect[] } {
  const c = CARD_MM[kind];
  const page = { w: A4_MM.w * MM_TO_PT, h: A4_MM.h * MM_TO_PT };
  const x = ((A4_MM.w - c.w) / 2) * MM_TO_PT;
  const mk = (topMm: number): Rect => ({ x, y: topMm * MM_TO_PT, w: c.w * MM_TO_PT, h: c.h * MM_TO_PT });
  const cards = mode === "two" ? [mk(TOP_MM), mk(TOP_MM + c.h + GAP_MM)] : [mk(TOP_MM)];
  return { page, cards };
}

export type Rotation = 0 | 90 | 180 | 270;

export type WatermarkOpts = { text: string; opacity?: number };

/** Kaynak görseli kart oranlı tuvale sığdırır (kırpmaz), isteğe bağlı döndürür ve filigran basar. */
export async function renderCardJpeg(
  file: Blob,
  kind: CardKind,
  rotation: Rotation,
  watermark?: WatermarkOpts,
): Promise<Uint8Array> {
  const dpi = 300;
  const c = CARD_MM[kind];
  const W = Math.round((c.w / 25.4) * dpi);
  const H = Math.round((c.h / 25.4) * dpi);
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const quarter = rotation === 90 || rotation === 270;
  const sw = quarter ? bmp.height : bmp.width;
  const sh = quarter ? bmp.width : bmp.height;
  const k = Math.min(W / sw, H / sh);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bmp, (-bmp.width * k) / 2, (-bmp.height * k) / 2, bmp.width * k, bmp.height * k);
  ctx.restore();
  if (watermark?.text.trim()) {
    ctx.save();
    ctx.globalAlpha = watermark.opacity ?? 0.3;
    ctx.fillStyle = "#b91c1c";
    const size = Math.round(H / 7);
    ctx.font = `bold ${size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 8);
    const step = size * 2.2;
    for (let yy = -H; yy <= H; yy += step) {
      for (let xx = -W; xx <= W; xx += ctx.measureText(watermark.text).width + size) {
        ctx.fillText(watermark.text, xx, yy);
      }
    }
    ctx.restore();
  }
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("jpeg"))), "image/jpeg", 0.92));
  return new Uint8Array(await blob.arrayBuffer());
}

export type SheetInput = { file: Blob; rotation: Rotation };

/** Tek A4 PDF üretir. `inputs` uzunluğu mode ile uyumlu olmalı (two → 2, one → 1). */
export async function buildIdSheetPdf(
  kind: CardKind,
  mode: SheetMode,
  inputs: SheetInput[],
  watermark?: WatermarkOpts,
): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const { page, cards } = layoutSheet(kind, mode);
  const pdf = await PDFDocument.create();
  const pg = pdf.addPage([page.w, page.h]);
  for (let i = 0; i < cards.length; i++) {
    const inp = inputs[i];
    if (!inp) continue;
    const jpg = await pdf.embedJpg(await renderCardJpeg(inp.file, kind, inp.rotation, watermark));
    const r = cards[i]!;
    pg.drawImage(jpg, { x: r.x, y: page.h - r.y - r.h, width: r.w, height: r.h });
    pg.drawRectangle({ x: r.x, y: page.h - r.y - r.h, width: r.w, height: r.h, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
  }
  return pdf.save();
}
