/**
 * PayTR Bildirim URL işleyicisi (iFrame API 2. adım).
 *
 * KURALLAR (dev.paytr.com/iframe-api/iframe-api-2-adim):
 *  - Plan/kredi YALNIZ bu bildirimle verilir; müşterinin döndüğü "başarılı" sayfası kanıt DEĞİLDİR.
 *  - hash doğrulanmadan hiçbir şey yapılmaz.
 *  - PayTR'ye düz metin "OK" dönülmezse ödeme "devam ediyor" kalır ve bildirim tekrarlanır.
 *  - Aynı sipariş için birden çok bildirim gelebilir → idempotent olmalı (fulfillPaidCheckout öyle).
 *  - Oturum/giriş yok; her şey merchant_oid ile yapılır.
 */
import type { Request, Response } from "express";
import express from "express";
import { env } from "../../../config/env.js";
import { logSuspiciousActivity } from "../../../lib/app-logger.js";
import { logger } from "../../../lib/file-log.js";
import { prisma } from "../../../lib/prisma.js";
import {
  fulfillPaidCheckout,
  isSuccessRedirect,
  PaymentFulfillmentDbError,
} from "../payment.service.js";
import {
  conversationIdFromMerchantOid,
  parseNotification,
  toKurus,
  verifyNotificationHash,
  type PaytrNotification,
} from "./paytr.client.js";
import { getPaytrCredentials } from "./paytr.service.js";

const LOG = "[paytr/notify]";

/** PayTR bildirimi application/x-www-form-urlencoded POST eder. */
export const paytrNotifyUrlencoded = express.urlencoded({ extended: false });

export type NotifyOutcome =
  | { kind: "ok" } // PayTR'ye "OK" dön (işlendi, yok sayıldı veya zaten tamamdı)
  | { kind: "reject"; httpStatus: number }; // "OK" dönme → PayTR yeniden dener

type FulfillArg = Parameters<typeof fulfillPaidCheckout>[1];

/** Saf-ish çekirdek: HTTP'den bağımsız, test edilebilir. */
export async function processPaytrNotification(body: unknown): Promise<NotifyOutcome> {
  if (!env.paytrEnabled) {
    logger.error("payment", `${LOG} PayTR anahtarları yok — bildirim işlenemedi`);
    return { kind: "reject", httpStatus: 503 };
  }
  const creds = getPaytrCredentials();

  const n = parseNotification(body);
  if (!n) {
    logger.warn("payment", `${LOG} eksik/bozuk bildirim gövdesi`);
    return { kind: "reject", httpStatus: 400 };
  }

  if (!verifyNotificationHash(n, creds)) {
    logSuspiciousActivity({ type: "paytr_bad_hash", detail: n.merchant_oid.slice(0, 64) });
    logger.error("payment", `${LOG} hash doğrulanamadı — işlem yapılmadı`, { merchantOid: n.merchant_oid });
    return { kind: "reject", httpStatus: 400 };
  }

  const conversationId = conversationIdFromMerchantOid(n.merchant_oid);
  const pending = conversationId
    ? await prisma.paymentCheckout.findUnique({ where: { conversationId } })
    : null;
  if (!conversationId || !pending) {
    // İmza geçerli ama sipariş bizde yok (başka sistemin siparişi olabilir) → tekrar denemesin.
    logger.warn("payment", `${LOG} bilinmeyen sipariş — OK dönülüyor`, { merchantOid: n.merchant_oid });
    return { kind: "ok" };
  }

  if (n.status !== "success") {
    await markFailed(conversationId, n);
    return { kind: "ok" };
  }

  // Canlı mağazada test işlemi (test_mode=1) gerçek ödeme sayılmaz → plan verilmez.
  const testAllowed = env.PAYTR_TEST_MODE.trim().toLowerCase() === "true" || process.env.NODE_ENV !== "production";
  if (n.test_mode === "1" && !testAllowed) {
    logSuspiciousActivity({ type: "paytr_test_payment_in_live", detail: n.merchant_oid });
    logger.warn("payment", `${LOG} test ödemesi canlıda yok sayıldı`, { merchantOid: n.merchant_oid });
    return { kind: "ok" };
  }

  if (!amountMatches(n, pending.priceTry) || !currencyMatches(n, pending.paymentCurrency)) {
    logSuspiciousActivity({
      type: "paytr_amount_mismatch",
      detail: `expected=${pending.priceTry} ${pending.paymentCurrency} got=${n.payment_amount ?? n.total_amount} ${n.currency ?? ""}`,
    });
    logger.error("payment", `${LOG} tutar/para birimi uyuşmuyor — plan verilmedi`, { conversationId });
    return { kind: "ok" }; // tekrar denemek sonucu değiştirmez; olay kayıtlandı
  }

  const asIyzicoShape: FulfillArg = {
    status: "success",
    paymentStatus: "SUCCESS",
    paidPrice: pending.priceTry,
    currency: pending.paymentCurrency,
    // "paytr:" öneki: iade yönlendirmesi bu kaydın PayTR'den geldiğini buradan anlar.
    paymentId: `paytr:${n.merchant_oid}`,
    conversationId,
  };

  try {
    const url = await fulfillPaidCheckout(conversationId, asIyzicoShape);
    if (!isSuccessRedirect(url)) {
      logger.error("payment", `${LOG} ödeme doğrulandı ama teslimat tamamlanamadı — yeniden denenecek`, { conversationId });
      return { kind: "reject", httpStatus: 500 };
    }
    return { kind: "ok" };
  } catch (err) {
    if (err instanceof PaymentFulfillmentDbError) {
      return { kind: "reject", httpStatus: 500 };
    }
    logger.error("payment", `${LOG} beklenmeyen hata`, err instanceof Error ? (err.stack ?? err.message) : err);
    return { kind: "reject", httpStatus: 500 };
  }
}

function amountMatches(n: PaytrNotification, expectedGross: string): boolean {
  // payment_amount: 1. adımda gönderdiğimiz tutar (kuruş). total_amount taksitle artabilir; taksit kapalı olduğundan
  // payment_amount yoksa total_amount ile de birebir eşleşme isteriz.
  const got = Number(n.payment_amount ?? n.total_amount);
  if (!Number.isFinite(got)) return false;
  try {
    return got === toKurus(expectedGross);
  } catch {
    return false;
  }
}

function currencyMatches(n: PaytrNotification, expected: string): boolean {
  if (!n.currency) return true; // alan opsiyonel; tutar kontrolü zaten yapıldı
  const norm = (c: string) => (c.toUpperCase() === "TRY" ? "TL" : c.toUpperCase());
  return norm(n.currency) === norm(expected);
}

async function markFailed(conversationId: string, n: PaytrNotification): Promise<void> {
  const res = await prisma.paymentCheckout.updateMany({
    where: { conversationId, status: "pending" },
    data: { status: "failed" },
  });
  logger.info("payment", `${LOG} ödeme başarısız`, {
    conversationId,
    updated: res.count,
    code: n.failed_reason_code,
    msg: n.failed_reason_msg?.slice(0, 200),
  });
}

/** POST /api/payment/paytr-notify */
export async function paytrNotifyController(request: Request, response: Response): Promise<void> {
  const outcome = await processPaytrNotification(request.body);
  if (outcome.kind === "ok") {
    response.status(200).type("text/plain").send("OK");
    return;
  }
  response.status(outcome.httpStatus).type("text/plain").send("ERROR");
}
