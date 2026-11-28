/**
 * Araç Reels/Shorts videoları için markalı KAPAK görselleri (1080×1920, dikey).
 *
 * `scripts/tool-reels/cover-specs.mjs` içindeki her araç için bir kapak üretilir:
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
 * YENİ ARAÇ: `cover-specs.mjs`e satır ekle, `node scripts/generate-reel-covers.mjs` çalıştır, çıkan dosyayı commitle.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderReelCover } from "./lib/cover-designs.mjs";
import { assignLayouts, renderCover } from "./lib/cover-engine.mjs";
import { heroFor } from "./lib/heroes.mjs";
import { COVER_SPECS } from "./tool-reels/cover-specs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "reel-covers");
const PUBLIC_DIR = join(ROOT, "public");

/** Gerçek içerik taşıdığı için özel tasarımda kalan kapaklar (önce/sonra, gerçek adımlar, ızgara vurgusu). */
const CUSTOM_DESIGN = new Set(["compress", "grayscale-pdf", "cv-olustur", "belge-tara", "taranmis-pdf-ocr", "sayfa-duzeni", "ustveri-temizle"]);
const ACCENT_CYCLE = ["blue", "violet", "emerald", "amber", "rose", "cyan", "fuchsia", "sky"];

/** Araç spec'ini motor girdisine çevirir (başlık + vurgulu etiket + konu çizimi). */
function engineSpec(id, spec) {
  const hero = spec.hero ?? heroFor(id);
  if (spec.design === "poster") return { title: spec.lines.join(" "), tag: spec.word, hero, forceCaps: true };
  if (spec.design === "dark") return { title: spec.l1, tag: spec.l2, hero: "convert", heroOpts: { from: spec.from, to: spec.to } };
  if (spec.design === "steps") return { title: spec.top, tag: spec.hl, hero };
  return { title: spec.l1, tag: spec.l2, hero };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const scenarios = Object.keys(COVER_SPECS).map((id) => ({ id, title: id, sub: "" }));
  // Derleme sunucusunda (Render/CI) kapaklar zaten depoda hazır: hepsi varsa yeniden üretmeyip ~15-40 sn kazanılır.
  // Kapak tasarımını değiştirdiysen yerelde `node scripts/generate-reel-covers.mjs` çalıştırıp dosyayı commitle
  // (ya da sunucuda zorlamak için FORCE_COVERS=1).
  const onBuildServer = Boolean(process.env.RENDER || process.env.CI);
  if (onBuildServer && process.env.FORCE_COVERS !== "1" && scenarios.every((x) => existsSync(join(OUT_DIR, `${x.id}.jpg`)))) {
    console.log(`reel-covers: ${scenarios.length} kapak depoda hazır, yeniden üretilmedi.`);
    return;
  }
  const specs = new Map(scenarios.map((x) => [x.id, COVER_SPECS[x.id]]));
  // Gerçek içerik taşıyan yedi özel tasarım dışındaki her araç düzen motoruna girer; düzenler yan yana tekrar etmesin diye atanır.
  const engineIds = [...specs.keys()].filter((id) => !CUSTOM_DESIGN.has(id));
  const layouts = assignLayouts(engineIds);
  for (const scenario of scenarios) {
    const spec = specs.get(scenario.id);
    let jpg;
    let label;
    if (CUSTOM_DESIGN.has(scenario.id)) {
      jpg = await renderReelCover(spec);
      label = spec.design;
    } else {
      const e = engineSpec(scenario.id, spec);
      const idx = engineIds.indexOf(scenario.id);
      jpg = await renderCover({ ...e, layout: layouts.get(scenario.id), accent: ACCENT_CYCLE[idx % ACCENT_CYCLE.length], w: 1080, h: 1920, key: "reel", format: "jpeg", publicDir: PUBLIC_DIR });
      label = layouts.get(scenario.id);
    }
    writeFileSync(join(OUT_DIR, `${scenario.id}.jpg`), jpg);
    console.log(`reel-covers/${scenario.id}.jpg [${label}] (${Math.round(jpg.length / 1024)} KB)`);
  }
}

// Kapak üretimi yardımcı bir adımdır: hata olursa derleme DURMAZ (video kapaksız çıkar, paylaşım engellenmez).
main().catch((err) => {
  console.warn(`UYARI: reel kapakları üretilemedi: ${String(err)}`);
});
