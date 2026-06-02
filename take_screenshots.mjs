/**
 * take_screenshots.mjs
 * Playwright ile web uygulamasının gerçek ekran görüntülerini çeker.
 * Çalıştırmak için: node take_screenshots.mjs
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "web", "frontend", "public");

const BASE = "http://localhost:5174";

async function shot(page, url, filename, opts = {}) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1800); // animasyonların bitmesi için bekle
  const outPath = path.join(OUT, filename);
  await page.screenshot({
    path: outPath,
    fullPage: opts.fullPage ?? false,
    clip: opts.clip,
  });
  console.log(`  ✓ ${filename}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── 1. Web – Landing Page (1280×800) ──────────────────────────────────────
  const ctxLanding = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const landing = await ctxLanding.newPage();

  console.log("📸  Web – Landing Page...");
  await shot(landing, BASE + "/", "screenshot-web-landing.png");

  // ── 2. Web – Araçlar (workspace) ──────────────────────────────────────────
  console.log("📸  Web – Workspace (misafir)...");
  // Misafir olarak workspace'e git
  await shot(landing, BASE + "/?guest=1", "screenshot-web-tools.png");

  // ── 3. Web – Split PDF aracı ───────────────────────────────────────────────
  console.log("📸  Web – Split PDF aracı...");
  await shot(landing, BASE + "/tools/split-pdf", "screenshot-web-split.png");

  // ── 4. Web – Merge PDF aracı ───────────────────────────────────────────────
  console.log("📸  Web – Merge PDF aracı...");
  await shot(landing, BASE + "/tools/merge-pdf", "screenshot-web-merge.png");

  await ctxLanding.close();

  // ── 5. Web – Dashboard geniş viewport ─────────────────────────────────────
  const ctxWide = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const wide = await ctxWide.newPage();
  console.log("📸  Web – Hero geniş (1440px)...");
  await shot(wide, BASE + "/", "screenshot-web-hero.png", {
    clip: { x: 0, y: 0, width: 1440, height: 860 },
  });
  await ctxWide.close();

  await browser.close();
  console.log("\n✅  Tüm web ekran görüntüleri alındı →", OUT);
})().catch((err) => {
  console.error("HATA:", err.message);
  process.exit(1);
});
