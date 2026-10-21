/**
 * Konuya özel kapak çizimleri ("hero"). Her çizim 400×400'lük bir kutuda çizilir; yerleşim motoru
 * (`cover-engine.mjs`) onu ölçekleyip yerleştirir. Beyaz sayfa/kart nesneleri hem açık hem koyu zeminde okunur;
 * vurgu rengi yazının kendi rengidir (`pal`), böylece aynı çizim farklı yazılarda farklı görünür.
 *
 * Yeni konu: bir çizim ekle, `heroFor()` kurallarına anahtar kelime yaz.
 */

import { T, ICON, UP, bold, fit, icon, measure, textPath } from "./cover-designs.mjs";

/** Vurgu adı → renk takımı. `a` ana, `d` koyu, `t` açık ton, `m` orta. */
export const ACCENT_PAL = {
  blue: { a: "#2563eb", d: "#1e3a8a", t: "#dbeafe", m: "#60a5fa" },
  cyan: { a: "#0891b2", d: "#155e75", t: "#cffafe", m: "#22d3ee" },
  amber: { a: "#f59e0b", d: "#b45309", t: "#fef3c7", m: "#fbbf24" },
  violet: { a: "#7c3aed", d: "#4c1d95", t: "#ede9fe", m: "#a78bfa" },
  emerald: { a: "#059669", d: "#065f46", t: "#d1fae5", m: "#34d399" },
  sky: { a: "#0284c7", d: "#075985", t: "#e0f2fe", m: "#38bdf8" },
  rose: { a: "#e11d48", d: "#9f1239", t: "#ffe4e6", m: "#fb7185" },
  fuchsia: { a: "#c026d3", d: "#86198f", t: "#fae8ff", m: "#e879f9" },
};
export const palFor = (accent) => ACCENT_PAL[accent] ?? ACCENT_PAL.blue;

const INK = "#0f1f4a";
const LINE = "#d7deea";

