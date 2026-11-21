#!/usr/bin/env node
/**
 * Yapay zekâ ajanı çalıştırıcı (GitHub Actions'tan çağrılır).
 *
 * Kullanım: node scripts/agents/run.mjs <durum|seo|sosyal|finans|ozet>
 *
 * KURALLAR
 *  - YALNIZ OKUR: gecelik özetler (indirilmiş dosyalar) ve salt-okunur API uçları. Siteye/koda/PR'a yazmaz.
 *  - Çıktı depoya/iş günlüğüne YAZILMAZ; yalnız $AGENT_OUT klasörüne yazılır, iş akışı özel kovaya yükler.
 *  - Anahtar değerleri hiçbir yere basılmaz.
 *  - Hata olursa çıktı dosyası "üretilemedi: neden" içerir ve çıkış kodu 1 olur.
 */
import fs from "node:fs";
import path from "node:path";
import { buildMail, parseLlmJson } from "./mail.mjs";
import { collect, mailLine } from "./bakim-rules.mjs";
import { bekciOzet } from "./bekci-ozet.mjs";

const AGENT = process.argv[2];
const VERI = process.env.AGENT_VERI || "veri"; // indirilmiş kova içeriği
const OUT = process.env.AGENT_OUT || "cikti";
const API = process.env.AGENT_API_BASE || "https://api.pdfplatform.app";
const KEY = process.env.ANTHROPIC_AGENT_API_KEY || "";
const TOKEN = process.env.AGENT_DATA_TOKEN || "";
const GH_TOKEN = process.env.GH_TOKEN || ""; // yalnız herkese açık verileri okurken istek sınırı için
let bakimData = null; // bakım ajanı kural çıktısı (yapay zekâ dışı)

// USD / 1M token (sahibin verdiği tablo). Yeni model eklenirse buraya yazılır.
const PRICE = {
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
};

const AGENTS = {
  durum: { file: "ajan-durum-son.md", model: "claude-haiku-5-5", title: "Günlük site durumu", max: 4000 },
  seo: { file: "ajan-seo-son.md", model: "claude-sonnet-5-5", title: "Haftalık SEO", max: 9000 },
  sosyal: { file: "ajan-sosyal-son.md", model: "claude-sonnet-5-5", title: "Haftalık sosyal medya planı", max: 8000 },
  finans: { file: "ajan-finans-son.md", model: "claude-haiku-5-5", title: "Aylık finans raporu", max: 4000 },
  ozet: { file: "ajan-yonetici-son.md", model: "claude-haiku-5-5", title: "Yönetici sabah özeti", max: 3000 },
  bakim: { file: "ajan-bakim-son.md", model: "claude-haiku-5-5", title: "Haftalık yazılım bakımı (gölge)", max: 3500 },
};

const GENEL_KURAL = `Sen PDF Platform (pdfplatform.app) sahibinin salt-okunur analiz ajanısın. Türkçe, sade, kısa yaz; sahibin programlama bilgisi yok.
KURALLAR: Yalnızca sana verilen veriyi kullan; rakamları aynen alıntıla, uydurma. Veri yoksa "veri yok" de. Hukuki/vergi tavsiyesi verme, vergi takvimi uydurma.
Kişisel veri (e-posta, isim) YAZMA. Sorun varsa satırın başına ⚠️ koy. Kod, ayar ya da site değişikliği yapamazsın; sadece rapor/öneri yazarsın.
Sahibinden veri ya da dosya isteme. Geçmiş veri yokluğunu "uyarı" (⚠️) olarak gösterme.
ABONELİK DİLİ: "Aktif abonelik" ifadesini tek başına KULLANMA. Özet verisinde "Ücretli abonelik" (gerçek ödemesi olanlar) ve "Elle verilen plan" (yönetici yükseltmesi, ödeme yok) ayrı satırlardır; ayrı yaz. Gelir ve satış hesaplarında yalnız ücretli abonelikleri say.`;

