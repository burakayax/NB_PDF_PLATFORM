/**
 * Kapak yerleşim motoru: SEKİZ farklı düzen × konuya özel çizim × yazının kendi vurgu rengi.
 * Blog kapakları (geniş/kare/dikey/kaydırmalı ilk slayt) ve araç videosu kapakları (1080×1920) aynı motoru kullanır.
 *
 * DÜZENLER (hepsi hem yatay hem dikey çalışır):
 *   poster · classic · dark · diagonal · sticker · stripes · device · sidebar
 *
 * Aynı düzen yan yana gelmesin diye atama `assignLayouts()` ile yapılır: eskiden yeniye giderken her gönderi, kendi
 * adının özetinden gelen tercihe en yakın ve son üç gönderide kullanılmamış düzeni alır. Yeni gönderi sona eklenince
 * eskilerin düzeni DEĞİŞMEZ.
 *
 * Logo her zaman sol üstte. Yazı vektör yoluna çevrilir (font gerekmez).
 */

import { join } from "node:path";

import sharp from "sharp";

import { C, T, UP, fit, icon, measure, svgOpen, textPath } from "./cover-designs.mjs";
import { HEROES, palFor, placeHero } from "./heroes.mjs";

export const LAYOUTS = ["poster", "classic", "dark", "diagonal", "sticker", "stripes", "device", "sidebar"];

const NAVY = C.navy;

function wrapLines(text, size, maxW) {
  const out = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, size) <= maxW || !line) line = next;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Başlık + etiket bloğunu kutuya sığdırır. */
function fitBlock({ head, tag, maxW, maxH, sizeMax, caps, tagRatio = 0.62, minSize = 28 }) {
  const h0 = caps ? UP(head) : head;
  let size = sizeMax;
  let best;
  for (; size >= minSize; size -= 2) {
    const lines = wrapLines(h0, size, maxW);
    const tsize = Math.round(size * tagRatio);
    const tl = tag ? wrapLines(tag, tsize, maxW - tsize * 1.1) : [];
    const lh = size * (caps ? 1.08 : 1.13);
    const hH = lines.length * lh;
    const tH = tag ? size * 0.3 + tl.length * tsize * 1.3 + tsize * 0.7 : 0;
    best = { size, lines, tsize, tl, lh, headH: hH, totalH: hH + tH };
    if (hH + tH <= maxH) break;
  }
  return best;
}

const bannerBox = (tl, tsize, x, y, { fill, text, shadow, rot = -1.6 }) => {
  const padX = tsize * 0.5, padY = tsize * 0.42;
  const bw = Math.max(...tl.map((l) => measure(l, tsize))) + padX * 2;
  const bh = tl.length * tsize * 1.3 + padY * 2 - tsize * 0.3;
  return {
    w: bw,
    h: bh,
    svg: `<g transform="rotate(${rot} ${x} ${y + bh / 2})" filter="url(#shadowS)">
      ${shadow ? `<rect x="${x + 9}" y="${y + 9}" width="${bw}" height="${bh}" rx="${tsize * 0.3}" fill="${shadow}"/>` : ""}
      <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${tsize * 0.3}" fill="${fill}"/>
      ${tl.map((l, i) => T(l, tsize, x + padX, y + padY + tsize * 0.8 + i * tsize * 1.3, text)).join("")}</g>`,
  };
};

/** Başlık metni çizer. align: "left" | "center". Dönen: svg + alt kenar. */
function drawText(blk, { x, y, align = "left", maxW, color, last, banner }) {
  const parts = [];
  blk.lines.forEach((ln, i) => {
    const w = measure(ln, blk.size);
    const lx = align === "center" ? x + (maxW - w) / 2 : x;
    const isLast = last && !blk.tl.length && i === blk.lines.length - 1 && blk.lines.length > 1;
    parts.push(`<path d="${textPath(ln, blk.size, lx, y + blk.size * 0.88 + i * blk.lh)}" fill="${isLast ? last : color}"/>`);
  });
  let bottom = y + blk.lines.length * blk.lh;
  if (blk.tl.length && banner) {
    const by = bottom + blk.size * 0.18;
    const bw = Math.max(...blk.tl.map((l) => measure(l, blk.tsize))) + blk.tsize;
    const bx = align === "center" ? x + (maxW - bw) / 2 : x;
    const b = bannerBox(blk.tl, blk.tsize, bx, by, banner);
    parts.push(b.svg);
    bottom = by + b.h;
  }
  return { svg: parts.join(""), bottom };
}

