import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  createSignatureRequestController,
  listSignatureRequestsController,
  signatureRequestDetailController,
  cancelSignatureRequestController,
  downloadSignatureDocumentController,
  openSignPageController,
  submitSignatureController,
  declineSignatureController,
  downloadSignerCopyController,
} from "./signature.controller.js";

/** Gönderen tarafı — oturum gerektirir. */
export const signatureRouter = Router();
signatureRouter.use(requireAuth);

const belgeYukleme = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

signatureRouter.get("/", asyncHandler(listSignatureRequestsController));
signatureRouter.post("/", belgeYukleme.single("file"), asyncHandler(createSignatureRequestController));
signatureRouter.get("/:id", asyncHandler(signatureRequestDetailController));
signatureRouter.post("/:id/cancel", asyncHandler(cancelSignatureRequestController));
signatureRouter.get("/:id/download", asyncHandler(downloadSignatureDocumentController));

/**
 * İmzalayan tarafı — oturum YOKTUR, kimlik bağlantı anahtarıyla kurulur.
 *
 * Anahtar tahmin edilemez uzunluktadır ve yalnız hedef e-posta adresine gider;
 * yine de deneme yanılmayı anlamsız kılmak için hız sınırı uygulanır.
 */
export const publicSignRouter = Router();

const imzaSiniri = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
publicSignRouter.use(imzaSiniri);

publicSignRouter.get("/:token", asyncHandler(openSignPageController));
publicSignRouter.post("/:token/sign", asyncHandler(submitSignatureController));
publicSignRouter.post("/:token/decline", asyncHandler(declineSignatureController));
publicSignRouter.get("/:token/download", asyncHandler(downloadSignerCopyController));
