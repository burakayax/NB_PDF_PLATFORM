import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { csrfOriginCheck } from "../../middleware/csrf.middleware.js";
import {
  changePasswordController,
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
import {
  forgotPasswordRequestController,
  forgotPasswordResetController,
  forgotPasswordVerifyController,
} from "./password-reset.controller.js";

export const authRouter = Router();

authRouter.get("/google", asyncHandler(googleOAuthStartController));
authRouter.get("/google/callback", asyncHandler(googleOAuthCallbackController));
authRouter.post("/forgot-password/request", asyncHandler(forgotPasswordRequestController));
authRouter.post("/forgot-password/verify-code", asyncHandler(forgotPasswordVerifyController));
authRouter.post("/forgot-password/reset", asyncHandler(forgotPasswordResetController));
authRouter.post("/register", asyncHandler(registerController));
authRouter.post("/login", asyncHandler(loginController));
authRouter.post("/refresh", csrfOriginCheck, asyncHandler(refreshController));
authRouter.post("/logout", csrfOriginCheck, asyncHandler(logoutController));
authRouter.get("/me", asyncHandler(meController));
authRouter.get("/verify-email", asyncHandler(verifyEmailController));
authRouter.patch("/preferences/language", asyncHandler(updatePreferredLanguageController));
authRouter.patch("/profile", asyncHandler(updateProfileController));
authRouter.patch("/password", asyncHandler(changePasswordController));
/** JWT: üst düzey `requireJwtUnlessPublic` + Bearer. */
authRouter.post("/change-password", asyncHandler(changePasswordPostController));
authRouter.post("/set-password", asyncHandler(setInitialPasswordPostController));
