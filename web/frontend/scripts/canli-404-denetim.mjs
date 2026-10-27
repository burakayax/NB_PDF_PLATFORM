/**
 * Canlı 404 denetimi: sitemap.xml'deki HER adres 200, bilinmeyenler 404 dönmeli.
 * Kullanım:  node scripts/canli-404-denetim.mjs [taban-adres]
 *   ör.  node scripts/canli-404-denetim.mjs https://www.pdfplatform.app
 *        node scripts/canli-404-denetim.mjs https://test.pdfplatform.app   (Worker test adresi)
 * Sitemap önce tabandan, olmazsa yereldeki public/sitemap.xml'den okunur.
 * Not: /about ve /register uygulamanın GERÇEK istemci rotalarıdır → 200 beklenir.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const taban = (process.argv[2] || "https://www.pdfplatform.app").replace(/\/+$/, "");
const burasi = dirname(fileURLToPath(import.meta.url));

async function sitemapYollari() {
  let xml;
  try {
    const r = await fetch(`${taban}/sitemap.xml`);
    if (!r.ok) throw new Error(String(r.status));
    xml = await r.text();
  } catch {
    xml = readFileSync(join(burasi, "../public/sitemap.xml"), "utf8");
  }
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

const durum = async (yol) => (await fetch(taban + yol, { redirect: "manual" })).status;

const yollar = await sitemapYollari();
const hatalar = [];
let i = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (i < yollar.length) {
      const yol = yollar[i++];
      const d = await durum(yol);
      if (d !== 200) hatalar.push(`${yol} → ${d} (200 beklenirdi)`);
    }
  }),
);
console.log(`Sitemap: ${yollar.length} adres, 200 dönmeyen: ${hatalar.length}`);
hatalar.forEach((h) => console.log("  ✗", h));

const beklenen404 = ["/bu-sayfa-yok-xyz", "/en/bu-yok-xyz", "/en/blog/bu-yok-xyz", "/blog/bu-yok-xyz"];
const beklenen200 = ["/about", "/register", "/en/about", "/en/register", "/login", "/en/blog/convert-pdf-to-word"];
let kotu = hatalar.length;
for (const y of beklenen404) {
  const d = await durum(y);
  console.log(`${d === 404 ? "✓" : "✗"} ${y} → ${d} (404 beklenir)`);
  if (d !== 404) kotu++;
}
for (const y of beklenen200) {
  const d = await durum(y);
  console.log(`${d === 200 ? "✓" : "✗"} ${y} → ${d} (200 beklenir)`);
  if (d !== 200) kotu++;
}
process.exit(kotu ? 1 : 0);