const bar = (x, y, w, fill = LINE, h = 11, op = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" fill-opacity="${op}"/>`;
const pg = (x, y, w, h, { fill = "#fff", rot = 0, shadow = true, r = 18 } = {}) =>
  `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})" ${shadow ? 'filter="url(#shadowS)"' : ""}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/></g>`;
const lines = (x, y, ws, { gap = 22, fill = LINE, h = 10 } = {}) => ws.map((w, i) => bar(x, y + i * gap, w, fill, h)).join("");
const ic = (name, x, y, size, color, sw = 2) => icon(name, x, y, size, color, sw);
const star = (cx, cy, r, fill) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `<polygon points="${pts.join(" ")}" fill="${fill}" stroke="${fill}" stroke-width="3" stroke-linejoin="round"/>`;
};
const badge = (cx, cy, r, fill, inner) => `<g filter="url(#shadowS)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/></g>${inner}`;
const check = (cx, cy, s, color, sw = 6) => `<path d="M${cx - s} ${cy}l${s * 0.7} ${s * 0.75} ${s * 1.4}-${s * 1.6}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** Etiketli belge (Word/UDF/PDF/PPT rozetli). */
function docBadge(pal, label, col) {
  const bs = fit(label, 56, 120);
  return `${pg(110, 40, 200, 290, { rot: -4 })}
  ${lines(140, 150, [130, 150, 110, 140, 90], { fill: LINE })}
  <g filter="url(#shadowS)"><rect x="70" y="60" width="150" height="100" rx="26" fill="${col}"/></g>
  ${T(label, bs, 145, 128, "#fff", { center: true })}
  ${bar(140, 270, 100, pal.a, 12)}`;
}

/** Kaynak → hedef: iki etiketli belge ve aralarında ok (ör. PDF → W). */
function convertHero(pal, opts = {}) {
  const from = opts.from ?? "PDF", to = opts.to ?? "W";
  const fs = fit(from, 46, 96), ts = fit(to, 46, 96);
  return `${pg(14, 70, 150, 220, { rot: -6 })}${lines(34, 150, [90, 74, 90, 60], { gap: 22, h: 9 })}
    <g filter="url(#shadowS)"><rect x="14" y="78" width="120" height="64" rx="18" fill="#e11d48"/></g>${T(from, fs, 74, 120, "#fff", { center: true })}
    <g filter="url(#shadowS)"><circle cx="200" cy="190" r="34" fill="${pal.a}"/></g>${ic("arrow", 182, 172, 36, "#fff", 3.4)}
    ${pg(236, 90, 150, 230, { rot: 6 })}${lines(256, 176, [92, 76, 92, 64], { gap: 22, h: 9 })}
    <g filter="url(#shadowS)"><rect x="262" y="98" width="120" height="64" rx="18" fill="${pal.d}"/></g>${T(to, ts, 322, 140, "#fff", { center: true })}
    ${bar(256, 276, 80, pal.m, 11)}`;
}

export const HEROES = {
  convert: convertHero,
  cv: (pal) => `
    ${pg(150, 50, 210, 290, { rot: 7, fill: pal.t })}
    ${pg(80, 40, 220, 310, { rot: -4 })}
    <g transform="rotate(-4 190 195)"><rect x="80" y="40" width="220" height="82" rx="18" fill="${pal.a}"/><rect x="80" y="90" width="220" height="32" fill="${pal.a}"/>
    <circle cx="124" cy="84" r="26" fill="#fff"/><circle cx="124" cy="78" r="9" fill="${pal.m}"/><path d="M106 98a18 15 0 0 1 36 0z" fill="${pal.m}"/>
    ${bar(164, 70, 100, "#fff", 13)}${bar(164, 92, 70, "#fff", 10, 0.7)}
    ${bar(106, 148, 80, pal.a, 11)}${lines(106, 172, [160, 148, 120], { gap: 20 })}
    ${bar(106, 248, 80, pal.a, 11)}${lines(106, 272, [160, 130], { gap: 20 })}</g>`,

  photo: (pal) => `
    ${pg(70, 30, 250, 320, { rot: -3 })}
    <g transform="rotate(-3 195 190)"><rect x="92" y="54" width="206" height="250" rx="12" fill="${pal.t}"/>
    <circle cx="195" cy="150" r="52" fill="${pal.m}"/><path d="M118 304c0-52 34-82 77-82s77 30 77 82z" fill="${pal.a}"/>
    <path d="M92 84V54h30M298 84V54h-30M92 274v30h30M298 274v30h-30" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    ${bar(110, 322, 90, LINE, 12)}</g>
    <g filter="url(#shadowS)"><rect x="300" y="70" width="46" height="240" rx="12" fill="${INK}"/></g>
    ${Array.from({ length: 11 }, (_, i) => `<path d="M${300} ${86 + i * 20}h${i % 5 === 0 ? 26 : 14}" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`).join("")}`,

  scan: (pal) => `
    <g filter="url(#shadow)"><rect x="118" y="14" width="164" height="340" rx="30" fill="${INK}"/></g>
    <rect x="130" y="36" width="140" height="296" rx="14" fill="#fff"/>
    ${pg(146, 72, 108, 150, { shadow: false, r: 8, fill: pal.t })}
    ${lines(158, 96, [84, 70, 84, 60, 76], { gap: 22, fill: "#b8c4dc" })}
    <path d="M142 118V72h36M258 118V72h-36M142 190v32h36M258 190v32h-36" fill="none" stroke="${pal.a}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="136" y="150" width="128" height="8" rx="4" fill="${pal.m}" fill-opacity="0.9"/>
    <rect x="160" y="262" width="80" height="34" rx="17" fill="${pal.a}"/>${check(200, 278, 8, "#fff", 5)}
    <circle cx="200" cy="26" r="5" fill="#2b3a6b"/>`,

  compress: (pal) => `
    ${pg(110, 60, 180, 250, { rot: -3 })}
    ${lines(136, 110, [128, 110, 128, 90, 118, 100], { gap: 24 })}${bar(136, 80, 70, pal.a, 14)}
    <g stroke="${pal.a}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M60 60l50 50M60 60v34M60 60h34"/><path d="M340 60l-50 50M340 60v34M340 60h-34"/>
      <path d="M60 330l50-50M60 330v-34M60 330h34"/><path d="M340 330l-50-50M340 330v-34M340 330h-34"/></g>
    <g filter="url(#shadowS)"><rect x="226" y="262" width="110" height="64" rx="20" fill="${INK}"/></g>${T("KB", 40, 281, 306, "#fff", { center: true })}`,

  merge: (pal) => `
    ${[0, 1, 2].map((i) => pg(30, 40 + i * 100, 120, 86, { rot: i === 1 ? 3 : -3, r: 14 })).join("")}
    ${[0, 1, 2].map((i) => bar(48, 62 + i * 100, 70, [pal.a, pal.m, pal.d][i], 11)).join("")}
    ${[0, 1, 2].map((i) => bar(48, 86 + i * 100, 84, LINE, 9)).join("")}
    <g stroke="${pal.a}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M162 84C200 100 210 170 232 190M162 184l66 8M162 284C200 270 210 214 232 196"/></g>
    ${pg(236, 70, 140, 250, { rot: 2 })}${bar(256, 100, 70, pal.a, 14)}${lines(256, 132, [96, 84, 96, 70, 90, 76, 60], { gap: 22 })}
    ${badge(376, 70, 26, pal.a, `<path d="M376 58v24M364 70h24" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`)}`,

  split: (pal) => `
    <g transform="rotate(-7 190 120)">${pg(100, 40, 190, 130, { shadow: true })}${lines(124, 70, [120, 96, 130], { gap: 22 })}</g>
    <g transform="rotate(6 220 280)">${pg(120, 196, 190, 130, { shadow: true })}${lines(144, 226, [110, 130, 90], { gap: 22 })}</g>
    <path d="M40 188H350" stroke="${pal.a}" stroke-width="7" stroke-dasharray="14 12" stroke-linecap="round"/>
    ${badge(52, 188, 34, "#fff", ic("split", 34, 170, 36, pal.a, 2.3))}`,

  lock: (pal) => `
    ${pg(90, 30, 200, 290, { rot: -4 })}${bar(120, 70, 80, pal.a, 14)}${lines(120, 104, [130, 110, 130, 96, 120], { gap: 22 })}
    <g filter="url(#shadow)"><path d="M214 206v-30a52 52 0 0 1 104 0v30" fill="none" stroke="${pal.d}" stroke-width="22" stroke-linecap="round"/><rect x="190" y="200" width="152" height="122" rx="26" fill="${pal.a}"/></g>
    <circle cx="266" cy="250" r="16" fill="#fff"/><rect x="259" y="258" width="14" height="30" rx="7" fill="#fff"/>`,

  sign: (pal) => `
    ${pg(70, 40, 240, 310, { rot: -3 })}${bar(100, 76, 100, pal.a, 14)}${lines(100, 112, [170, 150, 170, 120], { gap: 24 })}
    <path d="M104 290c20-44 34-60 44-40s-22 56 6 36 34-30 44-8 20 8 40-10" fill="none" stroke="${pal.a}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M100 312h210" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <g transform="rotate(38 330 230)" filter="url(#shadowS)"><rect x="318" y="150" width="26" height="150" rx="10" fill="${INK}"/><path d="M318 300l13 34 13-34z" fill="${pal.m}"/></g>`,

  excel: (pal) => `
    ${pg(40, 60, 300, 250, { rot: -2, r: 16 })}
    <g transform="rotate(-2 190 185)"><rect x="40" y="60" width="300" height="46" rx="16" fill="${pal.a}"/><rect x="40" y="86" width="300" height="20" fill="${pal.a}"/>
    ${[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => `<rect x="${58 + c * 94}" y="${120 + r * 44}" width="80" height="30" rx="6" fill="${(r + c) % 2 ? "#f1f5ff" : pal.t}"/>`).join("")).join("")}</g>
    <g filter="url(#shadowS)"><rect x="236" y="204" width="136" height="124" rx="18" fill="#fff"/></g>
    ${[44, 72, 56, 90].map((h, i) => `<rect x="${254 + i * 28}" y="${312 - h}" width="18" height="${h}" rx="5" fill="${[pal.m, pal.a, pal.d, pal.a][i]}"/>`).join("")}`,

  word: (pal) => docBadge(pal, "W", "#1d4ed8"),
  udf: (pal) => docBadge(pal, "UDF", pal.a),
  pdfdoc: (pal) => docBadge(pal, "PDF", "#e11d48"),

  ppt: (pal) => `
    ${pg(50, 70, 300, 200, { rot: -2, r: 20 })}
    <g transform="rotate(-2 200 170)"><rect x="50" y="70" width="300" height="46" rx="20" fill="${pal.a}"/><rect x="50" y="96" width="300" height="20" fill="${pal.a}"/>
    ${bar(74, 90, 120, "#fff", 12)}${lines(74, 140, [120, 100, 110], { gap: 24 })}
    <circle cx="276" cy="190" r="44" fill="${pal.t}"/><path d="M276 190V146a44 44 0 0 1 40 62z" fill="${pal.a}"/></g>
    <path d="M200 270v60M150 336h100" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`,

  image: (pal) => `
    ${pg(40, 70, 250, 200, { rot: -4 })}
    <g transform="rotate(-4 165 170)"><rect x="60" y="90" width="210" height="160" rx="12" fill="${pal.t}"/>
    <circle cx="106" cy="132" r="20" fill="${pal.m}"/><path d="M60 250l66-80 44 52 30-34 70 62z" fill="${pal.a}"/></g>
    <path d="M296 184h46M326 164l20 20-20 20" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <g filter="url(#shadowS)"><rect x="262" y="226" width="116" height="120" rx="20" fill="#fff"/></g>${T("PDF", 34, 320, 296, "#e11d48", { center: true })}${bar(284, 312, 72, LINE, 9)}`,

  ocr: (pal) => `
    ${pg(60, 40, 250, 310, { rot: -3 })}${lines(90, 84, [160, 140, 170, 120, 150, 130, 160], { gap: 28, fill: "#c4cde0", h: 12 })}
    <g filter="url(#shadow)"><circle cx="248" cy="232" r="80" fill="#fff" fill-opacity="0.96" stroke="${pal.a}" stroke-width="16"/></g>
    ${T("Aa", 66, 248, 254, pal.a, { center: true })}
    <path d="M304 292l62 62" stroke="${pal.d}" stroke-width="22" stroke-linecap="round"/>`,

  contract: (pal) => `
    ${pg(70, 20, 230, 330, { rot: -3 })}
    <g transform="rotate(-3 185 185)">${bar(98, 56, 120, INK, 14)}
    ${lines(98, 92, [170, 150], { gap: 22 })}<rect x="90" y="140" width="190" height="30" rx="8" fill="${pal.m}" fill-opacity="0.45"/>${bar(98, 150, 150, pal.a, 10)}
    ${lines(98, 184, [170, 120], { gap: 22 })}<rect x="90" y="228" width="190" height="30" rx="8" fill="#fde68a" fill-opacity="0.8"/>${bar(98, 238, 130, "#b45309", 10)}
    <path d="M98 308h110" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></g>
    ${badge(300, 290, 48, pal.a, check(300, 292, 14, "#fff", 8))}`,

  checklist: (pal) => `
    ${pg(80, 40, 240, 320, { rot: -2 })}
    <rect x="150" y="22" width="100" height="44" rx="16" fill="${INK}"/><rect x="172" y="32" width="56" height="12" rx="6" fill="#fff"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="104" y="${94 + i * 62}" width="38" height="38" rx="10" fill="${i < 3 ? pal.a : "#fff"}" stroke="${pal.a}" stroke-width="5"/>${i < 3 ? check(123, 114 + i * 62, 8, "#fff", 6) : ""}${bar(158, 106 + i * 62, [128, 112, 136, 96][i], LINE, 14)}`).join("")}`,

  shield: (pal) => `
    ${pg(60, 50, 190, 270, { rot: -7 })}
    <g transform="rotate(-7 155 185)">${lines(86, 90, [130, 100, 130], { gap: 26 })}<rect x="86" y="110" width="110" height="20" rx="4" fill="${INK}"/><rect x="86" y="188" width="90" height="20" rx="4" fill="${INK}"/>${bar(86, 236, 110, LINE, 11)}</g>
    <g filter="url(#shadow)"><path d="M280 40l86 30v82c0 80-44 130-86 156-42-26-86-76-86-156V70z" fill="${pal.a}"/></g>
    <path d="M280 60l66 24v68c0 64-34 106-66 128-32-22-66-64-66-128V84z" fill="${pal.m}" fill-opacity="0.5"/>
    ${ic("eyeoff", 244, 120, 72, "#fff", 2.2)}`,

  compare: (pal) => `
    ${pg(30, 50, 160, 260, { rot: -4 })}${pg(210, 50, 160, 260, { rot: 4 })}
    <g transform="rotate(-4 110 180)">${lines(52, 86, [110, 90, 110, 80], { gap: 26 })}<rect x="46" y="130" width="122" height="22" rx="6" fill="#fecdd3"/></g>
    <g transform="rotate(4 290 180)">${lines(232, 86, [110, 90, 110, 80], { gap: 26 })}<rect x="226" y="130" width="122" height="22" rx="6" fill="#bbf7d0"/><rect x="226" y="208" width="122" height="22" rx="6" fill="#fde68a"/></g>
    ${badge(200, 190, 38, pal.a, `<path d="M184 180h32M184 200h32M214 172l-26 36" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`)}`,

  translate: (pal) => `
    <g filter="url(#shadow)"><path d="M40 60h190a30 30 0 0 1 30 30v90a30 30 0 0 1-30 30h-110l-50 40v-40h-30a30 30 0 0 1-30-30V90a30 30 0 0 1 30-30z" fill="${pal.a}"/></g>${T("TR", 78, 135, 160, "#fff", { center: true })}
    <g filter="url(#shadow)"><path d="M370 170H190a30 30 0 0 0-30 30v90a30 30 0 0 0 30 30h110l50 40v-40h20a30 30 0 0 0 30-30v-90a30 30 0 0 0-30-30z" fill="#fff"/></g>${T("EN", 78, 265, 290, pal.a, { center: true })}
    <path d="M250 60c40 0 70 20 80 60" fill="none" stroke="${pal.d}" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 14"/>`,

  summary: (pal) => `
    ${pg(30, 40, 150, 300, { rot: -4, fill: "#f4f7ff" })}${lines(50, 80, [100, 90, 100, 84, 96, 90, 100, 70, 92, 84], { gap: 24, fill: "#c4cde0", h: 8 })}
    <path d="M190 190h44M218 170l22 20-22 20" fill="none" stroke="${pal.a}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    ${pg(246, 110, 140, 170, { rot: 3 })}${bar(266, 142, 96, pal.a, 14)}${lines(266, 176, [100, 84, 96], { gap: 28, fill: INK, h: 10 })}
    ${star(380, 108, 26, "#fbbf24")}${star(352, 64, 14, pal.m)}`,

  form: (pal) => `
    ${pg(60, 30, 250, 330, { rot: -3 })}
    <g transform="rotate(-3 185 195)">${bar(88, 64, 100, pal.a, 14)}
    ${[0, 1, 2].map((i) => `${bar(88, 104 + i * 66, 70, LINE, 9)}<rect x="88" y="${120 + i * 66}" width="190" height="36" rx="9" fill="#f4f7ff" stroke="${LINE}" stroke-width="3"/>`).join("")}
    <rect x="88" y="302" width="28" height="28" rx="7" fill="${pal.a}"/>${check(102, 316, 6, "#fff", 5)}${bar(128, 310, 90, LINE, 11)}
    <rect x="168" y="132" width="3" height="20" fill="${INK}"/>${bar(100, 136, 60, pal.m, 11)}</g>
    <g transform="rotate(28 330 250)" filter="url(#shadowS)"><rect x="318" y="170" width="26" height="130" rx="9" fill="${pal.d}"/></g>`,

  pages: (pal) => `
    ${pg(40, 60, 150, 210, { rot: -10, fill: pal.t })}${pg(120, 50, 160, 230, { rot: 0 })}${pg(210, 70, 150, 210, { rot: 10, fill: pal.t })}
    ${bar(140, 80, 80, pal.a, 14)}${lines(140, 114, [110, 90, 110, 80], { gap: 24 })}
    ${badge(200, 300, 58, pal.a, ic("rotate", 164, 264, 72, "#fff", 2.2))}`,

  phone: (pal) => `
    <g filter="url(#shadow)"><rect x="116" y="14" width="168" height="350" rx="34" fill="${INK}"/></g>
    <rect x="128" y="38" width="144" height="304" rx="16" fill="#fff"/>
    <rect x="128" y="38" width="144" height="60" rx="16" fill="${pal.a}"/><rect x="128" y="70" width="144" height="28" fill="${pal.a}"/>${T("PDF", 30, 200, 80, "#fff", { center: true })}
    ${lines(146, 122, [108, 90, 108, 76, 100, 90], { gap: 26 })}
    <rect x="148" y="288" width="104" height="32" rx="16" fill="${pal.m}"/>
    <rect x="176" y="24" width="48" height="8" rx="4" fill="#2b3a6b"/>`,

  watermark: (pal) => `
    ${pg(70, 30, 250, 330, { rot: -3 })}${lines(100, 80, [170, 150, 170, 140, 160, 130, 150], { gap: 30, fill: "#d3dbea", h: 12 })}
    <g transform="rotate(-28 195 200)"><rect x="30" y="170" width="330" height="62" rx="14" fill="${pal.a}" fill-opacity="0.9"/>${T("FİLİGRAN", 40, 195, 214, "#fff", { center: true })}</g>`,

  numbers: (pal) => `
    ${[0, 1, 2].map((i) => `${pg(24 + i * 124, 70 + (i === 1 ? -16 : 0), 120, 190, { rot: [-5, 0, 5][i], r: 14 })}${lines(42 + i * 124, 104 + (i === 1 ? -16 : 0), [78, 64, 78, 56], { gap: 22, h: 9 })}
    ${badge(84 + i * 124, 286, 32, pal.a, T(String(i + 1), 40, 84 + i * 124, 300, "#fff", { center: true }))}`).join("")}`,

  repair: (pal) => `
    ${pg(80, 40, 230, 310, { rot: -3 })}${lines(110, 84, [150, 130, 150, 110], { gap: 26 })}
    <path d="M70 214l40-18 30 28 36-30 34 26 40-22 36 22" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 12"/>
    ${lines(110, 246, [150, 120], { gap: 26 })}
    ${badge(300, 300, 54, pal.a, ic("tool", 270, 270, 60, "#fff", 2))}`,

  invoice: (pal) => `
    <g filter="url(#shadowS)"><path d="M100 20h200v318l-16-12-17 12-17-12-17 12-17-12-17 12-17-12-17 12-17-12-16 12z" fill="#fff"/></g>
    ${bar(130, 56, 100, INK, 14)}${[0, 1, 2, 3].map((i) => `${bar(130, 100 + i * 40, [100, 84, 96, 72][i], LINE, 10)}${bar(250, 100 + i * 40, 32, pal.m, 10)}`).join("")}
    <path d="M130 268h140" stroke="${LINE}" stroke-width="4" stroke-dasharray="6 8"/>${bar(130, 288, 70, INK, 12)}<rect x="226" y="276" width="62" height="34" rx="12" fill="${pal.a}"/>`,

  vs: (pal) => `
    <g filter="url(#shadow)"><rect x="20" y="80" width="170" height="230" rx="26" fill="#fff"/><rect x="210" y="80" width="170" height="230" rx="26" fill="${pal.t}"/></g>
    <circle cx="105" cy="140" r="32" fill="${pal.a}"/><circle cx="295" cy="140" r="32" fill="${pal.m}"/>
    ${lines(44, 200, [100, 84, 100], { gap: 26 })}${lines(234, 200, [100, 84, 100], { gap: 26, fill: "#b8c8ec" })}
    ${badge(200, 195, 40, INK, T("VS", 34, 200, 207, "#fff", { center: true }))}`,

  folder: (pal) => `
    ${pg(90, 20, 150, 200, { rot: -8, r: 12 })}${pg(160, 10, 150, 200, { rot: 6, r: 12 })}${pg(120, 30, 150, 200, { rot: -1, r: 12 })}
    ${lines(140, 70, [90, 70, 80], { gap: 22, h: 9 })}
    <g filter="url(#shadow)"><path d="M30 130h110l24 28h206v178a24 24 0 0 1-24 24H54a24 24 0 0 1-24-24z" fill="${pal.a}"/></g>
    <path d="M30 188h340v148a24 24 0 0 1-24 24H54a24 24 0 0 1-24-24z" fill="${pal.m}" fill-opacity="0.55"/>`,

  stars: (pal) => `
    <g filter="url(#shadowS)"><rect x="40" y="220" width="100" height="110" rx="16" fill="${pal.m}"/><rect x="150" y="170" width="100" height="160" rx="16" fill="${pal.a}"/><rect x="260" y="250" width="100" height="80" rx="16" fill="${pal.d}"/></g>
    ${T("2", 56, 90, 292, "#fff", { center: true })}${T("1", 70, 200, 266, "#fff", { center: true })}${T("3", 50, 310, 304, "#fff", { center: true })}
    ${star(200, 110, 44, "#fbbf24")}${star(104, 168, 22, "#fde68a")}${star(298, 188, 22, "#fde68a")}`,
};


