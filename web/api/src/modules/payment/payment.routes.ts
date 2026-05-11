import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import express from "express";
import {
  createPaymentController,
  paymentCallbackController,
  paymentCallbackUrlencoded,
  paymentRefundWebhookController,
} from "./payment.controller.js";

export const paymentRouter = Router();

paymentRouter.post("/callback", paymentCallbackUrlencoded, asyncHandler(paymentCallbackController));
paymentRouter.post("/create", asyncHandler(createPaymentController));
// iyzico iade bildirimi — JSON body kabul eder
paymentRouter.post("/refund-notify", express.json(), asyncHandler(paymentRefundWebhookController));
