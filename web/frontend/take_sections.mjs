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
  await page.waitForTimeout(3000);
  // Scroll down to app preview section
  await page.evaluate(() => window.scrollBy(0, 1200));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "ss-app-preview.png"), clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log("App preview section shot done");
  // Scroll to showcase section
  await page.evaluate(() => window.scrollBy(0, 3000));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "ss-showcase.png"), clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log("Showcase section shot done");
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
