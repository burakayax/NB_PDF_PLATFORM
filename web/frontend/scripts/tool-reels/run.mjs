/**
 * Araç tanıtım videosu üretici: aracı gerçekten kullanıp ekranı kaydeder, kurgular, MP4 yazar.
 *
 *   node scripts/tool-reels/run.mjs --tool compress --out video.mp4
 *
 * Giriş yapılabilen bir site gerekir (`--base`; üretimde CANLI site) ve PRO yetkili bir deneme
 * hesabı (REELS_DEMO_EMAIL / REELS_DEMO_PASSWORD). Üretimde bunu GitHub iş akışı çalıştırır
 * (.github/workflows/tool-reels.yml); videoyu paylaşım zamanı yaklaşınca üretir, API'ye yükler,
 * paylaşıldıktan sonra silinir. Yapay zekâ kullanan araçlar eklenmez (senaryoda usesAi: true).
 *
 * Yeni araç eklemek: scenarios/<id>.mjs yaz, aşağıdaki SCENARIOS listesine ekle ve
 * API tarafındaki araç kataloğuna (tool-reel-catalog.ts) metnini ekle.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compose } from "./lib/compose.mjs";
import { createStage } from "./lib/stage.mjs";
import compress from "./scenarios/compress.mjs";
import merge from "./scenarios/merge.mjs";
import cvOlustur from "./scenarios/cv-olustur.mjs";

const SCENARIOS = { compress, merge, "cv-olustur": cvOlustur };

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, "../..");
const publicDir = resolve(frontendRoot, "public");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const toolId = arg("tool");
const scenario = SCENARIOS[toolId];
if (!scenario) {
  console.error(`Bilinmeyen araç: ${toolId}. Tanımlılar: ${Object.keys(SCENARIOS).join(", ")}`);
  process.exit(2);
}
// Yapay zekâ araçları (kredi/ücret keser) video üretiminde kullanılmaz.
if (scenario.usesAi) {
  console.error(`${toolId} yapay zekâ kullanıyor; araç videosu üretiminde kullanılmaz.`);
  process.exit(2);
}
const out = resolve(arg("out", `${toolId}-reel.mp4`));
const baseUrl = arg("base", "http://localhost:5180").replace(/\/$/, "");
const workDir = resolve(arg("work", `${process.env.RUNNER_TEMP || process.env.TEMP || "/tmp"}/tool-reel-${toolId}`));
const email = process.env.REELS_DEMO_EMAIL;
const password = process.env.REELS_DEMO_PASSWORD;
if (!email || !password) {
  console.error("REELS_DEMO_EMAIL ve REELS_DEMO_PASSWORD gerekli.");
  process.exit(2);
}

// Gizlilik cümlesi araç durumuna göre: tek kaynak src/lib/onDeviceTools.ts (elle yazılmaz).
const onDeviceSrc = readFileSync(resolve(frontendRoot, "src/lib/onDeviceTools.ts"), "utf8");
const onDeviceIds = new Set([...onDeviceSrc.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]));
const processing = onDeviceIds.has(scenario.id)
  ? ["Cihazında işlenir", "dosyan sunucuya gitmez"]
  : ["Sunucuda işlenir", "işlem sonrası silinir"];

// Örnek belgeler (uydurma): python + pymupdf gerekir.
mkdirSync(`${workDir}/fixtures`, { recursive: true });
if (!scenario.files.every((f) => existsSync(`${workDir}/fixtures/${f}`))) {
  const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  const r = spawnSync(
    python,
    ["-I", resolve(here, "fixtures/make-fixtures.py"), `${workDir}/fixtures`, resolve(publicDir, "fonts")],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error("Örnek belgeler üretilemedi");
}
const fixtures = (name) => `${workDir}/fixtures/${name}`;

const stage = await createStage({ baseUrl, workDir });
let extra;
try {
  await stage.loginAndOpenTool({ email, password, toolPath: scenario.toolPath, readySelector: scenario.readySelector });
  extra = await scenario.run(stage, { fixtures, processing });
} catch (err) {
  await stage.pg.screenshot({ path: `${workDir}/hata.png` }).catch(() => {});
  await stage.finish({}).catch(() => {});
  console.error(`Kayıt başarısız (ekran görüntüsü: ${workDir}/hata.png)`);
  throw err;
}
await stage.finish(extra);

mkdirSync(dirname(out), { recursive: true });
const { total } = compose({ workDir, out, intro: scenario.intro, publicDir });
copyFileSync(out, out); // varlık denetimi (yazılmadıysa hata verir)
console.log(JSON.stringify({ ok: true, tool: toolId, out, seconds: Math.round(total) }));
