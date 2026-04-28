import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { updateProfileController } from "../auth/auth.controller.js";
import { profileController } from "./user.controller.js";

export const userRouter = Router();

userRouter.get("/profile", asyncHandler(profileController));
/** Alias of PATCH /api/auth/profile — billing fields for checkout (same handler). */
userRouter.patch("/profile", asyncHandler(updateProfileController));
