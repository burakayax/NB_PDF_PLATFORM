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
/** Sayfa kenarından bırakılan boşluk (mm). */
const MARGIN_MM = 15;
/** Çakışma sayılmayan en küçük boşluk (mm). */
const MIN_SEP_MM = 3;

/** Sayfadaki yatay / dikey hizalama. Varsayılan: üstte, yatayda ortalı. */
export type AlignH = "left" | "center" | "right";
export type AlignV = "top" | "middle" | "bottom";
export type SheetAlign = { h: AlignH; v: AlignV };
/** Ön ve arka yüz ayrı ayrı konumlanır. */
export type SheetAligns = { front: SheetAlign; back: SheetAlign };
export const DEFAULT_ALIGN: SheetAlign = { h: "center", v: "top" };
export const DEFAULT_ALIGNS: SheetAligns = { front: DEFAULT_ALIGN, back: DEFAULT_ALIGN };

/** Arayüzdeki seçilebilir konumlar: 3 sütun × 3 satır. */
export const UI_COLS: AlignH[] = ["left", "center", "right"];
export const UI_ROWS: AlignV[] = ["top", "middle", "bottom"];

/** Hazır düzen 1: ortada, ön yüz üstte arka yüz hemen altında (tek blok; aynı konum = birlikte). */
export function stackedAligns(_kind: CardKind): SheetAligns {
  return { front: DEFAULT_ALIGN, back: DEFAULT_ALIGN };
}

/** Hazır düzen 2: yan yana (sol üst + sağ üst). Belge sığmıyorsa (pasaport) null. */
export function sideBySideAligns(kind: CardKind): SheetAligns | null {
  const front: SheetAlign = { h: "left", v: "top" };
  const back: SheetAlign = { h: "right", v: "top" };
  return alignmentsConflict(kind, front, back) ? null : { front, back };
}

/** Başlangıç düzeni = ortada alt alta. */
export const defaultAligns = stackedAligns;

export type Rect = { x: number; y: number; w: number; h: number };

export const sameAlign = (a: SheetAlign, b: SheetAlign) => a.h === b.h && a.v === b.v;

/** Bir kartın (mm) verilen hizalamadaki sol-üst köşesi; `blockH` = hizalanan bloğun yüksekliği. */
function originMm(kind: CardKind, align: SheetAlign, blockH: number): { x: number; y: number } {
  const c = CARD_MM[kind];
  const x = align.h === "left" ? MARGIN_MM : align.h === "right" ? A4_MM.w - MARGIN_MM - c.w : (A4_MM.w - c.w) / 2;
  const y = align.v === "top" ? MARGIN_MM : align.v === "bottom" ? A4_MM.h - MARGIN_MM - blockH : (A4_MM.h - blockH) / 2;
  return { x, y };
}

/** Tek kartın (mm) verilen hizalamadaki dikdörtgeni. */
function cardMm(kind: CardKind, align: SheetAlign) {
  const c = CARD_MM[kind];
  const o = originMm(kind, align, c.h);
  return { x: o.x, y: o.y, w: c.w, h: c.h };
}

/** İki hizalamadaki kartlar aynı yerde mi, üst üste mi ya da birbirine çok yakın mı? */
export function alignmentsConflict(kind: CardKind, a: SheetAlign, b: SheetAlign): boolean {
  if (sameAlign(a, b)) return true;
  const r1 = cardMm(kind, a);
  const r2 = cardMm(kind, b);
  return (
    r1.x < r2.x + r2.w + MIN_SEP_MM && r2.x < r1.x + r1.w + MIN_SEP_MM && r1.y < r2.y + r2.h + MIN_SEP_MM && r2.y < r1.y + r1.h + MIN_SEP_MM
  );
}

/**
 * Sayfa (pt, sol-üst başlangıç) üzerindeki kart dikdörtgenleri. Gerçek boyut.
 * Ön ve arka yüz ayrı konumlanır. İkisi AYNI konumu seçerse tek blok olarak konur: arka yüz ön yüzün hemen altına gelir ("alt alta").
 */
export function layoutSheet(
  kind: CardKind,
  mode: SheetMode,
  aligns: SheetAligns = DEFAULT_ALIGNS,
): { page: { w: number; h: number }; cards: Rect[] } {
  const c = CARD_MM[kind];
  const page = { w: A4_MM.w * MM_TO_PT, h: A4_MM.h * MM_TO_PT };
  const pt = (r: { x: number; y: number; w: number; h: number }): Rect => ({ x: r.x * MM_TO_PT, y: r.y * MM_TO_PT, w: r.w * MM_TO_PT, h: r.h * MM_TO_PT });
  if (mode === "one") return { page, cards: [pt(cardMm(kind, aligns.front))] };
  if (sameAlign(aligns.front, aligns.back)) {
    const o = originMm(kind, aligns.front, c.h * 2 + GAP_MM);
    return { page, cards: [pt({ x: o.x, y: o.y, w: c.w, h: c.h }), pt({ x: o.x, y: o.y + c.h + GAP_MM, w: c.w, h: c.h })] };
  }
  return { page, cards: [pt(cardMm(kind, aligns.front)), pt(cardMm(kind, aligns.back))] };
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
  aligns: SheetAligns = DEFAULT_ALIGNS,
): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const { page, cards } = layoutSheet(kind, mode, aligns);
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
