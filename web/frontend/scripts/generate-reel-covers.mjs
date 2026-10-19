/**
 * Araç Reels/Shorts videoları için markalı KAPAK görselleri (1080×1920, dikey).
 *
 * Her araç senaryosu (`scripts/tool-reels/scenarios/<id>.mjs`) için bir kapak üretilir:
 * `public/reel-covers/<id>.jpg`. Instagram Reels kapağı (profil ızgarasında görünen) ve YouTube küçük
 * resmi olarak kullanılır (API tarafı: `platforms/instagram-reels.ts`, `platforms/youtube.platform.ts`).
 *
 * TASARIM: Beş tasarım dili (poster, adım adım, koyu premium, özellik ızgarası, önce/sonra) araç başına
 * seçilir; her aracın kelime oyunlu kendi başlığı vardır. Tasarımlar `scripts/lib/cover-designs.mjs`,
 * araç metinleri ve tasarım seçimi `scripts/tool-reels/cover-specs.mjs` içindedir. Yazı SVG'ye vektör yolu
 * olarak gömülür: üretildiği makinede font kurulu olması gerekmez, Türkçe karakterler sorunsuz çıkar.
 *
 * GÜVENLİ ALAN: Instagram profil ızgarası kapağı 3:4 kırpar (üstten/alttan 240 px gider); tüm önemli
 * öğeler y=250..1670 arasında tutulur.
 *
 * YENİ ARAÇ: senaryo eklenince `cover-specs.mjs`e satır ekle, `node scripts/generate-reel-covers.mjs`
 * çalıştır, çıkan dosyayı commitle. Satır eklenmezse başlıktan sade bir poster üretilir.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderReelCover } from "./lib/cover-designs.mjs";
import { COVER_SPECS, fallbackSpec } from "./tool-reels/cover-specs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "reel-covers");
const SCENARIOS_DIR = join(ROOT, "scripts", "tool-reels", "scenarios");

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
  const scenarios = loadScenarios();
  warnMissingCatalog(scenarios.map((x) => x.id));
  for (const scenario of scenarios) {
    const spec = COVER_SPECS[scenario.id] ?? fallbackSpec(scenario);
    const jpg = await renderReelCover(spec);
    writeFileSync(join(OUT_DIR, `${scenario.id}.jpg`), jpg);
    console.log(`reel-covers/${scenario.id}.jpg [${spec.design}] (${Math.round(jpg.length / 1024)} KB)`);
  }
}

// Kapak üretimi yardımcı bir adımdır: hata olursa derleme DURMAZ (video kapaksız çıkar, paylaşım engellenmez).
main().catch((err) => {
  console.warn(`UYARI: reel kapakları üretilemedi: ${String(err)}`);
});
