import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { csrfOriginCheck } from "../../middleware/csrf.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  changePasswordController,
  deleteMyAccountController,
  exportMyDataController,
  googleOAuthCallbackController,
  googleOAuthStartController,
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
  updatePreferredLanguageController,
  changePasswordPostController,
  setInitialPasswordPostController,
  updateProfileController,
  verifyEmailController,
} from "./auth.controller.js";
import { deleteAccountLimiter, forgotPasswordLimiter, loginLimiter } from "./auth.rate-limit.js";
import {
  forgotPasswordRequestController,
  forgotPasswordResetController,
  forgotPasswordVerifyController,
} from "./password-reset.controller.js";

export const authRouter = Router();

authRouter.get("/google", asyncHandler(googleOAuthStartController));
authRouter.get("/google/callback", asyncHandler(googleOAuthCallbackController));
authRouter.post("/forgot-password/request", forgotPasswordLimiter, asyncHandler(forgotPasswordRequestController));
authRouter.post("/forgot-password/verify-code", forgotPasswordLimiter, asyncHandler(forgotPasswordVerifyController));
authRouter.post("/forgot-password/reset", forgotPasswordLimiter, asyncHandler(forgotPasswordResetController));
authRouter.post("/register", loginLimiter, asyncHandler(registerController));
authRouter.post("/login", loginLimiter, asyncHandler(loginController));
authRouter.post("/refresh", csrfOriginCheck, asyncHandler(refreshController));
authRouter.post("/logout", csrfOriginCheck, asyncHandler(logoutController));
// Kimlik doğrulama gerektiren endpoint'lere açık requireAuth eklendi (defense-in-depth).
// Global requireJwtUnlessPublic bunları zaten kapsıyor; buradaki satırlar
// yeni geliştirici için dokümantasyon görevi görür ve beklenmeyen konfigürasyon
// değişikliklerinde ek güvenlik katmanı sağlar.
authRouter.get("/me", requireAuth, asyncHandler(meController));
// GDPR: authenticated user can delete their own account (rate-limited: 1 req/min).
authRouter.delete("/me", deleteAccountLimiter, requireAuth, asyncHandler(deleteMyAccountController));
authRouter.get("/verify-email", asyncHandler(verifyEmailController));
authRouter.patch("/preferences/language", requireAuth, asyncHandler(updatePreferredLanguageController));
authRouter.patch("/profile", requireAuth, asyncHandler(updateProfileController));
authRouter.patch("/password", requireAuth, asyncHandler(changePasswordController));
// GDPR Article 20: machine-readable personal data export (rate-limited via deleteAccountLimiter)
authRouter.get("/export-my-data", requireAuth, deleteAccountLimiter, asyncHandler(exportMyDataController));
authRouter.post("/change-password", requireAuth, asyncHandler(changePasswordPostController));
authRouter.post("/set-password", requireAuth, asyncHandler(setInitialPasswordPostController));
