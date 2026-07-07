import type { Request, Response, NextFunction } from "express";
import { isAiConfigured, isAiEnabledByFlag } from "./ai.service.js";
import { prisma } from "../../lib/prisma.js";

/**
 * AI uçları için erişim koruması:
 *  1) Anahtar yok / global kill-switch kapalı → 503 (kimse kullanamaz, maliyet yok).
 *  2) Ücretli plan (STARTER/PLUS/PRO/BUSINESS) veya ADMIN → izin. Aylık AI kotası
 *     plana göre farklıdır (aiLimitForPlan); kota bitince controller 429 döner.
 *  3) Değilse: satın alınmış bonus kredisi (pay-per-use) varsa yine izin.
 *  4) Hiçbiri yoksa → 403.
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
  // Ücretli tüm planlar AI'a erişir (aylık kota plana göre; STARTER/PLUS az, PRO/BUSINESS çok).
  const paidPlans = ["STARTER", "PLUS", "PRO", "BUSINESS"];
  let allowed = !!u && (u.role === "ADMIN" || paidPlans.includes(u.plan));
  if (!allowed && u) {
    // Pay-per-use: abone olmayan ama kredi satın almış kullanıcı da AI kullanabilir.
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { bonusAiCredits: true } });
    if ((row?.bonusAiCredits ?? 0) > 0) allowed = true;
  }
  if (!allowed) {
    res.status(403).json({
      error: "pro_required",
      message: "Yapay zekâ özellikleri için Pro/Business aboneliği ya da işlem kredisi gerekir.",
    });
    return;
  }
  next();
}
