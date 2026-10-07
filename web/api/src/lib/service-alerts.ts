import { countRecentFailures, getComponentStates, type HealthComponent } from "./service-health.js";

/**
 * HİZMET UYARISI — sorun olunca yöneticiye otomatik e-posta.
 *
 *  • Veritabanı: 2 dakikadır kapalıysa uyarı (kontroller dakikada bir).
 *  • PDF API: kalp atışı kaybı kaydından 3 dakika sonra uyarı (toplam ≈ 6 dk sessizlik; dağıtım gürültüsünü eler).
 *  • PDF API 5xx patlaması: 10 dakikada en az 5 hata bildirimi.
 *  • Düzelince "normale döndü" e-postası (süre ile).
 *  • Saatte en çok 6 uyarı e-postası; aynı konu için 60 dk bekleme (5xx).
 *
 * Bu servis tamamen kapalıysa e-posta gönderemez; o durum için dış izleyici (UptimeRobot) gerekir.
 * Gönderim hatası yutulur: uyarı sistemi asla servisi etkilemez.
 */

export type AlertSender = (subject: string, text: string, html: string) => Promise<void>;

const DOWN_AFTER_MS: Record<HealthComponent, number> = { db: 2 * 60_000, pdf: 3 * 60_000, api: Number.POSITIVE_INFINITY };
const NAMES: Record<HealthComponent, string> = { api: "Auth API", db: "Veritabanı", pdf: "PDF API" };
const SPIKE_WINDOW_MS = 10 * 60_000;
const SPIKE_THRESHOLD = 5;
const SPIKE_COOLDOWN_MS = 60 * 60_000;
const MAX_PER_HOUR = 6;

const alerted = new Map<HealthComponent, number>(); // component → uyarının gönderildiği an
let lastSpikeAlertAt = 0;
let sentTimes: number[] = [];

export function __resetServiceAlertState() {
  alerted.clear();
  lastSpikeAlertAt = 0;
  sentTimes = [];
}

const trTime = (ms: number) => new Date(ms).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour12: false });
const dur = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60_000));
  return m < 60 ? `${m} dk` : `${Math.floor(m / 60)} sa ${m % 60} dk`;
};

function build(title: string, lines: string[]) {
  const text = [title, "", ...lines, "", "Panel: Yönetim → Analitik → Hizmet durumu", "Bu e-posta sistem tarafından otomatik gönderilmiştir."].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
<h2 style="margin:0 0 12px;font-size:17px">${title}</h2>
${lines.map((l) => `<p style="margin:4px 0">${l}</p>`).join("")}
<p style="margin:14px 0 0;color:#555">Panel: Yönetim → Analitik → Hizmet durumu</p>
<p style="margin:4px 0 0;color:#888;font-size:12px">Bu e-posta sistem tarafından otomatik gönderilmiştir.</p></div>`;
  return { text, html };
}

async function send(send_: AlertSender, now: number, subject: string, title: string, lines: string[]): Promise<boolean> {
  sentTimes = sentTimes.filter((t) => now - t < 60 * 60_000);
  if (sentTimes.length >= MAX_PER_HOUR) return false;
  const { text, html } = build(title, lines);
  try {
    await send_(subject, text, html);
    sentTimes.push(now);
    return true;
  } catch {
    return false;
  }
}

/** Her dakika çağrılır. */
export async function evaluateAlerts(sender: AlertSender, now = Date.now()): Promise<void> {
  if ((process.env["SERVICE_ALERTS"] ?? "").toLowerCase() === "off") return;

  for (const st of getComponentStates()) {
    const name = NAMES[st.component];
    const sentAt = alerted.get(st.component);
    if (!st.ok && sentAt === undefined && now - st.since >= DOWN_AFTER_MS[st.component]) {
      const ok = await send(sender, now, `[PDF Platform] ${name} KAPALI`, `${name} yanıt vermiyor`, [
        `<b>Bileşen:</b> ${name}`,
        `<b>Başlangıç:</b> ${trTime(st.since)} (TR saati)`,
        `<b>Süre:</b> ${dur(now - st.since)} ve sürüyor`,
        st.component === "pdf" ? "PDF API'den kalp atışı gelmiyor. Render panelinde 'nb-pdf-api' servisinin durumuna ve günlüklerine bakın." : "Render panelinde veritabanı ve Auth API servisinin durumuna bakın.",
      ]);
      if (ok) alerted.set(st.component, now);
    } else if (st.ok && sentAt !== undefined) {
      const ok = await send(sender, now, `[PDF Platform] ${name} normale döndü`, `${name} tekrar çalışıyor`, [
        `<b>Bileşen:</b> ${name}`,
        `<b>Normale dönüş:</b> ${trTime(st.since)} (TR saati)`,
        `<b>Uyarıdan bu yana:</b> ${dur(st.since - sentAt)}`,
      ]);
      if (ok) alerted.delete(st.component);
    }
  }

  const spike = countRecentFailures(SPIKE_WINDOW_MS, now);
  if (spike >= SPIKE_THRESHOLD && now - lastSpikeAlertAt >= SPIKE_COOLDOWN_MS) {
    const ok = await send(sender, now, "[PDF Platform] PDF API'de hata artışı", "PDF API'de sunucu hataları artıyor", [
      `<b>Son 10 dakikada bildirilen 5xx hata sayısı:</b> ${spike}`,
      `<b>Zaman:</b> ${trTime(now)} (TR saati)`,
      "Hangi yolların etkilendiği panelde '5xx hataları' bölümünde görünür.",
    ]);
    if (ok) lastSpikeAlertAt = now;
  }
}
