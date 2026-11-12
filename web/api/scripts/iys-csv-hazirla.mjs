#!/usr/bin/env node
/**
 * Yönetim panelindeki "Onay kayıtları" CSV'sini İYS toplu yükleme biçimine çevirir.
 *
 * Kullanım:
 *   node web/api/scripts/iys-csv-hazirla.mjs <onay-kayitlari.csv> [cikis-klasoru]
 *
 * Her e-posta için EN SON kayıt geçerlidir (onay verip sonra geri aldıysa ret=0).
 * İYS tek seferde en fazla 50 satır aldığı için çıktı 50'şer satırlık parçalara bölünür.
 * Tarih Türkiye saatine (UTC+3) çevrilir: GG-AA-YYYY SS:dd:ss
 */
import fs from "node:fs";
import path from "node:path";

const [, , input, outDirArg] = process.argv;
if (!input) {
  console.error("Kullanım: node iys-csv-hazirla.mjs <onay-kayitlari.csv> [cikis-klasoru]");
  process.exit(1);
}
const outDir = outDirArg ?? path.dirname(input);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const pad = (n) => String(n).padStart(2, "0");
function trDate(iso) {
  const d = new Date(new Date(iso).getTime() + 3 * 3600 * 1000);
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

const text = fs.readFileSync(input, "utf8").replace(/^﻿/, "");
const [header, ...data] = parseCsv(text).filter((r) => r.length > 1);
const col = (name) => header.indexOf(name);
const iEmail = col("E-posta"), iAct = col("İşlem"), iDate = col("Tarih ve Saat");
if ([iEmail, iAct, iDate].includes(-1)) {
  console.error("Beklenen sütunlar bulunamadı. Başlık:", header.join(" | "));
  process.exit(1);
}

// E-posta başına en son kayıt
const latest = new Map();
for (const r of data) {
  const email = r[iEmail].trim().toLowerCase();
  const at = new Date(r[iDate]).getTime();
  if (!email || Number.isNaN(at)) continue;
  const prev = latest.get(email);
  if (!prev || at > prev.at) latest.set(email, { at, iso: r[iDate], granted: r[iAct] === "Onay verildi" });
}

const lines = [...latest.entries()]
  .sort((a, b) => a[1].at - b[1].at)
  .map(([email, v]) => `EPOSTA,${email},${v.granted ? 1 : 0},HS_WEB,${trDate(v.iso)},`);

const HEADER = "IZIN TURU,ALICI,ONAY(1)-RET(0),IZIN KAYNAGI,IZIN TARIHI,IZNIN ALINDIGI BAYI IYS NO";
fs.mkdirSync(outDir, { recursive: true });
const parts = Math.max(1, Math.ceil(lines.length / 50));
for (let p = 0; p < parts; p++) {
  const file = path.join(outDir, `iys-yukle-${pad(p + 1)}.csv`);
  fs.writeFileSync(file, [HEADER, ...lines.slice(p * 50, p * 50 + 50)].join("\n") + "\n", "utf8");
  console.log("Yazıldı:", file);
}
const granted = lines.filter((l) => l.split(",")[2] === "1").length;
console.log(`Toplam ${lines.length} adres (onay: ${granted}, ret: ${lines.length - granted}), ${parts} dosya.`);
