import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAiAccess } from "./ai.middleware.js";
import {
  summarizeController,
  chatController,
  quotaController,
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
