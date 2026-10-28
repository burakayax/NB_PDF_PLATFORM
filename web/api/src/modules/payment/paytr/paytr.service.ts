/**
 * PayTR ödeme oturumu başlatma. payment.service.ts içindeki createPaymentCheckoutSession
 * PaymentCheckout kaydını oluşturduktan sonra (PAYMENTS_PROVIDER=paytr ise) buraya devreder.
 *
 * Bildirim (sonuç) işleme AYRI dosyadadır (paytr.notify.ts): payment.service.ts'i içe aktarır;
 * burada içe aktarsaydık döngüsel bağımlılık oluşurdu.
 */
import { env } from "../../../config/env.js";
import { HttpError } from "../../../lib/http-error.js";
import { logger } from "../../../lib/file-log.js";
import {
  buildTokenForm,
  merchantOidFromConversationId,
  normalizeUserIp,
  paytrCurrency,
  paytrPaymentPageUrl,
  requestPaytrToken,
  toKurus,
  type PaytrCredentials,
} from "./paytr.client.js";

const LOG = "[paytr/start]";

export function getPaytrCredentials(): PaytrCredentials {
  if (!env.paytrEnabled) {
    throw new HttpError(503, "PayTR is not configured.");
  }
  return {
    merchantId: env.PAYTR_MERCHANT_ID.trim(),
    merchantKey: env.PAYTR_MERCHANT_KEY.trim(),
    merchantSalt: env.PAYTR_MERCHANT_SALT.trim(),
  };
}

/** Ödeme PayTR üzerinden mi alınacak? (Seçili ama anahtarsızsa çağıran 503 almalı — sessizce iyzico'ya düşülmez.) */
export function isPaytrSelected(): boolean {
  return env.PAYMENTS_PROVIDER === "paytr";
}

export type StartPaytrSessionParams = {
  conversationId: string;
  /** KDV dahil brüt tutar, "399.00" biçiminde. */
  grossPrice: string;
  currency: string;
  email: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  clientIp: string;
  basketName: string;
  okUrl: string;
  failUrl: string;
  lang?: "tr" | "en";
};

export async function startPaytrSession(
  p: StartPaytrSessionParams,
  fetchImpl: typeof fetch = fetch,
): Promise<{ token: string; paymentPageUrl: string; merchantOid: string }> {
  const creds = getPaytrCredentials();
  const merchantOid = merchantOidFromConversationId(p.conversationId);
  const kurus = toKurus(p.grossPrice);
  // PayTR alt sınırı 1 TL (SSS). USD/EUR için de 1 birimin altı anlamsız.
  if (kurus < 100) {
    throw new HttpError(400, "Payment amount is below the provider minimum.");
  }

  const form = buildTokenForm(
    {
      merchantOid,
      email: p.email,
      paymentAmountKurus: kurus,
      currency: paytrCurrency(p.currency),
      basketName: p.basketName,
      basketUnitPrice: p.grossPrice,
      userIp: normalizeUserIp(p.clientIp),
      userName: p.userName,
      userAddress: p.userAddress,
      userPhone: p.userPhone,
      okUrl: p.okUrl,
      failUrl: p.failUrl,
      testMode: env.PAYTR_TEST_MODE.trim().toLowerCase() === "true",
      lang: p.lang,
    },
    creds,
  );

  let result;
  try {
    result = await requestPaytrToken(form, fetchImpl);
  } catch (e) {
    logger.error("payment", `${LOG} get-token isteği başarısız`, e instanceof Error ? e.message : String(e));
    throw new HttpError(502, "Payment provider request failed.");
  }
  if (!result.ok) {
    logger.error("payment", `${LOG} get-token reddedildi`, { reason: result.reason, merchantOid });
    throw new HttpError(502, "Could not start payment session.");
  }
  return { token: result.token, paymentPageUrl: paytrPaymentPageUrl(result.token), merchantOid };
}
