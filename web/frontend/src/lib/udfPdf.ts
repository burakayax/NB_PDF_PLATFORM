/**
 * UDF → PDF ÇİZİCİ — cihazda, pdf-lib ile.
 *
 * `parseUdf()` çıktısındaki blokları A4 sayfalara döker: paragraf hizalaması,
 * kalın/altı çizili/üst simge, renk, girinti, tablo ve gömülü görsel. Türkçe
 * karakterler için Unicode font (Roboto) fontkit ile GÖMÜLÜR — pdf-lib'in
 * yerleşik fontları WinAnsi olduğu için ğ/ş/ı/İ gibi harfleri çizemez.
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { PDF_SAVE_OPTIONS } from "./pdfSaveOptions";
import type { UdfDocument, UdfParagraph, UdfRun, UdfTable } from "./udf";

const A4 = { w: 595.28, h: 841.89 };
/** Satır yüksekliği çarpanı — UYAP editörünün göze yakın aralığı. */
const LINE_HEIGHT = 1.32;
/** Paragraflar arası ek boşluk (nokta). */
const PARA_GAP = 4;
const TABLE_PAD = 4;

export type UdfPdfFonts = {
  regular: ArrayBuffer | Uint8Array;
  bold: ArrayBuffer | Uint8Array;
};

type Ctx = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  /** İmlecin dikey konumu (sayfa üstünden aşağı doğru, pdf-lib origin sol-alt). */
  y: number;
  pageW: number;
  pageH: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function hexToRgb(hex: string | undefined): RGB {
  if (!hex) return rgb(0, 0, 0);
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0, 0, 0);
  const n = Number.parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function fontFor(ctx: Ctx, run: UdfRun): PDFFont {
  return run.bold ? ctx.bold : ctx.regular;
}

function sizeFor(run: UdfRun, fallback: number): number {
  const s = run.size && run.size > 0 ? run.size : fallback;
  // Üst simge (dipnot numarası) küçültülerek çizilir.
  return run.superscript ? s * 0.7 : s;
}

/**
 * Fontun çizemediği karakterler pdf-lib'de istisna fırlatır ve tüm dönüşümü
 * düşürür. Bu yüzden ölçmeden önce metni güvenli hâle getiriyoruz.
 */
function sanitize(text: string, font: PDFFont): string {
  let out = "";
  for (const ch of text) {
    if (ch === "\r") continue;
    if (ch === "​" || ch === "￼") continue; // sıfır genişlik / nesne yer tutucu
    try {
      font.widthOfTextAtSize(ch, 12);
      out += ch;
    } catch {
      out += " ";
    }
  }
  return out;
}

function widthOf(font: PDFFont, text: string, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    return text.length * size * 0.5;
  }
}

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([ctx.pageW, ctx.pageH]);
  ctx.y = ctx.pageH - ctx.top;
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < ctx.bottom) newPage(ctx);
}

/** Tek satırda çizilecek, aynı biçime sahip parça. */
type Piece = { text: string; font: PDFFont; size: number; color: RGB; run: UdfRun };
type Line = { pieces: Piece[]; width: number; height: number };

/**
 * Paragrafın parçalarını verilen genişliğe göre satırlara böler. Kırma kelime
 * sınırındadır; tek başına sığmayan uzun kelime karakterden bölünür.
 */
function layoutLines(ctx: Ctx, para: UdfParagraph, maxWidth: number, baseSize: number): Line[] {
  const lines: Line[] = [];
  let cur: Line = { pieces: [], width: 0, height: 0 };

  const pushLine = () => {
    if (cur.pieces.length === 0 && lines.length > 0) return;
    if (cur.height === 0) cur.height = baseSize * LINE_HEIGHT;
    lines.push(cur);
    cur = { pieces: [], width: 0, height: 0 };
  };

  const addPiece = (text: string, font: PDFFont, size: number, color: RGB, run: UdfRun) => {
    const w = widthOf(font, text, size);
    cur.pieces.push({ text, font, size, color, run });
    cur.width += w;
    cur.height = Math.max(cur.height, size * LINE_HEIGHT);
  };

  for (const run of para.runs) {
    const font = fontFor(ctx, run);
    const size = sizeFor(run, baseSize);
    const color = hexToRgb(run.color);
    const text = sanitize(run.text.replace(/\t/g, "    "), font);
    if (!text) continue;

    // Satır sonları paragraf içinde de gelebilir (UDF'te \n metnin parçasıdır).
    const segments = text.split("\n");
    segments.forEach((segment, si) => {
      if (si > 0) pushLine();
      if (!segment) return;

      // Boşlukları koruyarak kelimelere ayır.
      const words = segment.match(/\s+|\S+/g) ?? [];
      for (const word of words) {
        const w = widthOf(font, word, size);
        if (cur.width + w <= maxWidth || cur.pieces.length === 0) {
          addPiece(word, font, size, color, run);
          continue;
        }
        // Sığmıyor → satırı kapat. Baştaki boşluk yeni satıra taşınmaz.
        pushLine();
        if (/^\s+$/.test(word)) continue;
        if (w <= maxWidth) {
          addPiece(word, font, size, color, run);
          continue;
        }
        // Tek kelime satırdan uzun → karakterden böl.
        let chunk = "";
        for (const ch of word) {
          const test = chunk + ch;
          if (widthOf(font, test, size) > maxWidth && chunk) {
            addPiece(chunk, font, size, color, run);
            pushLine();
            chunk = ch;
          } else {
            chunk = test;
          }
        }
        if (chunk) addPiece(chunk, font, size, color, run);
      }
    });
  }
  pushLine();
  return lines;
}

