/**
 * app.css'teki ELLE yazılmış renkleri açık tema için dönüştürür.
 *
 * Tailwind sınıfları palet tersleme ile (generate-light-palette.mjs) çözülüyor; ama app.css'teki
 * modal/toast/ilerleme çubuğu gibi bileşen sınıfları sabit hex/rgba kullanıyor. Bu betik o kuralları
 * tarar ve koyu temaya göre yazılmış renkleri açık temadaki karşılığına çevirir:
 *   - açık yazı (#f8fafc, #e2e8f0 …)        → koyu yazı (aynı ton, parlaklık tersine çevrilir)
 *   - beyaz saydam yüzey (rgba(255,255,255,.06)) → koyu saydam yüzey (rgba(15,23,42,.06))
 *   - koyu opak/yarı saydam yüzey            → açık karşılığı
 *   - renkli saydam etiket (cyan/yeşil …)    → dokunulmaz (açık zeminde de çalışır)
 * Gradyanlar ve gölgeler dönüştürülmez (rapor edilir).
 *
 * Çalıştırma:  node scripts/generate-light-appcss.mjs  → src/styles/theme-light.appcss.css
 * app.css değişince yeniden çalıştırın.
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("src/styles/app.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// ── renk yardımcıları ─────────────────────────────────────────────────────────
function parseColor(tok) {
  tok = tok.trim().toLowerCase();
  let m = tok.match(/^#([0-9a-f]{3})$/);
  if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
  m = tok.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  m = tok.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    let a = 1;
    if (m[4] !== undefined) a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  if (tok === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (tok === "black") return { r: 0, g: 0, b: 0, a: 1 };
  return null;
}
function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}
function fromHsl({ h, s, l }) {
  const f = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return { r: Math.round(f(p, q, h + 1 / 3) * 255), g: Math.round(f(p, q, h) * 255), b: Math.round(f(p, q, h - 1 / 3) * 255) };
}
const fmt = ({ r, g, b }, a) => (a >= 0.999 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`);

/** Yazı rengi: açıksa koyulaştır (L 0.14–0.30, doygunluk sınırlı). */
function convertText(c) {
  const hsl = toHsl(c);
  if (hsl.l < 0.62) return null; // zaten koyu/orta: dokunma
  const l = Math.min(0.3, Math.max(0.14, 1 - hsl.l + 0.08));
  return fmt(fromHsl({ h: hsl.h, s: Math.min(hsl.s, 0.55), l }), c.a);
}
/** Yüzey rengi: beyaz saydam → koyu saydam; koyu zemin → açık karşılık; renkli saydam → dokunma. */
function convertSurface(c) {
  const hsl = toHsl(c);
  if (hsl.s > 0.35 && hsl.l > 0.2 && hsl.l < 0.8 && c.a < 0.6) return null; // renkli etiket
  if (hsl.l > 0.9 && c.a < 0.9) return fmt({ r: 15, g: 23, b: 42 }, c.a); // beyaz saydam yüzey
  if (hsl.l < 0.3) {
    // koyu zemin/perde: yüzey ise açığa çevir, perde (backdrop, a≥0.7 ve çok koyu) ise dokunma
    if (c.a >= 0.7 && hsl.l < 0.1) return null;
    const l = Math.min(0.97, 1 - hsl.l * 0.6);
    return fmt(fromHsl({ h: hsl.h, s: Math.min(hsl.s, 0.3), l: Math.max(l, 0.9) }), Math.min(1, Math.max(c.a, 0.85)));
  }
  return null;
}

const COLOR_TOKEN = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b/g;

/** Gradyan durağı: beyaz saydam → koyu saydam; koyu yüzey → açık; renkli saydam/orta tonlar dokunulmaz. */
function convertGradientStop(c) {
  const hsl = toHsl(c);
  if (hsl.s > 0.35 && hsl.l > 0.2 && hsl.l < 0.8) return null;
  if (hsl.l > 0.9 && c.a < 0.9) return fmt({ r: 15, g: 23, b: 42 }, c.a);
  if (hsl.l < 0.3) {
    const l = Math.max(0.9, Math.min(0.97, 1 - hsl.l * 0.6));
    return fmt(fromHsl({ h: hsl.h, s: Math.min(hsl.s, 0.3), l }), Math.min(1, Math.max(c.a, 0.8)));
  }
  return null;
}
const PROPS = {
  color: convertText,
  "background-color": convertSurface,
  background: convertSurface,
  "border-color": convertSurface,
  fill: convertText,
};

