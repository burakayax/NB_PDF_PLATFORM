import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
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

subscriptionRouter.get("/plans", asyncHandler(listPlansController));
subscriptionRouter.get("/status", asyncHandler(subscriptionStatusController));
subscriptionRouter.get("/current", asyncHandler(currentSubscriptionController));
subscriptionRouter.post("/cancel", asyncHandler(cancelSubscriptionController));
