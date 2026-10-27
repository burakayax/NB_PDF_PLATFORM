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
  const v600 = vars.get(`${f}-600`);
  if (v600 && vars.has(`${f}-400`)) css += `  --color-${f}-400: ${v600};\n`;
}
css += `}\n`;
writeFileSync("src/styles/theme-light.palette.css", css);
console.log(`${families.length} renk ailesi yazıldı:`, families.join(", "));
