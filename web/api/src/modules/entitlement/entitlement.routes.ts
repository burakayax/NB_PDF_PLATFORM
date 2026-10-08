import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import {
  guestCompressConfigController,
  guestCompressUsageController,
} from "../guest-compress/guest-compress.internal.js";
import {
  downloadLogAckController,
  downloadLogCreateController,
  editorDownloadConsumeController,
  outputRecordController,
  entitlementBalanceController,
  entitlementCheckController,
  entitlementConsumeController,
  entitlementTransactionsController,
} from "./entitlement.controller.js";

/**
 * Mounted at `/api/entitlement` by `src/routes/index.ts`. JWT is enforced
 * globally by `requireJwtUnlessPublic`; none of these paths are in the
 * public allow-list, so every request must carry a valid Bearer token.
 */
export const entitlementRouter = Router();

entitlementRouter.get("/balance", asyncHandler(entitlementBalanceController));
entitlementRouter.get("/transactions", asyncHandler(entitlementTransactionsController));
entitlementRouter.post("/check", asyncHandler(entitlementCheckController));
entitlementRouter.post("/consume", asyncHandler(entitlementConsumeController));
entitlementRouter.post("/download-log", asyncHandler(downloadLogCreateController));
entitlementRouter.post("/download-log/:id/ack", asyncHandler(downloadLogAckController));
// Dahili (FastAPI worker) — X-Internal-Secret ile korunur; JWT bypass'ı için
// `isPublicApiPath`'e eklendi (kendi secret'ıyla yetkilenir).
entitlementRouter.post("/internal/editor-download", asyncHandler(editorDownloadConsumeController));
// Çıktı dosyası parmak izi kaydı (FastAPI → Node; X-Internal-Secret ile yetkilenir).
entitlementRouter.post("/internal/output-record", asyncHandler(outputRecordController));
// Misafir PDF Sıkıştır: panelden ayarlanan değerler + hak sayacı (FastAPI → Node; X-Internal-Secret).
entitlementRouter.get("/internal/guest-compress/config", asyncHandler(guestCompressConfigController));
entitlementRouter.post("/internal/guest-compress/usage", asyncHandler(guestCompressUsageController));