function drawLine(
  ctx: Ctx,
  line: Line,
  startX: number,
  maxWidth: number,
  alignment: UdfParagraph["alignment"],
  isLastLine: boolean,
): void {
  let x = startX;
  let extraPerGap = 0;

  if (alignment === "center") {
    x = startX + (maxWidth - line.width) / 2;
  } else if (alignment === "right") {
    x = startX + (maxWidth - line.width);
  } else if (alignment === "justify" && !isLastLine) {
    const gaps = line.pieces.filter((p) => /^\s+$/.test(p.text)).length;
    if (gaps > 0) extraPerGap = (maxWidth - line.width) / gaps;
  }
  if (x < startX) x = startX;

  const baseline = ctx.y - line.height;
  for (const piece of line.pieces) {
    const w = widthOf(piece.font, piece.text, piece.size);
    // Üst simge biraz yukarı kaydırılır.
    const dy = piece.run.superscript ? piece.size * 0.35 : 0;
    if (piece.text.trim()) {
      try {
        ctx.page.drawText(piece.text, {
          x,
          y: baseline + piece.size * 0.22 + dy,
          size: piece.size,
          font: piece.font,
          color: piece.color,
        });
      } catch {
        // Tek bir parça çizilemezse belgenin kalanı korunur.
      }
      if (piece.run.underline) {
        ctx.page.drawLine({
          start: { x, y: baseline + piece.size * 0.08 },
          end: { x: x + w, y: baseline + piece.size * 0.08 },
          thickness: Math.max(0.4, piece.size * 0.05),
          color: piece.color,
        });
      }
      if (piece.run.strikethrough) {
        ctx.page.drawLine({
          start: { x, y: baseline + piece.size * 0.42 },
          end: { x: x + w, y: baseline + piece.size * 0.42 },
          thickness: Math.max(0.4, piece.size * 0.05),
          color: piece.color,
        });
      }
    }
    x += w + (/^\s+$/.test(piece.text) ? extraPerGap : 0);
  }
  ctx.y -= line.height;
}

async function drawImages(ctx: Ctx, para: UdfParagraph): Promise<void> {
  for (const img of para.images) {
    try {
      const embedded =
        img.mime === "image/png"
          ? await ctx.doc.embedPng(img.bytes)
          : await ctx.doc.embedJpg(img.bytes);
      const avail = ctx.pageW - ctx.left - ctx.right;
      let w = img.width && img.width > 0 ? img.width : embedded.width;
      let h = img.height && img.height > 0 ? img.height : embedded.height;
      if (w > avail) {
        h = (h * avail) / w;
        w = avail;
      }
      const maxH = ctx.pageH - ctx.top - ctx.bottom;
      if (h > maxH) {
        w = (w * maxH) / h;
        h = maxH;
      }
      ensureSpace(ctx, h + PARA_GAP);
      ctx.page.drawImage(embedded, { x: ctx.left, y: ctx.y - h, width: w, height: h });
      ctx.y -= h + PARA_GAP;
    } catch {
      // Gömülemeyen görsel atlanır; metin kaybolmaz.
    }
  }
}

