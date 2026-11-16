import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  creditCheckoutPreviewController,
  creditCheckoutStartController,
  creditCheckoutValidateCouponController,
} from "./credit-checkout.controller.js";
import { requirePaymentsEnabled } from "../payment/payments-gate.middleware.js";

export const creditCheckoutRouter = Router();

/**
 * KULLANIMDAN KALKTI: bu akış (eski "Bronz/Altın/Limitsiz" kredi paketleri) canlıda kullanılmaz; ödeme
 * artık PayTR ve fiyat kataloğuyla (`lib/plan-catalogue.ts`) yapılır. Geçerli fiyatlarla çelişen
 * eski rakamları (149 ₺, 399 ₺, 699 ₺ …) canlıda döndürmemek için üretimde kapatıldı; yerel geliştirmede
 * eski sahte-ödeme sınaması için açık kalır.
 */
creditCheckoutRouter.use((_req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.status(410).json({ message: "This checkout flow is no longer available." });
    return;
  }
  next();
});

const validateCouponLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
  keyGenerator: (req) => (req as any).authUser?.id ?? req.ip ?? "unknown",
  message: { message: "Too many coupon attempts. Please wait a minute." },
});

creditCheckoutRouter.post("/preview", asyncHandler(creditCheckoutPreviewController));
creditCheckoutRouter.post("/start", requirePaymentsEnabled, asyncHandler(creditCheckoutStartController));
creditCheckoutRouter.post("/validate-coupon", validateCouponLimiter, asyncHandler(creditCheckoutValidateCouponController));
