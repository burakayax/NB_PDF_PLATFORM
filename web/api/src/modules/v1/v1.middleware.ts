import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { isAiConfigured, isAiEnabledByFlag } from "../ai/ai.service.js";
import { resolveApiKeyUser } from "../api-keys/api-keys.service.js";
import { problem } from "./v1.errors.js";

export type ApiUser = { id: string; plan: string; role: string };

/** Her /v1 yanıtına benzersiz X-Request-Id ekler (destek/hata ayıklama için). */
export function requestId(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Request-Id", `req_${randomUUID().replace(/-/g, "")}`);
  next();
}

/** /v1 kimlik doğrulama: Authorization: Bearer nb_live_xxx → kullanıcıyı çöz. */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!raw) {
    problem(res, 401, "invalid_api_key", "Authorization: Bearer <API_KEY> başlığı gerekli.");
    return;
  }
  const resolved = await resolveApiKeyUser(raw);
  if (!resolved) {
    problem(res, 401, "invalid_api_key", "Geçersiz ya da iptal edilmiş API anahtarı.");
    return;
  }
  if (!isAiConfigured() || !(await isAiEnabledByFlag())) {
    problem(res, 503, "ai_unavailable", "AI servisi şu an kullanılamıyor.");
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: resolved.userId },
    select: { id: true, plan: true, role: true },
  });
  if (!user) {
    problem(res, 401, "invalid_api_key", "Anahtar sahibi bulunamadı.");
    return;
  }
  (res.locals as { apiUser?: ApiUser }).apiUser = { id: user.id, plan: user.plan, role: user.role };
  next();
}
