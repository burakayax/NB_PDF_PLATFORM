/**
 * pdf-lib ile matematik çizimi: üs/indis, kesir, kök, semboller (gerekirse yedek yazı tipiyle) ve fonksiyon grafiği.
 * Her öğe bir "kutu"dur: genişlik + taban çizgisinin üstü/altı yüksekliği + çizim fonksiyonu.
 */
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { splitMath, type MNode } from "./mathText";
import { plotData, tickLabel, type GraphSpec } from "./graphPlot";

export type Fonts = { reg: PDFFont; bold: PDFFont; fb?: PDFFont };
type RGB = ReturnType<typeof rgb>;

export type Box = {
  w: number;
  asc: number;
  desc: number;
  draw: (page: PDFPage, x: number, y: number, color: RGB) => void;
};

const charSets = new WeakMap<PDFFont, Set<number>>();
function hasGlyph(font: PDFFont, ch: string): boolean {
  let set = charSets.get(font);
  if (!set) {
    try {
      set = new Set(font.getCharacterSet());
    } catch {
      set = new Set();
    }
    charSets.set(font, set);
  }
  return set.size === 0 ? true : set.has(ch.codePointAt(0) ?? 0);
}

/** Düz metni, glifi olmayan karakterleri yedek yazı tipine vererek kutuya çevirir. */
export function textBox(text: string, f: Fonts, size: number, bold: boolean): Box {
  const main = bold ? f.bold : f.reg;
  const runs: { s: string; font: PDFFont; w: number }[] = [];
  for (const ch of text) {
    const font = f.fb && !hasGlyph(main, ch) ? f.fb : main;
    const last = runs[runs.length - 1];
    if (last && last.font === font) last.s += ch;
    else runs.push({ s: ch, font, w: 0 });
  }
  let w = 0;
  for (const r of runs) {
    try {
      r.w = r.font.widthOfTextAtSize(r.s, size);
    } catch {
      r.s = r.s.replace(/./gu, "?");
      r.w = r.font.widthOfTextAtSize(r.s, size);
    }
    w += r.w;
  }
  return {
    w,
    asc: size * 0.8,
    desc: size * 0.22,
    draw: (page, x, y, color) => {
      let cx = x;
      for (const r of runs) {
        page.drawText(r.s, { x: cx, y, size, font: r.font, color });
        cx += r.w;
      }
    },
  };
}

const concat = (boxes: Box[]): Box => {
  const w = boxes.reduce((s, b) => s + b.w, 0);
  return {
    w,
    asc: Math.max(0, ...boxes.map((b) => b.asc)),
    desc: Math.max(0, ...boxes.map((b) => b.desc)),
    draw: (page, x, y, color) => {
      let cx = x;
      for (const b of boxes) {
        b.draw(page, cx, y, color);
        cx += b.w;
      }
    },
  };
};

export function nodesBox(nodes: MNode[], f: Fonts, size: number, bold: boolean): Box {
  const parts: Box[] = nodes.map((n): Box => {
    switch (n.k) {
      case "t":
        return textBox(n.s, f, size, bold);
      case "sup":
      case "sub": {
        const c = nodesBox(n.c, f, size * 0.68, bold);
        const shift = n.k === "sup" ? size * 0.38 : -size * 0.2;
        return {
          w: c.w + 0.5,
          asc: n.k === "sup" ? c.asc + shift : 0,
          desc: n.k === "sub" ? c.desc - shift : 0,
          draw: (page, x, y, color) => c.draw(page, x + 0.5, y + shift, color),
        };
      }
      case "frac": {
        const a = nodesBox(n.n, f, size * 0.86, bold);
        const b = nodesBox(n.d, f, size * 0.86, bold);
        const axis = size * 0.3;
        const gap = size * 0.12;
        const w = Math.max(a.w, b.w) + size * 0.3;
        const numBase = axis + gap + a.desc;
        const denBase = axis - gap - b.asc;
        return {
          w: w + 2,
          asc: numBase + a.asc,
          desc: Math.max(0, -denBase + b.desc),
          draw: (page, x, y, color) => {
            page.drawLine({ start: { x: x + 1, y: y + axis }, end: { x: x + 1 + w, y: y + axis }, thickness: Math.max(0.6, size * 0.05), color });
            a.draw(page, x + 1 + (w - a.w) / 2, y + numBase, color);
            b.draw(page, x + 1 + (w - b.w) / 2, y + denBase, color);
          },
        };
      }
      case "sqrt": {
        const c = nodesBox(n.c, f, size, bold);
        const top = Math.max(c.asc, size * 0.8) + size * 0.14;
        const hook = size * 0.62;
        return {
          w: hook + c.w + 2,
          asc: top + 1,
          desc: Math.max(c.desc, size * 0.2),
          draw: (page, x, y, color) => {
            const t = Math.max(0.6, size * 0.05);
            const pts: [number, number][] = [
              [x, y + size * 0.3],
              [x + hook * 0.28, y + size * 0.36],
              [x + hook * 0.55, y - size * 0.18],
              [x + hook, y + top],
            ];
            for (let k = 0; k < pts.length - 1; k++) {
              page.drawLine({ start: { x: pts[k][0], y: pts[k][1] }, end: { x: pts[k + 1][0], y: pts[k + 1][1] }, thickness: t, color });
            }
            page.drawLine({ start: { x: x + hook, y: y + top }, end: { x: x + hook + c.w + 2, y: y + top }, thickness: t, color });
            c.draw(page, x + hook + 1, y, color);
          },
        };
      }
    }
  });
  return concat(parts);
}

