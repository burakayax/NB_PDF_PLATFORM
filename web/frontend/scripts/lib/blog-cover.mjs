/**
 * Blog kapakları (site paylaşım görseli, kare, dikey) ve kaydırmalı gönderinin İLK SLAYDI — yeni tasarım sistemi.
 *
 * Dört renk varyantı yazının adresinden (slug) sabit biçimde seçilir: aynı yazı her build'de aynı görünür,
 * profilde yan yana duran gönderiler birbirine benzemez.
 *   0 amber poster · 1 açık zemin · 2 doygun mavi · 3 koyu premium
 *
 * BAŞLIK KURALI: "Başlık: alt başlık" ya da "Soru? alt başlık" biçimindeki başlık otomatik bölünür; ilk kısım
 * iri, ikinci kısım renkli bantta. Bölünemeyen başlığın son satırı vurgu renginde yazılır.
 *
 * Kapak resmi yazının kendi başlığından üretilir; içerik uydurulmaz. Logo her zaman SOL ÜSTTE.
 */

import { join } from "node:path";

import sharp from "sharp";

import { C, T, bold, fit, icon, measure, svgOpen, textPath } from "./cover-designs.mjs";

export const BLOG_VARIANTS = 4;

/** Slug'dan sabit varyant (0..3). */
export function variantFor(slug) {
  let h = 0;
  for (const ch of String(slug)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % BLOG_VARIANTS;
}

/** "CV Nasıl Hazırlanır? Adım Adım Rehber" → { head: "CV Nasıl Hazırlanır?", tag: "Adım Adım Rehber" } */
export function splitTitle(title) {
  const t = String(title).trim();
  const m = /^(.{6,}?)(:|\?|\s[-–—]\s)\s*(.{4,})$/.exec(t);
  if (!m) return { head: t, tag: "" };
  const [, before, sep, after] = m;
  if (after.length > 64) return { head: t, tag: "" };
  const head = sep === "?" ? `${before}?` : before;
  return { head, tag: after };
}

function wrapLines(text, size, maxW) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, size) <= maxW || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const FORMAT_TUNING = {
  wide: { fan: 1.0, tag: 0.66 },
  square: { fan: 0.8, tag: 0.6 },
  carousel: { fan: 1.0, tag: 0.6 },
  tall: { fan: 0.95, tag: 0.6 },
};

const HEADS = ["#ec4899", "#7c3aed", "#0d9488", "#f59e0b"];

function fanPages(pivotX, pivotY, s, glass) {
  const pg = (i) => {
    const ang = [-20, -7, 6, 19][i];
    const x = pivotX, y = pivotY;
    const body = glass
      ? `<rect x="${x - 130}" y="${y - 400}" width="260" height="380" rx="16" fill="#16235a" stroke="#fff" stroke-opacity="0.4" stroke-width="2.5"/>`
      : `<rect x="${x - 130}" y="${y - 400}" width="260" height="380" rx="16" fill="#fff"/>`;
    const line = glass ? "#fff" : "#d7deea";
    const lo = glass ? 0.4 : 1;
    return `<g transform="translate(${pivotX} ${pivotY}) scale(${s}) translate(${-pivotX} ${-pivotY}) rotate(${ang} ${x} ${y})" filter="url(#shadow)">
      ${body}
      <rect x="${x - 130}" y="${y - 400}" width="260" height="96" rx="16" fill="${HEADS[i]}"/><rect x="${x - 130}" y="${y - 340}" width="260" height="36" fill="${HEADS[i]}"/>
      <rect x="${x - 100}" y="${y - 366}" width="150" height="14" rx="7" fill="#fff"/><rect x="${x - 100}" y="${y - 340}" width="100" height="10" rx="5" fill="#fff" fill-opacity="0.7"/>
      <rect x="${x - 100}" y="${y - 276}" width="110" height="10" rx="5" fill="${HEADS[i]}"/>
      ${[0, 1, 2].map((k) => `<rect x="${x - 100}" y="${y - 250 + k * 22}" width="${[190, 170, 150][k]}" height="9" rx="4.5" fill="${line}" fill-opacity="${lo}"/>`).join("")}
      <rect x="${x - 100}" y="${y - 172}" width="110" height="10" rx="5" fill="${HEADS[i]}"/>
      ${[0, 1, 2, 3].map((k) => `<rect x="${x - 100}" y="${y - 146 + k * 22}" width="${[190, 160, 180, 120][k]}" height="9" rx="4.5" fill="${line}" fill-opacity="${lo}"/>`).join("")}
    </g>`;
  };
  return [0, 1, 2, 3].map(pg).join("");
}

