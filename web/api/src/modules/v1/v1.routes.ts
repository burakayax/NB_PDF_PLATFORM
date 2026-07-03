import { Router } from "express";
import express from "express";
import multer from "multer";
import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import type { NextFunction } from "express";
import { requestId, apiKeyAuth } from "./v1.middleware.js";
import { problem } from "./v1.errors.js";
import { v1RateLimiter } from "./v1.ratelimit.js";
import { idempotency } from "./v1.idempotency.js";
import { openApiSpec } from "./v1.openapi.js";
import {
  v1MeController,
  v1SummarizeController,
  v1ExtractController,
  v1TranslateController,
} from "./v1.controller.js";

/** B2B programatik API — API anahtarıyla doğrulanır (JWT DEĞİL). RFC 9457 hatalar,
 * X-Request-Id, RateLimit + X-Credits-Remaining başlıkları, Idempotency-Key. */
export const v1Router = Router();

// PDF yükleme (multipart) — 20 MB, yalnız bellek.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

v1Router.use(requestId);
v1Router.use(express.json({ limit: "2mb" }));

// OpenAPI tanımı — herkese açık (anahtar gerekmez).
v1Router.get("/openapi.json", (req: Request, res: Response) => {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.headers.host;
  res.json(openApiSpec(`${proto}://${host}`));
});

// Bundan sonrası anahtar-korumalı + sınırlı.
v1Router.use(asyncHandler(apiKeyAuth));
v1Router.use(v1RateLimiter);

v1Router.get("/me", asyncHandler(v1MeController));
v1Router.post("/summarize", upload.single("file"), idempotency, asyncHandler(v1SummarizeController));
v1Router.post("/extract", upload.single("file"), idempotency, asyncHandler(v1ExtractController));
v1Router.post("/translate", upload.single("file"), idempotency, asyncHandler(v1TranslateController));

// RFC 9457 hata yakalayıcı — multer/beklenmeyen hataları makine-okur formata çevirir.
v1Router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") return problem(res, 413, "payload_too_large", "Dosya 20 MB sınırını aşıyor.");
    return problem(res, 400, "invalid_request", err.message);
  }
  problem(res, 500, "server_error", "Beklenmeyen bir hata oluştu.");
});
