import { Router } from "express";

/**
 * Stripe router — LIBRARY-ONLY MODE.
 *
 * Bu dosya dosya sistemi üzerinde Phase 3 entegrasyonu için iskelet olarak durur.
 * Router şu anda HİÇ bir handler register etmez ve `routes/index.ts` içinde
 * mount EDİLMEZ. Kasıtlı olarak boş:
 *   - `/api/payment` üzerinden Stripe endpoint'i sunmak için `PAYMENTS_PROVIDER=stripe`
 *     YETMEZ; ayrıca aşağıdaki handler bağlamaları ve `routes/index.ts` içinde
 *     mount satırı da Phase 3'te etkinleştirilmeli.
 *   - Yanlışlıkla mount edilirse bile hiç handler olmadığı için her path 404 döner —
 *     eski 501 cevapları kaldırıldı (sistem "inactive" sinyali 404 olarak verilir).
 *
 * Phase 3 aktivasyonu (yapılacak):
 *   import { asyncHandler } from "../../../lib/async-handler.js";
 *   import { createStripeCheckout, handleStripeWebhook } from "./stripe.controller.js";
 *   stripePaymentRouter.post("/create",  asyncHandler(createStripeCheckout));
 *   stripePaymentRouter.post("/webhook", asyncHandler(handleStripeWebhook));
 */
export const stripePaymentRouter = Router();
