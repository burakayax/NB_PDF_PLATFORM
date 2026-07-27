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
// NEDEN: notlar elle güncelleniyordu ve unutuluyordu → "Yeni sürüm hazır" bildirimi
// her deploy'da AYNI eski notları gösteriyordu (kullanıcı şikayeti: "gerçekten yapılan
// işlem yazılmıyor"). Artık notlar, bir ÖNCEKİ deploy'dan bu yana yapılan git commit'lerinden
// türetilir → her sürüm gerçek değişiklikleri yansıtır.
//
// NASIL: version.json.version zaten önceki build'in git hash'ini ("g<hash>") tutar.
// Onu üzerine yazmadan ÖNCE okuyup `prevHash..HEAD` aralığındaki kullanıcıyı ilgilendiren
// commit'leri (feat/fix/perf) alır, conventional-commit önekini temizler, TR notlara çevirir.

/** "g<hash>" biçimindeki build id'den git ref'i çıkarır (yoksa null). */
function refFromBuildId(val) {
  if (typeof val !== "string") return null;
  const m = val.match(/^g([0-9a-f]{7,40})$/i);
  return m ? m[1] : null;
}

/** Bir önceki deploy'dan bu yana kullanıcıyı ilgilendiren commit'lerden TR not listesi üretir. */
function releaseNotesTr(prevRef) {
  const range = prevRef ? `${prevRef}..HEAD` : "-12";
  let raw = "";
  try {
    raw = execSync(`git log ${range} --no-merges --pretty=format:%s`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
  } catch {
    // prevRef geçmişte yoksa (shallow clone / force-push) → son 12 commit'e düş.
    try {
      raw = execSync(`git log -12 --no-merges --pretty=format:%s`, {
        stdio: ["ignore", "pipe", "ignore"],
      }).toString();
    } catch {
      return [];
    }
  }
  const seen = new Set();
  const notes = [];
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s || /^merge:/i.test(s)) continue;
    // Yalnızca kullanıcıya görünür türler; altyapı/commit-hijyen türlerini ele.
    const m = s.match(/^(feat|fix|perf)(\([^)]*\))?:\s*(.+)$/i);
    if (!m) continue;
    let text = m[3].replace(/\s+/g, " ").trim();
    text = text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1);
    const key = text.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push(text);
    if (notes.length >= 5) break;
  }
  return notes;
}

if (existsSync(versionPath)) {
  try {
    const v = JSON.parse(readFileSync(versionPath, "utf8"));
    const prevRef = refFromBuildId(v.version); // üzerine yazmadan önceki hash
    const tr = releaseNotesTr(prevRef);
    v.version = id;
    v.date = new Date().toISOString().slice(0, 10);
    if (tr.length > 0) {
      v.notes = {
        tr,
        // EN kitlesi azınlık + TR commit'lerini İngilizce göstermek yanlış olur;
        // spesifik-ama-yanlış yerine dürüst genel satır (asla "eski/donuk" değil).
        en: ["We shipped improvements and bug fixes."],
      };
    }
    writeFileSync(versionPath, JSON.stringify(v, null, 2) + "\n", "utf8");
    console.log(`[stamp-sw] version.json → ${id} (${v.date}), ${tr.length} not`);
  } catch (e) {
    console.warn(`[stamp-sw] version.json güncellenemedi: ${e?.message ?? e}`);
  }
}
