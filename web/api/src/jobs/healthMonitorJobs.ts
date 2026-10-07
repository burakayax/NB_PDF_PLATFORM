import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { checkPdfHeartbeatMissing, recordHealth } from "../lib/service-health.js";
import { evaluateAlerts } from "../lib/service-alerts.js";
import { sendMail } from "../lib/mailer.js";
import { env } from "../config/env.js";

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
  await checkPdfHeartbeatMissing();
  // Sorun varsa yöneticiye otomatik e-posta (SERVICE_ALERTS=off ile kapatılır).
  await evaluateAlerts(async (subject, text, html) => {
    await sendMail({ to: env.ADMIN_EMAIL, subject, text, html });
  });
}

export function registerHealthMonitorJobs() {
  cron.schedule("* * * * *", () => {
    void runHealthChecks().catch(() => {
      /* sağlık kaydı asla uygulamayı etkilemez */
    });
  });
}