/** Kapak SVG'si ve logonun yerleşimi. `key`: wide | square | carousel | tall. */
export function blogCoverSvg({ title, w, h, key, variant, cta }) {
  const tune = FORMAT_TUNING[key] ?? FORMAT_TUNING.wide;
  const wide = key === "wide";
  const m = Math.round(w * (wide ? 0.06 : 0.07));
  const logoW = Math.round(w * (wide ? 0.19 : 0.23));
  const logoH = Math.round(logoW * 0.335);
  const logoTop = Math.round(m * 0.75);
  const y0 = logoTop + logoH + Math.round(h * (wide ? 0.07 : 0.045));

  const pillH = Math.round(h * (wide ? 0.125 : 0.07));
  const pillSize = Math.round(pillH * 0.5);
  const pillY = h - Math.round(m * 0.8) - pillH;
  const fanS = tune.fan;
  const pivotX = wide ? w * 0.77 : w * 0.7;
  const pivotY = wide ? h * 0.94 : h - 36 * fanS;
  const fanTop = pivotY - 420 * fanS;
  const maxW = wide ? w * 0.56 : w - 2 * m;
  const textBottom = wide ? pillY - Math.round(h * 0.05) : fanTop - 18;
  const avail = textBottom - y0;

  const { head, tag } = splitTitle(title);
  const sizeMax = wide ? 66 : Math.round(w * (key === "square" ? 0.094 : 0.115));
  let size = sizeMax, hl, tl = [], tsize = 0;
  for (; size >= 32; size -= 2) {
    hl = wrapLines(head, size, maxW);
    tsize = Math.round(size * tune.tag);
    tl = tag ? wrapLines(tag, tsize, maxW - tsize * 1.2) : [];
    const hH = hl.length * size * 1.12;
    const tH = tag ? 28 + tl.length * tsize * 1.3 + tsize * 0.7 : 0;
    if (hH + tH <= avail) break;
  }
  const lineH = size * 1.12;

  const dark = variant === 3;
  const palettes = [
    { head: C.navy, last: C.blue2, banner: C.blue2, bannerText: "#fff", bannerShadow: C.navy, pill: "#fff", pillText: C.navy, pillStroke: C.navy },
    { head: C.ink, last: C.blue2, banner: C.amber, bannerText: C.navy, bannerShadow: null, pill: C.blue2, pillText: "#fff", pillStroke: null },
    { head: "#fff", last: C.amber, banner: C.amber, bannerText: C.navy, bannerShadow: null, pill: C.amber, pillText: C.navy, pillStroke: null },
    { head: "#fff", last: "url(#txt)", banner: C.amber, bannerText: C.navy, bannerShadow: null, pill: C.amber, pillText: C.navy, pillStroke: null },
  ];
  const P = palettes[variant];

  const bgDefs = [
    `<radialGradient id="bg" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#ffe27a"/><stop offset="0.6" stop-color="#ffc21a"/><stop offset="1" stop-color="#f59e0b"/></radialGradient>
     <pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="3" fill="#0a1a4d" fill-opacity="0.09"/></pattern>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7faff"/><stop offset="1" stop-color="#dfeaff"/></linearGradient>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#2f6bff"/><stop offset="0.6" stop-color="#1d4ed8"/><stop offset="1" stop-color="#0b2a8f"/></linearGradient>
     <radialGradient id="l1" cx="90%" cy="0%" r="55%"><stop offset="0" stop-color="#9dbdff" stop-opacity="0.6"/><stop offset="1" stop-color="#9dbdff" stop-opacity="0"/></radialGradient>
     <pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="3" fill="#fff" fill-opacity="0.09"/></pattern>`,
    `<radialGradient id="g1" cx="12%" cy="85%" r="62%"><stop offset="0" stop-color="#2563eb" stop-opacity="0.7"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></radialGradient>
     <radialGradient id="g2" cx="92%" cy="10%" r="58%"><stop offset="0" stop-color="#7c3aed" stop-opacity="0.65"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></radialGradient>
     <linearGradient id="txt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset="0.55" stop-color="#60a5fa"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>`,
  ][variant];
  const bgBody = [
    `<rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#dots)"/><circle cx="${w * 0.86}" cy="${h * 0.22}" r="${h * 0.16}" fill="#fff" fill-opacity="0.2"/><circle cx="${w * 0.08}" cy="${h * 0.9}" r="${h * 0.2}" fill="#fff" fill-opacity="0.16"/>`,
    `<rect width="${w}" height="${h}" fill="url(#bg)"/><circle cx="${w * 0.8}" cy="${h * 0.45}" r="${Math.min(w, h) * 0.46}" fill="#c9dcff" fill-opacity="0.6"/><circle cx="${w * 0.02}" cy="${h * 1.0}" r="${Math.min(w, h) * 0.34}" fill="#d3e2ff"/>`,
    `<rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#l1)"/><rect width="${w}" height="${h}" fill="url(#dots)"/>`,
    `<rect width="${w}" height="${h}" fill="#050a1c"/><rect width="${w}" height="${h}" fill="url(#g1)"/><rect width="${w}" height="${h}" fill="url(#g2)"/>`,
  ][variant];

  // Başlık satırları; etiket yoksa son satır vurgu renginde.
  const blockH = hl.length * lineH + (tag ? 28 + tl.length * tsize * 1.3 + tsize * 0.7 : 0);
  const shift = wide ? 0 : Math.max(0, (avail - blockH) * 0.3);
  let by = y0 + shift + size * 0.95;
  const headPaths = hl
    .map((ln, i) => {
      const isLast = !tag && i === hl.length - 1 && hl.length > 1;
      const p = `<path d="${textPath(ln, size, m, by + i * lineH)}" fill="${isLast ? P.last : P.head}"/>`;
      return p;
    })
    .join("");
  const headBottom = by + (hl.length - 1) * lineH + size * 0.25;

  let bannerSvg = "";
  if (tag) {
    const padX = tsize * 0.5, padY = tsize * 0.42;
    const bw = Math.max(...tl.map((l) => measure(l, tsize))) + padX * 2;
    const bh = tl.length * tsize * 1.3 + padY * 2 - tsize * 0.3;
    const bx = m, byTop = headBottom + 22;
    bannerSvg = `<g transform="rotate(-1.6 ${bx} ${byTop + bh / 2})" filter="url(#shadowS)">
      ${P.bannerShadow ? `<rect x="${bx + 10}" y="${byTop + 10}" width="${bw}" height="${bh}" rx="${tsize * 0.3}" fill="${P.bannerShadow}"/>` : ""}
      <rect x="${bx}" y="${byTop}" width="${bw}" height="${bh}" rx="${tsize * 0.3}" fill="${P.banner}"/>
      ${tl.map((l, i) => T(l, tsize, bx + padX, byTop + padY + tsize * 0.95 + i * tsize * 1.3 - tsize * 0.15, P.bannerText)).join("")}
    </g>`;
  }

  const label = cta ?? "pdfplatform.app";
  const lw = measure(label, pillSize);
  const pw = lw + pillSize * 2.1 + pillSize * 0.9;
  const pill = `<g filter="url(#shadow)"><rect x="${m}" y="${pillY}" width="${pw}" height="${pillH}" rx="${pillH / 2}" fill="${P.pill}" ${P.pillStroke ? `stroke="${P.pillStroke}" stroke-width="5"` : ""}/></g>
    ${T(label, pillSize, m + pillSize * 0.95, pillY + pillH / 2 + pillSize * 0.35, P.pillText)}
    ${icon("arrow", m + pillSize * 0.95 + lw + pillSize * 0.35, pillY + pillH / 2 - pillSize * 0.46, pillSize * 0.92, P.pillText, 3)}`;

  const svg = `${svgOpen(w, h, bgDefs)}${bgBody}
  ${fanPages(pivotX, pivotY, fanS, dark)}
  ${headPaths}${bannerSvg}${pill}
</svg>`;
  return { svg, logo: { width: logoW, left: m, top: logoTop } };
}

const logoCache = new Map();

/** Kapağı çizer; logo sol üstte. `format`: "png" (palet) ya da "jpeg". */
export async function renderBlogCover({ title, slug, w, h, key, cta, format = "png", publicDir, quality = 88 }) {
  const variant = variantFor(slug);
  const { svg, logo } = blogCoverSvg({ title, w, h, key, variant, cta });
  const cacheKey = logo.width;
  if (!logoCache.has(cacheKey)) {
    logoCache.set(cacheKey, await sharp(join(publicDir, "logo.png")).resize({ width: logo.width }).png().toBuffer());
  }
  const base = sharp(Buffer.from(svg)).composite([{ input: logoCache.get(cacheKey), left: logo.left, top: logo.top }]);
  return format === "jpeg"
    ? base.jpeg({ quality, mozjpeg: true }).toBuffer()
    : base.png({ compressionLevel: 9, palette: true, quality: 82, effort: 6 }).toBuffer();
}

export { bold, fit };
