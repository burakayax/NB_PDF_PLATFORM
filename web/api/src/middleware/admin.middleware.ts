import type { NextFunction, Request, Response } from "express";
import { ADMIN_2FA_COOKIE, hasValidProof, isAdmin2faEnabled } from "../modules/auth/admin-2fa.service.js";

/**
 * Requires JWT (global middleware) and ADMIN role from email policy.
 * Ayrıca bu tarayıcının e-posta kodu doğrulaması (ikinci adım) yapılmış olmalı.
 */
export function requireAdmin(request: Request, response: Response, next: NextFunction) {
  if (!request.authUser || request.authUser.role !== "ADMIN") {
    response.status(403).json({ message: "Admin access required." });
    return;
  }
  if (isAdmin2faEnabled()) {
    const proof = (request.cookies as Record<string, string> | undefined)?.[ADMIN_2FA_COOKIE];
    if (!hasValidProof(proof, request.authUser.id)) {
      response.status(403).json({
        message: "Yönetim paneli için e-posta doğrulaması gerekli.",
        code: "admin_2fa_required",
      });
      return;
    }
  }
  next();
}
