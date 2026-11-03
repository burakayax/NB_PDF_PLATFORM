/**
 * Bloklar → okunaklı A4 PDF (pdf-lib + gömülü Roboto: Türkçe karakterler tam).
 * Başlıklar, paragraflar (kalın parçalarla), madde işaretli listeler, alıntı, kod kutusu, yatay çizgi,
 * sayfa sonu ve alt bilgide sayfa numarası. Fontta olmayan karakterler "?" yerine güvenle atlanır/yer tutucuya çevrilir.
 */
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Block, Run } from "./docText";
import { loadPdfFonts } from "./summaryPdf";
import { PDF_SAVE_OPTIONS } from "./pdfSaveOptions";

const PW = 595.28;
const PH = 841.89;
const M = 56;
const INK = rgb(0.1, 0.11, 0.15);
const MUTED = rgb(0.45, 0.47, 0.54);
const LINE = rgb(0.82, 0.83, 0.88);
const CODE_BG = rgb(0.95, 0.95, 0.97);
const QUOTE = rgb(0.4, 0.2, 0.82);

export type BlocksPdfOptions = { title?: string; fontSize?: number };

export async function blocksToPdf(blocks: Block[], opts: BlocksPdfOptions = {}): Promise<Uint8Array> {
  const { regular, bold } = await loadPdfFonts();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const reg = await pdf.embedFont(regular, { subset: true });
  const bld = await pdf.embedFont(bold, { subset: true });
  if (opts.title) pdf.setTitle(opts.title);

  const sets = new Map<PDFFont, Set<number>>();
  const has = (f: PDFFont, cp: number) => {
    let s = sets.get(f);
    if (!s) {
      s = new Set(f.getCharacterSet());
      sets.set(f, s);
    }
    return s.has(cp);
  };
  /** Fontta olmayan karakterleri temizler (sekme → boşluk, sıfır genişlik/denetim karakterleri atılır). */
  const clean = (s: string, f: PDFFont): string => {
    let out = "";
    for (const ch of s.replace(/\t/g, "    ").replace(/\u00a0/g, " ")) {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp === 0x0a || cp === 0x0d) { out += " "; continue; }
      if (cp < 0x20 || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfeff || cp === 0xad || (cp >= 0x202a && cp <= 0x202e)) continue;
      out += has(f, cp) ? ch : cp > 0xffff ? "" : "?";
    }
    return out;
  };

  const body = opts.fontSize ?? 11;
  const lead = body * 1.5;
  const maxW = PW - M * 2;

  let page = pdf.addPage([PW, PH]);
  let y = PH - M;
  const newPage = () => {
    page = pdf.addPage([PW, PH]);
    y = PH - M;
  };
  const ensure = (h: number) => {
    if (y - h < M) newPage();
  };

  type Tok = { s: string; b: boolean; w: number };
  const tokensOf = (runs: Run[], size: number, forceBold: boolean): Tok[] => {
    const out: Tok[] = [];
    for (const r of runs) {
      const b = forceBold || !!r.b;
      const f = b ? bld : reg;
      for (const w of clean(r.t, f).split(/ +/)) {
        if (w) out.push({ s: w, b, w: f.widthOfTextAtSize(w, size) });
      }
    }
    return out;
  };

  /** Sözcükleri genişliğe göre satırlara dizer (çok uzun sözcük karakter karakter bölünür). */
  const wrapTokens = (toks: Tok[], size: number, width: number): Tok[][] => {
    const sp = reg.widthOfTextAtSize(" ", size);
    const lines: Tok[][] = [];
    let cur: Tok[] = [];
    let w = 0;
    const push = () => {
      if (cur.length) lines.push(cur);
      cur = [];
      w = 0;
    };
    for (let t of toks) {
      while (t.w > width) {
        const f = t.b ? bld : reg;
        let cut = t.s.length - 1;
        while (cut > 1 && f.widthOfTextAtSize(t.s.slice(0, cut), size) > width) cut--;
        const head = { s: t.s.slice(0, cut), b: t.b, w: f.widthOfTextAtSize(t.s.slice(0, cut), size) };
        if (cur.length) push();
        cur.push(head);
        push();
        const rest = t.s.slice(cut);
        t = { s: rest, b: t.b, w: f.widthOfTextAtSize(rest, size) };
      }
      const add = (cur.length ? sp : 0) + t.w;
      if (w + add > width && cur.length) push();
      w += (cur.length ? sp : 0) + t.w;
      cur.push(t);
    }
    push();
    return lines;
  };

  const drawTokens = (line: Tok[], x: number, baseY: number, size: number, color = INK) => {
    const sp = reg.widthOfTextAtSize(" ", size);
    let cx = x;
    for (const t of line) {
      page.drawText(t.s, { x: cx, y: baseY, size, font: t.b ? bld : reg, color });
      cx += t.w + sp;
    }
  };

  const paragraph = (runs: Run[], size: number, opt: { x?: number; width?: number; gap?: number; bullet?: string; color?: ReturnType<typeof rgb>; forceBold?: boolean; bar?: boolean } = {}) => {
    const x = opt.x ?? M;
    const width = opt.width ?? maxW;
    const ls = size * 1.5;
    const lines = wrapTokens(tokensOf(runs, size, !!opt.forceBold), size, width);
    if (!lines.length) return;
    lines.forEach((ln, i) => {
      ensure(ls);
      const top = y;
      if (i === 0 && opt.bullet) {
        const bw = reg.widthOfTextAtSize(clean(opt.bullet, reg), size);
        page.drawText(clean(opt.bullet, reg), { x: x - bw - 6, y: top - size, size, font: reg, color: MUTED });
      }
      if (opt.bar) page.drawRectangle({ x: x - 10, y: top - ls + 3, width: 2.5, height: ls, color: QUOTE });
      drawTokens(ln, x, top - size, size, opt.color ?? INK);
      y -= ls;
    });
    y -= opt.gap ?? 6;
  };

  for (const b of blocks) {
    if (b.k === "break") {
      if (y < PH - M - 1) newPage();
    } else if (b.k === "h") {
      const size = b.level === 1 ? 20 : b.level === 2 ? 16 : 13;
      ensure(size * 1.5 * 2 + lead * 2);
      y -= b.level === 1 ? 10 : 6;
      paragraph([{ t: b.text }], size, { forceBold: true, gap: 6 });
    } else if (b.k === "p") {
      const indent = b.bullet ? 14 + (b.indent ?? 1) * 14 : 0;
      paragraph(b.runs, body, { x: M + indent, width: maxW - indent, bullet: b.bullet, gap: b.bullet ? 3 : 7 });
    } else if (b.k === "lines") {
      for (const l of b.lines) {
        const lines = wrapTokens(tokensOf([{ t: l }], body, false), body, maxW);
        if (!lines.length) { y -= lead; continue; }
        for (const ln of lines) {
          ensure(lead);
          drawTokens(ln, M, y - body, body);
          y -= lead;
        }
      }
      y -= 8;
    } else if (b.k === "quote") {
      paragraph(b.runs, body, { x: M + 18, width: maxW - 18, bar: true, color: rgb(0.25, 0.27, 0.35), gap: 8 });
    } else if (b.k === "code") {
      const size = body - 1.5;
      const ls = size * 1.45;
      const rows: Tok[][] = [];
      for (const raw of b.text.split("\n")) {
        const t = clean(raw, reg);
        rows.push(...(t ? wrapTokens([{ s: t, b: false, w: reg.widthOfTextAtSize(t, size) }], size, maxW - 16) : [[]]));
      }
      let i = 0;
      while (i < rows.length) {
        ensure(ls + 8);
        const fit = Math.max(1, Math.min(rows.length - i, Math.floor((y - M - 8) / ls)));
        const h = fit * ls + 8;
        page.drawRectangle({ x: M, y: y - h, width: maxW, height: h, color: CODE_BG });
        for (let k = 0; k < fit; k++) {
          const row = rows[i + k];
          if (row.length) drawTokens(row, M + 8, y - 4 - size - k * ls, size);
        }
        y -= h;
        i += fit;
      }
      y -= 8;
    } else if (b.k === "hr") {
      ensure(18);
      y -= 8;
      page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.7, color: LINE });
      y -= 10;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    const t = `${i + 1} / ${pages.length}`;
    pg.drawText(t, { x: PW / 2 - reg.widthOfTextAtSize(t, 8) / 2, y: 28, size: 8, font: reg, color: MUTED });
  });
  return pdf.save(PDF_SAVE_OPTIONS);
}
