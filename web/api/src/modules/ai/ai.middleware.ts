import type { Request, Response, NextFunction } from "express";
import { isAiConfigured, isAiEnabledByFlag } from "./ai.service.js";

/**
 * AI uçları için erişim koruması:
 *  1) Anahtar yok / global kill-switch kapalı → 503 (kimse kullanamaz, maliyet yok).
 *  2) Plan PRO/BUSINESS veya rol ADMIN değilse → 403 (ücretsiz kullanıcı AI kullanamaz).
 * Böylece ücretsiz kullanıcı AI'ı tetikleyip kurucuya maliyet çıkaramaz.
 */
export async function requireAiAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isAiConfigured() || !(await isAiEnabledByFlag())) {
    res.status(503).json({
      error: "ai_unavailable",
      message: "AI özelliği şu an kullanılamıyor.",
    });
    return;
  }
  const u = req.authUser;
  const allowed =
    !!u && (u.role === "ADMIN" || u.plan === "PRO" || u.plan === "BUSINESS");
  if (!allowed) {
    res.status(403).json({
      error: "pro_required",
      message: "Yapay zekâ özellikleri Pro ve Business planlarına özeldir.",
    });
    return;
  }
  next();
}