// ── basit CSS ayrıştırıcı (iç içe @media dahil) ───────────────────────────────
function parseBlocks(text, atPath = []) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    if (open === -1) break;
    const head = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < text.length && depth) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") depth--;
      j++;
    }
    const body = text.slice(open + 1, j - 1);
    if (head.startsWith("@media") || head.startsWith("@supports")) out.push(...parseBlocks(body, [...atPath, head]));
    else if (!head.startsWith("@")) out.push({ sel: head, body, at: atPath });
    i = j;
  }
  return out;
}


function coloredGradientBg(body) {
  const m = body.match(/background(?:-image)?\s*:\s*([^;]*gradient\([^;]*)/);
  if (!m) return false;
  return (m[1].match(COLOR_TOKEN) || []).some((tok) => {
    const c = parseColor(tok);
    if (!c || c.a < 0.9) return false;
    const h = toHsl(c);
    return h.s > 0.35 && h.l > 0.15 && h.l < 0.55;
  });
}
const SKIP_SEL = /^(html|body|:root|\*|#root)\b/;
const rules = parseBlocks(src);
const emitted = new Map(); // at-yolu → css parçaları
let skippedGradients = 0, converted = 0;

for (const { sel, body, at } of rules) {
  const sels = sel.split(",").map((s) => s.trim()).filter((s) => s && !SKIP_SEL.test(s));
  if (!sels.length) continue;
  const decls = [];
  for (const d of body.split(";")) {
    const idx = d.indexOf(":");
    if (idx === -1) continue;
    const prop = d.slice(0, idx).trim().toLowerCase();
    let value = d.slice(idx + 1).trim();
    const fn = PROPS[prop];
    if (!fn) continue;
    // Renkli (doygun, orta koyulukta) gradyan zeminli düğmede beyaz yazı kalır: zemin iki temada da aynı.
    if (prop === "color" && coloredGradientBg(body)) continue;
    if (/url\(|var\(/.test(value)) continue;
    let fnUse = fn;
    if (/gradient\(/.test(value)) {
      if (prop !== "background" && prop !== "background-image") { skippedGradients++; continue; }
      fnUse = convertGradientStop;
    }
    const important = /!important/.test(value);
    value = value.replace(/!important/, "").trim();
    let changed = false;
    const next = value.replace(COLOR_TOKEN, (tok) => {
      const c = parseColor(tok);
      if (!c) return tok;
      const r = fnUse(c);
      if (r) { changed = true; return r; }
      return tok;
    });
    if (changed) { decls.push(`  ${prop}: ${next}${important ? " !important" : ""};`); converted++; }
  }
  if (!decls.length) continue;
  const key = at.join(" | ");
  const css = `${sels.map((s) => `[data-theme="light"] ${s}`).join(",\n")} {\n${decls.join("\n")}\n}\n`;
  if (!emitted.has(key)) emitted.set(key, []);
  emitted.get(key).push(css);
}

let outCss = `/* OTOMATİK ÜRETİLDİ — elle düzenleme. scripts/generate-light-appcss.mjs çalıştırın (kaynak: app.css). */\n`;
for (const [key, parts] of emitted) {
  if (!key) outCss += parts.join("\n") + "\n";
  else {
    const ats = key.split(" | ");
    outCss += ats.map((a) => `${a} {`).join("\n") + "\n" + parts.join("\n") + "\n" + ats.map(() => "}").join("\n") + "\n";
  }
}
writeFileSync("src/styles/theme-light.appcss.css", outCss);
console.log(`${converted} bildirim dönüştürüldü; ${skippedGradients} gradyan atlandı (elle bakılmalı).`);