const PROMPTS = {
  bakim: `GÖREV: Haftalık yazılım bakım raporu (GÖLGE MODU: hiçbir şey yapılmadı, yapılmayacak). Girdi: açık Dependabot güncellemelerinin KURAL TABANLI sınıflandırması (JSON; gruplar zaten kurallarla belirlendi, sen değiştirme). Sahibe (programlama bilgisi yok) sade Türkçe rapor yaz: önce 2-3 cümlelik genel durum, sonra her grup için kaç güncelleme olduğu ve neden o grupta olduğu (teknik terimi kısa açıkla), sonra "## Ne yapardım" (yalnız girdideki yapardim satırlarına dayan, yeni karar üretme). "ciEski": true olanlar için CI sonucunun eski olabileceğini belirt. PR numaralarını yaz. Birleştir/onayla gibi bir karar verme; yalnız anlat.`,
  durum: `GÖREV: Günlük site durumu. Aşağıda son gecelik özet (JSON) ve önceki günlerin özetleri var. Dünü bir önceki günle ve son 7 günün ortalamasıyla karşılaştır; önemli değişimleri ve hataları yaz. Sorun varsa ⚠️.
Biçim: "## Özet" (3-5 madde), "## Değişimler", "## ⚠️ Dikkat" (yoksa "Yok").`,
  seo: `GÖREV: Haftalık SEO. Search Console verisi: son 7 gün ("current") ve önceki 7 gün ("previous"). Tıklama/gösterim/sıra değişimini, yükselen-düşen sayfa ve sorguları karşılaştır. 3-5 SOMUT öneri yaz (hangi sayfa/sorgu, ne yapılmalı, neden). Veri azsa bunu açıkça söyle; abartma.
Biçim: "## Bu hafta", "## Öne çıkanlar", "## Öneriler" (numaralı).`,
  sosyal: `GÖREV: Haftalık sosyal medya planı. Girdi: son paylaşımlar (tekrar etme), SEO verisi (öne çıkan sorgu/sayfalar) ve sitenin araçları. 5-7 paylaşımlık hafta planı yaz: her biri için gün+saat (TR), platform, paylaşım metni, görsel fikri, bağlanacak sayfa. Son 45 günde işlenen aynı konuyu tekrarlama. ASLA paylaşım yapmazsın; yalnız plan yazarsın.
ETİKET KURALI: Her paylaşımdaki etiketler (#) paylaşımın KONUSUYLA eşleşmeli. Örneğin PDF→Excel paylaşımına alakasız etiket (#edevlet, #TabloModelleri gibi) koyma; yalnız o aracı/konuyu doğrudan tarif eden etiketler kullan. Emin değilsen etiketi azalt.
Biçim: "## Hafta planı" tablo ya da madde, sonra "## Neden bu konular".`,
  finans: `GÖREV: Aylık finans raporu. Girdi: geçen ayın ve ondan önceki ayın gecelik özetleri. Gelir (TL ve yabancı para AYRI), ödeme/iade adedi, yeni abonelik, iptal ve nedenleri, aktif abonelik, sitenin yapay zekâ maliyetini (özette varsa) hesapla ve önceki ayla karşılaştır. Toplamları özetlerdeki günlük değerlerden topla; hesabını göster. Vergi takvimi UYDURMA. Önceki ay verisi yoksa bunu uyarı olarak gösterme ve veri isteme; bunun yerine şu bilgi notunu yaz: "Gecelik raporlar Kasım 2026'da başladı; ilk aylık finans karşılaştırması verisi oluştukça gelecek (ilk tam aylık rapor 1 Aralık'ta)." Ekim ve Eylül verisi hiç olmayacak, bu normaldir. Eldeki gün sayısını ve tutarları yine de özetle.
Biçim: "## Özet", "## Karşılaştırma tablosu", "## ⚠️ Dikkat".`,
  ozet: `GÖREV: Yönetici sabah özeti için YAPISAL VERİ. Girdi: diğer ajanların son çıktıları (Markdown). YALNIZCA şu biçimde geçerli JSON döndür, başka metin yazma:
{"dikkat": ["kısa madde", ...], "seoOneriler": ["en çok 3 öneri"], "sosyal": [{"tarih":"","platform":"","konu":"","durum":"Planlandı"}], "finansNotu": "..." veya null, "finansTablo": [["Ölçüt","Bu ay","Önceki ay","Değişim"], ...] veya null}
KURALLAR: "dikkat" EN ÇOK 3 madde olur ve yalnız sahibin BUGÜN bir şey yapması gereken ya da sitedeki GERÇEK bir sorunu (hata, kesinti, ödeme sorunu, ciddi trafik/sıralama düşüşü) içerir. ASLA yazma: veri listesinin kısaltıldığı/sınırlı olduğu notları, "rapor uzunluk sınırına takıldı" notları, aylık finans raporunun olmaması, sosyal paylaşımların DRAFT/MANUAL durumu ya da yayın zamanının boş olması (sahip paylaşımları elle yapar, bu normaldir), 1-3 tıklamalık küçük sayfa dalgalanmaları. Etiket-konu uyumsuzluğu dikkat maddesi değildir, yalnız sosyal ajan raporunda yer alır. "dikkat" yalnız GERÇEKTEN dikkat gerektiren şeyleri içerir (hata, kesinti, düşüş, ⚠️ ile işaretlenmiş sorun); yoksa boş dizi. Veri yokluğunu (örn. geçen ay özeti yok) dikkat maddesi YAPMA. "sosyal" satırları sosyal planından alınır (tarih, platform, konu kısa; durum: Planlandı). finans için önceki ay verisi yoksa finansTablo null ve finansNotu: "Gecelik raporlar Kasım 2026'da başladı; ilk aylık finans raporu 1 Aralık'ta gelecek." Rakamları uydurma, yalnız girdidekini kullan. Kişisel veri (e-posta, isim) yazma.`,
};

