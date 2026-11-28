/**
 * Araç tanıtım videosu üretici: elle yazılmış animasyon sahnesinden MP4 üretir.
 *
 *   node scripts/tool-reels/run.mjs --tool udf-to-pdf --out video.mp4
 *   node scripts/tool-reels/run.mjs --tool udf-to-pdf --stills        # yalnız denetim kareleri
 *
 * Siteye giriş, deneme hesabı ve ekran kaydı YOKTUR; yalnız tarayıcı (Playwright) ve ffmpeg gerekir.
 * Üretimde GitHub iş akışı çalıştırır (.github/workflows/tool-reels.yml); videoyu paylaşım zamanı
 * yaklaşınca üretir, API'ye yükler, paylaşıldıktan sonra silinir.
 *
 * Yeni araç eklemek ve BAĞLAYICI video kuralları: README.md
 */

import { resolve } from "node:path";
import { TOOL_PROCESSING } from "../../src/content/toolProcessing.mjs";
import { renderStills, renderVideos } from "./lib/record.mjs";
import { LINK_LINES, SCENES, processingMismatch } from "./scenes/index.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const toolId = arg("tool");
if (!SCENES[toolId]) {
  console.error(`Bu aracın video sahnesi yok: ${toolId}. Tanımlılar: ${Object.keys(SCENES).join(", ")}`);
  process.exit(2);
}
// Videodaki gizlilik sözü aracın gerçek çalışma biçimiyle uyuşmuyorsa üretilmez.
const mismatch = processingMismatch(toolId, TOOL_PROCESSING);
if (mismatch) {
  console.error(mismatch);
  process.exit(2);
}
// Kapanıştaki araç sayısı her üretimde sitenin kendi listesinden okunur.
const toolCount = TOOL_PROCESSING.length;
const out = resolve(arg("out", `${toolId}-reel.mp4`));
const workDir = resolve(arg("work", `${process.env.RUNNER_TEMP || process.env.TEMP || "/tmp"}/tool-reel-${toolId}`));

if (process.argv.includes("--stills")) {
  console.log(await renderStills({ id: toolId, workDir: workDir, toolCount, linkLine: LINK_LINES.profile }));
} else {
  const outCaption = resolve(arg("out-aciklama", out.replace(/\.mp4$/, "-aciklama.mp4")));
  const outComment = resolve(arg("out-yorum", out.replace(/\.mp4$/, "-yorum.mp4")));
  const { seconds } = await renderVideos({
    id: toolId,
    workDir,
    toolCount,
    versions: [
      { out, linkLine: LINK_LINES.profile },
      { out: outCaption, linkLine: LINK_LINES.caption },
      { out: outComment, linkLine: LINK_LINES.comment },
    ],
  });
  console.log(JSON.stringify({ ok: true, tool: toolId, out, outCaption, outComment, seconds: Math.round(seconds) }));
}
