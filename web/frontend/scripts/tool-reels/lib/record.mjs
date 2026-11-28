/**
 * Teknik tesisat: sahneyi kare kare görüntüler, sesi sentezler, MP4 yazar. Görsel dil sahne dosyalarındadır.
 *
 * Sahne sözleşmesi: `window.META = { sure, kontrol: [sn...] }` ve belirlenimci `window.render(sn)`;
 * `/*FONTLAR*\/` ve `__EMBLEM__` yer tutucuları burada doldurulur.
 */

import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OUTRO_SECONDS } from "../scenes/index.mjs";
import { SESLER, wav } from "../scenes/sounds.mjs";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const scenesDir = resolve(here, "../scenes");
const fontDir = resolve(here, "../../../public/fonts");
const FPS = 30;

const ffmpegPath = () => process.env.FFMPEG_PATH || require("ffmpeg-static");

function fontCss() {
  const face = (family, file) =>
    ["latin", "latin-ext"]
      .map((subset) => {
        const data = readFileSync(resolve(fontDir, `${file}-${subset}-wght-normal.woff2`)).toString("base64");
        const range = subset === "latin" ? "U+0000-00FF,U+2000-206F,U+20A0-20CF" : "U+0100-02AF";
        return `@font-face{font-family:${family};font-weight:100 900;src:url(data:font/woff2;base64,${data});unicode-range:${range}}`;
      })
      .join("");
  return face("PJS", "plus-jakarta-sans") + face("INT", "inter") + face("DMS", "dm-sans");
}

function sceneHtml(id) {
  const emblem = "data:image/png;base64," + readFileSync(resolve(scenesDir, "emblem.png")).toString("base64");
  return readFileSync(resolve(scenesDir, `${id}.html`), "utf8").replace("/*FONTLAR*/", fontCss()).replaceAll("__EMBLEM__", emblem);
}

function ffmpeg(args) {
  const r = spawnSync(ffmpegPath(), ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg başarısız");
}

async function openScene(id, toolCount) {
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((n) => {
    window.ARAC_SAYISI = n;
  }, toolCount);
  await page.setContent(sceneHtml(id));
  // setContent yeni gezinme sayılmadığından değer sayfaya ayrıca da yazılır.
  await page.evaluate(async (n) => {
    window.ARAC_SAYISI = n;
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  }, toolCount);
  const meta = await page.evaluate(() => window.META);
  const check = () => {
    if (errors.length) throw new Error(`Sahne hatası (${id}):\n${errors.join("\n")}`);
  };
  check();
  return { browser, page, meta, check };
}

const draw = (page, seconds, linkLine) =>
  page.evaluate(
    ([t, line]) => {
      window.BAGLANTI = line;
      window.render(t);
    },
    [seconds, linkLine],
  );

/** Denetim kareleri: `<workDir>/serit.png` (5×2 yan yana). */
export async function renderStills({ id, workDir, toolCount, linkLine }) {
  mkdirSync(workDir, { recursive: true });
  const { browser, page, meta, check } = await openScene(id, toolCount);
  try {
    for (let i = 0; i < meta.kontrol.length; i++) {
      await draw(page, meta.kontrol[i], linkLine);
      await page.screenshot({ path: `${workDir}/k${String(i).padStart(2, "0")}.png` });
    }
    check();
  } finally {
    await browser.close();
  }
  ffmpeg(["-i", `${workDir}/k%02d.png`, "-vf", "scale=432:-1,tile=5x2:padding=10:color=0xff0000", "-frames:v", "1", `${workDir}/serit.png`]);
  return `${workDir}/serit.png`;
}

async function encodeFrames(page, from, to, linkLine, file) {
  const encoder = spawn(
    ffmpegPath(),
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", file],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((res, rej) => encoder.on("close", (code) => (code === 0 ? res() : rej(new Error("kare kodlama başarısız")))));
  for (let i = from; i < to; i++) {
    await draw(page, i / FPS, linkLine);
    const frame = await page.screenshot({ type: "jpeg", quality: 94 });
    if (!encoder.stdin.write(frame)) await new Promise((r) => encoder.stdin.once("drain", r));
  }
  encoder.stdin.end();
  await done;
}

/**
 * Sürümleri üretir. Gövde bir kez çizilir; yalnız kapanış vitrini her sürüm için ayrı çizilip eklenir.
 * `versions`: [{ out, linkLine }]
 */
export async function renderVideos({ id, workDir, toolCount, versions }) {
  mkdirSync(workDir, { recursive: true });
  const { browser, page, meta, check } = await openScene(id, toolCount);
  const total = Math.round(FPS * meta.sure);
  const split = Math.floor(FPS * (meta.sure - OUTRO_SECONDS));
  const body = resolve(workDir, "govde.mp4");
  try {
    await encodeFrames(page, 0, split, versions[0].linkLine, body);
    for (const [i, v] of versions.entries()) {
      await encodeFrames(page, split, total, v.linkLine, resolve(workDir, `kapanis-${i}.mp4`));
    }
    check();
  } finally {
    await browser.close();
  }

  const audio = resolve(workDir, "ses.wav");
  writeFileSync(audio, wav(SESLER[id](meta.sure)));
  for (const [i, v] of versions.entries()) {
    const list = resolve(workDir, `liste-${i}.txt`);
    const quote = (p) => `file '${p.replaceAll("\\", "/").replaceAll("'", "'\\''")}'`;
    writeFileSync(list, [body, resolve(workDir, `kapanis-${i}.mp4`)].map(quote).join("\n"));
    const mixed = resolve(workDir, `surum-${i}.mp4`);
    ffmpeg([
      "-f", "concat", "-safe", "0", "-i", list, "-i", audio,
      "-af", "lowpass=f=14000,loudnorm=I=-16:TP=-1.5:LRA=11",
      "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k",
      "-shortest", "-movflags", "+faststart", mixed,
    ]);
    mkdirSync(dirname(v.out), { recursive: true });
    copyFileSync(mixed, v.out);
  }
  return { seconds: meta.sure };
}
