import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAiAccess } from "./ai.middleware.js";
import {
  summarizeController,
  chatController,
  extractController,
  translateController,
  compareController,
  detectSensitiveController,
  quotaController,
  topupPacksController,
  topupGrantController,
} from "./ai.controller.js";

export const aiRouter = Router();

// Kota göstergesi (araç bunu okuyup "kalan hak"ı gösterir).
aiRouter.get("/quota", requireAuth, requireAiAccess, asyncHandler(quotaController));

// requireAuth → authUser'ı set eder; requireAiAccess → anahtar/flag/plan kontrolü.
aiRouter.post(
  "/summarize",
  requireAuth,
  requireAiAccess,
  asyncHandler(summarizeController),
);
aiRouter.post("/chat", requireAuth, requireAiAccess, asyncHandler(chatController));
aiRouter.post("/extract", requireAuth, requireAiAccess, asyncHandler(extractController));
aiRouter.post("/translate", requireAuth, requireAiAccess, asyncHandler(translateController));
aiRouter.post("/compare", requireAuth, requireAiAccess, asyncHandler(compareController));
aiRouter.post("/detect-sensitive", requireAuth, requireAiAccess, asyncHandler(detectSensitiveController));

// Top-up (ek AI kredisi paketleri) — katalog herkese açık; grant admin-gated (controller içinde).
aiRouter.get("/topup/packs", requireAuth, asyncHandler(topupPacksController));
aiRouter.post("/topup/grant", requireAuth, asyncHandler(topupGrantController));
