import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { checkQuota } from "../../lib/quota.js";

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

export async function checkAccess(userId: string, toolId = "_generic"): Promise<CheckAccessResult> {
  const result = await checkQuota(userId, toolId, 1, 0);
  if (result.allowed) {
    return { allowed: true, reason: "active_subscription" };
  }
  return { allowed: false, reason: "payment_required" };
}

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
    (request as Request & { accessDecision?: CheckAccessResult }).accessDecision = result;
    next();
  } catch (error) {
    next(error);
  }
}