async function drawParagraph(
  ctx: Ctx,
  para: UdfParagraph,
  baseSize: number,
  boxLeft = ctx.left,
  boxWidth = ctx.pageW - ctx.left - ctx.right,
): Promise<void> {
  const startX = boxLeft + para.leftIndent;
  const maxWidth = Math.max(40, boxWidth - para.leftIndent - para.rightIndent);
  const lines = layoutLines(ctx, para, maxWidth, baseSize);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    ensureSpace(ctx, line.height);
    drawLine(ctx, line, startX, maxWidth, para.alignment, i === lines.length - 1);
  }
  await drawImages(ctx, para);
  ctx.y -= PARA_GAP;
}

/** Hücre içeriğini ölçmek için: çizmeden satır yüksekliklerini toplar. */
function measureCell(ctx: Ctx, paras: UdfParagraph[], width: number, baseSize: number): number {
  let h = 0;
  for (const p of paras) {
    const inner = Math.max(20, width - TABLE_PAD * 2 - p.leftIndent - p.rightIndent);
    for (const line of layoutLines(ctx, p, inner, baseSize)) h += line.height;
    h += PARA_GAP;
  }
  return h + TABLE_PAD * 2;
}

async function drawTable(ctx: Ctx, table: UdfTable, baseSize: number): Promise<void> {
  const avail = ctx.pageW - ctx.left - ctx.right;
  const total = table.columnRatios.reduce((a, b) => a + b, 0) || table.columnCount;
  const widths = table.columnRatios.map((r) => (r / total) * avail);

  for (const row of table.rows) {
    const heights = row.map((cell, i) => measureCell(ctx, cell, widths[i] ?? avail, baseSize));
    const rowH = Math.max(...heights, baseSize * LINE_HEIGHT + TABLE_PAD * 2);

    // Satır sayfaya sığmıyorsa yeni sayfaya taşı (satır bölünmez).
    if (ctx.y - rowH < ctx.bottom) newPage(ctx);

    const rowTop = ctx.y;
    let x = ctx.left;
    for (let i = 0; i < row.length; i += 1) {
      const w = widths[i] ?? avail / row.length;
      ctx.page.drawRectangle({
        x,
        y: rowTop - rowH,
        width: w,
        height: rowH,
        borderWidth: 0.6,
        borderColor: rgb(0.45, 0.45, 0.45),
      });
      const savedY = ctx.y;
      ctx.y = rowTop - TABLE_PAD;
      for (const p of row[i]) {
        await drawParagraph(ctx, p, baseSize, x + TABLE_PAD, w - TABLE_PAD * 2);
      }
      ctx.y = savedY;
      x += w;
    }
    ctx.y = rowTop - rowH;
  }
  ctx.y -= PARA_GAP;
}

/**
 * Ayrıştırılmış UDF belgesini PDF baytlarına çevirir.
 * `fonts` — Unicode TTF baytları (Roboto Regular + Bold).
 */
export async function udfToPdf(udf: UdfDocument, fonts: UdfPdfFonts): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fonts.regular, { subset: true });
  const bold = await doc.embedFont(fonts.bold, { subset: true });

  const landscape = udf.page.landscape;
  const pageW = landscape ? A4.h : A4.w;
  const pageH = landscape ? A4.w : A4.h;

  // Çok küçük kenar boşlukları okunabilirliği bozuyor; alt sınır uygulanır.
  const left = Math.max(28, udf.page.leftMargin);
  const right = Math.max(28, udf.page.rightMargin);
  const top = Math.max(36, udf.page.topMargin);
  const bottom = Math.max(36, udf.page.bottomMargin);

  const ctx: Ctx = {
    doc,
    regular,
    bold,
    page: doc.addPage([pageW, pageH]),
    y: pageH - top,
    pageW,
    pageH,
    left,
    right,
    top,
    bottom,
  };

  const baseSize = udf.defaultSize > 0 ? udf.defaultSize : 12;

  for (const block of udf.blocks) {
    if (block.kind === "paragraph") {
      await drawParagraph(ctx, block, baseSize);
    } else if (block.kind === "table") {
      await drawTable(ctx, block, baseSize);
    } else {
      newPage(ctx);
    }
  }

  try {
    // NOT: pdf-lib kaydederken Producer alanını her hâlükârda kendi imzasıyla
    // ezer; kalıcı olan künye Creator'dır. İkisi de yazılıyor ki kütüphane bu
    // davranışını değiştirdiğinde çıktı kendiliğinden doğrulansın.
    doc.setProducer("PDF Platform (pdfplatform.app)");
    doc.setCreator("PDF Platform (pdfplatform.app)");
    doc.setModificationDate(new Date());
  } catch {
    /* künye yazılamazsa çıktı yine geçerli */
  }

  return doc.save(PDF_SAVE_OPTIONS);
}
