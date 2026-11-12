import { Router } from "express";
import express from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { unsubscribeController, unsubscribeFeedbackController, resubscribeController } from "./email.controller.js";

/** Pazarlama e-posta abonelik yönetimi (giriş gerektirmez; token ile). */
export const emailRouter = Router();

// RFC 8058 tek-tık POST'u form-encoded gövde gönderebilir.
emailRouter.post("/unsubscribe", express.urlencoded({ extended: false }), asyncHandler(unsubscribeController));
emailRouter.get("/unsubscribe", asyncHandler(unsubscribeController));
// Çıkış sayfasındaki formlar (düz HTML form, JavaScript gerekmez).
emailRouter.post("/unsubscribe/feedback", express.urlencoded({ extended: false }), asyncHandler(unsubscribeFeedbackController));
emailRouter.post("/unsubscribe/resubscribe", express.urlencoded({ extended: false }), asyncHandler(resubscribeController));
