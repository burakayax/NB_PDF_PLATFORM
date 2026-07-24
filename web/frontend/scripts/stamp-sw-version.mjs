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

// version.json "version" alanını da build id + tarihle güncelle (notlar elle kalır).
if (existsSync(versionPath)) {
  try {
    const v = JSON.parse(readFileSync(versionPath, "utf8"));
    v.version = id;
    v.date = new Date().toISOString().slice(0, 10);
    writeFileSync(versionPath, JSON.stringify(v, null, 2) + "\n", "utf8");
    console.log(`[stamp-sw] version.json → ${id} (${v.date})`);
  } catch (e) {
    console.warn(`[stamp-sw] version.json güncellenemedi: ${e?.message ?? e}`);
  }
}
