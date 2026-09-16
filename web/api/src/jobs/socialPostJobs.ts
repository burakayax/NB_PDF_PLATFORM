/**
 * Günlük sosyal medya paylaşımı.
 *
 * NEDEN SABİT CRON DEĞİL: Paylaşım saati admin panelinden değiştiriliyor.
 * Sabit bir cron ifadesi kurulsaydı saat her değiştiğinde sunucunun yeniden
 * başlatılması gerekirdi. Bunun yerine tur her beş dakikada bir atıyor ve
 * "ayarlanan saat geldi mi, bugün paylaşım yapıldı mı" sorusunu kendisi
 * yanıtlıyor.
 */

import cron from "node-cron";
import { logError } from "../lib/app-logger.js";
import { logger } from "../lib/file-log.js";
import { prisma } from "../lib/prisma.js";
import {
  calendarDayKey,
  publishDuePosts,
  queueDailyPosts,
  isPostingDay,
  readSocialConfig,
} from "../modules/social/social.service.js";

/** Tur aralığı. Beş dakika, ayarlanan saate yeterince yakın vuruş demek. */
const TICK = "*/5 * * * *";

function safeRun(name: string, fn: () => Promise<void>) {
  fn().catch((err) => {
    logError({
      category: "unhandled",
      message: `[cron/${name}] ${err instanceof Error ? err.message : String(err)}`,
      status: 500,
      method: "CRON",
      path: `/${name}`,
    });
  });
}

/** Verilen saat diliminde şu anki saat ve dakika. */
function localHourMinute(timeZone: string): { hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    return { hour, minute };
  } catch {
    const now = new Date();
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes() };
  }
}

async function tick(): Promise<void> {
  const config = await readSocialConfig();

  // Kuyrukta bekleyen (ya da önceki turda başarısız olup yeniden denenecek)
  // gönderiler otomasyon kapalıyken de yayınlanır: admin elle sıraya aldıysa
  // beklemesin.
  const sent = await publishDuePosts();
  if (sent.published > 0 || sent.failed > 0) {
    logger.info("social", `yayın turu: ${sent.published} başarılı, ${sent.failed} başarısız`);
  }

  if (!config.enabled) return;

  const { hour, minute } = localHourMinute(config.timeZone);
  const nowMinutes = hour * 60 + minute;
  const targetMinutes = config.hour * 60 + config.minute;
  // Tur 5 dakikada bir attığı için hedef dakikayı tam yakalamak yerine
  // hedeften sonraki ilk turda çalışılır.
  if (nowMinutes < targetMinutes) return;

  const dayKey = calendarDayKey(new Date(), config.timeZone);
  // Seçilen tempo (her gün / gün aşırı / haftada üç) bugüne denk gelmiyorsa geç.
  if (!isPostingDay(dayKey, config.cadence)) return;
  const alreadyQueued = await prisma.socialPost.count({ where: { dayKey } });
  if (alreadyQueued > 0) return;

  const result = await queueDailyPosts(new Date());
  if (result.queued.length > 0) {
    logger.info("social", `${dayKey} için ${result.queued.length} gönderi kuyruğa alındı`);
    // Kuyruğa alınanlar aynı turda yayınlansın; bir sonraki turu beklemesin.
    await publishDuePosts();
  } else if (result.skipped.length > 0) {
    logger.info("social", `${dayKey}: paylaşım yapılmadı — ${result.skipped[0]?.reason ?? ""}`);
  }
}

export function registerSocialPostJobs() {
  cron.schedule(TICK, () => {
    safeRun("socialDailyPost", tick);
  });
}