const pillBox = (label, x, y, h, { fill, text, stroke, shadow }) => {
  const size = Math.round(h * 0.5);
  const lw = measure(label, size);
  const w = lw + size * 2.1 + size * 0.9;
  return {
    w,
    svg: `${shadow ? `<rect x="${x + 8}" y="${y + 8}" width="${w}" height="${h}" rx="${h / 2}" fill="${shadow}"/>` : `<g filter="url(#shadow)">`}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="5"` : ""}/>${shadow ? "" : "</g>"}
    ${T(label, size, x + size * 0.95, y + h / 2 + size * 0.35, text)}${icon("arrow", x + size * 0.95 + lw + size * 0.35, y + h / 2 - size * 0.46, size * 0.92, text, 3)}`,
  };
};

/** Ortak geometri. */
function geometry(w, h, key) {
  const isH = w / h > 1.3;
  const reel = key === "reel";
  const m = reel ? 64 : Math.round(w * (isH ? 0.06 : 0.07));
  const logoW = reel ? 340 : Math.round(w * (isH ? 0.19 : 0.23));
  const logoH = Math.round(logoW * 0.335);
  const logoTop = reel ? 256 : Math.round(m * 0.75);
  const y0 = logoTop + logoH + (reel ? 44 : Math.round(h * (isH ? 0.07 : 0.04)));
  const yb = reel ? 1670 : h - Math.round(m * 0.8);
  const ph = reel ? 104 : Math.round(h * (isH ? 0.125 : 0.07));
  return { w, h, isH, reel, m, logoW, logoH, logoTop, y0, yb, ph };
}

/* ─────────────────────────── Düzenler ─────────────────────────── */

const dotsPattern = (c = "#0a1a4d", o = 0.09) => `<pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="3" fill="${c}" fill-opacity="${o}"/></pattern>`;

const LAYOUT_FNS = {
  /* 1) POSTER — amber zemin, dev büyük harf, lacivert daire içinde çizim */
  poster(c) {
    const { w, h, isH, m, y0, yb, ph, pal, blkIn } = c;
    const caps = true;
    const defs = `<radialGradient id="bg" cx="50%" cy="42%" r="78%"><stop offset="0" stop-color="#ffe27a"/><stop offset="0.6" stop-color="#ffc21a"/><stop offset="1" stop-color="#f59e0b"/></radialGradient>${dotsPattern()}`;
    const bgBody = `<rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#dots)"/><circle cx="${w * 0.9}" cy="${h * 0.16}" r="${h * 0.14}" fill="#fff" fill-opacity="0.2"/><circle cx="${w * 0.06}" cy="${h * 0.92}" r="${h * 0.18}" fill="#fff" fill-opacity="0.16"/>
      ${(isH ? [[0.56, 0.1], [0.96, 0.9]] : [[0.94, 0.5], [0.05, 0.55]]).map(([fx, fy]) => `<path d="M${w * fx - 20} ${h * fy}h40M${w * fx} ${h * fy - 20}v40" stroke="${C.blue2}" stroke-width="10" stroke-linecap="round"/>`).join("")}`;
    const banner = { fill: C.blue2, text: "#fff", shadow: NAVY };
    if (isH) {
      const blk = blkIn({ maxW: w * 0.5, maxH: yb - ph - 40 - y0, sizeMax: 64, caps });
      const t = drawText(blk, { x: m, y: y0, maxW: w * 0.5, color: NAVY, last: C.blue2, banner });
      const D = Math.min(h * 0.8, w * 0.38), cx = w * 0.75, cy = h * 0.5;
      const pill = pillBox(c.cta, m, yb - ph, ph, { fill: "#fff", text: NAVY, stroke: NAVY, shadow: NAVY });
      return { defs, bg: bgBody, body: `${t.svg}<circle cx="${cx + 10}" cy="${cy + 10}" r="${D / 2}" fill="${NAVY}"/><circle cx="${cx}" cy="${cy}" r="${D / 2}" fill="${pal.a}" stroke="${NAVY}" stroke-width="7"/>${c.place({ ...pal, t: "#fff" }, cx - D * 0.44, cy - D * 0.44, D * 0.88)}${pill.svg}` };
    }
    const blk = blkIn({ maxW: w - 2 * m, maxH: (yb - y0) * 0.38, sizeMax: Math.round(w * 0.17), caps });
    const t = drawText(blk, { x: m, y: y0, align: "center", maxW: w - 2 * m, color: NAVY, last: C.blue2, banner });
    const zoneTop = t.bottom + 20, zoneBot = yb - ph - 24;
    const D = Math.max(160, Math.min(w * 0.64, zoneBot - zoneTop)), cy = (zoneTop + zoneBot) / 2, cx = w / 2;
    const pillW = pillBox(c.cta, 0, 0, ph, { fill: "#fff", text: NAVY }).w;
    const pill2 = pillBox(c.cta, (w - pillW) / 2, yb - ph, ph, { fill: "#fff", text: NAVY, stroke: NAVY, shadow: NAVY });
    return { defs, bg: bgBody, body: `${t.svg}<circle cx="${cx + 10}" cy="${cy + 10}" r="${D / 2}" fill="${NAVY}"/><circle cx="${cx}" cy="${cy}" r="${D / 2}" fill="${pal.a}" stroke="${NAVY}" stroke-width="7"/>${c.place({ ...pal, t: "#fff" }, cx - D * 0.44, cy - D * 0.44, D * 0.88)}${pill2.svg}` };
  },

  /* 2) CLASSIC — açık zemin, solda yazı, sağ altta çizim */
  classic(c) {
    const { w, h, isH, m, y0, yb, ph, pal, blkIn } = c;
    const defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7faff"/><stop offset="1" stop-color="#dfeaff"/></linearGradient>`;
    const bgBody = `<rect width="${w}" height="${h}" fill="url(#bg)"/><circle cx="${w * 0.8}" cy="${h * 0.55}" r="${Math.min(w, h) * 0.46}" fill="${pal.t}" fill-opacity="0.9"/><circle cx="${w * 0.02}" cy="${h}" r="${Math.min(w, h) * 0.32}" fill="#d3e2ff"/>`;
    const banner = { fill: C.amber, text: NAVY };
    const pill = pillBox(c.cta, m, yb - ph, ph, { fill: C.blue2, text: "#fff" });
    if (isH) {
      const blk = blkIn({ maxW: w * 0.52, maxH: yb - ph - 36 - y0, sizeMax: 64 });
      const t = drawText(blk, { x: m, y: y0, maxW: w * 0.52, color: C.ink, last: pal.a, banner });
      const S = h * 0.88;
      return { defs, bg: bgBody, body: `${t.svg}${c.place(pal, w * 0.77 - S / 2, h * 0.52 - S / 2, S)}${pill.svg}` };
    }
    const blk = blkIn({ maxW: w - 2 * m, maxH: (yb - y0) * 0.36, sizeMax: Math.round(w * 0.105) });
    const t = drawText(blk, { x: m, y: y0, maxW: w - 2 * m, color: C.ink, last: pal.a, banner });
    const S = Math.max(180, Math.min(w * 0.96, yb - ph * 0.2 - t.bottom - 16));
    return { defs, bg: bgBody, body: `${t.svg}${c.place(pal, w - m * 0.2 - S, yb - S + 14, S)}${pill.svg}` };
  },

  /* 3) DARK — koyu zemin, ışıma halkaları, ortada çizim, renk geçişli vurgu */
  dark(c) {
    const { w, h, isH, m, y0, yb, ph, pal, blkIn } = c;
    const defs = `<radialGradient id="g1" cx="12%" cy="85%" r="62%"><stop offset="0" stop-color="#2563eb" stop-opacity="0.7"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></radialGradient>
      <radialGradient id="g2" cx="92%" cy="10%" r="58%"><stop offset="0" stop-color="${pal.a}" stop-opacity="0.65"/><stop offset="1" stop-color="${pal.a}" stop-opacity="0"/></radialGradient>
      <radialGradient id="g3" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${pal.m}" stop-opacity="0.45"/><stop offset="1" stop-color="${pal.m}" stop-opacity="0"/></radialGradient>
      <linearGradient id="txt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset="0.55" stop-color="#60a5fa"/><stop offset="1" stop-color="${pal.m}"/></linearGradient>`;
    const bgBody = `<rect width="${w}" height="${h}" fill="#050a1c"/><rect width="${w}" height="${h}" fill="url(#g1)"/><rect width="${w}" height="${h}" fill="url(#g2)"/>`;
    const banner = { fill: C.amber, text: NAVY };
    const pill = pillBox(c.cta, isH ? m : (w - 400) / 2, yb - ph, ph, { fill: C.amber, text: NAVY });
    if (isH) {
      const blk = blkIn({ maxW: w * 0.5, maxH: yb - ph - 36 - y0, sizeMax: 64 });
      const t = drawText(blk, { x: m, y: y0, maxW: w * 0.5, color: "#fff", last: "url(#txt)", banner });
      const S = h * 0.86, cx = w * 0.76, cy = h * 0.5;
      return { defs, bg: bgBody, body: `<circle cx="${cx}" cy="${cy}" r="${S * 0.62}" fill="url(#g3)"/><circle cx="${cx}" cy="${cy}" r="${S * 0.5}" fill="none" stroke="${pal.m}" stroke-opacity="0.35" stroke-width="2"/>${t.svg}${c.place(pal, cx - S / 2, cy - S / 2, S)}${pill.svg}` };
    }
    const S = Math.min(w * 0.74, (yb - y0) * 0.5), cx = w / 2, cy = y0 + S / 2 + 6;
    const blk = blkIn({ maxW: w - 2 * m, maxH: yb - ph - 30 - (cy + S / 2 + 20), sizeMax: Math.round(w * 0.1) });
    const t = drawText(blk, { x: m, y: cy + S / 2 + 24, align: "center", maxW: w - 2 * m, color: "#fff", last: "url(#txt)", banner });
    const pill2 = pillBox(c.cta, 0, 0, ph, { fill: C.amber, text: NAVY });
    const pillC = pillBox(c.cta, (w - pill2.w) / 2, yb - ph, ph, { fill: C.amber, text: NAVY });
    return { defs, bg: bgBody, body: `<circle cx="${cx}" cy="${cy}" r="${S * 0.7}" fill="url(#g3)"/><circle cx="${cx}" cy="${cy}" r="${S * 0.56}" fill="none" stroke="${pal.m}" stroke-opacity="0.35" stroke-width="2"/>${c.place(pal, cx - S / 2, cy - S / 2, S)}${t.svg}${pillC.svg}` };
  },

  /* 4) DIAGONAL — çapraz bölünmüş zemin (renk + lacivert), çizim ayrımda */
  diagonal(c) {
    const { w, h, isH, m, y0, yb, ph, pal, blkIn } = c;
    const defs = `<linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.m}"/><stop offset="1" stop-color="${pal.d}"/></linearGradient>`;
    const poly = isH ? `M0 0H${w * 0.62}L${w * 0.46} ${h}H0Z` : `M0 0H${w}V${h * 0.56}L0 ${h * 0.7}Z`;
    const bgBody = `<rect width="${w}" height="${h}" fill="#0b1b4d"/><path d="${poly}" fill="url(#dg)"/><path d="${isH ? `M${w * 0.62} 0L${w * 0.46} ${h}` : `M${w} ${h * 0.56}L0 ${h * 0.7}`}" stroke="#fff" stroke-width="7" stroke-opacity="0.9"/>`;
    const banner = { fill: C.amber, text: NAVY };
    const pill = pillBox(c.cta, isH ? m : (w - 400) / 2, yb - ph, ph, { fill: "#fff", text: NAVY });
    if (isH) {
      const blk = blkIn({ maxW: w * 0.42, maxH: yb - ph - 36 - y0, sizeMax: 60 });
      const t = drawText(blk, { x: m, y: y0, maxW: w * 0.42, color: "#fff", last: C.amber, banner });
      const S = h * 0.84;
      return { defs, bg: bgBody, body: `${t.svg}${c.place(pal, w * 0.76 - S / 2, h * 0.5 - S / 2, S)}${pill.svg}` };
    }
    const blk = blkIn({ maxW: w - 2 * m, maxH: (h * 0.56 - y0) * 0.95, sizeMax: Math.round(w * 0.1) });
    const t = drawText(blk, { x: m, y: y0, maxW: w - 2 * m, color: "#fff", last: C.amber, banner });
    const S = Math.min(w * 0.74, (yb - ph - 20 - (h * 0.46)) * 1.0 + 90);
    const pillC = pillBox(c.cta, 0, 0, ph, { fill: "#fff", text: NAVY });
    const pillX = pillBox(c.cta, (w - pillC.w) / 2, yb - ph, ph, { fill: "#fff", text: NAVY });
    return { defs, bg: bgBody, body: `${t.svg}${c.place(pal, w / 2 - S / 2, Math.max(t.bottom + 6, h * 0.5 - S * 0.12), S)}${pillX.svg}` };
  },

  /* 5) STICKER — doygun mavi, dev beyaz daire içinde çizim, yıldızlar */
  sticker(c) {
    const { w, h, isH, m, y0, yb, ph, pal, blkIn } = c;
    const defs = `<linearGradient id="bg" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#2f6bff"/><stop offset="0.6" stop-color="#1d4ed8"/><stop offset="1" stop-color="#0b2a8f"/></linearGradient>${dotsPattern("#fff", 0.1)}`;
    const bgBody = `<rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#dots)"/>`;
    const banner = { fill: C.amber, text: NAVY };
    const sparkle = (x, y, r) => `<path d="M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z" fill="${C.amber}"/>`;
    if (isH) {
      const blk = blkIn({ maxW: w * 0.4, maxH: yb - ph - 36 - y0, sizeMax: 62 });
      const t = drawText(blk, { x: m, y: y0, maxW: w * 0.4, color: "#fff", last: C.amber, banner });
      const D = h * 1.02, cx = w * 0.78, cy = h * 0.52;
      const pill = pillBox(c.cta, m, yb - ph, ph, { fill: C.amber, text: NAVY });
      return { defs, bg: bgBody, body: `<circle cx="${cx}" cy="${cy}" r="${D / 2 + 22}" fill="#fff" fill-opacity="0.16"/><circle cx="${cx}" cy="${cy}" r="${D / 2}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${D / 2 - 18}" fill="${pal.t}"/>${c.place(pal, cx - D * 0.4, cy - D * 0.4, D * 0.8)}${sparkle(cx - D * 0.5, cy - D * 0.32, 26)}${sparkle(cx + D * 0.42, cy + D * 0.4, 18)}${t.svg}${pill.svg}` };
    }
    const D = Math.min(w * 0.78, (yb - y0) * 0.5), cx = w / 2, cy = y0 + D / 2;
    const blk = blkIn({ maxW: w - 2 * m, maxH: yb - ph - 28 - (cy + D / 2 + 26), sizeMax: Math.round(w * 0.095) });
    const t = drawText(blk, { x: m, y: cy + D / 2 + 28, align: "center", maxW: w - 2 * m, color: "#fff", last: C.amber, banner });
    const p0 = pillBox(c.cta, 0, 0, ph, { fill: C.amber, text: NAVY });
    const pill = pillBox(c.cta, (w - p0.w) / 2, yb - ph, ph, { fill: C.amber, text: NAVY });
    return { defs, bg: bgBody, body: `<circle cx="${cx}" cy="${cy}" r="${D / 2 + 20}" fill="#fff" fill-opacity="0.16"/><circle cx="${cx}" cy="${cy}" r="${D / 2}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${D / 2 - 16}" fill="${pal.t}"/>${c.place(pal, cx - D * 0.4, cy - D * 0.4, D * 0.8)}${sparkle(cx - D * 0.5, cy - D * 0.3, 28)}${sparkle(cx + D * 0.46, cy + D * 0.36, 20)}${t.svg}${pill.svg}` };
  },

  /* 6) STRIPES — her başlık satırı kendi şeridinde, çizim sağ altta taşar */
  stripes(c) {
    const { w, h, isH, m, y0, yb, ph, pal, blkIn } = c;
    const defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14224f"/><stop offset="1" stop-color="#0a1235"/></linearGradient>`;
    const bgBody = `<rect width="${w}" height="${h}" fill="url(#bg)"/><circle cx="${w * 0.85}" cy="${h * 0.8}" r="${Math.min(w, h) * 0.5}" fill="${pal.a}" fill-opacity="0.28"/>`;
    const maxW = isH ? w * 0.58 : w - 2 * m;
    const blk = blkIn({ maxW: maxW - 40, maxH: (isH ? yb - ph - 40 - y0 : (yb - y0) * 0.46), sizeMax: isH ? 58 : Math.round(w * 0.094), tagRatio: 0.7 });
    let y = y0;
    const parts = [];
    blk.lines.forEach((ln, i) => {
      const lw = measure(ln, blk.size) + blk.size * 0.7;
      const fill = i % 2 === 0 ? C.amber : "#fff";
      const rot = i % 2 === 0 ? -1.4 : 1.2;
      parts.push(`<g transform="rotate(${rot} ${m} ${y + blk.lh / 2})" filter="url(#shadowS)"><rect x="${m}" y="${y}" width="${lw}" height="${blk.lh * 0.98}" rx="${blk.size * 0.18}" fill="${fill}"/>${T(ln, blk.size, m + blk.size * 0.35, y + blk.size * 0.86, i % 2 === 0 ? NAVY : C.blue2)}</g>`);
      y += blk.lh * 1.04;
    });
    if (blk.tl.length) {
      const b = bannerBox(blk.tl, blk.tsize, m, y + blk.size * 0.1, { fill: pal.a, text: "#fff", shadow: null, rot: -1 });
      parts.push(b.svg);
      y += blk.size * 0.1 + b.h;
    }
    const pill = pillBox(c.cta, m, yb - ph, ph, { fill: C.amber, text: NAVY });
    if (isH) {
      const S = h * 0.9;
      return { defs, bg: bgBody, body: `${c.place(pal, w * 0.78 - S / 2, h * 0.52 - S / 2, S)}${parts.join("")}${pill.svg}` };
    }
    const S = Math.min(w * 0.78, yb - y - ph * 0.4);
    return { defs, bg: bgBody, body: `${c.place(pal, w - S + m * 0.5, yb - S + 20, S)}${parts.join("")}${pill.svg}` };
  },

  /* 7) DEVICE — tarayıcı penceresi içinde çizim; açık renk gradyan zemin */
  device(c) {
    const { w, h, isH, m, y0, yb, ph, pal, blkIn } = c;
    const defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.t}"/><stop offset="1" stop-color="#ffffff"/></linearGradient>`;
    const bgBody = `<rect width="${w}" height="${h}" fill="url(#bg)"/><circle cx="${w * 0.9}" cy="${h * 0.1}" r="${Math.min(w, h) * 0.3}" fill="${pal.m}" fill-opacity="0.25"/>`;
    const banner = { fill: pal.a, text: "#fff" };
    const win = (x, y, ww, hh) => `<g filter="url(#shadow)"><rect x="${x}" y="${y}" width="${ww}" height="${hh}" rx="26" fill="#fff"/></g>
      <rect x="${x}" y="${y}" width="${ww}" height="${Math.min(54, hh * 0.1)}" rx="26" fill="#eef3ff"/><rect x="${x}" y="${y + 24}" width="${ww}" height="${Math.min(30, hh * 0.06)}" fill="#eef3ff"/>
      ${[0, 1, 2].map((i) => `<circle cx="${x + 30 + i * 26}" cy="${y + Math.min(54, hh * 0.1) / 2}" r="7" fill="${["#ff6b6b", "#ffd34d", "#4ade80"][i]}"/>`).join("")}
      <rect x="${x + 18}" y="${y + Math.min(54, hh * 0.1) + 14}" width="${ww - 36}" height="${hh - Math.min(54, hh * 0.1) - 32}" rx="18" fill="${pal.t}"/>`;
    const pill = pillBox(c.cta, m, yb - ph, ph, { fill: C.blue2, text: "#fff" });
    if (isH) {
      const blk = blkIn({ maxW: w * 0.46, maxH: yb - ph - 36 - y0, sizeMax: 62 });
      const t = drawText(blk, { x: m, y: y0, maxW: w * 0.46, color: C.ink, last: pal.a, banner });
      const ww = w * 0.46, hh = h * 0.82, wx = w - ww - m * 0.7, wy = h * 0.09;
      const S = Math.min(ww, hh) * 0.84;
      return { defs, bg: bgBody, body: `${t.svg}${win(wx, wy, ww, hh)}${c.place(pal, wx + ww / 2 - S / 2, wy + hh / 2 - S / 2 + 20, S)}${pill.svg}` };
    }
    const blk = blkIn({ maxW: w - 2 * m, maxH: (yb - y0) * 0.34, sizeMax: Math.round(w * 0.098) });
    const t = drawText(blk, { x: m, y: y0, maxW: w - 2 * m, color: C.ink, last: pal.a, banner });
    const wy = t.bottom + 26, hh = yb - ph - 30 - wy, ww = w - 2 * m;
    const S = Math.min(ww, hh) * 0.88;
    return { defs, bg: bgBody, body: `${t.svg}${win(m, wy, ww, hh)}${c.place(pal, w / 2 - S / 2, wy + hh / 2 - S / 2 + 24, S)}${pill.svg}` };
  },

  /* 8) SIDEBAR — beyaz zemin, solda renkli dikey bant, editoryal yazı, altta renkli panelde çizim */
  sidebar(c) {
    const { w, h, isH, m, y0, yb, ph, pal, blkIn } = c;
    const defs = `<linearGradient id="sb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.m}"/><stop offset="1" stop-color="${pal.d}"/></linearGradient>`;
    const band = Math.round(w * (isH ? 0.025 : 0.035));
    const bgBody = `<rect width="${w}" height="${h}" fill="#ffffff"/><rect width="${band}" height="${h}" fill="url(#sb)"/>`;
    const banner = { fill: C.amber, text: NAVY };
    const x0 = m + band;
    const pill = pillBox(c.cta, x0, yb - ph, ph, { fill: C.blue2, text: "#fff" });
    if (isH) {
      const blk = blkIn({ maxW: w * 0.48, maxH: yb - ph - 36 - y0, sizeMax: 64 });
      const t = drawText(blk, { x: x0, y: y0, maxW: w * 0.48, color: C.ink, last: pal.a, banner });
      const px = w * 0.6, pw = w * 0.4 - 0;
      const S = h * 0.8;
      return { defs, bg: bgBody, body: `<path d="M${px + 70} 0H${w}V${h}H${px - 30}Z" fill="${pal.t}"/>${t.svg}${c.place(pal, w * 0.8 - S / 2, h * 0.5 - S / 2, S)}${pill.svg}` };
    }
    const panelTop = y0 + (yb - y0) * 0.42;
    const blk = blkIn({ maxW: w - x0 - m, maxH: panelTop - y0 - 24, sizeMax: Math.round(w * 0.105) });
    const t = drawText(blk, { x: x0, y: y0, maxW: w - x0 - m, color: C.ink, last: pal.a, banner });
    const pTop = t.bottom + 30, pH = yb - ph - 30 - pTop;
    const S = Math.min(pH * 1.12, w * 0.92);
    return { defs, bg: bgBody, body: `${t.svg}<rect x="${band}" y="${pTop}" width="${w - band}" height="${pH}" fill="${pal.t}"/>${c.place(pal, w / 2 + band / 2 - S / 2, pTop + pH / 2 - S / 2, S)}${pill.svg}` };
  },
};

/** Düzen atama: eskiden yeniye; tercihe en yakın, son 3'te kullanılmamış düzen. */
export function assignLayouts(keysOldestFirst, { prefer = (k) => hash(k), window = 3 } = {}) {
  const out = new Map();
  const recent = [];
  for (const k of keysOldestFirst) {
    const start = prefer(k) % LAYOUTS.length;
    let pick = null;
    for (let d = 0; d < LAYOUTS.length; d++) {
      const cand = LAYOUTS[(start + d) % LAYOUTS.length];
      if (!recent.includes(cand)) {
        pick = cand;
        break;
      }
    }
    pick ??= LAYOUTS[start];
    out.set(k, pick);
    recent.push(pick);
    if (recent.length > window) recent.shift();
  }
  return out;
}
export function hash(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Kapak SVG'si. */
export function coverSvg({ layout, title, tag = "", hero, heroOpts, accent, w, h, key, cta = "pdfplatform.app", forceCaps = false }) {
  const g = geometry(w, h, key);
  const pal = palFor(accent);
  // 1920 piksellik uzun tuvalde (Reels/Shorts) başlık, genişlikten türeyen punto yüzünden küçük kalıyordu.
  const boost = g.reel ? 1.3 : 1;
  const blkIn = (o) => fitBlock({ head: title, tag, caps: forceCaps, ...o, sizeMax: o.sizeMax * boost, ...(forceCaps && o.caps === undefined ? { caps: true } : {}) });
  const ctx = { ...g, pal, hero, cta, blkIn, place: (p, x, y, S) => placeHero(hero, p, x, y, S, heroOpts) };
  const fn = LAYOUT_FNS[layout] ?? LAYOUT_FNS.classic;
  const r = fn(ctx);
  const svg = `${svgOpen(w, h, r.defs)}${r.bg}${r.body}</svg>`;
  return { svg, logo: { width: g.logoW, left: g.reel ? 64 : g.m, top: g.logoTop } };
}

const logoCache = new Map();
export async function renderCover({ publicDir, format = "png", quality = 88, ...spec }) {
  const { svg, logo } = coverSvg(spec);
  if (!logoCache.has(logo.width)) {
    logoCache.set(logo.width, await sharp(join(publicDir, "logo.png")).resize({ width: logo.width }).png().toBuffer());
  }
  const base = sharp(Buffer.from(svg)).composite([{ input: logoCache.get(logo.width), left: logo.left, top: logo.top }]);
  return format === "jpeg"
    ? base.jpeg({ quality, mozjpeg: true }).toBuffer()
    : base.png({ compressionLevel: 9, palette: true, quality: 82, effort: 6 }).toBuffer();
}
export { HEROES };
