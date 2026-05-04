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
  await page.waitForTimeout(2000);
  // Scroll to ProductShowcase (after trust section, roughly 4000px)
  await page.evaluate(() => window.scrollTo(0, 4200));
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, "ss-new-showcase.png"), clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log("shot 1 done");
  // click desktop tab
  await page.evaluate(() => window.scrollTo(0, 4400));
  await page.waitForTimeout(800);
  // find desktop tab button and click
  const buttons = await page.$$('button[role="tab"]');
  for (const btn of buttons) {
    const txt = await btn.textContent();
    if (txt && txt.includes("Desktop")) { await btn.click(); break; }
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "ss-new-showcase-desktop.png"), clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log("shot 2 done");
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
