/**
 * Sabah özeti e-postası: HTML + düz metin üretimi (saf fonksiyonlar, ağ/dosya yok; test edilebilir).
 * Tablolar rakamları DOĞRUDAN veriden alır (gecelik özet JSON'u, Search Console); yapay zekâ yalnız
 * "dikkat edilecekler", SEO önerileri, sosyal plan satırları ve finans notunu JSON olarak verir.
 * Kişisel veri (e-posta, isim) bu dosyada hiçbir yere yazılmaz.
 */

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const fmt = (v, d = 0) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString("tr-TR", { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** Değişim metni: +3 ↑ / −2 ↓ / 0 =; veri yoksa —. */
export function delta(now, prev, d = 0) {
  if (num(now) === null || num(prev) === null) return "—";
  const diff = Math.round((now - prev) * 10 ** d) / 10 ** d;
  if (diff === 0) return "0 =";
  return `${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff), d)} ${diff > 0 ? "↑" : "↓"}`;
}

function sumNum(...v) {
  const n = v.map(num).filter((x) => x !== null);
  return n.length ? n.reduce((a, b) => a + b, 0) : null;
}

/** Gecelik özet JSON'undan (yeni ya da eski biçim) tablo satırları. */
export function dailyRows(now, prev) {
  const g = (o) => ({
    views: num(o?.traffic?.pageViews),
    newUsers: num(o?.users?.new),
    totalUsers: num(o?.users?.total),
    paidSubs: num(o?.subscriptions?.paidSubscribers),
    manual: num(o?.subscriptions?.manualPlans),
    paidOrders: num(o?.changes?.paidOrders?.value),
    paidTotal: num(Number.parseFloat(o?.sales?.paidTotalTRY)),
    errors: sumNum(o?.health?.clientErrors, o?.health?.serverFailures),
    aiCost: num(o?.ai?.estimatedCost),
  });
  const a = g(now);
  const b = g(prev);
  const row = (label, k, d = 0) => [label, fmt(a[k], d), fmt(b[k], d), delta(a[k], b[k], d)];
  return [
    row("Sayfa görüntüleme", "views"),
    row("Yeni üye", "newUsers"),
    row("Toplam üye", "totalUsers"),
    row("Ücretli abonelik", "paidSubs"),
    row("Elle verilen plan", "manual"),
    row("Ödeme sayısı", "paidOrders"),
    row("Ödeme tutarı (₺)", "paidTotal", 2),
    row("Hata sayısı", "errors"),
    row("AI maliyeti ($)", "aiCost", 4),
  ];
}

/** Search Console iki dönem → tablo satırları (veri yoksa null). */
export function seoRows(gsc) {
  const c = gsc?.current;
  const p = gsc?.previous;
  if (!c?.available || !p?.available) return null;
  return [
    ["Tıklama", fmt(c.clicks), fmt(p.clicks), delta(c.clicks, p.clicks)],
    ["Gösterim", fmt(c.impressions), fmt(p.impressions), delta(c.impressions, p.impressions)],
    // Sıra için DÜŞÜK sayı iyidir; farkı olduğu gibi göster.
    ["Ortalama sıra", fmt(c.avgPosition, 1), fmt(p.avgPosition, 1), delta(c.avgPosition, p.avgPosition, 1)],
  ];
}

const TH = "text-align:left;padding:6px 8px;background:#f1f5f9;color:#334155;font-size:12px;border-bottom:1px solid #e2e8f0";
const TD = "padding:6px 8px;font-size:13px;color:#0f172a;border-bottom:1px solid #eef2f7;word-break:break-word;overflow-wrap:anywhere";

function tableHtml(head, rows) {
  const th = head.map((h, i) => `<th style="${TH}${i > 0 ? ";text-align:right" : ""}">${esc(h)}</th>`).join("");
  const tr = rows.map((r) => `<tr>${r.map((c, i) => `<td style="${TD}${i > 0 ? ";text-align:right" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;width:100%;margin:6px 0 14px"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function tableText(head, rows) {
  return [head.join(" | "), ...rows.map((r) => r.join(" | "))].join("\n");
}

const H = (t) => `<h2 style="font-size:15px;margin:18px 0 4px;color:#0f172a">${esc(t)}</h2>`;

/**
 * @param {object} p
 * @param {string} p.date
 * @param {string[]} p.attention  dikkat maddeleri (boşsa "dikkat gerektiren bir şey yok")
 * @param {object|null} p.now     son gecelik özet
 * @param {object|null} p.prev    bir önceki gün özeti
 * @param {object|null} p.gsc     {current, previous}
 * @param {string[]} p.seoTips    en çok 3
 * @param {Array<{tarih:string,platform:string,konu:string,durum:string}>} p.social
 * @param {string|null} p.financeNote
 * @param {string[][]|null} p.financeTable  ilk satır başlık
 * @param {string} p.footer
 */
export function buildMail(p) {
  const attention = (p.attention || []).map((s) => String(s)).filter(Boolean).slice(0, 8);
  const tips = (p.seoTips || []).slice(0, 3);
  const social = (p.social || []).slice(0, 10);
  const daily = p.now ? dailyRows(p.now, p.prev) : null;
  const seo = seoRows(p.gsc);

  // ---- HTML ----
  const box = attention.length
    ? `<div style="background:#fff7e0;border:1px solid #f0b429;border-radius:8px;padding:10px 12px;margin:10px 0"><strong style="color:#92400e">⚠️ Dikkat edilecekler</strong><ul style="margin:6px 0 0;padding-left:18px;color:#78350f;font-size:13px">${attention.map((a) => `<li style="margin:2px 0">${esc(a)}</li>`).join("")}</ul></div>`
    : `<div style="background:#ecfdf5;border:1px solid #86efac;border-radius:8px;padding:10px 12px;margin:10px 0;color:#166534;font-size:13px"><strong>Dikkat edilecekler</strong><br>Bugün dikkat gerektiren bir şey yok.</div>`;

  let html = `<div style="max-width:640px;margin:0 auto;padding:12px 14px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">`;
  html += `<h1 style="font-size:18px;margin:0 0 2px">Sabah özeti</h1><div style="color:#64748b;font-size:12px">${esc(p.date)}</div>`;
  html += box;
  html += H("Günlük site durumu");
  html += daily ? tableHtml(["Ölçüt", "Dün", "Önceki gün", "Değişim"], daily) : `<p style="font-size:13px;color:#64748b">Gecelik özet verisi bulunamadı.</p>`;
  html += H("Haftalık SEO");
  html += seo ? tableHtml(["Ölçüt", "Bu hafta", "Geçen hafta", "Değişim"], seo) : `<p style="font-size:13px;color:#64748b">Search Console verisi alınamadı.</p>`;
  if (tips.length) html += `<ol style="margin:0 0 10px;padding-left:20px;font-size:13px">${tips.map((t) => `<li style="margin:3px 0">${esc(t)}</li>`).join("")}</ol>`;
  html += H("Sosyal medya planı");
  html += social.length
    ? tableHtml(["Tarih", "Platform", "Konu", "Durum"], social.map((s) => [s.tarih, s.platform, s.konu, s.durum]))
    : `<p style="font-size:13px;color:#64748b">Bu hafta için plan satırı yok.</p>`;
  html += H("Aylık finans");
  html += p.financeTable && p.financeTable.length > 1
    ? tableHtml(p.financeTable[0], p.financeTable.slice(1))
    : `<p style="font-size:13px;color:#475569">${esc(p.financeNote || "Gecelik raporlar Kasım 2026'da başladı; ilk aylık finans raporu 1 Aralık'ta gelecek.")}</p>`;
  html += `<p style="margin:18px 0 0;font-size:11px;color:#94a3b8">${esc(p.footer).replace(/\n/g, "<br>")}</p></div>`;

  // ---- Düz metin ----
  const t = [];
  t.push(`SABAH ÖZETİ — ${p.date}`, "");
  t.push("DİKKAT EDİLECEKLER");
  t.push(attention.length ? attention.map((a) => `- ${a}`).join("\n") : "Bugün dikkat gerektiren bir şey yok.", "");
  t.push("GÜNLÜK SİTE DURUMU");
  t.push(daily ? tableText(["Ölçüt", "Dün", "Önceki gün", "Değişim"], daily) : "Gecelik özet verisi bulunamadı.", "");
  t.push("HAFTALIK SEO");
  t.push(seo ? tableText(["Ölçüt", "Bu hafta", "Geçen hafta", "Değişim"], seo) : "Search Console verisi alınamadı.");
  if (tips.length) t.push(tips.map((x, i) => `${i + 1}. ${x}`).join("\n"));
  t.push("", "SOSYAL MEDYA PLANI");
  t.push(social.length ? tableText(["Tarih", "Platform", "Konu", "Durum"], social.map((s) => [s.tarih, s.platform, s.konu, s.durum])) : "Bu hafta için plan satırı yok.", "");
  t.push("AYLIK FİNANS");
  t.push(p.financeTable && p.financeTable.length > 1 ? tableText(p.financeTable[0], p.financeTable.slice(1)) : p.financeNote || "Gecelik raporlar Kasım 2026'da başladı; ilk aylık finans raporu 1 Aralık'ta gelecek.", "");
  t.push("—", p.footer);

  return { html, text: t.join("\n") };
}

/** Yapay zekâ çıktısından JSON'u ayıklar (kod çiti olabilir). Başarısızsa fırlatır. */
export function parseLlmJson(text) {
  const m = /\{[\s\S]*\}/.exec(String(text));
  if (!m) throw new Error("yanıt JSON değil");
  const j = JSON.parse(m[0]);
  const arr = (x) => (Array.isArray(x) ? x : []);
  return {
    attention: arr(j.dikkat).map(String),
    seoTips: arr(j.seoOneriler).map(String),
    social: arr(j.sosyal).map((s) => ({ tarih: String(s?.tarih ?? ""), platform: String(s?.platform ?? ""), konu: String(s?.konu ?? ""), durum: String(s?.durum ?? "") })),
    financeNote: typeof j.finansNotu === "string" ? j.finansNotu : null,
    financeTable: Array.isArray(j.finansTablo) && j.finansTablo.every(Array.isArray) ? j.finansTablo.map((r) => r.map(String)) : null,
  };
}
