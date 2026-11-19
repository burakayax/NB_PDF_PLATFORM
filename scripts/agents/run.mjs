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

const AGENT = process.argv[2];
const VERI = process.env.AGENT_VERI || "veri"; // indirilmiş kova içeriği
const OUT = process.env.AGENT_OUT || "cikti";
const API = process.env.AGENT_API_BASE || "https://api.pdfplatform.app";
const KEY = process.env.ANTHROPIC_AGENT_API_KEY || "";
const TOKEN = process.env.AGENT_DATA_TOKEN || "";

// USD / 1M token (sahibin verdiği tablo). Yeni model eklenirse buraya yazılır.
const PRICE = {
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
};

const AGENTS = {
  durum: { file: "ajan-durum-son.md", model: "claude-haiku-5-5", title: "Günlük site durumu", max: 1500 },
  seo: { file: "ajan-seo-son.md", model: "claude-sonnet-5-5", title: "Haftalık SEO", max: 2500 },
  sosyal: { file: "ajan-sosyal-son.md", model: "claude-sonnet-5-5", title: "Haftalık sosyal medya planı", max: 3500 },
  finans: { file: "ajan-finans-son.md", model: "claude-haiku-5-5", title: "Aylık finans raporu", max: 2000 },
  ozet: { file: "ajan-yonetici-son.md", model: "claude-haiku-5-5", title: "Yönetici sabah özeti", max: 1200 },
};

const GENEL_KURAL = `Sen PDF Platform (pdfplatform.app) sahibinin salt-okunur analiz ajanısın. Türkçe, sade, kısa yaz; sahibin programlama bilgisi yok.
KURALLAR: Yalnızca sana verilen veriyi kullan; rakamları aynen alıntıla, uydurma. Veri yoksa "veri yok" de. Hukuki/vergi tavsiyesi verme, vergi takvimi uydurma.
Kişisel veri yazma. Sorun varsa satırın başına ⚠️ koy. Kod, ayar ya da site değişikliği yapamazsın; sadece rapor/öneri yazarsın.`;

const PROMPTS = {
  durum: `GÖREV: Günlük site durumu. Aşağıda son gecelik özet (JSON) ve önceki günlerin özetleri var. Dünü bir önceki günle ve son 7 günün ortalamasıyla karşılaştır; önemli değişimleri ve hataları yaz. Sorun varsa ⚠️.
Biçim: "## Özet" (3-5 madde), "## Değişimler", "## ⚠️ Dikkat" (yoksa "Yok").`,
  seo: `GÖREV: Haftalık SEO. Search Console verisi: son 7 gün ("current") ve önceki 7 gün ("previous"). Tıklama/gösterim/sıra değişimini, yükselen-düşen sayfa ve sorguları karşılaştır. 3-5 SOMUT öneri yaz (hangi sayfa/sorgu, ne yapılmalı, neden). Veri azsa bunu açıkça söyle; abartma.
Biçim: "## Bu hafta", "## Öne çıkanlar", "## Öneriler" (numaralı).`,
  sosyal: `GÖREV: Haftalık sosyal medya planı. Girdi: son paylaşımlar (tekrar etme), SEO verisi (öne çıkan sorgu/sayfalar) ve sitenin araçları. 5-7 paylaşımlık hafta planı yaz: her biri için gün+saat (TR), platform, paylaşım metni, görsel fikri, bağlanacak sayfa. Son 45 günde işlenen aynı konuyu tekrarlama. ASLA paylaşım yapmazsın; yalnız plan yazarsın.
Biçim: "## Hafta planı" tablo ya da madde, sonra "## Neden bu konular".`,
  finans: `GÖREV: Aylık finans raporu. Girdi: geçen ayın ve ondan önceki ayın gecelik özetleri. Gelir (TL ve yabancı para AYRI), ödeme/iade adedi, yeni abonelik, iptal ve nedenleri, aktif abonelik, sitenin yapay zekâ maliyetini (özette varsa) hesapla ve önceki ayla karşılaştır. Toplamları özetlerdeki günlük değerlerden topla; hesabını göster. Vergi takvimi UYDURMA.
Biçim: "## Özet", "## Karşılaştırma tablosu", "## ⚠️ Dikkat".`,
  ozet: `GÖREV: Yönetici sabah özeti. Girdi: diğer ajanların son çıktıları. Sahibe TEK kısa e-posta metni yaz: en üstte "Dikkat edilecekler" (⚠️ olanlar; yoksa "Bugün acil bir şey yok"), sonra her ajandan 1-2 satır. 200 kelimeyi geçme. Bir ajanın çıktısı 2 günden eskiyse veya yoksa belirt.`,
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

function monthTotal(ledger, ym) {
  return ledger.filter((r) => r.ym === ym).reduce((a, r) => a + r.usd, 0);
}

async function main() {
  const def = AGENTS[AGENT];
  if (!def) { console.error("Kullanım: run.mjs durum|seo|sosyal|finans|ozet"); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const outFile = path.join(OUT, def.file);
  const ledgerPath = path.join(VERI, "ajan-maliyet.json");
  let ledger = [];
  try { ledger = JSON.parse(readIf(ledgerPath) || "[]"); } catch { ledger = []; }
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);

  try {
    if (!KEY) throw new Error("ANTHROPIC_AGENT_API_KEY tanımlı değil");
    if (AGENT !== "durum" && AGENT !== "finans" && AGENT !== "ozet" && !TOKEN) throw new Error("AGENT_DATA_TOKEN tanımlı değil");
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
    if (!text) throw new Error("boş yanıt");
    const inTok = j.usage?.input_tokens ?? 0;
    const outTok = j.usage?.output_tokens ?? 0;
    const usd = cost(def.model, inTok, outTok);
    ledger.push({ date: today, ym, agent: AGENT, model: def.model, inTok, outTok, usd });
    let body = `# ${def.title} — ${today}\n\n${text}\n`;
    body += `\n---\nToken: ${inTok} giriş / ${outTok} çıkış · Model: ${def.model} · Bu çalışma ≈ $${usd.toFixed(4)} (tahmini) · Bu ay ajanların toplamı ≈ $${monthTotal(ledger, ym).toFixed(3)}\n`;
    fs.writeFileSync(outFile, body);
    fs.writeFileSync(path.join(OUT, "ajan-maliyet.json"), JSON.stringify(ledger.slice(-400)));

    if (AGENT === "ozet") {
      const subject = `Sabah özeti — ${today}`;
      await api("/api/internal/agent/mail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, text: body }) });
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
