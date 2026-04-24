import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { checkAccess } from "./check-access.js";

/**
 * POST /api/access/check
 *
 * Thin JSON wrapper around `checkAccess(userId)` so the Python FastAPI
 * (which owns the result store + download stream) can delegate the cost
 * decision to Node without duplicating credit-balance logic.
 *
 * Semantics match `requireActiveAccess`:
 *   - 200 { allowed: true, reason, creditsAfter? } when access is granted
 *   - 402 { error: "payment_required" } otherwise
 *
 * JWT is enforced globally by `requireJwtUnlessPublic` — this path is not
 * in the public list.
 */
export async function checkAccessController(request: Request, response: Response) {
  if (!request.authUser) {
    throw new HttpError(401, "Authentication is required.");
  }

  const result = await checkAccess(request.authUser.id);

  if (!result.allowed) {
    response.status(402).json({ error: "payment_required" });
    return;
  }

  response.status(200).json({
    allowed: true,
    reason: result.reason,
    creditsAfter: result.creditsAfter,
  });
}