/** Meslek CV'leri: aynı CV kâğıdı, ama sağ altta mesleğe özgü rozet (hepsi aynı görünmesin). Rozet merkezi (276, 268). */
const E = (inner) => `<g fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" transform="translate(276 268)">${inner}</g>`;
const EMBLEMS = {
  sales: E(`<path d="M-44 36V4M-14 36V-14M16 36V-4M46 36V-34"/><path d="M-44 -6l32-24 26 12 38-30"/><path d="M28 -66h24v24"/>`),
  accounting: E(`<rect x="-36" y="-46" width="72" height="92" rx="10"/><rect x="-22" y="-32" width="44" height="18" rx="4"/><path d="M-20 4h.1M0 4h.1M20 4h.1M-20 24h.1M0 24h.1M20 24h.1"/>`),
  software: E(`<path d="M-20 -30l-30 30 30 30"/><path d="M20 -30l30 30-30 30"/><path d="M8 -42l-16 84"/>`),
  teacher: E(`<path d="M0 -44L-60 -14 0 16 60 -14z"/><path d="M-36 -2v30c0 10 72 10 72 0V-2"/><path d="M60 -14v38"/><circle cx="60" cy="30" r="5" fill="#fff"/>`),
  health: E(`<path d="M-14 -50h28v36h36v28H14v36h-28V14h-36v-28h36z"/>`),
  support: E(`<path d="M-48 8v-14a48 48 0 0 1 96 0v14"/><rect x="-58" y="2" width="22" height="40" rx="10"/><rect x="36" y="2" width="22" height="40" rx="10"/><path d="M46 42q-4 16-30 18"/>`),
  hr: E(`<circle cx="-22" cy="-24" r="16"/><path d="M-54 40a32 32 0 0 1 64 0"/><circle cx="30" cy="-18" r="13"/><path d="M12 30a26 26 0 0 1 48 8"/>`),
  marketing: E(`<circle r="52"/><circle r="30"/><circle r="8" fill="#fff"/><path d="M0 0l40-40"/>`),
  engineer: E(`<circle r="22"/><path d="M0 -58v16M0 42v16M-58 0h16M42 0h16M-41 -41l11 11M30 30l11 11M41 -41l-11 11M-30 30l-11 11"/><circle r="40"/>`),
  hospitality: E(`<path d="M-56 24h112"/><path d="M-46 24a46 46 0 0 1 92 0"/><path d="M0 -30v-12"/><circle cy="-48" r="6"/><path d="M-56 44h112"/>`),
  logistics: E(`<path d="M-50 -22l50-26 50 26v50l-50 26-50-26z"/><path d="M-50 -22l50 26 50-26M0 4v50"/><path d="M-26 -35l50 26"/>`),
  manager: E(`<rect x="-20" y="-54" width="40" height="28" rx="6"/><path d="M0 -26v14M-40 -12h80M-40 -12v16M40 -12v16"/><rect x="-60" y="4" width="40" height="28" rx="6"/><rect x="20" y="4" width="40" height="28" rx="6"/>`),
  design: E(`<path d="M-8 -54l40 40-52 64-34 8 8-34z"/><circle cx="-6" cy="14" r="7"/><path d="M-22 -22l18 18"/>`),
  admin: E(`<rect x="-44" y="-44" width="88" height="100" rx="10"/><rect x="-18" y="-56" width="36" height="22" rx="6"/><path d="M-26 -6h52M-26 16h52M-26 36h30"/>`),
};
for (const [id, emblem] of Object.entries(EMBLEMS)) {
  HEROES[`cv-${id}`] = (pal) => `
    ${pg(150, 36, 210, 290, { rot: 7, fill: pal.t })}
    ${pg(70, 30, 220, 310, { rot: -4 })}
    <g transform="rotate(-4 180 185)"><rect x="70" y="30" width="220" height="82" rx="18" fill="${pal.a}"/><rect x="70" y="80" width="220" height="32" fill="${pal.a}"/>
    <circle cx="116" cy="71" r="22" fill="#fff"/>${bar(150, 56, 100, "#fff", 12)}${bar(150, 78, 70, pal.t, 10)}
    ${lines(94, 140, [150, 120, 150, 100], { gap: 22 })}${bar(94, 240, 90, pal.m, 12)}${lines(94, 270, [140, 110], { gap: 22 })}</g>
    <g filter="url(#shadow)"><circle cx="276" cy="268" r="92" fill="${pal.d}"/></g><circle cx="276" cy="268" r="80" fill="none" stroke="${pal.m}" stroke-width="3" stroke-opacity="0.7"/>
    ${emblem}`;
}

