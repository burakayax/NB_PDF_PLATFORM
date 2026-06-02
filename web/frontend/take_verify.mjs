import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "public");
const BASE = "http://localhost:5174";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "screenshot-landing-updated.png"), fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log("Hero shot done");
  await page.waitForTimeout(500);
  // Full page scroll shot
  await page.screenshot({ path: path.join(OUT, "screenshot-landing-full.png"), fullPage: true });
  console.log("Full page shot done");
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
