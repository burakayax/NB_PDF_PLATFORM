import { Router } from "express";
import express from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { unsubscribeController } from "./email.controller.js";

/** Pazarlama e-posta abonelik yönetimi (giriş gerektirmez; token ile). */
export const emailRouter = Router();

// RFC 8058 tek-tık POST'u form-encoded gövde gönderebilir.
emailRouter.post("/unsubscribe", express.urlencoded({ extended: false }), asyncHandler(unsubscribeController));
emailRouter.get("/unsubscribe", asyncHandler(unsubscribeController));
