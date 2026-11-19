import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { logger } from "../../lib/file-log.js";
import {
  ADMIN_2FA_COOKIE,
  ADMIN_2FA_PROOF_HOURS,
  hasValidProof,
  isAdmin2faEnabled,
  sendAdminCode,
  verifyAdminCode,
} from "./admin-2fa.service.js";
import { getCookieOptions } from "./auth.controller.js";

function requireAdminUser(request: Request) {
  const u = request.authUser;
  if (!u || u.role !== "ADMIN") throw new HttpError(403, "Admin access required.");
  return u;
}

/** GET /api/auth/admin-2fa/status → bu tarayıcı doğrulanmış mı? */
export async function adminTwoFactorStatusController(request: Request, response: Response) {
  const u = requireAdminUser(request);
  const enabled = isAdmin2faEnabled();
  const proof = (request.cookies as Record<string, string> | undefined)?.[ADMIN_2FA_COOKIE];
  response.json({ enabled, verified: !enabled || hasValidProof(proof, u.id) });
}

/** POST /api/auth/admin-2fa/send → kodu yöneticinin kendi e-postasına yollar. */
export async function adminTwoFactorSendController(request: Request, response: Response) {
  const u = requireAdminUser(request);
  if (!isAdmin2faEnabled()) {
    response.json({ ok: true, cooldownSeconds: 0 });
    return;
  }
  const r = await sendAdminCode({ id: u.id, email: u.email }, request.ip);
  logger.info("auth", "admin-2fa: kod gönderildi", { userId: u.id });
  response.json({ ok: true, ...r });
}

/** POST /api/auth/admin-2fa/verify { code } → doğruysa kanıt çerezi yazar. */
export async function adminTwoFactorVerifyController(request: Request, response: Response) {
  const u = requireAdminUser(request);
  const code = (request.body as { code?: unknown } | undefined)?.code;
  try {
    const proof = await verifyAdminCode(u.id, typeof code === "string" ? code : "");
    const opts = getCookieOptions();
    response.cookie(ADMIN_2FA_COOKIE, proof, {
      ...opts,
      path: "/",
      maxAge: ADMIN_2FA_PROOF_HOURS * 60 * 60 * 1000,
    });
    logger.info("auth", "admin-2fa: doğrulandı", { userId: u.id });
    response.json({ ok: true });
  } catch (error) {
    logger.warn("auth", "admin-2fa: yanlış/süresi geçmiş kod", { userId: u.id, ip: request.ip });
    throw error;
  }
}
