// GEÇİCİ (commitlenmez): (x,y) PDF noktasındaki yazıyı tümüyle değiştir → hazırla; önizleme + op'lar.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const [SP, pdfPath, px, py, pageW, newText, outName, clipH] = process.argv.slice(2);
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
await pg.locator("input[type=file]").first().setInputFiles(pdfPath);
await pg.waitForSelector("[data-tour='editor-canvas'] canvas", { timeout: 30000 });
await pg.waitForTimeout(8000);
const box = await pg.locator("[data-tour='editor-canvas'] canvas").boundingBox();
const s = box.width / Number(pageW);
await pg.mouse.click(box.x + Number(px) * s, box.y + Number(py) * s);
await pg.waitForTimeout(500);
await pg.keyboard.press("Control+A");
await pg.keyboard.type(newText);
await pg.waitForTimeout(800);
await pg.mouse.move(box.x + 5, box.y + box.height - 5);
await pg.screenshot({ path: `${SP}/${outName}_preview.png`, clip: { x: box.x, y: box.y + (Number(py) - 30) * s, width: Math.min(box.width, 820), height: Number(clipH || 60) * s } });
await pg.click("[data-tour='editor-done']");
await pg.getByRole("button", { name: "PDF'i Hazırla →" }).click();
await pg.getByRole("button", { name: "İndir", exact: true }).waitFor({ timeout: 60000 });
writeFileSync(`${SP}/${outName}_edits.json`, edits ?? "null");
console.log("OPS", edits ? JSON.stringify(JSON.parse(edits).map((o) => ({ t: o.text, f: o.font, hs: o.hs, fit: o.fit, ocs: o.ocs, of: o.ofont, b: o.bold, i: o.italic }))) : "yok");
await b.close();
