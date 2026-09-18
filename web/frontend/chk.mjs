import { chromium } from "playwright";
const b = await chromium.launch();
const page = await (await b.newContext({ viewport:{width:1440,height:900} })).newPage();
const urls = ["summarize-pdf","chat-with-pdf","translate-pdf","extract-data-from-pdf","compare-pdf","batch-process-pdf","redact-pdf","ocr-pdf","pdf-to-word"];
for (const u of urls) {
  await page.goto(`https://www.pdfplatform.app/en/tools/${u}`, { waitUntil:"networkidle", timeout:60000 });
  await page.waitForTimeout(1800);
  const t = await page.locator("body").innerText();
  const soon = /coming soon/i.test(t);
  console.log(u.padEnd(24), soon ? "COMING SOON" : "aktif");
}
await b.close();
