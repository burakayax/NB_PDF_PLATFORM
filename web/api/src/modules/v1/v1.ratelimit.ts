import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { problem } from "./v1.errors.js";
import type { ApiUser } from "./v1.middleware.js";

/** Anahtar başına dakikalık istek sınırı. RateLimit (RFC draft-7) + X-RateLimit-*
 * başlıkları eklenir; aşımda RFC 9457 429 + Retry-After. apiKeyAuth'tan SONRA çalışmalı. */
export const v1RateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: true,
  keyGenerator: (_req: Request, res: Response): string => {
    const u = (res.locals as { apiUser?: ApiUser }).apiUser;
    return u?.id ?? _req.ip ?? "anon";
  },
  handler: (_req: Request, res: Response): void => {
    problem(res, 429, "rate_limited", "İstek sınırı aşıldı (60/dk). Retry-After başlığına göre bekleyin.");
  },
});
