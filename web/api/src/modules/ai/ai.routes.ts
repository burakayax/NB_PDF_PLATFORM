import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAiAccess } from "./ai.middleware.js";
import { requireAiTool } from "./ai-tool-switch.js";
import {
  summarizeController,
  chatController,
  extractController,
  translateController,
  translateSegmentsController,
  compareController,
  detectSensitiveController,
  quotaController,
  toolStatusController,
  topupPacksController,
  topupGrantController,
} from "./ai.controller.js";
import {
  startContractReviewController,
  prescanContractController,
  contractReviewStatusController,
  deleteContractReviewController,
  contractReviewDownloadController,
} from "./contract-review.controller.js";

export const aiRouter = Router();

// Kapalı araçların admin notları — giriş gerektirmez (misafir de "Çok Yakında" notunu görür).
aiRouter.get("/tool-status", asyncHandler(toolStatusController));

// Kota göstergesi (araç bunu okuyup "kalan hak"ı gösterir).
aiRouter.get("/quota", requireAuth, requireAiAccess, asyncHandler(quotaController));

// requireAuth → authUser'ı set eder; requireAiAccess → anahtar/flag/plan kontrolü.
aiRouter.post(
  "/summarize",
  requireAuth,
  requireAiAccess,
  requireAiTool("pdf-ozetle"),
  asyncHandler(summarizeController),
);
aiRouter.post("/chat", requireAuth, requireAiAccess, requireAiTool("pdf-sohbet"), asyncHandler(chatController));
aiRouter.post("/extract", requireAuth, requireAiAccess, requireAiTool("pdf-veri-cikar"), asyncHandler(extractController));
aiRouter.post("/translate", requireAuth, requireAiAccess, requireAiTool("pdf-ceviri"), asyncHandler(translateController));
aiRouter.post("/translate-segments", requireAuth, requireAiAccess, requireAiTool("pdf-ceviri"), asyncHandler(translateSegmentsController));
aiRouter.post("/compare", requireAuth, requireAiAccess, requireAiTool("pdf-karsilastir"), asyncHandler(compareController));
aiRouter.post("/detect-sensitive", requireAuth, requireAiAccess, requireAiTool("hassas-veri-gizle"), asyncHandler(detectSensitiveController));

// Sözleşme Denetçisi — uzun süren iş: başlat → durumu yokla → (isteğe bağlı) sil.
aiRouter.post("/contract-review/prescan", requireAuth, requireAiAccess, asyncHandler(prescanContractController));
aiRouter.post("/contract-review", requireAuth, requireAiAccess, asyncHandler(startContractReviewController));
aiRouter.get("/contract-review/:id", requireAuth, requireAiAccess, asyncHandler(contractReviewStatusController));
aiRouter.post("/contract-review/:id/download", requireAuth, requireAiAccess, asyncHandler(contractReviewDownloadController));
aiRouter.delete("/contract-review/:id", requireAuth, requireAiAccess, asyncHandler(deleteContractReviewController));

// Top-up (ek AI kredisi paketleri) — katalog herkese açık; grant admin-gated (controller içinde).
aiRouter.get("/topup/packs", requireAuth, asyncHandler(topupPacksController));
aiRouter.post("/topup/grant", requireAuth, asyncHandler(topupGrantController));