function readIf(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}
function listSummaries() {
  const root = path.join(VERI, "ozet");
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/^ozet-\d{4}-\d{2}-\d{2}\.json$/.test(e.name)) out.push(p);
    }
  };
  walk(root);
  return out.sort(); // tarih sırası
}
const dateOf = (p) => /ozet-(\d{4}-\d{2}-\d{2})/.exec(p)[1];
const clip = (s, n) => (s.length > n ? s.slice(0, n) + "\n…(kısaltıldı)" : s);

async function api(pathname, init = {}) {
  const res = await fetch(API + pathname, { ...init, headers: { authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${pathname} HTTP ${res.status}`);
  return res.json();
}

async function buildInput() {
  const files = listSummaries();
  if (AGENT === "durum") {
    if (files.length === 0) throw new Error("gecelik özet bulunamadı");
    const last = files.slice(-8);
    return last.map((f) => `### ${dateOf(f)}\n${clip(readIf(f), 9000)}`).join("\n\n");
  }
  if (AGENT === "seo") {
    return "SEARCH CONSOLE:\n" + JSON.stringify(await api("/api/internal/agent/gsc"));
  }
  if (AGENT === "sosyal") {
    const [gsc, posts] = await Promise.all([api("/api/internal/agent/gsc"), api("/api/internal/agent/social-posts?days=45")]);
    const araclar = readIf("scripts/agents/araclar.txt");
    return `SON PAYLAŞIMLAR (45 gün):\n${clip(JSON.stringify(posts), 20000)}\n\nSEO:\n${clip(JSON.stringify(gsc), 12000)}\n\nSİTE ARAÇLARI:\n${araclar}`;
  }
  if (AGENT === "finans") {
    const now = new Date();
    const ymOf = (d) => d.toISOString().slice(0, 7);
    const cur = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
    const pick = (ym) => files.filter((f) => dateOf(f).startsWith(ym)).map((f) => `### ${dateOf(f)}\n${clip(readIf(f), 6000)}`).join("\n");
    return `GEÇEN AY (${ymOf(cur)}):\n${pick(ymOf(cur)) || "veri yok"}\n\nÖNCEKİ AY (${ymOf(prev)}):\n${pick(ymOf(prev)) || "veri yok"}`;
  }
  if (AGENT === "bakim") {
    bakimData = await collect({ token: GH_TOKEN });
    return JSON.stringify(bakimData);
  }
  if (AGENT === "ozet") {
    const parts = [];
    for (const k of ["durum", "seo", "sosyal", "finans"]) {
      const txt = readIf(path.join(VERI, AGENTS[k].file));
      parts.push(`## ${AGENTS[k].title}\n${txt ? clip(txt, 5000) : "ÇIKTI YOK"}`);
    }
    return parts.join("\n\n");
  }
  throw new Error("bilinmeyen ajan");
}

function cost(model, inTok, outTok) {
  const p = PRICE[model];
  return p ? (inTok * p.in + outTok * p.out) / 1e6 : 0;
}

// Aylık tahmin: ajan başına ortalama çalışma maliyeti x aylık çalışma sayısı (günlük 30, haftalık ~4,33, aylık 1).
const RUNS_PER_MONTH = { durum: 30, ozet: 30, seo: 4.33, sosyal: 4.33, finans: 1, bakim: 4.33 };
function monthEstimate(ledger) {
  let total = 0;
  for (const [agent, runs] of Object.entries(RUNS_PER_MONTH)) {
    const rows = ledger.filter((r) => r.agent === agent);
    if (rows.length === 0) continue;
    total += (rows.reduce((a, r) => a + r.usd, 0) / rows.length) * runs;
  }
  return total;
}

function monthTotal(ledger, ym) {
  return ledger.filter((r) => r.ym === ym).reduce((a, r) => a + r.usd, 0);
}

async function composeMail(llmText, today, footer) {
  const llm = parseLlmJson(llmText);
  const files = listSummaries();
  const read = (f) => { try { return JSON.parse(readIf(f)); } catch { return null; } };
  const now = files.length ? read(files[files.length - 1]) : null;
  const prev = files.length > 1 ? read(files[files.length - 2]) : null;
  let gsc = null;
  try { gsc = await api("/api/internal/agent/gsc"); } catch { gsc = null; }
  const attention = [...llm.attention];
  if (now && now.verified === false) attention.unshift("Gecelik özet sayıları iki yöntemde tutmuyor; rakamlara güvenmeden önce kontrol edin.");
  for (const k of ["durum", "seo", "sosyal"]) {
    const txt = readIf(path.join(VERI, AGENTS[k].file));
    if (!txt) attention.push(`${AGENTS[k].title} çıktısı bulunamadı.`);
    else if (/üretilemedi/.test(txt)) attention.unshift(`${AGENTS[k].title} raporu üretilemedi.`);
  }
  let watchdog = null;
  try {
    const b = bekciOzet(JSON.parse(readIf(path.join(VERI, "bekci-kayit.json")) || "null"));
    watchdog = b.satir;
    attention.push(...b.dikkat);
  } catch { watchdog = null; }
  let maintenance = null;
  try { maintenance = mailLine(JSON.parse(readIf(path.join(VERI, "ajan-bakim-son.json")))); } catch { maintenance = null; }
  return buildMail({ date: today, attention, now, prev, gsc, seoTips: llm.seoTips, social: llm.social, financeNote: llm.financeNote, financeTable: llm.financeTable, maintenance, watchdog, footer });
}

async function main() {
  const def = AGENTS[AGENT];
  if (!def) { console.error("Kullanım: run.mjs durum|seo|sosyal|finans|ozet|bakim"); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const outFile = path.join(OUT, def.file);
  const ledgerPath = path.join(VERI, "ajan-maliyet.json");
  let ledger = [];
  try { ledger = JSON.parse(readIf(ledgerPath) || "[]"); } catch { ledger = []; }
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);

  try {
    if (!KEY) throw new Error("ANTHROPIC_AGENT_API_KEY tanımlı değil");
    if (AGENT !== "durum" && AGENT !== "finans" && AGENT !== "ozet" && AGENT !== "bakim" && !TOKEN) throw new Error("AGENT_DATA_TOKEN tanımlı değil");
    const input = await buildInput();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: def.model, max_tokens: def.max, system: GENEL_KURAL, messages: [{ role: "user", content: `${PROMPTS[AGENT]}\n\nBUGÜN: ${today}\n\nVERİ:\n${input}` }] }),
      signal: AbortSignal.timeout(180000),
    });
    if (!res.ok) throw new Error(`Claude HTTP ${res.status}`);
    const j = await res.json();
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!text) throw new Error(`boş yanıt (durum: ${j.stop_reason ?? "?"}, parçalar: ${(j.content || []).map((b) => b.type).join(",") || "yok"})`);
    const kesildi = j.stop_reason === "max_tokens";
    const inTok = j.usage?.input_tokens ?? 0;
    const outTok = j.usage?.output_tokens ?? 0;
    const usd = cost(def.model, inTok, outTok);
    ledger.push({ date: today, ym, agent: AGENT, model: def.model, inTok, outTok, usd });
    const footer = `Token: ${inTok} giriş / ${outTok} çıkış · Model: ${def.model} · Bu özet ≈ $${usd.toFixed(4)} (tahmini)\n`
      + `Ay başından bu yana ajan toplamı: $${monthTotal(ledger, ym).toFixed(3)} (ayın 1'inden bugüne kadar gerçekleşen çalışmaların tahmini maliyeti)\n`
      + `Aylık tahmin (günlük ve haftalık çalışmalara göre): ≈ $${monthEstimate(ledger).toFixed(2)}`;
    const mail = AGENT === "ozet" ? await composeMail(text, today, footer) : null;
    let body = mail ? `${mail.text}\n` : `# ${def.title} — ${today}\n\n${text}\n`;
    if (kesildi) body += "\n⚠️ Not: yanıt uzunluk sınırına takıldı, rapor eksik olabilir.\n";
    if (!mail) body += `\n---\nToken: ${inTok} giriş / ${outTok} çıkış · Model: ${def.model} · Bu çalışma ≈ $${usd.toFixed(4)} (tahmini) · Ay başından bu yana ajan toplamı: $${monthTotal(ledger, ym).toFixed(3)}\n`;
    fs.writeFileSync(outFile, body);
    if (bakimData) fs.writeFileSync(path.join(OUT, "ajan-bakim-son.json"), JSON.stringify(bakimData));
    fs.writeFileSync(path.join(OUT, "ajan-maliyet.json"), JSON.stringify(ledger.slice(-400)));

    if (AGENT === "ozet") {
      const subject = `Sabah özeti — ${today}`;
      await api("/api/internal/agent/mail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, text: mail.text, html: mail.html }) });
      console.log("E-posta gönderildi");
    }
    console.log(`${def.title} tamam (${inTok}/${outTok} token)`);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    fs.writeFileSync(outFile, `# ${def.title} — ${today}\n\n⚠️ ${def.title} raporu üretilemedi: ${reason}\n`);
    if (AGENT === "ozet" && TOKEN) {
      try { await api("/api/internal/agent/mail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject: `Sabah özeti üretilemedi — ${today}`, text: `Yönetici özeti üretilemedi: ${reason}` }) }); } catch { /* ek hata yutulur */ }
    }
    console.error(`::error::${def.title} üretilemedi: ${reason}`);
    process.exit(1);
  }
}
main();
