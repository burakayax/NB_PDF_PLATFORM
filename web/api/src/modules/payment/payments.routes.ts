import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { paymentCallbackController, paymentCallbackUrlencoded } from "./payment.controller.js";
import {
  getPaymentsPricingPublicController,
  initializePaymentsController,
} from "./payments.controller.js";

/** `/api/payments/initialize` — pricing tiers; GET `/api/payments/pricing` — canonical TRY amounts; `/api/payments/callback` — iyzico POST alias. */
export const paymentsRouter = Router();

paymentsRouter.get("/pricing", asyncHandler(getPaymentsPricingPublicController));
paymentsRouter.post("/initialize", asyncHandler(initializePaymentsController));
paymentsRouter.post("/callback", paymentCallbackUrlencoded, asyncHandler(paymentCallbackController));
