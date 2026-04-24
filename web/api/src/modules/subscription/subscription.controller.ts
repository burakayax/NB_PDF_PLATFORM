import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import {
  getSubscriptionStatus,
  getSubscriptionSummary,
  listPlans,
} from "./subscription.service.js";

/*
 * Daily-quota HTTP surface (``/assert-feature`` and ``/record-usage``) has
 * been removed along with the legacy daily-limit system. All tool gating
 * now goes through the entitlement engine (``/api/entitlement/*``). The
 * remaining controllers are read-only surfaces for plan / status data.
 */

function requireUserId(request: Request) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }
  return userId;
}

export async function listPlansController(_request: Request, response: Response) {
  response.json({
    plans: await listPlans(),
  });
}

export async function currentSubscriptionController(request: Request, response: Response) {
  const userId = requireUserId(request);
  const summary = await getSubscriptionSummary(userId);
  response.json(summary);
}

export async function subscriptionStatusController(request: Request, response: Response) {
  const userId = requireUserId(request);
  const status = await getSubscriptionStatus(userId);
  response.json(status);
}
