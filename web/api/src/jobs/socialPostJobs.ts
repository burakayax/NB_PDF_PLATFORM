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
import { collectReplyDrafts, maybeGenerateWeeklyReport } from "../modules/social/facebook-engagement.service.js";
import {
  calendarDayKey,
  catchUpToolReel,
  publishDuePosts,
  queueDailyPosts,
  isPostingDay,
  runInstantOn,
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

  // Günün turu videosuz çalıştıysa ve video sonradan geldiyse araç videosu yine eklenir.
  try {
    const late = await catchUpToolReel();
    if (late.queued.length > 0) await publishDuePosts();
  } catch (err) {
    logger.warn("social", `Geç gelen araç videosu işlenemedi: ${String(err)}`);
  }

  // ── Hazırlık turu ───────────────────────────────────────────────────────
  //
  // Gönderiler yayın saatinden `prepareLeadMinutes` dakika ÖNCE hazırlanır ve
  // yayın anını bekleyerek "sırada" durur. Böylece admin metni okuyup
  // düzeltebilir; eskiden metin yayın anında üretildiği için gönderi ancak
  // gittikten sonra görülüyordu.
  //
  // Hangi güne hazırlanacağı: önce bugün, sonra yarın. Hazırlık penceresi gece
  // yarısını aşabildiği için (örn. 01:00 paylaşım + 3 saat hazırlık) yarın da
  // aday sayılır.
  const now = new Date();
  const lead = config.prepareLeadMinutes * 60_000;

  for (const dayOffset of [0, 1]) {
    const dayKey = calendarDayKey(new Date(now.getTime() + dayOffset * 86_400_000), config.timeZone);
    // Seçilen tempo (her gün / gün aşırı / haftada üç) bu güne denk gelmiyorsa geç.
    if (!isPostingDay(dayKey, config.cadence)) continue;

    const runAt = runInstantOn(dayKey, config);
    // Hazırlık anı gelmediyse bekle. Geçmiş bir yayın anı (sunucu kapalıyken
    // kaçmış gün) yine de hazırlanır ve ilk turda gider.
    if (now.getTime() < runAt.getTime() - lead) continue;

    const alreadyQueued = await prisma.socialPost.count({ where: { dayKey } });
    if (alreadyQueued > 0) continue;

    // scheduledAt = gerçek yayın anı. Yayın turu bu ana kadar kayda dokunmaz.
    const result = await queueDailyPosts(runAt, false, true);
    if (result.queued.length > 0) {
      logger.info(
        "social",
        `${dayKey} için ${result.queued.length} gönderi hazırlandı (yayın: ${runAt.toISOString()})`,
      );
      // Yayın anı çoktan geçtiyse bekletmeden gitsin.
      if (runAt.getTime() <= Date.now()) await publishDuePosts();
    } else if (result.skipped.length > 0) {
      logger.info("social", `${dayKey}: paylaşım yapılmadı — ${result.skipped[0]?.reason ?? ""}`);
    }
    return;
  }
}

/** Yorum taslakları: iki saatte bir. Otomasyon açıkken çalışır; hata cron'u durdurmaz. */
async function replyTick(): Promise<void> {
  if (!(await readSocialConfig()).enabled) return;
  const created = await collectReplyDrafts();
  if (created > 0) logger.info("social", `${created} Facebook yorum yanıtı taslağı hazırlandı (onay bekliyor)`);
}

/** Haftalık rapor: Pazartesi 09:00'dan sonra, hafta başına bir kez. */
async function reportTick(): Promise<void> {
  const config = await readSocialConfig();
  if (!config.enabled) return;
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: config.timeZone, weekday: "short" }).format(now);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: config.timeZone, hour: "2-digit", hour12: false }).format(now));
  if (weekday !== "Mon" || hour < 9) return;
  if (await maybeGenerateWeeklyReport(now)) logger.info("social", "Facebook haftalık raporu hazırlandı");
}

export function registerSocialPostJobs() {
  cron.schedule("7 */2 * * *", () => safeRun("facebookReplyDrafts", replyTick));
  // Pazartesi günleri yarım saatte bir bakar; hafta başına yalnız bir kez üretir.
  cron.schedule("*/30 * * * 1", () => safeRun("facebookWeeklyReport", reportTick));
  cron.schedule(TICK, () => {
    safeRun("socialDailyPost", tick);
  });
}