/**
 * Metni sözcük kutularına böler: boşlukla ayrılmış her sözcük (varsa içindeki formüllerle birlikte) bir parçadır.
 * `blank` olan parça "____" boşluğudur (çizgi olarak çizilir, `suffix` noktalama).
 */
export type Piece = { box: Box; blank?: boolean; suffix?: string };

export function richPieces(text: string, f: Fonts, size: number, bold: boolean): Piece[] {
  const out: Piece[] = [];
  let cur: Box[] = [];
  const flush = () => {
    if (cur.length) out.push({ box: concat(cur) });
    cur = [];
  };
  for (const sg of splitMath(text)) {
    if (sg.math) {
      cur.push(nodesBox(sg.nodes, f, size, bold));
      continue;
    }
    for (const piece of sg.s.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        flush();
      } else if (!cur.length && /^_{2,}[.,;:!?]*$/.test(piece)) {
        const suffix = piece.replace(/^_+/, "");
        const sfx = suffix ? textBox(suffix, f, size, bold).w : 0;
        out.push({ box: { w: 70 + sfx, asc: size * 0.8, desc: size * 0.22, draw: () => {} }, blank: true, suffix });
      } else {
        cur.push(textBox(piece, f, size, bold));
      }
    }
  }
  flush();
  return out;
}

/** Grafiği çizer. (x, topY) kutunun sol üst köşesi. */
export function drawGraph(page: PDFPage, spec: GraphSpec, x: number, topY: number, w: number, h: number, f: Fonts): void {
  const data = plotData(spec);
  const INK = rgb(0.1, 0.11, 0.16);
  const GRID = rgb(0.9, 0.9, 0.94);
  const AXIS = rgb(0.25, 0.27, 0.35);
  const padL = 4;
  const padB = 4;
  const left = x + padL;
  const bottom = topY - h + padB;
  const iw = w - padL * 2;
  const ih = h - padB * 2;
  const sx = (v: number) => left + ((v - spec.xmin) / (spec.xmax - spec.xmin)) * iw;
  const sy = (v: number) => bottom + ((v - spec.ymin) / (spec.ymax - spec.ymin)) * ih;

  page.drawRectangle({ x, y: topY - h, width: w, height: h, color: rgb(1, 1, 1), borderColor: rgb(0.84, 0.83, 0.9), borderWidth: 0.8 });
  for (const t of data.xTicks) page.drawLine({ start: { x: sx(t), y: bottom }, end: { x: sx(t), y: bottom + ih }, thickness: 0.4, color: GRID });
  for (const t of data.yTicks) page.drawLine({ start: { x: left, y: sy(t) }, end: { x: left + iw, y: sy(t) }, thickness: 0.4, color: GRID });

  const ax = spec.xmin <= 0 && spec.xmax >= 0 ? sx(0) : left;
  const ay = spec.ymin <= 0 && spec.ymax >= 0 ? sy(0) : bottom;
  page.drawLine({ start: { x: left, y: ay }, end: { x: left + iw, y: ay }, thickness: 0.9, color: AXIS });
  page.drawLine({ start: { x: ax, y: bottom }, end: { x: ax, y: bottom + ih }, thickness: 0.9, color: AXIS });
  const lab = (s: string, lx: number, ly: number, size = 6.5, anchor: "l" | "c" | "r" = "c") => {
    const b = textBox(s, f, size, false);
    b.draw(page, anchor === "c" ? lx - b.w / 2 : anchor === "r" ? lx - b.w : lx, ly, AXIS);
  };
  for (const t of data.xTicks) if (Math.abs(t) > 1e-9) lab(tickLabel(t), sx(t), ay - 8);
  for (const t of data.yTicks) if (Math.abs(t) > 1e-9) lab(tickLabel(t), ax - 2.5, sy(t) - 2.2, 6.5, "r");
  lab("x", left + iw - 3, ay + 3, 8, "r");
  lab("y", ax + 3, bottom + ih - 8, 8, "l");
  lab("0", ax - 2.5, ay - 8, 6.5, "r");

  data.curves.forEach((c) => {
    c.segs.forEach(([x0, y0, x1, y1]) => {
      const hex = c.color.replace("#", "");
      const col = rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
      page.drawLine({ start: { x: sx(x0), y: sy(y0) }, end: { x: sx(x1), y: sy(y1) }, thickness: 1.5, color: col });
    });
  });

  // Gösterim: "y = ..." (renkli çizgi + ifade)
  data.curves.forEach((c, i) => {
    const hex = c.color.replace("#", "");
    const col = rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
    const ly = topY - 11 - i * 10;
    page.drawLine({ start: { x: x + 7, y: ly + 2.5 }, end: { x: x + 19, y: ly + 2.5 }, thickness: 1.6, color: col });
    textBox(`y = ${c.expr}`, f, 7, false).draw(page, x + 23, ly, INK);
  });
}