/** Konu kuralları: ilk eşleşen kazanır. Anahtar: slug ya da araç adı. */
const RULES = [
  [/biyometrik|vesikalik|profil-fotograf|cv-fotografi|fotograf-boyutu|osym|fotograf-studyosu/, "photo"],
  [/cv-on-yazi|cv-ozgecmis-word|word-pdf|pdf-word|uyap-karari-word|pdf-metin-duzenleme/, "word"],
  [/ats-uyumlu|cv-is-ilanina|kontrol-listesi/, "checklist"],
  [/satis-danismani-cv/, "cv-sales"], [/muhasebeci-cv/, "cv-accounting"], [/yazilim-gelistirici-cv/, "cv-software"],
  [/ogretmen-cv/, "cv-teacher"], [/hemsire-cv/, "cv-health"], [/musteri-temsilcisi-cv/, "cv-support"],
  [/insan-kaynaklari-uzmani-cv/, "cv-hr"], [/dijital-pazarlama-uzmani-cv/, "cv-marketing"], [/muhendis-cv/, "cv-engineer"],
  [/garson-otel-restoran-cv/, "cv-hospitality"], [/depo-lojistik-cv/, "cv-logistics"], [/yonetici-cv/, "cv-manager"],
  [/grafik-tasarimci-cv/, "cv-design"], [/ofis-asistani-cv/, "cv-admin"],
  [/(^|-)cv(-|$)/, "cv"],
  [/udf/, "udf"],
  [/yabanci-dildeki|baska-dile|ceviri|translate/, "translate"],
  [/sozlesme|kira-kontrati|ihale-sartname/, "contract"],
  [/gecikme-cezasi|fatura|bordro-hesap|banka-ekstresi/, "invoice"],
  [/excel|veri-cikar/, "excel"],
  [/powerpoint|ppt/, "ppt"],
  [/ozetle|ozetleme|summary|sohbet/, "summary"],
  [/karsilastir|compare/, "compare"],
  [/hassas-veri|kimlik-numarasi|gizlilik|dosya-yuklemeden|kvkk|ustveri/, "shield"],
  [/sifre|encrypt|unlock/, "lock"],
  [/imza|isaretleme|yazma|yorum/, "sign"],
  [/filigran|watermark/, "watermark"],
  [/sayfa-numara/, "numbers"],
  [/dondurme|sayfa-sirasi|sayfa-silme|sayfa-duzeni|organize|rotate|delete-pages|flip|resize|toplu-islem/, "pages"],
  [/bolme|bordro-sayfa|split/, "split"],
  [/birlestirme|tek-pdf|merge/, "merge"],
  [/kucultme|sikistir|boyut-hatasi|compress/, "compress"],
  [/ocr|aranabilir|taranmis/, "ocr"],
  [/tarama|camscanner|lens|scanner|belge-fotografi|belge-tara/, "scan"],
  [/onar|bozuk|repair/, "repair"],
  [/form-doldur|duzenleyici|form|flatten|pdf-duzenle/, "form"],
  [/telefonda|mobil/, "phone"],
  [/alternatif/, "vs"],
  [/gorsel|resim|jpg|kesit|kirpma|image/, "image"],
  [/evrak|universite-kayit|ihale-dosyasi|vize/, "folder"],
  [/en-iyi|nasil-secilir/, "stars"],
];

/** Yazının/aracın konusuna göre çizim adı. */
export function heroFor(key, tool) {
  const hay = `${key} ${tool ?? ""}`.toLowerCase();
  for (const [re, name] of RULES) if (re.test(hay)) return name;
  return "pdfdoc";
}

/** Çizimi (x, y) noktasına, `size` piksellik kutuya yerleştirir. */
export function placeHero(name, pal, x, y, size, opts) {
  const make = HEROES[name] ?? HEROES.pdfdoc;
  return `<g transform="translate(${x} ${y}) scale(${size / 400})">${make(pal, opts)}</g>`;
}
export { UP, ICON, measure, textPath, bold };
