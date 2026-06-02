import cron from "node-cron";
import {
  checkUsageAndNotify,
  sendInviteReminders,
  sendExpiryWarnings,
  sendWeeklySummaries,
} from "../modules/team/team.service.js";
import { logError } from "../lib/app-logger.js";

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

export function registerTeamJobs() {
  // Her gün 08:00 — abonelik sona erme uyarıları
  cron.schedule("0 8 * * *", () => {
    safeRun("sendExpiryWarnings", sendExpiryWarnings);
  });

  // Her gün 09:00 — kullanım limiti uyarıları
  cron.schedule("0 9 * * *", () => {
    safeRun("checkUsageAndNotify", checkUsageAndNotify);
  });

  // Her gün 10:00 — davet hatırlatmaları
  cron.schedule("0 10 * * *", () => {
    safeRun("sendInviteReminders", sendInviteReminders);
  });

  // Her Pazartesi 08:30 — haftalık özet e-postaları
  cron.schedule("30 8 * * 1", () => {
    safeRun("sendWeeklySummaries", sendWeeklySummaries);
  });
}
