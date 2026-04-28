import { Router } from "express";
import type { Request, Response } from "express";

/**
 * `/api/payment/*` — PAYMENTS GLOBALLY DISABLED.
 *
 * Bu router, ödemelerin sistem genelinde kapalı olduğu "infrastructure-only"
 * modda `/api/payment` altına mount edilir. Hiçbir ödeme sağlayıcısı aktif
 * değildir:
 *  - iyzico modülü (`modules/payment/**`) diskte kalır, router'ı mount edilmez.
 *  - Stripe modülü (`modules/payment/stripe/**`) diskte kalır, router'ı mount edilmez.
 *
 * Neden 501 DEĞİL, 503:
 *  - 501 "Not Implemented" semantiği burada yanlış olur; endpoint'ler fiilen
 *    mevcut fakat DEVRE DIŞI — ayrıca 501 yanıtı üretim akışından kaldırıldı.
 *  - 503 "Service Unavailable" feature-flag gereği kapalı bir servis için
 *    standart semantiktir; frontend/desktop istemci status koduna göre
 *    net bir "şu an kullanılamaz" durumu ayırt edebilir.
 *
 * Neden 200 + `{enabled:false}` DEĞİL:
 *  - 200 yanıtı status'e bakan naif istemcilerde sessiz başarı gibi görünür;
 *    503 açıkça "bu istek işlenmedi" demektedir.
 *
 * Frontend uyumluluğu: `web/frontend/src/api/payment.ts` → `ensureOk`,
 * JSON body'deki `message` alanını okuyup `Error` atar; böylece kullanıcıya
 * "Payments are not active in this environment." mesajı görünür. Desktop
 * Python istemcisi de aynı mantıkla `DesktopAuthError` yükseltir. Hiçbir
 * endpoint "broken" durumda DEĞİLDİR; yanıt deterministic ve dokümante edilmiş.
 */
export const paymentsDisabledRouter = Router();

function respondPaymentsDisabled(_request: Request, response: Response): void {
  response.status(503).json({
    error: "payments_disabled",
    enabled: false,
    provider: null,
    message: "Payments are not active in this environment. No payment processor is wired.",
  });
}

paymentsDisabledRouter.post("/create", respondPaymentsDisabled);
paymentsDisabledRouter.post("/callback", respondPaymentsDisabled);
paymentsDisabledRouter.post("/initialize", respondPaymentsDisabled);
// Catch-all: `/api/payment/*` altında tanımsız her path aynı NO-OP yanıtı verir.
paymentsDisabledRouter.use(respondPaymentsDisabled);
