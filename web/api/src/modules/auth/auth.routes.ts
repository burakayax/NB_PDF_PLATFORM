import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { csrfOriginCheck } from "../../middleware/csrf.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  deviceIdMiddleware,
  changePasswordController,
  deleteMyAccountController,
  exportMyDataController,
  googleOAuthCallbackController,
  googleOAuthStartController,
  googleSignupCompleteController,
  loginController,
  logoutController,
  meController,
  listSessionsController,
  revokeSessionController,
  revokeOtherSessionsController,
  refreshController,
  registerController,
  resendVerificationController,
  updatePreferredLanguageController,
  changePasswordPostController,
  setInitialPasswordPostController,
  updateProfileController,
  verifyEmailController,
} from "./auth.controller.js";
import {
  getMarketingConsentController,
  setMarketingConsentController,
} from "../email/marketing-consent.controller.js";
import { deleteAccountLimiter, forgotPasswordLimiter, loginLimiter, registerLimiter, resendVerificationLimiter } from "./auth.rate-limit.js";
import {
  adminTwoFactorSendController,
  adminTwoFactorStatusController,
  adminTwoFactorVerifyController,
} from "./admin-2fa.controller.js";
import {
  forgotPasswordRequestController,
  forgotPasswordResetController,
  forgotPasswordVerifyController,
} from "./password-reset.controller.js";

export const authRouter = Router();
authRouter.use(deviceIdMiddleware);

authRouter.get("/google", asyncHandler(googleOAuthStartController));
authRouter.get("/google/callback", asyncHandler(googleOAuthCallbackController));
// Google ile YENİ hesap: onay ekranından sonra hesabı açar (kayıt benzeri; aynı hız sınırı).
authRouter.post("/google/complete", registerLimiter, asyncHandler(googleSignupCompleteController));
authRouter.post("/forgot-password/request", forgotPasswordLimiter, asyncHandler(forgotPasswordRequestController));
authRouter.post("/forgot-password/verify-code", forgotPasswordLimiter, asyncHandler(forgotPasswordVerifyController));
authRouter.post("/forgot-password/reset", forgotPasswordLimiter, asyncHandler(forgotPasswordResetController));
authRouter.post("/register", registerLimiter, asyncHandler(registerController));
authRouter.post("/resend-verification", resendVerificationLimiter, asyncHandler(resendVerificationController));
authRouter.post("/login", loginLimiter, asyncHandler(loginController));
// Admin girişi: IP sınırı + hesap kilidi + bot doğrulaması; panele erişim ayrıca e-posta koduyla (admin-2fa) korunur.
authRouter.post("/nbadmin", loginLimiter, asyncHandler(loginController));
// Yönetici ikinci doğrulama (e-posta kodu): durum / kod gönder / kodu doğrula.
authRouter.get("/admin-2fa/status", requireAuth, asyncHandler(adminTwoFactorStatusController));
authRouter.post("/admin-2fa/send", csrfOriginCheck, requireAuth, loginLimiter, asyncHandler(adminTwoFactorSendController));
authRouter.post("/admin-2fa/verify", csrfOriginCheck, requireAuth, loginLimiter, asyncHandler(adminTwoFactorVerifyController));
authRouter.post("/refresh", csrfOriginCheck, asyncHandler(refreshController));
authRouter.post("/logout", csrfOriginCheck, asyncHandler(logoutController));
// Kimlik doğrulama gerektiren endpoint'lere açık requireAuth eklendi (defense-in-depth).
// Global requireJwtUnlessPublic bunları zaten kapsıyor; buradaki satırlar
// yeni geliştirici için dokümantasyon görevi görür ve beklenmeyen konfigürasyon
// değişikliklerinde ek güvenlik katmanı sağlar.
authRouter.get("/me", requireAuth, asyncHandler(meController));
// Açık oturumlar: kullanıcı hesabının nerelerde açık olduğunu görür ve
// istediğini uzaktan kapatır (OWASP oturum yönetimi önerisi).
authRouter.get("/sessions", requireAuth, asyncHandler(listSessionsController));
authRouter.delete("/sessions/:id", csrfOriginCheck, requireAuth, asyncHandler(revokeSessionController));
authRouter.post("/sessions/revoke-others", csrfOriginCheck, requireAuth, asyncHandler(revokeOtherSessionsController));
// GDPR: authenticated user can delete their own account (rate-limited: 1 req/min).
authRouter.delete("/me", deleteAccountLimiter, requireAuth, asyncHandler(deleteMyAccountController));
authRouter.get("/verify-email", asyncHandler(verifyEmailController));
authRouter.patch("/preferences/language", requireAuth, asyncHandler(updatePreferredLanguageController));
authRouter.patch("/profile", requireAuth, asyncHandler(updateProfileController));
authRouter.patch("/password", requireAuth, asyncHandler(changePasswordController));
// GDPR Article 20: machine-readable personal data export (rate-limited via deleteAccountLimiter)
authRouter.get("/export-my-data", requireAuth, deleteAccountLimiter, asyncHandler(exportMyDataController));
// Tanıtım e-postası izni: hesap ayarlarından onay / geri alma (kanıt defterine yazılır).
authRouter.get("/marketing-consent", requireAuth, asyncHandler(getMarketingConsentController));
authRouter.put("/marketing-consent", csrfOriginCheck, requireAuth, asyncHandler(setMarketingConsentController));
authRouter.post("/change-password", requireAuth, asyncHandler(changePasswordPostController));
authRouter.post("/set-password", requireAuth, asyncHandler(setInitialPasswordPostController));
