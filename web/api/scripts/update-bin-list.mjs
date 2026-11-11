/**
 * BIN → ülke listesini kaynaktan yeniler (web/api/data/bin-country.csv).
 *
 * Kaynak: Techbuddie-Solutions/binlist-data (bins.csv) — CC BY 4.0 (atıf zorunlu; dosya başlığına yazılır).
 * Kullanım:
 *   node scripts/update-bin-list.mjs [--source <csv yolu ya da URL>] [--out <dosya>] [--report <rapor.md>]
 *
 * Yalnızca `bin` (6–8 hane) ve `alpha_2` (ISO ülke kodu) sütunları alınır; 5 haneli eski aralıklar ve bozuk satırlar atılır.
 * Rapor: eski listeye göre eklenen/çıkarılan/değişen kayıt sayısı ve ÖZELLİKLE Türkiye (TR) kayıtlarındaki değişiklikler
 * (bir TR kaydının yabancıya dönmesi, Türk kartına KDV'siz fatura riski doğurur → rapor bunu öne çıkarır).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SOURCE = "https://raw.githubusercontent.com/Techbuddie-Solutions/binlist-data/main/bins.csv";
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** RFC 4180 uyumlu küçük CSV ayrıştırıcı (tırnaklı alan, "" kaçışı, alan içi virgül/satır sonu). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** bins.csv içeriğinden Map<bin, ÜLKE> üretir. */
export function extractBinCountries(csvText) {
  const rows = parseCsv(csvText);
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  const iBin = header.indexOf("bin");
  const iCountry = header.indexOf("alpha_2");
  if (iBin < 0 || iCountry < 0) throw new Error(`Beklenen sütunlar bulunamadı (bin, alpha_2). Başlık: ${header.join(",")}`);
  const map = new Map();
  for (const r of rows) {
    const bin = (r[iBin] ?? "").trim();
    const cc = (r[iCountry] ?? "").trim().toUpperCase();
    if (/^\d{6,8}$/.test(bin) && /^[A-Z]{2}$/.test(cc)) map.set(bin, cc);
  }
  return map;
}

function readOld(file) {
  const map = new Map();
  if (!existsSync(file)) return map;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [bin, cc] = line.split(",").map((x) => x.trim());
    if (bin && cc) map.set(bin, cc.toUpperCase());
  }
  return map;
}

export function diffReport(oldMap, newMap) {
  let added = 0;
  let removed = 0;
  let changed = 0;
  const trChanges = [];
  for (const [bin, cc] of newMap) {
    const o = oldMap.get(bin);
    if (o === undefined) {
      added++;
      if (cc === "TR") trChanges.push(`+ ${bin} eklendi (TR)`);
    } else if (o !== cc) {
      changed++;
      if (o === "TR" || cc === "TR") trChanges.push(`~ ${bin}: ${o} → ${cc}`);
    }
  }
  for (const [bin, cc] of oldMap) {
    if (!newMap.has(bin)) {
      removed++;
      if (cc === "TR") trChanges.push(`- ${bin} çıkarıldı (eskiden TR)`);
    }
  }
  return { added, removed, changed, trChanges };
}

async function main() {
  const source = arg("source", DEFAULT_SOURCE);
  const out = path.resolve(arg("out", path.join(apiRoot, "data", "bin-country.csv")));
  const reportPath = arg("report", "");

  const csvText = /^https?:\/\//.test(source)
    ? await fetch(source).then((r) => {
        if (!r.ok) throw new Error(`İndirilemedi: HTTP ${r.status}`);
        return r.text();
      })
    : readFileSync(source, "utf8");

  const newMap = extractBinCountries(csvText);
  if (newMap.size < 1000) throw new Error(`Şüpheli derecede az kayıt (${newMap.size}); mevcut liste korunuyor.`);
  const oldMap = readOld(out);
  const diff = diffReport(oldMap, newMap);
  const trCount = [...newMap.values()].filter((c) => c === "TR").length;

  const lines = [
    "# Kartın ilk 6-8 hanesi (BIN) -> kartı çıkaran bankanın ülkesi. Biçim: BIN,ÜLKE",
    "# Kaynak: Techbuddie-Solutions/binlist-data (iannuttall + venelinkochev birleşimi), lisans CC BY 4.0.",
    "# Bu liste topluluk derlemesidir, resmi kayıt değildir; bilinmeyen BIN'ler 'belirlenemedi' sayılır (KDV'li fatura).",
    `# generated: ${new Date().toISOString()}`,
    `# entries: ${newMap.size}`,
    ...[...newMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([b, c]) => `${b},${c}`),
  ];
  writeFileSync(out, lines.join("\n") + "\n", "utf8");

  const report = [
    "## BIN listesi güncellemesi",
    "",
    `- Toplam kayıt: **${newMap.size}** (eski: ${oldMap.size}) · Türkiye (TR) kaydı: **${trCount}**`,
    `- Eklenen: ${diff.added} · Çıkarılan: ${diff.removed} · Ülkesi değişen: ${diff.changed}`,
    "",
    diff.trChanges.length
      ? `### ⚠ Türkiye (TR) kayıtlarında değişiklik (${diff.trChanges.length}) — birleştirmeden önce inceleyin\n\n${diff.trChanges.slice(0, 200).map((l) => `- ${l}`).join("\n")}`
      : "### Türkiye (TR) kayıtlarında değişiklik yok",
    "",
    "Kaynak ve atıf: Techbuddie-Solutions/binlist-data, CC BY 4.0.",
  ].join("\n");
  console.log(report);
  if (reportPath) writeFileSync(path.resolve(reportPath), report + "\n", "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
