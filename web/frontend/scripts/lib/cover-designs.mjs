/**
 * Kapak tasarım kütüphanesi — tüm markalı kapakların ortak kaynağı.
 *
 * Beş dikey (1080×1920) tasarım dili: poster, adım adım, koyu premium, özellik ızgarası, önce/sonra.
 * Araç videosu (Reels/Shorts) kapakları `scripts/generate-reel-covers.mjs`, blog kapakları ve
 * kaydırmalı gönderi ilk slaytı da bu dosyayı kullanır. Araç başına metin ve tasarım seçimi
 * `scripts/tool-reels/cover-specs.mjs` içindedir.
 *
 * RENK İLKESİ: doygun mavi zemin + TEK sıcak vurgu (amber). Kontrast ve doygunluk dikkat çeker;
 * vurgu rengi zeminden ne kadar ayrışırsa o kadar fark edilir. Amber yalnız anahtar kelimede ve eylem
 * düğmesinde kullanılır.
 *
 * GÜVENLİ ALAN: Instagram profil ızgarası kapağı 3:4 kırpar (üstten/alttan 240 px gider). Önemli her şey
 * y=250..1670 arasındadır; logo sol üstte (x=64, y=256).
 *
 * YAZI vektör yoluna çevrilir (fontkit): üretildiği makinede font kurulu olması gerekmez.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bold = fontkit.create(readFileSync(join(ROOT, "public", "fonts", "Roboto-Bold.ttf")));
const regular = fontkit.create(readFileSync(join(ROOT, "public", "fonts", "Roboto-Regular.ttf")));

export const C = {
  blue1: "#2f6bff", blue2: "#1d4ed8", blue3: "#0b2a8f", navy: "#0a1a4d", amber: "#ffc21a",
  green: "#16a34a", ink: "#0f1f4a", mute: "#5b6b94",
};

export const W = 1080;
export const H = 1920;
const CX = W / 2;

export const measure = (text, size, f = bold) => (f.layout(text).advanceWidth / f.unitsPerEm) * size;
export const fit = (text, size, maxW, f = bold) => {
  let sz = size;
  while (sz > 28 && measure(text, sz, f) > maxW) sz -= 2;
  return sz;
};
export const UP = (s) => s.toLocaleUpperCase("tr");

export function textPath(text, size, x, baseline, f = bold) {
  const scale = size / f.unitsPerEm;
  const run = f.layout(text);
  let pen = x;
  const parts = [];
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    if (g.path && g.path.commands.length > 0) {
      parts.push(g.path.scale(scale, -scale).translate(pen + (pos.xOffset ?? 0) * scale, baseline - (pos.yOffset ?? 0) * scale).toSVG());
    }
    pen += (pos.xAdvance ?? 0) * scale;
  });
  return parts.join(" ");
}
export const T = (text, size, x, baseline, fill, { f = bold, center = false, right = false, opacity = 1 } = {}) => {
  const w = measure(text, size, f);
  const left = center ? x - w / 2 : right ? x - w : x;
  return `<path d="${textPath(text, size, left, baseline, f)}" fill="${fill}" fill-opacity="${opacity}"/>`;
};
export { bold, regular };

/** Lucide çizgi simgeleri (24×24). Aracın simgesi yoksa FALLBACK kullanılır. */
export const ICON = {
  compress: ["M4 14h6v6", "M20 10h-6V4", "M14 10l7-7", "M3 21l7-7"],
  merge: ["M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z", "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65", "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"],
  split: ["M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M20 4 8.12 15.88", "M14.47 14.48 20 20", "M8.12 8.12 12 12"],
  word: ["M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"],
  cv: ["M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z", "M14 2v6h6", "M12 17.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M7.5 21c.4-2 2.1-3.5 4.5-3.5s4.1 1.5 4.5 3.5"],
  rotate: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
  drop: ["M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"],
  lock: ["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z", "M7 11V7a5 5 0 0 1 10 0v4"],
  unlock: ["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z", "M7 11V7a5 5 0 0 1 9.9-1"],
  scan: ["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", "M7 12h10"],
  arrow: ["M5 12h14", "m12 5 7 7-7 7"],
  check: ["M20 6 9 17l-5-5"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  edit: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"],
  shield: ["M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", "m9 12 2 2 4-4"],
  text: ["M17 6.1H3", "M21 12.1H3", "M15.1 18H3"],
  image: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z", "M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z", "m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"],
  globe: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  eraser: ["m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21", "M22 21H7", "m5 11 9 9"],
  search: ["m21 21-4.3-4.3", "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"],
  shuffle: ["m18 14 4 4-4 4", "m18 2 4 4-4 4", "M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22", "M2 6h1.972a4 4 0 0 1 3.6 2.2", "M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"],
  table: ["M12 3v18", "M3 3h18v18H3z", "M3 9h18", "M3 15h18"],
  monitor: ["M20 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z", "M8 21h8", "M12 17v4"],
  archive: ["M21 8v13H3V8", "M1 3h22v5H1z", "M10 12h4"],
  tool: ["M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"],
  flip: ["M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3", "M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3", "M12 20v2", "M12 14v2", "M12 8v2", "M12 2v4"],
  resize: ["M15 3h6v6", "M9 21H3v-6", "M21 3l-7 7", "M3 21l7-7"],
  gray: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 18a6 6 0 0 0 0-12v12Z"],
  layers: ["M12 2 2 7l10 5 10-5-10-5Z", "m2 17 10 5 10-5", "m2 12 10 5 10-5"],
};
export const icon = (name, x, y, size, color, sw = 2) =>
  `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${(ICON[name] ?? ICON.word).map((d) => `<path d="${d}"/>`).join("")}</g>`;

const SHADOWS = `
    <filter id="shadow" x="-30%" y="-60%" width="160%" height="240%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#04123d" flood-opacity="0.35"/></filter>
    <filter id="shadowS" x="-30%" y="-60%" width="160%" height="240%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#04123d" flood-opacity="0.28"/></filter>
    <filter id="txtShadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.35"/></filter>
    <linearGradient id="amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd34d"/><stop offset="1" stop-color="#ffc21a"/></linearGradient>`;
export const svgOpen = (w, h, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${SHADOWS}${defs}</defs>`;

/** Eylem düğmesi (amber) — metin + ok, ortalı. */
export function ctaPill(cx, y, label = "Hemen dene", { w = 640, h = 104, size = 52 } = {}) {
  const tw = measure(label, size);
  const gap = size * 0.5;
  const total = tw + gap + size * 0.95;
  const x0 = cx - total / 2;
  return `<g filter="url(#shadow)"><rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#amber)"/></g>
  ${T(label, size, x0, y + h / 2 + size * 0.35, C.navy)}${icon("arrow", x0 + tw + gap, y + h / 2 - size * 0.475, size * 0.95, C.navy, 3)}`;
}

/* ═════════ 1) POSTER ═════════
 * spec: { lines: [satır1, satır2] (büyük harf), word: "küçült" (küçük harf, daha küçük punto), icon, ba?: [önce, sonra], sub? } */
export function poster(spec) {
  const lines = spec.lines.map(UP);
  const size = Math.min(210, ...lines.map((l) => fit(l, 210, 860)));
  const bs = fit(spec.word, 168, 760);
  const bw = measure(spec.word, bs) + 100;
  const bh = bs * 1.2;
  const L1 = 600, L2 = L1 + size * 1.14, BY = L2 + 30;
  let hero;
  if (spec.ba) {
    const [from, to] = spec.ba;
    const fs = fit(from, 66, 230), ts = fit(to, 88, 230);
    hero = `<g transform="rotate(-6 330 1238)">
      <circle cx="338" cy="1246" r="140" fill="${C.navy}"/><circle cx="330" cy="1238" r="140" fill="#fff" stroke="${C.navy}" stroke-width="8"/>
      ${T(from, fs, 330, 1258, "#94a3b8", { center: true })}<path d="M225 1244H435" stroke="#e11d48" stroke-width="9" stroke-linecap="round"/>
      ${T("Örnek", 30, 330, 1308, C.mute, { center: true, f: regular })}</g>
    <path d="M478 1238H578" stroke="${C.navy}" stroke-width="18" stroke-linecap="round"/><path d="M542 1196l46 42-46 42" fill="none" stroke="${C.navy}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="rotate(5 750 1238)"><circle cx="758" cy="1246" r="140" fill="${C.navy}"/><circle cx="750" cy="1238" r="140" fill="${C.blue2}" stroke="${C.navy}" stroke-width="8"/>
      ${T(to, ts, 750, 1238 + ts * 0.34, "#fff", { center: true })}</g>`;
  } else {
    const sub = spec.sub ? T(spec.sub, fit(spec.sub, 46, 900), CX, 1398, C.navy, { center: true }) : "";
    hero = `<g transform="rotate(-4 ${CX} 1215)"><circle cx="${CX + 10}" cy="1225" r="118" fill="${C.navy}"/><circle cx="${CX}" cy="1215" r="118" fill="${C.blue2}" stroke="${C.navy}" stroke-width="8"/>
      ${icon(spec.icon ?? "word", CX - 62, 1153, 124, "#fff", 1.8)}</g>${sub}`;
  }
  return `${svgOpen(W, H, `
    <radialGradient id="bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#ffe27a"/><stop offset="0.6" stop-color="#ffc21a"/><stop offset="1" stop-color="#f59e0b"/></radialGradient>
    <pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="3" fill="#0a1a4d" fill-opacity="0.09"/></pattern>`)}
  <rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#dots)"/>
  <circle cx="940" cy="520" r="170" fill="#fff" fill-opacity="0.22"/><circle cx="110" cy="1420" r="230" fill="#fff" fill-opacity="0.18"/>
  ${[[70, 1500, 30], [990, 1130, 26], [990, 300, 24], [990, 1720, 34]].map(([x, y, s]) => `<path d="M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}" stroke="#1d4ed8" stroke-width="12" stroke-linecap="round"/>`).join("")}
  ${T(lines[0], size, CX, L1, C.navy, { center: true })}
  ${T(lines[1], size, CX, L2, C.navy, { center: true })}
  <g transform="rotate(-3 ${CX} ${BY + bh / 2})">
    <rect x="${CX - bw / 2 + 14}" y="${BY + 14}" width="${bw}" height="${bh}" rx="34" fill="${C.navy}"/>
    <rect x="${CX - bw / 2}" y="${BY}" width="${bw}" height="${bh}" rx="34" fill="${C.blue2}"/>
    ${T(spec.word, bs, CX, BY + bs * 0.93, "#fff", { center: true })}
  </g>
  ${hero}
  <g><rect x="${CX - 310 + 10}" y="${1470 + 10}" width="620" height="104" rx="52" fill="${C.navy}"/>
  <rect x="${CX - 310}" y="1470" width="620" height="104" rx="52" fill="#fff" stroke="${C.navy}" stroke-width="7"/>
  ${T("Hemen dene", 52, CX - 44, 1540, C.navy, { center: true })}${icon("arrow", CX + 130, 1498, 52, C.blue2, 3)}</g>
  ${T("pdfplatform.app", 42, CX, 1650, C.navy, { center: true })}
</svg>`;
}

/* ═════════ 2) ADIM ADIM ═════════
 * spec: { top: "3 adımda", hl: "CV'n hazır", steps: [[başlık, açıklama, simge] ×3] } */
export function steps(spec) {
  const hl = fit(spec.hl, 140, 760);
  const hw = measure(spec.hl, hl);
  const row = ([title, desc, ic], i) => {
    const y = 770 + i * 214;
    return `<g filter="url(#shadowS)"><rect x="80" y="${y}" width="920" height="184" rx="40" fill="#fff"/></g>
    <circle cx="176" cy="${y + 92}" r="54" fill="${C.blue2}"/>${T(String(i + 1), 66, 176, y + 115, "#fff", { center: true })}
    ${T(title, fit(title, 46, 540), 262, y + 88, C.ink)}${T(desc, fit(desc, 30, 560, regular), 262, y + 136, C.mute, { f: regular })}
    <circle cx="910" cy="${y + 92}" r="42" fill="#e8efff"/>${icon(ic, 887, y + 69, 46, C.blue2, 2.4)}`;
  };
  return `${svgOpen(W, H, `<linearGradient id="amberH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd34d"/><stop offset="1" stop-color="#ffc21a"/></linearGradient>`)}
  <rect width="${W}" height="${H}" fill="#f1f6ff"/>
  <circle cx="1000" cy="260" r="330" fill="#dbe7ff"/><circle cx="60" cy="1780" r="300" fill="#e3ecff"/>
  ${[0, 1].map((i) => `<path d="M176 ${770 + 184 + i * 214 - 2}V${770 + 214 + i * 214 + 2}" stroke="${C.blue2}" stroke-width="6" stroke-dasharray="2 14" stroke-linecap="round"/>`).join("")}
  ${T(spec.top, fit(spec.top, 112, 880), CX, 560, C.ink, { center: true })}
  <rect x="${CX - hw / 2 - 26}" y="${690 - hl * 0.46}" width="${hw + 52}" height="${hl * 0.56}" rx="14" fill="url(#amberH)" transform="rotate(-1.5 ${CX} 680)"/>
  ${T(spec.hl, hl, CX, 690, C.navy, { center: true })}
  ${spec.steps.map(row).join("")}
  <g filter="url(#shadow)"><rect x="${CX - 320}" y="1440" width="640" height="104" rx="52" fill="${C.blue2}"/></g>
  ${T("Hemen dene", 52, CX - 44, 1510, "#fff", { center: true })}
  <circle cx="${CX + 160}" cy="1492" r="28" fill="${C.amber}"/>${icon("arrow", CX + 143, 1475, 34, C.navy, 3.4)}
  ${T("pdfplatform.app", 42, CX, 1630, C.ink, { center: true })}
</svg>`;
}

/* ═════════ 3) KOYU PREMİUM ═════════
 * spec: { l1, l2 (renk geçişli), from: "PDF", to: "W", caption } */
export function dark(spec) {
  const gs = fit(spec.l2, 140, 880);
  const l1 = fit(spec.l1, 140, 880);
  const glass = (x, y, w, h, rot, fill, inner) => `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})" filter="url(#shadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="40" fill="${fill}" fill-opacity="0.12"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="40" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="2.5"/>${inner}</g>`;
  const lines = (x, y, n, ws) => Array.from({ length: n }, (_, i) => `<rect x="${x}" y="${y + i * 36}" width="${ws[i % ws.length]}" height="14" rx="7" fill="#fff" fill-opacity="0.55"/>`).join("");
  const fromS = fit(spec.from, 56, 250), toS = fit(spec.to, 70, 250);
  return `${svgOpen(W, H, `
    <radialGradient id="g1" cx="12%" cy="78%" r="62%"><stop offset="0" stop-color="#2563eb" stop-opacity="0.7"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="92%" cy="14%" r="58%"><stop offset="0" stop-color="#7c3aed" stop-opacity="0.65"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></radialGradient>
    <radialGradient id="g3" cx="50%" cy="52%" r="40%"><stop offset="0" stop-color="#22d3ee" stop-opacity="0.38"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
    <linearGradient id="txt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset="0.55" stop-color="#60a5fa"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>
    <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#6366f1"/></linearGradient>`)}
  <rect width="${W}" height="${H}" fill="#050a1c"/><rect width="${W}" height="${H}" fill="url(#g1)"/><rect width="${W}" height="${H}" fill="url(#g2)"/><rect width="${W}" height="${H}" fill="url(#g3)"/>
  ${T(spec.l1, l1, CX, 560, "#fff", { center: true })}
  <path d="${textPath(spec.l2, gs, CX - measure(spec.l2, gs) / 2, 560 + gs * 1.04)}" fill="url(#txt)"/>
  ${glass(140, 800, 360, 480, -8, "#fb7185", `
    <rect x="140" y="800" width="360" height="100" rx="40" fill="#fb7185" fill-opacity="0.35"/>${T(spec.from, fromS, 320, 872, "#fff", { center: true })}
    ${lines(176, 944, 6, [290, 230, 270, 190])}`)}
  ${glass(540, 850, 360, 480, 6, "#60a5fa", `
    <rect x="540" y="850" width="360" height="100" rx="40" fill="#2563eb" fill-opacity="0.75"/>${T(spec.to, toS, 720, 926, "#fff", { center: true })}
    ${lines(576, 994, 5, [290, 240, 270, 170])}<rect x="760" y="1136" width="6" height="32" rx="3" fill="${C.amber}"/>`)}
  <circle cx="${CX}" cy="1060" r="58" fill="url(#chip)" stroke="#fff" stroke-opacity="0.5" stroke-width="3"/>${icon("arrow", CX - 28, 1032, 56, "#fff", 3.2)}
  ${T(spec.caption, fit(spec.caption, 48, 900, regular), CX, 1410, "#e5ecff", { center: true, f: regular })}
  ${ctaPill(CX, 1460, "Hemen dene", { w: 600, h: 104, size: 52 })}
  ${T("pdfplatform.app", 42, CX, 1640, "#fff", { center: true, opacity: 0.9 })}
</svg>`;
}

/* ═════════ 4) ÖZELLİK IZGARASI (aracı vurgular) ═════════
 * spec: { l1, l2 (amber), toolIcon, toolLabel } */
const NEIGHBORS = [
  ["compress", "PDF Sıkıştır", "#2563eb", "#dbeafe"], ["merge", "PDF Birleştir", "#7c3aed", "#ede9fe"], ["split", "PDF Böl", "#e11d48", "#ffe4e6"],
  ["word", "PDF'den Word'e", "#1d4ed8", "#dbeafe"], null, ["rotate", "Sayfa Döndür", "#d97706", "#fef3c7"],
  ["drop", "Filigran Ekle", "#0891b2", "#cffafe"], ["lock", "PDF Şifrele", "#475569", "#e2e8f0"], ["scan", "Belge Tara", "#db2777", "#fce7f3"],
];
export function grid(spec) {
  const cw = 290, ch = 232, gx = 25, gy = 22, x0 = 80, y0 = 690;
  const l1 = fit(spec.l1, 104, 900), l2 = fit(spec.l2, 104, 900);
  const card = (c, i) => {
    const x = x0 + (i % 3) * (cw + gx), y = y0 + Math.floor(i / 3) * (ch + gy);
    if (!c) {
      const lb = spec.toolLabel;
      return `<g filter="url(#shadow)"><rect x="${x - 6}" y="${y - 6}" width="${cw + 12}" height="${ch + 12}" rx="36" fill="url(#amber)"/></g>
      <rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="30" fill="#fff"/>
      <circle cx="${x + cw / 2}" cy="${y + 84}" r="54" fill="#fff3c4"/>${icon(spec.toolIcon, x + cw / 2 - 34, y + 50, 68, C.navy, 2.2)}
      ${T(lb, fit(lb, 32, cw - 24), x + cw / 2, y + 190, C.navy, { center: true })}`;
    }
    const [ic, label] = c;
    return `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="30" fill="#fff" fill-opacity="0.16" stroke="#fff" stroke-opacity="0.35" stroke-width="2"/>
    <circle cx="${x + cw / 2}" cy="${y + 84}" r="44" fill="#fff" fill-opacity="0.9"/>${icon(ic, x + cw / 2 - 26, y + 58, 52, C.blue2, 2.1)}
    ${T(label, fit(label, 28, cw - 24), x + cw / 2, y + 190, "#fff", { center: true })}`;
  };
  return `${svgOpen(W, H, `
    <linearGradient id="bg" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#2f6bff"/><stop offset="0.6" stop-color="#1d4ed8"/><stop offset="1" stop-color="#0b2a8f"/></linearGradient>
    <radialGradient id="l1" cx="90%" cy="0%" r="55%"><stop offset="0" stop-color="#9dbdff" stop-opacity="0.6"/><stop offset="1" stop-color="#9dbdff" stop-opacity="0"/></radialGradient>`)}
  <rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#l1)"/>
  ${T(spec.l1, l1, CX, 540, "#fff", { center: true })}${T(spec.l2, l2, CX, 540 + l2 * 1.08, C.amber, { center: true })}
  ${NEIGHBORS.map(card).join("")}
  ${ctaPill(CX, 1500, "Hemen dene", { w: 640, h: 104, size: 52 })}
  ${T("pdfplatform.app", 42, CX, 1670, "#fff", { center: true, opacity: 0.92 })}
</svg>`;
}

/* ═════════ 5) ÖNCE / SONRA (çapraz ayrım) ═════════
 * spec: { l1, l2 } — renkli → gri (yalnız renk dönüştüren araç için) */
export function split(spec) {
  const px = 260, py = 720, pw = 560, ph = 700;
  const pie = (ccx, ccy, r, slices) => {
    let a0 = -Math.PI / 2;
    return slices.map(([frac, col]) => {
      const a1 = a0 + frac * Math.PI * 2;
      const d = `M${ccx} ${ccy}L${ccx + r * Math.cos(a0)} ${ccy + r * Math.sin(a0)}A${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${ccx + r * Math.cos(a1)} ${ccy + r * Math.sin(a1)}Z`;
      a0 = a1;
      return `<path d="${d}" fill="${col}"/>`;
    }).join("");
  };
  const page = (colored) => {
    const k = colored
      ? { head: "#ec4899", s: ["#f59e0b", "#22d3ee", "#a78bfa", "#ec4899"], bars: ["#22d3ee", "#a78bfa", "#f59e0b", "#ec4899"] }
      : { head: "#9ca3af", s: ["#d1d5db", "#6b7280", "#9ca3af", "#4b5563"], bars: ["#9ca3af", "#6b7280", "#d1d5db", "#4b5563"] };
    return `<g filter="url(#shadow)"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="40" fill="#fff"/></g>
    <rect x="${px}" y="${py}" width="${pw}" height="116" rx="40" fill="${k.head}"/><rect x="${px}" y="${py + 76}" width="${pw}" height="40" fill="${k.head}"/>
    ${pie(CX, py + 280, 100, [[0.35, k.s[0]], [0.25, k.s[1]], [0.22, k.s[2]], [0.18, k.s[3]]])}
    ${k.bars.map((c, i) => `<rect x="${px + 56 + i * 116}" y="${py + 500 - [90, 60, 110, 75][i]}" width="84" height="${[90, 60, 110, 75][i]}" rx="12" fill="${c}"/>`).join("")}
    <rect x="${px + 56}" y="${py + 556}" width="340" height="14" rx="7" fill="${colored ? "#cbd5e1" : "#d1d5db"}"/><rect x="${px + 56}" y="${py + 588}" width="250" height="14" rx="7" fill="${colored ? "#e2e8f0" : "#e5e7eb"}"/>`;
  };
  const leftPoly = `M0 0H590L490 ${H}H0Z`, rightPoly = `M590 0H${W}V${H}H490Z`;
  return `${svgOpen(W, H, `
    <linearGradient id="L" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ec4899"/><stop offset="0.55" stop-color="#a21caf"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
    <linearGradient id="R" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ca3af"/><stop offset="1" stop-color="#374151"/></linearGradient>
    <clipPath id="cl"><path d="${leftPoly}"/></clipPath><clipPath id="cr"><path d="${rightPoly}"/></clipPath>`)}
  <path d="${leftPoly}" fill="url(#L)"/><path d="${rightPoly}" fill="url(#R)"/>
  <path d="M590 0L507 1590" stroke="#fff" stroke-width="8"/>
  <g filter="url(#txtShadow)">${T(spec.l1, fit(spec.l1, 120, 900), CX, 520, "#fff", { center: true })}${T(spec.l2, fit(spec.l2, 120, 900), CX, 650, "#fff", { center: true })}</g>
  <g clip-path="url(#cl)">${page(true)}</g><g clip-path="url(#cr)">${page(false)}</g>
  ${T("ÖNCE", 34, 400, py + 74, "#fff", { center: true })}${T("SONRA", 34, 690, py + 74, "#fff", { center: true })}
  ${ctaPill(CX, 1470, "Hemen dene", { w: 640, h: 104, size: 52 })}
  ${T("pdfplatform.app", 42, CX, 1650, "#fff", { center: true })}
</svg>`;
}

export const DESIGNS = { poster, steps, dark, grid, split };

let logoBuf;
/** Spec'ten (design + alanlar) 1080×1920 JPEG kapak üretir. */
export async function renderReelCover(spec) {
  const make = DESIGNS[spec.design];
  if (!make) throw new Error(`Bilinmeyen kapak tasarımı: ${spec.design}`);
  logoBuf ??= await sharp(join(ROOT, "public", "logo.png")).resize({ width: 340 }).png().toBuffer();
  return sharp(Buffer.from(make(spec)))
    .composite([{ input: logoBuf, left: 64, top: 256 }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}
