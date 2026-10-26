import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../lib/async-handler.js";
import { recordClientErrorController } from "./monitoring.controller.js";

export const monitoringRouter = Router();

/**
 * Oturumsuz ziyaretçiler de hata gönderebildiği için (hata otomasyonu) bu uç IP başına sınırlıdır:
 * kötü niyetli biri tabloyu şişirip sahte "olay" üretemesin. Normal bir kullanıcı dakikada
 * birkaç hata bile göndermez.
 */
const errorLogLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  validate: { default: false },
  keyGenerator: (req) => `errlog:${req.ip ?? "unknown"}`,
  message: { message: "Too many error reports." },
});

monitoringRouter.post("/log", errorLogLimiter, asyncHandler(recordClientErrorController));
