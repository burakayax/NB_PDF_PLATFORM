import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  creditCheckoutPreviewController,
  creditCheckoutStartController,
  creditCheckoutValidateCouponController,
} from "./credit-checkout.controller.js";

export const creditCheckoutRouter = Router();

creditCheckoutRouter.post("/preview", asyncHandler(creditCheckoutPreviewController));
creditCheckoutRouter.post("/start", asyncHandler(creditCheckoutStartController));
creditCheckoutRouter.post("/validate-coupon", asyncHandler(creditCheckoutValidateCouponController));
