import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { checkPdfHeartbeatMissing, notePdfHeartbeat, pdfHeartbeatAgeMs, recordHealth } from "../lib/service-health.js";
import { evaluateAlerts } from "../lib/service-alerts.js";
import { sendMail } from "../lib/mailer.js";
import { env } from "../config/env.js";
import { setSecurityAlertSender } from "../lib/security-alerts.js";

/**
 * Her dakika: veritabanı ve bu servis için sağlık kaydı; PDF API'den kalp atışı gelmiyorsa "kapalı" kaydı.
 * (PDF API kalp atışını kendisi gönderir: POST /api/entitlement/internal/service-event.)
 */
export async function runHealthChecks(): Promise<void> {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    await recordHealth("db", true, { latencyMs: Date.now() - t0 });
  } catch (err) {
    await recordHealth("db", false, { detail: err instanceof Error ? err.message : "db check failed" });
  }
  await recordHealth("api", true);
  await probePdfApi();
  await checkPdfHeartbeatMissing();
  // Sorun varsa yöneticiye otomatik e-posta (SERVICE_ALERTS=off ile kapatılır).
  await evaluateAlerts(async (subject, text, html) => {
    await sendMail({ to: env.ADMIN_EMAIL, subject, text, html });
  });
}

/**
 * İsteğe bağlı AKTİF yoklama: PDF_API_HEALTH_URL (ör. https://nb-pdf-api.onrender.com/api/health) tanımlıysa her dakika
 * PDF API'ye istek atılır. Yanıt varsa PDF API "ayakta" sayılır (kalp atışı köprüsü kurulu olmasa da çalışır);
 * yanıt yoksa ve kalp atışı da 2 dakikadır gelmiyorsa "kapalı" yazılır.
 */
async function probePdfApi(): Promise<void> {
  const url = (process.env["PDF_API_HEALTH_URL"] ?? "").trim();
  if (!url) return;
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (r.ok) {
      await notePdfHeartbeat(true, Date.now() - t0);
      await probeGotenberg(url);
      return;
    }
    throw new Error(`HTTP ${r.status}`);
  } catch (err) {
    const age = pdfHeartbeatAgeMs();
    if (age === null || age > 2 * 60_000) {
      await recordHealth("pdf", false, { detail: `probe failed: ${err instanceof Error ? err.message : "unknown"}` });
    }
  }
}

/**
 * Office dönüştürücü (Gotenberg): PDF API'nin /api/health/deps ucu "gotenberg: up/down" bildirir.
 * Uç, PDF_API_HEALTH_URL'deki /health son ekinden türetilir. Yanıtsızlık Gotenberg'in değil PDF API'nin sorunudur
 * (o durum "pdf" bileşeninde görünür); bu yüzden yalnız yanıt GELİNCE Gotenberg durumu yazılır.
 */
async function probeGotenberg(healthUrl: string): Promise<void> {
  const depsUrl = healthUrl.replace(/\/health\/?$/, "/health/deps");
  if (depsUrl === healthUrl) return;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(depsUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    const body = (await r.json().catch(() => null)) as { gotenberg?: string } | null;
    if (!body || typeof body.gotenberg !== "string") return;
    await recordHealth("gotenberg", body.gotenberg === "up", body.gotenberg === "up" ? {} : { detail: `gotenberg: ${body.gotenberg}` });
  } catch {
    /* PDF API'ye ulaşılamadı: bu Gotenberg bilgisi değildir, yazılmaz */
  }
}

export function registerHealthMonitorJobs() {
  // Güvenlik uyarıları (saldırı belirtileri) aynı yönetici adresine gider.
  setSecurityAlertSender(async (subject, text, html) => {
    await sendMail({ to: env.ADMIN_EMAIL, subject, text, html });
  });
  cron.schedule("* * * * *", () => {
    void runHealthChecks().catch(() => {
      /* sağlık kaydı asla uygulamayı etkilemez */
    });
  });
}
