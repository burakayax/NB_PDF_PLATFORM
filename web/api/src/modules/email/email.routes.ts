import { Router } from "express";
import express from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { unsubscribeController, unsubscribeFeedbackController, resubscribeController } from "./email.controller.js";
import { unsubscribeIpLimiter, unsubscribeTokenLimiter } from "./email.rate-limit.js";

/** Pazarlama e-posta abonelik yönetimi (giriş gerektirmez; token ile). */
export const emailRouter = Router();

const urlencoded = express.urlencoded({ extended: false });

// Gövde önce okunur (token form alanında olabilir), sonra sınırlar çalışır.
// RFC 8058 tek-tık POST'u form-encoded gövde gönderebilir.
emailRouter.post("/unsubscribe", urlencoded, unsubscribeIpLimiter, unsubscribeTokenLimiter, asyncHandler(unsubscribeController));
emailRouter.get("/unsubscribe", unsubscribeIpLimiter, unsubscribeTokenLimiter, asyncHandler(unsubscribeController));
// Çıkış sayfasındaki formlar (düz HTML form, JavaScript gerekmez).
emailRouter.post("/unsubscribe/feedback", urlencoded, unsubscribeIpLimiter, unsubscribeTokenLimiter, asyncHandler(unsubscribeFeedbackController));
emailRouter.post("/unsubscribe/resubscribe", urlencoded, unsubscribeIpLimiter, unsubscribeTokenLimiter, asyncHandler(resubscribeController));
