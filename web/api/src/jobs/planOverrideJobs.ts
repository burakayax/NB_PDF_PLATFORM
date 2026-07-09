import cron from "node-cron";
import { logError } from "../lib/app-logger.js";
import { logger } from "../lib/file-log.js";
import { revertAllExpiredOverrides } from "../modules/organization/organization.service.js";

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

async function revertExpiredPlanOverrides(): Promise<void> {
  const reverted = await revertAllExpiredOverrides();
  if (reverted > 0) {
    logger.info("subscription", `temporary plan overrides reverted: ${reverted}`);
  }
}

/**
 * Süreli (geçici) plan tanımlarını temizler: `overrideExpiresAt` geçen org'lar
 * `basePlan`'a döndürülür. Saatte bir çalışır (kısa süreli comp'lar için yeterli;
 * ayrıca getQuotaSummary lazy revert de yapar).
 */
export function registerPlanOverrideJobs() {
  cron.schedule("0 * * * *", () => {
    safeRun("revertExpiredPlanOverrides", revertExpiredPlanOverrides);
  });
}
