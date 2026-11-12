import cron from "node-cron";
import { logger } from "../lib/file-log.js";
import { processReturnInvoices } from "../modules/payment/return-invoice.service.js";

let running = false;

/** Her saat başı +20 dk: kurumsal müşterinin gönderdiği iade faturalarını yakalar ve parayı iade eder. */
export function registerReturnInvoiceJobs() {
  cron.schedule("20 * * * *", () => {
    if (running) return;
    running = true;
    void processReturnInvoices()
      .then((tally) => {
        if (Object.keys(tally).length > 0) logger.info("payment", "[return-invoice] saatlik tur", tally);
      })
      .catch((err) => logger.error("payment", "[return-invoice] tur başarısız", err instanceof Error ? err.message : err))
      .finally(() => {
        running = false;
      });
  });
}
