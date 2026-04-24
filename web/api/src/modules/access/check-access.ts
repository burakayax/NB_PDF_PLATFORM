import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Access gate for paid tool runs.
 *
 * Scaffold only — this module is intentionally NOT mounted on any route yet.
 * The payment layer is frozen; once unfrozen, mount `requireActiveAccess`
 * in front of the relevant tool routes.
 */

export type CheckAccessDenyReason = "payment_required";

export type CheckAccessAllowReason =
  | "admin"
  | "active_subscription"
  | "credit_deducted";

export type CheckAccessResult =
  | {
      allowed: true;
      reason: CheckAccessAllowReason;
      creditsAfter?: number;
    }
  | {
      allowed: false;
      reason: CheckAccessDenyReason;
    };

/**
 * Decide whether `userId` is allowed to perform a paid action right now.
 *
 * ⚠ WARNING: This function must NOT be used in preview flows.
 * It has side effects — calling it can decrement the user's credit balance —
 * and is intended only for finalized download endpoints in later phases.
 * Previews (thumbnails, metadata, UI affordances) must remain cost-free.
 *
 * Decision order:
 *   1. ADMIN role → always allowed.
 *   2. Non-FREE plan with an unexpired subscription whose status is not
 *      "canceled" → allowed (active subscription).
 *   3. Atomic credit decrement — if the user has >0 credits, we take one
 *      via a conditional `updateMany` and return `credit_deducted`. The
 *      single-statement WHERE + decrement is race-safe on SQLite and
 *      portable to Postgres.
 *   4. Otherwise → denied with reason `payment_required`.
 */
export async function checkAccess(userId: string): Promise<CheckAccessResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      plan: true,
      subscriptionExpiry: true,
      subscription_status: true,
    },
  });

  if (!user) {
    return { allowed: false, reason: "payment_required" };
  }

  if (user.role === "ADMIN") {
    return { allowed: true, reason: "admin" };
  }

  const now = new Date();
  const hasActiveSubscription =
    user.plan !== "FREE" &&
    user.subscriptionExpiry !== null &&
    user.subscriptionExpiry > now &&
    user.subscription_status !== "canceled";

  if (hasActiveSubscription) {
    return { allowed: true, reason: "active_subscription" };
  }

  const decremented = await prisma.user.updateMany({
    where: { id: userId, credit_balance: { gt: 0 } },
    data: { credit_balance: { decrement: 1 } },
  });

  if (decremented.count === 1) {
    const after = await prisma.user.findUnique({
      where: { id: userId },
      select: { credit_balance: true },
    });
    return {
      allowed: true,
      reason: "credit_deducted",
      creditsAfter: after?.credit_balance,
    };
  }

  return { allowed: false, reason: "payment_required" };
}

/**
 * Express middleware form of `checkAccess`. On deny, throws an `HttpError(402)`
 * with a `code: "payment_required"` property so the error handler can render
 * a structured payload.
 *
 * NOT mounted on any router in this scaffold phase.
 */
export async function requireActiveAccess(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  const userId = request.authUser?.id;
  if (!userId) {
    const err = new HttpError(401, "Authentication is required.");
    (err as Error & { code?: string }).code = "unauthenticated";
    next(err);
    return;
  }

  try {
    const result = await checkAccess(userId);
    if (!result.allowed) {
      const err = new HttpError(402, "Payment required");
      (err as Error & { code?: string }).code = result.reason;
      next(err);
      return;
    }
    (request as Request & { accessDecision?: CheckAccessResult }).accessDecision =
      result;
    next();
  } catch (error) {
    next(error);
  }
}
