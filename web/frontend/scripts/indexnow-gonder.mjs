/**
 * IndexNow: sitemap'teki adresleri Bing ve diğer katılımcı arama motorlarına bildirir.
 * Anahtar dosyası public/5058d48e87a8edd2acf558899166b5cb.txt olarak sitede yayında olmalıdır.
 *
 * Kullanım:
 *   node scripts/indexnow-gonder.mjs            # prova: kaç adres gideceğini yazar
 *   node scripts/indexnow-gonder.mjs --uygula   # gerçekten gönderir
 *   node scripts/indexnow-gonder.mjs --uygula https://www.pdfplatform.app/tools/x  # yalnız verilen adresler
 */
const ANAHTAR = "5058d48e87a8edd2acf558899166b5cb";
const SITE = "https://www.pdfplatform.app";
const uygula = process.argv.includes("--uygula");
const verilen = process.argv.slice(2).filter((a) => a.startsWith("http"));

let adresler = verilen;
if (!adresler.length) {
  const xml = await (await fetch(SITE + "/sitemap.xml", { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  adresler = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}
console.log(adresler.length + " adres" + (uygula ? " gönderiliyor" : " (prova, gönderilmedi)"));
if (!uygula) process.exit(0);

const yanit = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(SITE).host,
    key: ANAHTAR,
    keyLocation: SITE + "/" + ANAHTAR + ".txt",
    urlList: adresler,
  }),
});
console.log("Yanıt:", yanit.status, yanit.statusText);
