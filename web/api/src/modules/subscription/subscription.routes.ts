import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  cancelSubscriptionController,
  currentSubscriptionController,
  listPlansController,
  subscriptionStatusController,
} from "./subscription.controller.js";

/*
 * ``/assert-feature`` and ``/record-usage`` were the HTTP entry points for
 * the legacy daily-limit system. They have been removed — every tool run
 * is now gated by the entitlement engine via ``/api/entitlement/*``.
 */
export const subscriptionRouter = Router();

// /plans herkese açık — fiyat listesi için auth gerekmez.
subscriptionRouter.get("/plans", asyncHandler(listPlansController));

// Kişisel abonelik endpoint'leri kimlik doğrulaması gerektirir.
subscriptionRouter.get("/status", requireAuth, asyncHandler(subscriptionStatusController));
subscriptionRouter.get("/current", requireAuth, asyncHandler(currentSubscriptionController));
subscriptionRouter.post("/cancel", requireAuth, asyncHandler(cancelSubscriptionController));
