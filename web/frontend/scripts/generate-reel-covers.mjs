/**
 * Araç Reels/Shorts videoları için markalı KAPAK görselleri (1080×1920, dikey).
 *
 * Her araç senaryosu (`scripts/tool-reels/scenarios/<id>.mjs`) için bir kapak üretilir:
 * `public/reel-covers/<id>.jpg`. Instagram Reels kapağı ve YouTube küçük resmi olarak kullanılır
 * (API tarafı: `platforms/instagram-reels.ts`, `platforms/youtube.platform.ts`).
 *
 * Görüntü videodan DEĞİL, tasarımdan gelir: koyu zemin, aracın vurgu rengiyle ışıma, cam görünümlü
 * simge kutusu, büyük araç adı. Yazı SVG'ye vektör yolu olarak gömülür (bkz. generate-covers.mjs):
 * üretildiği makinede font kurulu olması gerekmez, Türkçe karakterler sorunsuz çıkar.
 *
 * GÜVENLİ ALAN: Instagram profil ızgarası kapağı 3:4 kırpar (üstten/alttan ~240 px gider);
 * tüm önemli öğeler y=300..1620 arasında tutulur.
 *
 * YENİ ARAÇ: senaryo eklenince `node scripts/generate-reel-covers.mjs` çalıştır, çıkan dosyayı commitle.
 * Simge/renk tablosunda aracın yoksa genel belge simgesi ve kimlikten türetilen renk kullanılır.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "reel-covers");
const SCENARIOS_DIR = join(ROOT, "scripts", "tool-reels", "scenarios");

const W = 1080;
const H = 1920;
const BG = "#060b18";

/** Vurgu renk çiftleri (açık → koyu); araç kimliğine göre seçilir. */
const ACCENTS = {
  sky: ["#38bdf8", "#2563eb"],
  violet: ["#a78bfa", "#7c3aed"],
  emerald: ["#34d399", "#0d9488"],
  amber: ["#fbbf24", "#ea580c"],
  fuchsia: ["#e879f9", "#9333ea"],
  rose: ["#fb7185", "#e11d48"],
};
const ACCENT_BY_TOOL = { compress: "sky", merge: "violet", "cv-olustur": "emerald" };

/** 24×24 çizgi simgeleri (Lucide ile aynı çizim dili). */
const ICONS = {
  compress: ["M4 14h6v6", "M20 10h-6V4", "M14 10l7-7", "M3 21l7-7"],
  merge: [
    "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",
    "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",
    "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",
  ],
  "cv-olustur": [
    "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z",
    "M14 2v6h6",
    "M12 17.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    "M7.5 21c.4-2 2.1-3.5 4.5-3.5s4.1 1.5 4.5 3.5",
  ],
};
ICONS.watermark = ["M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"];
ICONS.encrypt = ["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z", "M7 11V7a5 5 0 0 1 10 0v4"];
ICONS["unlock-pdf"] = ["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z", "M7 11V7a5 5 0 0 1 9.9-1"];
ICONS["repair-pdf"] = ["M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"];
ICONS["page-numbers"] = ["M4 9h16", "M4 15h16", "M10 3 8 21", "M16 3l-2 18"];
ICONS["flip-pdf"] = ["M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3", "M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3", "M12 20v2", "M12 14v2", "M12 8v2", "M12 2v2"];
ICONS["resize-pdf"] = ["M15 3h6v6", "M9 21H3v-6", "M21 3l-7 7", "M3 21l7-7"];
ICONS["extract-images"] = ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z", "M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z", "m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"];
ICONS["deskew-pdf"] = ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"];
ICONS["flatten-pdf"] = ["M12 2 2 7l10 5 10-5-10-5Z", "m2 17 10 5 10-5"];
ICONS["grayscale-pdf"] = ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 18a6 6 0 0 0 0-12v12Z"];
const FALLBACK_ICON = [
  "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z",
  "M14 2v6h6",
  "M8 13h8",
  "M8 17h8",
];

const font = fontkit.create(readFileSync(join(ROOT, "public", "fonts", "Roboto-Bold.ttf")));

