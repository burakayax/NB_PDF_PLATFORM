import cron from "node-cron";
import { logger } from "../lib/file-log.js";
import { triggerInvoiceGeneration } from "../modules/payment/payment.service.js";
import { processDueInvoices, type InvoiceTrigger } from "../modules/payment/invoice-schedule.service.js";

let running = false;

const trigger: InvoiceTrigger = (c, r, o) =>
  triggerInvoiceGeneration(c as Parameters<typeof triggerInvoiceGeneration>[0], r as Parameters<typeof triggerInvoiceGeneration>[1], o);

/** Her saat başı +5 dk: vadesi gelen ertelenmiş faturaları keser (iade edilmiş ya da "kesme" denmiş olanları atlar). */
export function registerInvoiceScheduleJobs() {
  cron.schedule("5 * * * *", () => {
    if (running) return;
    running = true;
    void processDueInvoices(trigger)
      .then((tally) => {
        if (Object.keys(tally).length > 0) logger.info("payment", "[invoice-schedule] saatlik tur", tally);
      })
      .catch((err) => logger.error("payment", "[invoice-schedule] tur başarısız", err instanceof Error ? err.message : err))
      .finally(() => {
        running = false;
      });
  });
}
