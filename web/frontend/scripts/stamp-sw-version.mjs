// Build sonrası servis worker sürümünü OTOMATİK damgalar.
//
// NEDEN: SW_VERSION her deploy'da değişmezse tarayıcı yeni SW algılamaz →
// kullanıcı eski cache'lenmiş bundle'ı görür ve "güncelleme var" bildirimi
// çıkmaz. Elle bump etmek unutuluyordu; artık build otomatik damgalar.
//
// NASIL: public/sw.js içinde `const SW_VERSION = "__SW_BUILD_ID__";` placeholder'ı
// bulunur. Vite bunu dist/sw.js'e kopyalar. Bu script dist/sw.js'teki placeholder'ı
// git kısa hash'i (yoksa zaman damgası) ile değiştirir — kaynak dosya değişmez
// (git churn yok), her commit benzersiz bir SW sürümü alır.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "..", "dist");
const swPath = join(dist, "sw.js");
const versionPath = join(dist, "version.json");
const PLACEHOLDER = "__SW_BUILD_ID__";

function buildId() {
  try {
    const hash = execSync("git rev-parse --short=10 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (hash) return `g${hash}`;
  } catch {
    /* git yoksa/CI'da geçmiş yoksa → zaman damgası */
  }
  return `t${Date.now()}`;
}

const id = buildId();

if (!existsSync(swPath)) {
  console.warn(`[stamp-sw] dist/sw.js yok — atlanıyor (build çıktısı beklenir).`);
  process.exit(0);
}

let sw = readFileSync(swPath, "utf8");
if (!sw.includes(PLACEHOLDER)) {
  console.warn(`[stamp-sw] Uyarı: dist/sw.js içinde ${PLACEHOLDER} bulunamadı — SW_VERSION damgalanmadı.`);
} else {
  sw = sw.split(PLACEHOLDER).join(id);
  writeFileSync(swPath, sw, "utf8");
  console.log(`[stamp-sw] SW_VERSION damgalandı → ${id}`);
}

// --- version.json: sürüm + tarih + "neler değişti" notları OTOMATİK üretilir ---
//
// NEDEN: Kullanıcıya gösterilen "Yeni sürüm hazır" notları PROFESYONEL ve genel olmalı —
// ham commit mesajları (geliştirici dili, küçük iç detaylar) kullanıcıya gösterilmez.
// Bunun yerine, bir önceki deploy'dan bu yana yapılan commit TÜRLERİNDEN (feat/fix/perf)
// cilalı, genel kullanıcı-dostu satırlar üretilir ("Performans iyileştirmeleri", "Hata
// düzeltmeleri" gibi). Küçük çaplı değişiklikler ayrı ayrı YAZILMAZ.

/** "g<hash>" biçimindeki build id'den git ref'i çıkarır (yoksa null). */
function refFromBuildId(val) {
  if (typeof val !== "string") return null;
  const m = val.match(/^g([0-9a-f]{7,40})$/i);
  return m ? m[1] : null;
}

/** Bir önceki deploy'dan bu yana yapılan commit'lerin TÜRLERİNİ (feat/fix/perf/refactor) döndürür. */
function commitTypesSince(prevRef) {
  const range = prevRef ? `${prevRef}..HEAD` : "-15";
  let raw = "";
  try {
    raw = execSync(`git log ${range} --no-merges --pretty=format:%s`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
  } catch {
    try {
      raw = execSync(`git log -15 --no-merges --pretty=format:%s`, {
        stdio: ["ignore", "pipe", "ignore"],
      }).toString();
    } catch {
      return new Set();
    }
  }
  const types = new Set();
  for (const line of raw.split("\n")) {
    const m = line.trim().match(/^(feat|fix|perf|refactor)(\([^)]*\))?:/i);
    if (m) types.add(m[1].toLowerCase());
  }
  return types;
}

/**
 * Commit türlerinden PROFESYONEL, genel sürüm notları üretir (TR + EN).
 * Ham commit metni asla sızmaz; küçük detaylar tek tek yazılmaz.
 */
function professionalNotes(types) {
  const tr = [];
  const en = [];
  if (types.has("feat")) {
    tr.push("Yeni özellikler ve geliştirmeler eklendi.");
    en.push("New features and enhancements.");
  }
  if (types.has("perf")) {
    tr.push("Performans ve hız iyileştirmeleri yapıldı.");
    en.push("Performance and speed improvements.");
  }
  if (types.has("fix") || types.has("refactor")) {
    tr.push("Hatalar giderildi ve kararlılık artırıldı.");
    en.push("Bug fixes and stability improvements.");
  }
  if (tr.length === 0) {
    tr.push("Genel iyileştirmeler ve bakım güncellemeleri.");
    en.push("General improvements and maintenance updates.");
  }
  return { tr, en };
}

if (existsSync(versionPath)) {
  try {
    const v = JSON.parse(readFileSync(versionPath, "utf8"));
    const prevRef = refFromBuildId(v.version); // üzerine yazmadan önceki hash
    const types = commitTypesSince(prevRef);
    const notes = professionalNotes(types);
    v.version = id;
    v.date = new Date().toISOString().slice(0, 10);
    v.notes = notes;
    writeFileSync(versionPath, JSON.stringify(v, null, 2) + "\n", "utf8");
    console.log(`[stamp-sw] version.json → ${id} (${v.date}), ${notes.tr.length} profesyonel not`);
  } catch (e) {
    console.warn(`[stamp-sw] version.json güncellenemedi: ${e?.message ?? e}`);
  }
}