const measure = (text, size) => (font.layout(text).advanceWidth / font.unitsPerEm) * size;

/** Metni vektör yoluna çevirir (y ekseni ters çevrilir). */
function textPath(text, size, x, baselineY) {
  const scale = size / font.unitsPerEm;
  const run = font.layout(text);
  let penX = x;
  const parts = [];
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    if (glyph.path && glyph.path.commands.length > 0) {
      const d = glyph.path
        .scale(scale, -scale)
        .translate(penX + (pos.xOffset ?? 0) * scale, baselineY - (pos.yOffset ?? 0) * scale)
        .toSVG();
      if (d) parts.push(d);
    }
    penX += (pos.xAdvance ?? 0) * scale;
  });
  return parts.join(" ");
}

function wrap(text, size, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, size) <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * "A → B" başlığı: Roboto'da ok işareti yok (kutucuk çıkar), bu yüzden ok vektör olarak çizilir.
 * Tek satıra sığmazsa null döner; çağıran normal kırılmış metne düşer (ok " - " olur).
 */
function arrowTitle(text, { maxWidth, sizeMax, sizeMin, topY }) {
  const [left, right] = text.split("→").map((t) => t.trim());
  if (!left || !right) return null;
  for (let size = sizeMax; size >= sizeMin; size -= 4) {
    const arrowW = size * 0.95;
    const gap = size * 0.28;
    const total = measure(left, size) + gap + arrowW + gap + measure(right, size);
    if (total > maxWidth) continue;
    const baseline = topY + size;
    let x = (W - total) / 2;
    const parts = [textPath(left, size, x, baseline)];
    x += measure(left, size) + gap;
    const cy = baseline - size * 0.36;
    const t = size * 0.1;
    const head = size * 0.34;
    const hh = size * 0.24;
    // Gövde (dikdörtgen) + uç (üçgen).
    parts.push(`M${x} ${cy - t / 2}H${x + arrowW - head + 2}V${cy + t / 2}H${x}Z`);
    parts.push(`M${x + arrowW} ${cy}L${x + arrowW - head} ${cy - hh}V${cy + hh}Z`);
    x += arrowW + gap;
    parts.push(textPath(right, size, x, baseline));
    return { d: parts.join(" "), height: size * 1.14, size };
  }
  return null;
}

/** Ortalanmış çok satırlı metin; en büyük punto en fazla `maxLines` satıra sığacak şekilde seçilir. */
function centeredBlock(text, { maxWidth, sizeMax, sizeMin, maxLines, lineRatio, topY }) {
  let size = sizeMax;
  let lines = wrap(text, size, maxWidth);
  while (lines.length > maxLines && size > sizeMin) {
    size -= 4;
    lines = wrap(text, size, maxWidth);
  }
  const lineH = size * lineRatio;
  const d = lines
    .map((ln, i) => textPath(ln, size, (W - measure(ln, size)) / 2, topY + size + i * lineH))
    .join(" ");
  return { d, height: lines.length * lineH, size };
}

/** `x-to-y` kimlikli dönüştürme araçları: simge yerine iki biçim rozeti ve ok gösterilir. */
const FORMAT_LABELS = { pdf: "PDF", word: "WORD", excel: "EXCEL", ppt: "PPT", text: "TXT", pdfa: "PDF/A" };
function conversionOf(id) {
  const m = /^(pdf|word|excel|ppt)-to-(pdf|word|excel|ppt|text|pdfa)$/.exec(id);
  return m ? [FORMAT_LABELS[m[1]], FORMAT_LABELS[m[2]]] : null;
}

function accentFor(id) {
  const key = ACCENT_BY_TOOL[id];
  if (key) return ACCENTS[key];
  const names = Object.keys(ACCENTS);
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENTS[names[h % names.length]];
}

