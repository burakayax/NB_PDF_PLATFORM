import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:5288";
const DELAY = Number(process.env.DELAY ?? 1500);   // yenileme yanıtını geciktir (sayfa geçişinde kesilsin)
const GAP = Number(process.env.GAP ?? 900);        // sayfalar arası bekleme
const N = Number(process.env.N ?? 20);
const PAGES = ["compress","merge-pdf","split-pdf","delete-pages","rotate-pdf","organize-pdf","gorsel-sikistir","gorsel-boyutlandir","pdf-kesit-al","pdf-to-word","word-to-pdf","excel-to-pdf","pdf-to-excel","pdf-to-ppt","ppt-to-pdf","pdf-to-image","image-to-pdf","belge-tara","aranabilir-pdf","html-to-pdf","unlock-pdf","watermark","page-numbers"];
const IPVARY = process.env.IPVARY === "1";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const olaylar = [];
page.on("response", (r) => { if (r.url().includes("/api/auth/refresh")) olaylar.push(`refresh ${r.status()}`); if (r.status() >= 400) r.text().then((t) => console.log("gövde:", t.slice(0, 200))).catch(() => {}); });
page.on("requestfailed", (r) => { if (r.url().includes("/api/auth/refresh")) olaylar.push("refresh KESILDI"); });
if (IPVARY && !(DELAY > 0)) await ctx.route("**/api/**", async (route) => { const h = { ...route.request().headers(), "x-forwarded-for": `172.69.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}` }; try { await route.continue({ headers: h }); } catch {} });
await page.goto(BASE + "/", { waitUntil: "load" });
const giris = await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "oturum-testi@example.com", password: "Test12345!x" }) });
  if (r.ok) localStorage.setItem("nb_session_hint", "1");
  return r.status;
});
console.log("giris:", giris);
if (giris !== 200) process.exit(2);
if (DELAY > 0) await ctx.route("**/api/auth/refresh", async (route) => { try { const h = { ...route.request().headers() }; if (IPVARY) h["x-forwarded-for"] = `172.69.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}`; const resp = await route.fetch({ headers: h }); await new Promise((r) => setTimeout(r, DELAY)); await route.fulfill({ response: resp }); } catch {} });
let atildi = null;
for (let i = 0; i < N; i++) {
  const yol = "/tools/" + PAGES[i % PAGES.length];
  await page.goto(BASE + yol, { waitUntil: "commit" }).catch(() => {});
  await page.waitForTimeout(GAP);
  const hint = await page.evaluate(() => localStorage.getItem("nb_session_hint")).catch(() => "?");
  if (hint !== "1" && atildi === null) { atildi = { adim: i + 1, yol }; }
}
await ctx.unroute("**/api/auth/refresh");
await page.goto(BASE + "/tools/compress", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const son = await page.evaluate(() => ({ hint: localStorage.getItem("nb_session_hint"), bildirim: sessionStorage.getItem("nb_session_closed_notice") }));
const baslik = await page.locator("header").first().innerText().catch(() => "");
console.log("olaylar:", olaylar.join(", "));
console.log("sonuc:", JSON.stringify({ atildi, son, girisYapGorunuyor: /Giriş yap|Log in|Sign in/i.test(baslik) }));
await browser.close();
process.exit(atildi || son.hint !== "1" ? 1 : 0);
