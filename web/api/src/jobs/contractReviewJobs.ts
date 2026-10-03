import cron from "node-cron";
import { logError } from "../lib/app-logger.js";
import { logger } from "../lib/file-log.js";
import { recoverContractReviewJobs } from "../modules/ai/contract-review.controller.js";

async function run(): Promise<void> {
  try {
    const n = await recoverContractReviewJobs();
    if (n > 0) logger.info("contract-review", `ortada kalan ${n} sözleşme analizi iade edildi`);
  } catch (err) {
    logError({
      category: "unhandled",
      message: `[cron/contractReviewRecovery] ${err instanceof Error ? err.message : String(err)}`,
      status: 500,
      method: "CRON",
      path: "/contractReviewRecovery",
    });
  }
}

/**
 * Sözleşme Denetçisi: sunucu yeniden başlarsa ya da bir iş yarıda kalırsa kullanıcının hak/kredisi
 * düşmüş ama sonuç üretilmemiş olur. Bu görev bu işleri bulur ve (bir kez) iade eder.
 * Açılışta (10 sn sonra) bir kez, sonra 10 dakikada bir çalışır.
 */
export function registerContractReviewJobs(): void {
  const boot = setTimeout(() => void run(), 10_000);
  boot.unref();
  cron.schedule("*/10 * * * *", () => void run());
}
