import { prisma } from "../../lib/prisma.js";
import { getSettingWithFallback, setSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";
import { sendMail } from "../../lib/mailer.js";
import { env } from "../../config/env.js";
import { readAutoHealConfig, type Severity } from "./autoheal.config.js";
import { maxSeverity, severityAtLeast, triage, type Incident, type IncidentStatus, type NoiseReason } from "./error-triage.js";

/** Analiz penceresi: son 30 dakika. Sıklık: 5 dakikada bir. */
const WINDOW_MS = 30 * 60 * 1000;
/** Saatte en fazla bu kadar e-posta (hata fırtınasında posta kutusunu boğmasın). */
const MAX_EMAILS_PER_HOUR = 6;

export type AutoHealState = {
  /** Bu zamandan sonraki satırlar "yeni" sayılır. */
  cursor: string | null;
  incidents: Incident[];
  /** Son 24 saatte elenen gürültü sayıları. */
  noise: Record<NoiseReason, number>;
  noiseSince: string | null;
  emailLog: string[];
  lastRunAt: string | null;
};

const EMPTY_NOISE: Record<NoiseReason, number> = {
  extension: 0,
  "injected-script": 0,
  bot: 0,
  "browser-noise": 0,
  "cross-origin-script": 0,
};

export async function readAutoHealState(): Promise<AutoHealState> {
  const raw = await getSettingWithFallback<Partial<AutoHealState>>(SITE_SETTING_KEYS.AUTOHEAL_STATE, {});
  return {
    cursor: raw.cursor ?? null,
    incidents: Array.isArray(raw.incidents) ? raw.incidents : [],
    noise: { ...EMPTY_NOISE, ...(raw.noise ?? {}) },
    noiseSince: raw.noiseSince ?? null,
    emailLog: Array.isArray(raw.emailLog) ? raw.emailLog : [],
    lastRunAt: raw.lastRunAt ?? null,
  };
}

async function writeState(state: AutoHealState) {
  await setSetting(SITE_SETTING_KEYS.AUTOHEAL_STATE, state);
}

const SEV_TR: Record<Severity, string> = { low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik" };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

async function notify(inc: Incident): Promise<boolean> {
  const where = inc.server ? "Sunucu hatası" : "Sayfa hatası";
  const subject = `[PDF Platform] ${SEV_TR[inc.severity]} hata: ${inc.message.slice(0, 80)}`;
  const lines = [
    `${where} — önem: ${SEV_TR[inc.severity]}`,
    `Mesaj: ${inc.message}`,
    inc.source ? `Kaynak: ${inc.source}` : "",
    inc.url ? `Adres: ${inc.url}` : "",
    `Toplam: ${inc.count} kez, son 30 dakikada ${inc.visitors} farklı ziyaretçide.`,
    `İlk görülme: ${new Date(inc.firstSeenAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`,
    "",
    "Yönetim panelinde \"Hata otomasyonu\" sekmesinden ayrıntıyı görebilir, olayı \"yok say\" veya \"çözüldü\" diye işaretleyebilirsin.",
  ].filter(Boolean);
  try {
    await sendMail({
      to: env.ADMIN_EMAIL,
      subject,
      text: lines.join("\n"),
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">${lines
        .map((l) => `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`)
        .join("")}</div>`,
    });
    return true;
  } catch {
    return false;
  }
}

export type TriageRunSummary = { processed: number; incidents: number; emailed: number };

/** Bir analiz turu: son 30 dakikanın hatalarını okur, olayları günceller, gerekirse e-posta gönderir. */
export async function runTriage(now: Date = new Date()): Promise<TriageRunSummary> {
  const cfg = await readAutoHealConfig();
  if (!cfg.enabled) return { processed: 0, incidents: 0, emailed: 0 };

  const state = await readAutoHealState();
  const cursor = state.cursor ? new Date(state.cursor) : new Date(now.getTime() - WINDOW_MS);
  const since = new Date(Math.min(cursor.getTime(), now.getTime() - WINDOW_MS));

  const rows = await prisma.clientErrorLog.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: 5000,
    select: { message: true, source: true, stack: true, url: true, userAgent: true, userId: true, createdAt: true },
  });

  const result = triage(rows, state.incidents, cursor, now);

  // Gürültü sayacı: 24 saatlik kayan toplam (basit: 24 saatte bir sıfırla).
  const noiseSince = state.noiseSince ? new Date(state.noiseSince) : now;
  const resetNoise = now.getTime() - noiseSince.getTime() > 24 * 60 * 60 * 1000;
  const noise = { ...(resetNoise ? EMPTY_NOISE : state.noise) };
  for (const k of Object.keys(result.noise) as NoiseReason[]) noise[k] += result.noise[k];

  // E-posta: yalnızca açık olaylar; hiç bildirilmemiş ya da önem derecesi yükselmiş olanlar.
  const hourAgo = now.getTime() - 60 * 60 * 1000;
  const emailLog = state.emailLog.filter((t) => new Date(t).getTime() > hourAgo);
  let emailed = 0;
  for (const inc of result.incidents) {
    if (inc.status !== "open") continue;
    if (!severityAtLeast(inc.severity, cfg.emailMinSeverity)) continue;
    const escalated = inc.notifiedSeverity !== null && maxSeverity(inc.notifiedSeverity, inc.severity) !== inc.notifiedSeverity;
    if (inc.notifiedSeverity !== null && !escalated) continue;
    if (emailLog.length >= MAX_EMAILS_PER_HOUR) break;
    if (await notify(inc)) {
      inc.notifiedSeverity = inc.severity;
      inc.notifiedAt = now.toISOString();
      emailLog.push(now.toISOString());
      emailed += 1;
    }
  }

  const newest = rows.length ? rows[rows.length - 1]!.createdAt : cursor;
  // Analiz sırasında (e-posta beklerken) panelden yapılan durum değişikliği ezilmesin:
  // yazmadan hemen önce güncel durumu okuyup olayların durumunu koru.
  const fresh = await readAutoHealState();
  const freshById = new Map(fresh.incidents.map((i) => [i.id, i]));
  for (const inc of result.incidents) {
    const f = freshById.get(inc.id);
    if (!f) continue;
    inc.status = f.status;
  }
  await writeState({
    cursor: newest > cursor ? newest.toISOString() : cursor.toISOString(),
    incidents: result.incidents,
    noise,
    noiseSince: (resetNoise ? now : noiseSince).toISOString(),
    emailLog,
    lastRunAt: now.toISOString(),
  });
  return { processed: rows.length, incidents: result.incidents.length, emailed };
}

export async function setIncidentStatus(id: string, status: IncidentStatus): Promise<Incident | null> {
  const state = await readAutoHealState();
  const inc = state.incidents.find((i) => i.id === id);
  if (!inc) return null;
  inc.status = status;
  await writeState(state);
  return inc;
}

/**
 * Sunucu tarafı beklenmeyen hatayı (500) aynı tabloya yazar; böylece sayfa hatalarıyla birlikte
 * analiz edilir. Hata yanıtını ASLA geciktirmez ya da bozmaz: kendi hatası yutulur.
 */
export function recordServerError(input: { method: string; path: string; message: string; stack?: string }): void {
  void prisma.clientErrorLog
    .create({
      data: {
        level: "error",
        message: input.message.slice(0, 1000),
        source: `server:${input.method} ${input.path}`.slice(0, 120),
        stack: input.stack?.slice(0, 4000) ?? null,
        url: input.path.slice(0, 500),
      },
    })
    .catch(() => {
      /* telemetri asıl akışı bozmamalı */
    });
}
