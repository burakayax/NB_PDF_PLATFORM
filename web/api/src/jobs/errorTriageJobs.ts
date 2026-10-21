import cron from "node-cron";
import { runTriage } from "../modules/autoheal/autoheal.service.js";

let running = false;

/** 5 dakikada bir: son hataları analiz eder, gürültüyü eler, önemli olanları e-postayla bildirir. */
export function registerErrorTriageJobs() {
  cron.schedule("*/5 * * * *", () => {
    if (running) return; // önceki tur bitmediyse üst üste binme
    running = true;
    void runTriage()
      .catch((err) => {
        console.error("[autoheal] analiz turu başarısız:", err instanceof Error ? err.message : err);
      })
      .finally(() => {
        running = false;
      });
  });
}
