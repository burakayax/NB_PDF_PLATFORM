import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { csrfOriginCheck } from "../../middleware/csrf.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  changePasswordController,
  deleteMyAccountController,
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
import { deleteAccountLimiter, forgotPasswordLimiter } from "./auth.rate-limit.js";
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
authRouter.post("/register", asyncHandler(registerController));
authRouter.post("/login", asyncHandler(loginController));
authRouter.post("/refresh", csrfOriginCheck, asyncHandler(refreshController));
authRouter.post("/logout", csrfOriginCheck, asyncHandler(logoutController));
authRouter.get("/me", asyncHandler(meController));
// GDPR: authenticated user can delete their own account (rate-limited: 1 req/min).
authRouter.delete("/me", deleteAccountLimiter, requireAuth, asyncHandler(deleteMyAccountController));
authRouter.get("/verify-email", asyncHandler(verifyEmailController));
authRouter.patch("/preferences/language", asyncHandler(updatePreferredLanguageController));
authRouter.patch("/profile", asyncHandler(updateProfileController));
authRouter.patch("/password", asyncHandler(changePasswordController));
/** JWT: üst düzey `requireJwtUnlessPublic` + Bearer. */
authRouter.post("/change-password", asyncHandler(changePasswordPostController));
authRouter.post("/set-password", asyncHandler(setInitialPasswordPostController));
