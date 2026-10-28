import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import express from "express";
import {
  createPaymentController,
  createTopupCheckoutController,
  createCvPassCheckoutController,
  listCvPassesController,
  paymentCallbackController,
  paymentCallbackUrlencoded,
  paymentRefundWebhookController,
} from "./payment.controller.js";
import { paymentCallbackLimiter } from "../../middleware/api-security.middleware.js";
import { paytrNotifyController, paytrNotifyUrlencoded } from "./paytr/paytr.notify.js";
import { requirePaymentsEnabled } from "./payments-gate.middleware.js";

export const paymentRouter = Router();

paymentRouter.post("/callback", paymentCallbackLimiter, paymentCallbackUrlencoded, asyncHandler(paymentCallbackController));
paymentRouter.post("/create", requirePaymentsEnabled, asyncHandler(createPaymentController));
paymentRouter.post("/topup", requirePaymentsEnabled, asyncHandler(createTopupCheckoutController));
paymentRouter.get("/cv-passes", asyncHandler(listCvPassesController));
paymentRouter.post("/cv-pass", requirePaymentsEnabled, asyncHandler(createCvPassCheckoutController));
// PayTR bildirim URL (iFrame API 2. adım) — JWT yok, hash ile doğrulanır; yanıt düz metin OK.
paymentRouter.post("/paytr-notify", paymentCallbackLimiter, paytrNotifyUrlencoded, asyncHandler(paytrNotifyController));
// iyzico iade bildirimi — JSON body kabul eder
paymentRouter.post("/refund-notify", express.json(), asyncHandler(paymentRefundWebhookController));
