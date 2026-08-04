import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { updateProfileController } from "../auth/auth.controller.js";
import { profileController } from "./user.controller.js";
import {
  deleteScanController,
  downloadScanController,
  listScansController,
  uploadScanController,
} from "./scans.controller.js";

export const userRouter = Router();

// Tüm user endpoint'leri kimlik doğrulaması gerektirir.
userRouter.use(requireAuth);

userRouter.get("/profile", asyncHandler(profileController));
/** Alias of PATCH /api/auth/profile — billing fields for checkout (same handler). */
userRouter.patch("/profile", asyncHandler(updateProfileController));

// Belge Tarayıcı "Hesabıma kaydet" — son taramalar (Postgres bytea, FIFO).
const scanUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
userRouter.get("/scans", asyncHandler(listScansController));
userRouter.post("/scans", scanUpload.single("file"), asyncHandler(uploadScanController));
userRouter.get("/scans/:id/download", asyncHandler(downloadScanController));
userRouter.delete("/scans/:id", asyncHandler(deleteScanController));
