import cron from "node-cron";

import { env } from "../config/env.js";
import { logger } from "../lib/file-log.js";
import { sendMail } from "../lib/mailer.js";
import { prisma } from "../lib/prisma.js";
import { iysUrgency, readPendingBatch } from "../modules/email/iys-export.service.js";

/**
 * İYS yükleme hatırlatması.
 *
 * İYS'ye onay/ret en geç 3 iş günü içinde bildirilmeli; bildirilmeyen onay
 * geçersiz sayılıyor. Bekleyen kayıt 2 iş gününe ulaşınca (son gün) ve süre
 * dolduktan sonra yöneticiye e-posta gider. Aynı uyarı günde en fazla bir kez.
 */

const LAST_ALERT_KEY = "email.iys.lastReminderDay";

/** Türkiye gününe göre YYYY-MM-DD. */
function trToday(now: Date): string {
  return new Date(now.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function runIysReminder(now: Date = new Date()): Promise<boolean> {
  const p = await readPendingBatch();
  const urgency = iysUrgency(p.oldestAt, now);
  if (urgency !== "warn" && urgency !== "overdue") return false;

  const today = trToday(now);
  const last = await prisma.siteSetting.findUnique({ where: { key: LAST_ALERT_KEY } });
  if (last?.value === today) return false;

  const overdue = urgency === "overdue";
  const subject = overdue
    ? "İYS bildirim süresi doldu — bekleyen onaylar var"
    : "İYS'ye yüklenecek onaylar için son gün";
  const text =
    `${p.pendingTotal} adres İYS'ye yüklenmeyi bekliyor.\n\n` +
    (overdue
      ? "3 iş günlük bildirim süresi doldu. Yine de yükleyin: geciken kayıtların kabul edilmeme riski var; reddedilirse o kişiden onayı yeniden alın.\n\n"
      : "3 iş günlük bildirim süresinin son günü. Bugün yüklemezseniz bu onaylar İYS'ye kabul edilmeyebilir.\n\n") +
    "Yapılacak: Yönetim paneli → Onay kayıtları → \"İYS dosyasını indir\" → İYS panelinde " +
    "İzin Yönetimi → İzin Ekle → Dosyadan çoklu izin yükle → sonra panelde \"İYS'ye yükledim\".";
  const html = `<p>${text.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`;

  await sendMail({ to: env.ADMIN_EMAIL, subject, text, html });
  await prisma.siteSetting.upsert({
    where: { key: LAST_ALERT_KEY },
    create: { key: LAST_ALERT_KEY, value: today },
    update: { value: today },
  });
  return true;
}

export function registerIysReminderJobs() {
  // Her gün 09:30 (Türkiye saati = 06:30 UTC) — mesai başlarken.
  cron.schedule("30 6 * * *", () => {
    void runIysReminder().catch((err) => {
      logger.error("iys-reminder", "hatırlatma gönderilemedi", { detail: String(err) });
    });
  });
}
