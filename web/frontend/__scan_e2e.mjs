// GEÇİCİ (commitlenmez): taranmış PDF senaryoları — algılama, OCR, düzenleme, op'lar.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const [SP, name] = process.argv.slice(2);
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1300, height: 1000 } });
let edits = null;
pg.on("pageerror", (e) => console.log("PAGEERR", e.message));
pg.on("console", (m) => { if (m.text().startsWith("EDITS ")) edits = m.text().slice(6); });
await pg.addInitScript(() => {
  try { localStorage.setItem("pdfEditorTourSeen", "1"); } catch {}
  const oa = FormData.prototype.append;
  FormData.prototype.append = function (k, v) { if (k === "edits") console.log("EDITS " + v); return oa.apply(this, arguments); };
});
await pg.goto("http://localhost:5173/tools/pdf-duzenle", { waitUntil: "networkidle" });
await pg.locator("input[type=file]").first().setInputFiles(`${SP}/scans/${name}.pdf`);
await pg.waitForSelector("[data-tour='editor-canvas'] canvas", { timeout: 30000 });
await pg.waitForTimeout(2500);
const info = async () => pg.evaluate(() => {
  const c = document.querySelector("[data-tour='editor-canvas']");
  return { hedef: c ? c.querySelectorAll("[title]").length : 0, ocrButonu: document.body.innerText.includes("Metni Tanı (OCR)"), taranmisUyari: /taranmış görünüyor/i.test(document.body.innerText) };
});
console.log("AÇILIŞ:", JSON.stringify(await info()));
await pg.screenshot({ path: `${SP}/scans/${name}_1.png`, fullPage: false });
if ((await info()).ocrButonu) {
  await pg.click("[data-tour='editor-done']");
  await pg.getByRole("button", { name: "Metni Tanı (OCR)" }).click();
  await pg.waitForFunction(() => !document.body.innerText.includes("Metni Tanı (OCR)"), null, { timeout: 120000 });
  await pg.getByRole("button", { name: "Düzenle", exact: true }).click();
  await pg.waitForTimeout(2000);
  console.log("OCR SONRASI:", JSON.stringify(await info()));
}
// Başlığa tıkla (sayfanın üst-sol başlık bölgesi) ve değiştir
const box = await pg.locator("[data-tour='editor-canvas'] canvas").boundingBox();
const pw = await pg.evaluate(() => 0);
await pg.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.105);
await pg.waitForTimeout(500);
await pg.keyboard.press("Control+A");
await pg.keyboard.type("Kira Sözleşmesi Koşulları");
await pg.waitForTimeout(500);
await pg.mouse.click(box.x + 5, box.y + box.height - 5);
await pg.waitForTimeout(600);
await pg.screenshot({ path: `${SP}/scans/${name}_2.png`, clip: { x: box.x, y: box.y, width: Math.min(box.width, 820), height: 330 } });
await pg.click("[data-tour='editor-done']");
const hazirla = pg.getByRole("button", { name: "PDF'i Hazırla →" });
if (await hazirla.isEnabled()) {
  await hazirla.click();
  await pg.getByRole("button", { name: "İndir", exact: true }).waitFor({ timeout: 60000 });
} else console.log("HAZIRLA PASİF — düzenleme algılanmadı");
writeFileSync(`${SP}/scans/${name}_edits.json`, edits ?? "null");
console.log("OPS:", edits ? JSON.stringify(JSON.parse(edits).map((o) => ({ t: o.text, f: o.font, vt: o.vt, bg: o.bg, sz: o.size, by: o.by }))) : "yok");
await b.close();
