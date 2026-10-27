/**
 * Açık tema paleti üreticisi.
 *
 * Site koyu tema için yazıldı; renkler Tailwind sınıflarıyla (text-slate-300, bg-cyan-500/15 …) verilmiş.
 * Tailwind bu renkleri CSS değişkeni olarak okur. Açık temada her renk ailesinin ucları yer değiştirir
 * (50↔950, 100↔900, 200↔800, 300↔700); 400 → 600'ün değerini alır, 500 ve 600 yerinde kalır. Böylece açık-üstüne-koyu yazı olan
 * "text-slate-300" koyu-üstüne-açık okunur hâle gelir; binlerce sınıfı tek tek değiştirmek gerekmez.
 *
 * Çalıştırma:  node scripts/generate-light-palette.mjs   → src/styles/theme-light.palette.css
 */
import { readFileSync, writeFileSync } from "node:fs";

const theme = readFileSync("node_modules/tailwindcss/theme.css", "utf8");
const vars = new Map();
for (const m of theme.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) {
  vars.set(`${m[1]}-${m[2]}`, m[3].trim());
}
const families = [...new Set([...vars.keys()].map((k) => k.split("-")[0]))];
const pairs = [[50, 950], [100, 900], [200, 800], [300, 700]];

let css = `/* OTOMATİK ÜRETİLDİ — elle düzenleme. scripts/generate-light-palette.mjs çalıştırın. */\n`;
css += `:root[data-theme="light"],\n[data-theme="light"] {\n`;
for (const f of families) {
  for (const [a, b] of pairs) {
    const va = vars.get(`${f}-${a}`);
    const vb = vars.get(`${f}-${b}`);
    if (va && vb) {
      css += `  --color-${f}-${a}: ${vb};\n  --color-${f}-${b}: ${va};\n`;
    }
  }
  // 400 (koyu zeminde parlak vurgu) açık zeminde 600 olur; 600 dolgulu düğme/gradyan zaten koyu, yerinde kalır.
  // Ölçüm (açık zemin #f1f5f9 üzerinde 600'ün kontrastı): cyan/sky/emerald/teal/green/lime/amber/yellow/orange 2,7–3,7;
  // red/rose/pink/fuchsia 4,1–4,3 → WCAG AA (4,5) altı. Bu ailelerde 400 yerine 700 verilir (≥4,5).
  const KOYU_GEREKEN = new Set(["cyan", "sky", "emerald", "teal", "green", "lime", "amber", "yellow", "orange", "red", "rose", "pink", "fuchsia"]);
  const kaynak = vars.get(`${f}-${KOYU_GEREKEN.has(f) ? 800 : 600}`);
  if (kaynak && vars.has(`${f}-400`)) css += `  --color-${f}-400: ${kaynak};\n`;
  // Parlak ailelerde renkli açık etiketlerin (bg-emerald-500/15) içindeki yazı da okunmalı: 300 → 800, 200 → 900.
  // (Etiket zemini yazının arkasında koyulaşmış olur; 700 orada ~4,5'te kalıyordu.)
  if (KOYU_GEREKEN.has(f)) {
    if (vars.get(`${f}-800`)) css += `  --color-${f}-300: ${vars.get(`${f}-800`)};\n`;
    if (vars.get(`${f}-900`)) css += `  --color-${f}-200: ${vars.get(`${f}-900`)};\n`;
  }
}
css += `}\n`;

// Açık temanın İÇİNDE koyu bırakılan bölüm (data-theme="dark") için: paleti Tailwind varsayılanına döndürür.
css += `\n/* Açık tema içinde koyu kalan bölüm: palet varsayılana döner */\n`;
// Aynı blok, OPAK renkli zemini olan öğelerde de geçerli: düğme/rozetin zemini iki temada da aynı renk,
// dolayısıyla içindeki yazı da koyu temadaki gibi kalmalı (beyaz ya da koyu). class~= TAM sınıf adı:
// "from-cyan-500" eşleşir; "from-cyan-500/20" (saydam) ve "from-white/[0.06]" (cam kart) eşleşmez.
const SOLID = ["cyan", "blue", "indigo", "violet", "purple", "emerald", "rose", "red", "sky", "teal", "green", "orange", "amber", "fuchsia", "pink", "lime", "yellow"];
const solidSel = [];
for (const fam of SOLID) {
  for (const sh of [400, 500, 600, 700]) {
    solidSel.push(`[data-theme="light"] [class~="bg-${fam}-${sh}"]`, `[data-theme="light"] [class~="from-${fam}-${sh}"]`);
  }
}
css += `[data-theme="light"] [data-theme="dark"],\n${solidSel.join(",\n")} {\n`;
for (const f of families) {
  for (const s of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
    const v = vars.get(`${f}-${s}`);
    if (v) css += `  --color-${f}-${s}: ${v};\n`;
  }
}
css += `  --color-white: #ffffff;\n}\n`;
// Dolgulu düğme/rozetlerde beyaz yazı: 500'lük zeminde kontrast 2,7–3,7 (AA altı). Açık temada bu öğelerin
// KENDİ kapsamında zemin bir kademe koyulaşır (400→600, 500→700, 600→800); beyaz yazı ≥4,5 olur.
// text-slate-950/900 (koyu yazı) taşıyan parlak düğmeler dokunulmaz: koyu yazı parlak zeminde okunur.
const solidOnly = solidSel.filter((x) => !x.includes('data-theme="dark"')).map((x) => x + ':not([class~="text-slate-950"]):not([class~="text-slate-900"]):not([class~="text-black"])');
css += "\n/* Dolgulu zeminler açık temada koyulaşır (beyaz yazı kontrastı) */\n" + solidOnly.join(",\n") + " {\n";
for (const fam of SOLID) {
  for (const [from, to] of [[400, 600], [500, 700], [600, 800], [700, 800]]) {
    const v = vars.get(`${fam}-${to}`);
    if (v) css += `  --color-${fam}-${from}: ${v};\n`;
  }
}
css += "}\n";
writeFileSync("src/styles/theme-light.palette.css", css);
