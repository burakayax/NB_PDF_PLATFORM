// GEÇİCİ (commitlenmez): görseli seç → Delete → hazırla; op'ları ve önizlemeyi kaydet.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const [SP, pdfPath, px, py, pageW, outName] = process.argv.slice(2);
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
await pg.waitForTimeout(2500);
const box = await pg.locator("[data-tour='editor-canvas'] canvas").boundingBox();
const s = box.width / Number(pageW);
await pg.mouse.click(box.x + Number(px) * s, box.y + Number(py) * s);
await pg.waitForTimeout(400);
await pg.keyboard.press("Delete");
await pg.waitForTimeout(600);
await pg.mouse.move(box.x + 5, box.y + box.height - 5);
await pg.screenshot({ path: `${SP}/${outName}_preview.png`, clip: { x: box.x, y: box.y, width: Math.min(box.width, 820), height: 260 } });
await pg.click("[data-tour='editor-done']");
const h = pg.getByRole("button", { name: "PDF'i Hazırla →" });
if (await h.isEnabled()) { await h.click(); await pg.getByRole("button", { name: "İndir", exact: true }).waitFor({ timeout: 60000 }); }
else console.log("silme algılanmadı");
writeFileSync(`${SP}/${outName}_edits.json`, edits ?? "null");
console.log("OPS", edits);
await b.close();