/** İki biçim rozeti (üst: kaynak, alt: hedef) ve aralarında aşağı ok. */
function conversionGlyph([from, to], tileX, tileY, tile) {
  const chipW = 250;
  const chipH = 96;
  const cx = tileX + tile / 2;
  const chip = (label, y) => {
    const size = 50;
    const x = cx - chipW / 2;
    return `<rect x="${x}" y="${y}" width="${chipW}" height="${chipH}" rx="28" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.55" stroke-width="3"/>
  <path d="${textPath(label, size, cx - measure(label, size) / 2, y + chipH / 2 + size * 0.35)}" fill="#ffffff"/>`;
  };
  const top = tileY + 62;
  const bottom = tileY + tile - 62 - chipH;
  const mid = (top + chipH + bottom) / 2;
  return `${chip(from, top)}
  <g stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M${cx} ${mid - 26}V${mid + 22}"/><path d="M${cx - 20} ${mid + 4}L${cx} ${mid + 26}L${cx + 20} ${mid + 4}"/>
  </g>
  ${chip(to, bottom)}`;
}

function coverSvg({ id, title, sub }) {
  const [a1, a2] = accentFor(id);
  const icon = ICONS[id] ?? FALLBACK_ICON;
  const conversion = conversionOf(id);

  // Yerleşim (güvenli alan y=300..1620).
  const tile = 400;
  const tileX = (W - tile) / 2;
  const tileY = 500;
  const titleBlock =
    (title.includes("→") &&
      arrowTitle(title, { maxWidth: 900, sizeMax: 118, sizeMin: 70, topY: tileY + tile + 90 })) ||
    centeredBlock(title.replace(/\s*→\s*/g, " - "), {
    maxWidth: 900,
    sizeMax: 118,
    sizeMin: 70,
    maxLines: 2,
    lineRatio: 1.14,
    topY: tileY + tile + 90,
  });
  const barY = tileY + tile + 90 + titleBlock.height + 30;
  const subBlock = centeredBlock(sub, {
    maxWidth: 860,
    sizeMax: 50,
    sizeMin: 36,
    maxLines: 2,
    lineRatio: 1.3,
    topY: barY + 60,
  });

  const pillText = "pdfplatform.app";
  const pillSize = 40;
  const pillW = measure(pillText, pillSize) + 96;
  const pillX = (W - pillW) / 2;
  const pillY = 1530;

  const iconScale = (tile * 0.5) / 24;
  const iconOff = tileX + (tile - 24 * iconScale) / 2;
  const iconOffY = tileY + (tile - 24 * iconScale) / 2;

  const grid = Array.from({ length: 27 }, (_, i) => i * 40)
    .map((x) => `<path d="M${x} 0V${H}"/>`)
    .join("");
  const gridH = Array.from({ length: 49 }, (_, i) => i * 40)
    .map((y) => `<path d="M0 ${y}H${W}"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glowTop" cx="78%" cy="14%" r="62%">
      <stop offset="0" stop-color="${a1}" stop-opacity="0.34"/><stop offset="1" stop-color="${a1}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowBottom" cx="14%" cy="92%" r="64%">
      <stop offset="0" stop-color="${a2}" stop-opacity="0.38"/><stop offset="1" stop-color="${a2}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${a1}" stop-opacity="0.55"/><stop offset="1" stop-color="${a1}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a1}"/><stop offset="1" stop-color="${a2}"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.04"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a1}" stop-opacity="0.95"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="1" stop-color="${a2}" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="fadeV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BG}" stop-opacity="0.9"/><stop offset="0.25" stop-color="${BG}" stop-opacity="0"/>
      <stop offset="0.8" stop-color="${BG}" stop-opacity="0"/><stop offset="1" stop-color="${BG}" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glowTop)"/>
  <rect width="${W}" height="${H}" fill="url(#glowBottom)"/>
  <g stroke="#ffffff" stroke-opacity="0.045" stroke-width="1">${grid}${gridH}</g>
  <rect width="${W}" height="${H}" fill="url(#fadeV)"/>

  <ellipse cx="${W / 2}" cy="${tileY + tile / 2}" rx="400" ry="400" fill="url(#halo)" opacity="0.55"/>
  <rect x="${tileX}" y="${tileY}" width="${tile}" height="${tile}" rx="96" fill="url(#glass)"/>
  <rect x="${tileX + 1.5}" y="${tileY + 1.5}" width="${tile - 3}" height="${tile - 3}" rx="94.5" fill="none" stroke="url(#rim)" stroke-width="3"/>
  ${
    conversion
      ? conversionGlyph(conversion, tileX, tileY, tile)
      : `<g transform="translate(${iconOff} ${iconOffY}) scale(${iconScale})" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    ${icon.map((d) => `<path d="${d}"/>`).join("")}
  </g>`
  }

  <path d="${titleBlock.d}" fill="#ffffff"/>
  <rect x="${(W - 150) / 2}" y="${barY}" width="150" height="10" rx="5" fill="url(#accent)"/>
  <path d="${subBlock.d}" fill="#cbd5e1"/>

  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="84" rx="42" fill="#ffffff" fill-opacity="0.07" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/>
  <path d="${textPath(pillText, pillSize, pillX + 48, pillY + 56)}" fill="#e2e8f0"/>
</svg>`;
}

/**
 * Senaryo dosyalarını KAYNAK METİN olarak tarar (modül olarak çalıştırmaz): senaryolar Playwright gibi
 * yalnızca video üretim ortamında kurulu paketleri içe aktarır; derleme ortamında bunlar yoktur ve
 * içe aktarma derlemeyi çökertirdi. Tek senaryolu dosya da çok senaryolu harita da aynı kalıpla yakalanır:
 *   id: "x", ... intro: { title: "…", sub: "…" }
 */
const SCENARIO_RE =
  /\bid:\s*"([^"]+)"[\s\S]*?\bintro:\s*\{\s*title:\s*"((?:[^"\\]|\\.)*)"(?:\s*,\s*sub:\s*"((?:[^"\\]|\\.)*)")?/g;

function loadScenarios() {
  const found = new Map();
  for (const f of readdirSync(SCENARIOS_DIR).filter((n) => n.endsWith(".mjs"))) {
    const source = readFileSync(join(SCENARIOS_DIR, f), "utf8");
    for (const m of source.matchAll(SCENARIO_RE)) {
      const unescape = (v) => (v ? JSON.parse(`"${v}"`) : "");
      found.set(m[1], { id: m[1], title: unescape(m[2]), sub: unescape(m[3]) });
    }
  }
  return [...found.values()];
}

/** Katalogda (API) metni olmayan araçlar yayınlanamaz; derlemede uyarı olarak görünür. */
function warnMissingCatalog(ids) {
  try {
    const catalog = readFileSync(join(ROOT, "..", "api", "src", "modules", "social", "tool-reel-catalog.ts"), "utf8");
    const missing = ids.filter((id) => !catalog.includes(`id: "${id}"`));
    if (missing.length > 0) {
      console.warn(`UYARI: tool-reel-catalog.ts'te metni olmayan araç videoları (paylaşılmaz): ${missing.join(", ")}`);
    }
  } catch {
    /* katalog okunamazsa (farklı yerleşim) uyarı atlanır */
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const logo = await sharp(join(ROOT, "public", "logo.png")).resize({ width: 380 }).png().toBuffer();

  const scenarios = loadScenarios();
  warnMissingCatalog(scenarios.map((x) => x.id));
  for (const scenario of scenarios) {
    const base = await sharp(Buffer.from(coverSvg(scenario))).png().toBuffer();
    const jpg = await sharp(base)
      .composite([{ input: logo, left: Math.round((W - 380) / 2), top: 300 }])
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    writeFileSync(join(OUT_DIR, `${scenario.id}.jpg`), jpg);
    console.log(`reel-covers/${scenario.id}.jpg (${Math.round(jpg.length / 1024)} KB)`);
  }
}

// Kapak üretimi yardımcı bir adımdır: hata olursa derleme DURMAZ (video kapaksız çıkar, paylaşım engellenmez).
main().catch((err) => {
  console.warn(`UYARI: reel kapakları üretilemedi: ${String(err)}`);
});
