/**
 * GÜVENLİK UYARISI — saldırı belirtisi görülünce yöneticiye otomatik e-posta.
 *
 *  • Hemen bildirilenler: sahte/imzası bozuk ödeme bildirimi, tutar uyuşmazlığı, canlıda test ödemesi.
 *  • Yığılma: 10 dakikada çok sayıda engellenen istek / sınır aşımı / geçersiz oturum / başarısız giriş.
 *  • Aynı konu için bekleme süresi var; saatte en çok 6 e-posta (gelen kutusunu boğmaz).
 *
 * Sayaçlar bellektedir (servis yeniden başlarsa sıfırlanır) — amaç erken haber vermektir, kayıt tutmak değil.
 * Gönderim hatası yutulur: uyarı sistemi asla servisi etkilemez.
 */

export type SecurityAlertSender = (subject: string, text: string, html: string) => Promise<void>;

/** Tek olayda bile hemen haber verilecek türler. */
const CRITICAL: Record<string, string> = {
  paytr_bad_hash: "PayTR'den geliyormuş gibi imzası bozuk ödeme bildirimi geldi (sahte bildirim denemesi olabilir).",
  paytr_amount_mismatch: "Ödeme tutarı ile sipariş tutarı uyuşmadı; plan verilmedi (hileli ödeme denemesi olabilir).",
  paytr_test_payment_in_live: "Canlı mağazada test ödemesi geldi; plan verilmedi.",
  iyzico_signature_mismatch: "iyzico bildirimi imza doğrulamasından geçemedi (sahte bildirim denemesi olabilir).",
};

/** Yığılma kuralları: tür grubu → 10 dakikadaki eşik. */
const BURSTS: { key: string; label: string; types: string[]; threshold: number; hint: string }[] = [
  {
    key: "blocked",
    label: "Engellenen / sınırı aşan istek",
    types: ["ip_blocked", "blocked_request", "rate_limit_exceeded"],
    threshold: 150,
    hint: "Biri siteyi tarıyor veya yoğun istek gönderiyor olabilir. Render günlüklerinde aynı IP'yi arayın.",
  },
  {
    key: "jwt",
    label: "Geçersiz oturum anahtarı",
    types: ["invalid_jwt"],
    threshold: 60,
    hint: "Çalıntı veya uydurma oturum anahtarı denemesi olabilir.",
  },
  {
    key: "login",
    label: "Başarısız giriş denemesi",
    types: ["login_failure"],
    threshold: 40,
    hint: "Parola deneme saldırısı (credential stuffing) olabilir. Yönetim panelinden şüpheli IP'leri engelleyin.",
  },
];

const WINDOW_MS = 10 * 60_000;
const BURST_COOLDOWN_MS = 60 * 60_000;
const CRITICAL_COOLDOWN_MS = 30 * 60_000;
const MAX_PER_HOUR = 6;

type Hit = { at: number; ip?: string };

const hits = new Map<string, Hit[]>(); // burst key → olaylar
const lastSentByKey = new Map<string, number>();
let sentTimes: number[] = [];
let sender: SecurityAlertSender | null = null;

export function setSecurityAlertSender(fn: SecurityAlertSender | null): void {
  sender = fn;
}

export function __resetSecurityAlertState(): void {
  hits.clear();
  lastSentByKey.clear();
  sentTimes = [];
  sender = null;
}

const trTime = (ms: number) => new Date(ms).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour12: false });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function alertsEnabled(): boolean {
  const mode = (process.env["SECURITY_ALERTS"] ?? process.env["SERVICE_ALERTS"] ?? "").toLowerCase();
  if (mode === "off") return false;
  // Geliştirme makinesinde yanlış alarm üretmesin; zorla açmak için SECURITY_ALERTS=on.
  if (process.env["NODE_ENV"] !== "production" && mode !== "on") return false;
  return true;
}

async function dispatch(key: string, cooldownMs: number, now: number, title: string, lines: string[]): Promise<void> {
  if (!sender) return;
  const last = lastSentByKey.get(key);
  if (last !== undefined && now - last < cooldownMs) return;
  sentTimes = sentTimes.filter((t) => now - t < 60 * 60_000);
  if (sentTimes.length >= MAX_PER_HOUR) return;

  const footer = "Ne yapmalı: docs/runbooks/RB-15-veri-ihlali.md (veri ihlali rehberi).";
  const text = [title, "", ...lines.map((l) => l.replace(/<[^>]+>/g, "")), "", footer, "Bu e-posta sistem tarafından otomatik gönderilmiştir."].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
<h2 style="margin:0 0 12px;font-size:17px">${esc(title)}</h2>
${lines.map((l) => `<p style="margin:4px 0">${l}</p>`).join("")}
<p style="margin:14px 0 0;color:#555">${esc(footer)}</p>
<p style="margin:4px 0 0;color:#888;font-size:12px">Bu e-posta sistem tarafından otomatik gönderilmiştir.</p></div>`;

  // Önce kaydet: gönderim sırasında gelen aynı olay ikinci e-posta üretmesin.
  lastSentByKey.set(key, now);
  sentTimes.push(now);
  try {
    await sender(`[PDF Platform] Güvenlik uyarısı: ${title}`, text, html);
  } catch {
    // Gönderilemediyse bir sonraki olayda tekrar denensin.
    lastSentByKey.delete(key);
    sentTimes.pop();
  }
}

/** logSuspiciousActivity / başarısız giriş kaydı bu fonksiyonu çağırır. Asla hata fırlatmaz. */
export function noteSecurityEvent(type: string, info: { ip?: string; detail?: string } = {}, now = Date.now()): void {
  try {
    if (!sender || !alertsEnabled()) return;

    const criticalMsg = CRITICAL[type];
    if (criticalMsg) {
      void dispatch(`critical:${type}`, CRITICAL_COOLDOWN_MS, now, "Şüpheli ödeme bildirimi", [
        `<b>Ne oldu:</b> ${esc(criticalMsg)}`,
        `<b>Zaman:</b> ${trTime(now)} (TR saati)`,
        info.detail ? `<b>Sipariş/ayrıntı:</b> ${esc(info.detail.slice(0, 120))}` : "",
        "Bu bildirim yüzünden kimseye plan verilmedi. Sık tekrarlanıyorsa PayTR panelini ve günlükleri kontrol edin.",
      ].filter(Boolean));
      return;
    }

    const rule = BURSTS.find((b) => b.types.includes(type));
    if (!rule) return;

    const list = (hits.get(rule.key) ?? []).filter((h) => now - h.at < WINDOW_MS);
    list.push({ at: now, ip: info.ip });
    hits.set(rule.key, list);
    if (list.length < rule.threshold) return;

    const byIp = new Map<string, number>();
    for (const h of list) if (h.ip) byIp.set(h.ip, (byIp.get(h.ip) ?? 0) + 1);
    const top = [...byIp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    void dispatch(`burst:${rule.key}`, BURST_COOLDOWN_MS, now, `${rule.label} sayısı arttı`, [
      `<b>Son 10 dakikada:</b> ${list.length} olay`,
      `<b>Zaman:</b> ${trTime(now)} (TR saati)`,
      top.length ? `<b>En çok görülen IP'ler:</b> ${top.map(([ip, n]) => `${esc(ip)} (${n})`).join(", ")}` : "",
      rule.hint,
    ].filter(Boolean));
  } catch {
    /* uyarı sistemi asla uygulamayı etkilemez */
  }
}
