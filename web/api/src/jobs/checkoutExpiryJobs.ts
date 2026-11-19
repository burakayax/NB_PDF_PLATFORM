import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { logError } from "../lib/app-logger.js";
import { logger } from "../lib/file-log.js";

/**
 * Yarım kalan ödeme denemelerini "süresi doldu" yapar.
 *
 * Ödeme başlatılınca "bekliyor" kaydı açılır; kullanıcı vazgeçerse ya da kart sayfasında takılırsa kayıt
 * sonsuza dek "bekliyor" kalırdı. PayTR ödeme sayfası 30 dakikada kapandığı için 24 saati geçen kayıt
 * artık tamamlanamaz. Kayıt SİLİNMEZ, yalnız durumu değişir; plan, fatura ya da iade etkilenmez.
 */
export const CHECKOUT_EXPIRY_HOURS = 24;

export async function expireStalePendingCheckouts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CHECKOUT_EXPIRY_HOURS * 60 * 60 * 1000);
  const res = await prisma.paymentCheckout.updateMany({
    where: { status: "pending", completedAt: null, createdAt: { lt: cutoff } },
    data: { status: "expired" },
  });
  if (res.count > 0) logger.info("payment", "[checkout-expiry] süresi dolan bekleyen ödeme sayısı", { count: res.count });
  return res.count;
}

export function registerCheckoutExpiryJobs() {
  // Her saatin 40. dakikasında.
  cron.schedule("40 * * * *", () => {
    expireStalePendingCheckouts().catch((err) => {
      logError({
        category: "unhandled",
        message: `[cron/checkoutExpiry] ${err instanceof Error ? err.message : String(err)}`,
        status: 500,
        method: "CRON",
        path: "/checkoutExpiry",
      });
    });
  });
}
