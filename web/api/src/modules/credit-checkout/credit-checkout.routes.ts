import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  creditCheckoutPreviewController,
  creditCheckoutStartController,
  creditCheckoutValidateCouponController,
} from "./credit-checkout.controller.js";

export const creditCheckoutRouter = Router();

const validateCouponLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).authUser?.id ?? req.ip ?? "unknown",
  message: { message: "Too many coupon attempts. Please wait a minute." },
});

creditCheckoutRouter.post("/preview", asyncHandler(creditCheckoutPreviewController));
creditCheckoutRouter.post("/start", asyncHandler(creditCheckoutStartController));
creditCheckoutRouter.post("/validate-coupon", validateCouponLimiter, asyncHandler(creditCheckoutValidateCouponController));
