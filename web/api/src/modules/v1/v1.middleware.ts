import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { isAiConfigured, isAiEnabledByFlag } from "../ai/ai.service.js";
import { resolveApiKeyUser } from "../api-keys/api-keys.service.js";

export type ApiUser = { id: string; plan: string; role: string };

/** /v1 kimlik doğrulama: Authorization: Bearer nb_live_xxx → kullanıcıyı çöz. */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const resolved = await resolveApiKeyUser(raw);
  if (!resolved) {
    res.status(401).json({ error: "invalid_api_key", message: "Geçersiz ya da iptal edilmiş API anahtarı." });
    return;
  }
  if (!isAiConfigured() || !(await isAiEnabledByFlag())) {
    res.status(503).json({ error: "ai_unavailable", message: "AI şu an kullanılamıyor." });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: resolved.userId },
    select: { id: true, plan: true, role: true },
  });
  if (!user) {
    res.status(401).json({ error: "invalid_api_key", message: "Anahtar sahibi bulunamadı." });
    return;
  }
  (res.locals as { apiUser?: ApiUser }).apiUser = { id: user.id, plan: user.plan, role: user.role };
  next();
}
