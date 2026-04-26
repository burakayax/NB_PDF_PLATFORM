import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { canExecuteTool } from "../subscription/entitlement.engine.js";
import { entitlementBodySchema } from "../entitlement/entitlement.schema.js";

/**
 * POST /api/access/check
 *
 * Deprecated alias for the entitlement pre-check. Prefer
 * `POST /api/entitlement/check` with `toolId`. Responds 200 with the same
 * shape as the entitlement engine (no 402) — the PDF worker no longer
 * calls this path for download; ``entitlement_consume`` runs at download
 * time instead.
 */
export async function checkAccessController(request: Request, response: Response) {
  if (!request.authUser) {
    throw new HttpError(401, "Authentication is required.");
  }

  const { toolId } = entitlementBodySchema.parse(request.body);
  const result = await canExecuteTool(request.authUser.id, toolId);
  response.status(200).json(result);
}
