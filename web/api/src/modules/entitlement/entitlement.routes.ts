import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import {
  downloadLogAckController,
  downloadLogCreateController,
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
