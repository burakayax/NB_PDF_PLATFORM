import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { canExecuteTool, consumeTool } from "../subscription/entitlement.engine.js";
import { downloadLogCreateSchema, entitlementBodySchema } from "./entitlement.schema.js";

function clientIpFromRequest(request: Request): string | null {
  const xff = request.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0]?.trim() ?? null;
  }
  const raw = request.ip || request.socket?.remoteAddress;
  return typeof raw === "string" ? raw : null;
}

/**
 * `POST /check` and `POST /consume` wrap `entitlement.engine`. `GET /balance`
 * and `GET /transactions` are read-only Prisma queries (no engine).
 *
 * Contract (check/consume):
 *   - Authentication is enforced by `requireJwtUnlessPublic`; `request.authUser`
 *     is the only accepted identity. The body NEVER carries a userId.
 *   - Both endpoints return HTTP 200 with the engine's raw decision. Denial
 *     is represented by `allowed: false` in the JSON, not by a 4xx. The
 *     caller is responsible for mapping denial to an HTTP status
 *     (typically 402) at its own boundary.
 *   - Unknown tools, missing users, and race-loss are all represented as
 *     `allowed: false` with a specific `reason` — never a 5xx.
 *
 * Exposing denial as 200+body (rather than 402) keeps the semantics of this
 * module "query the engine" rather than "enforce a gate". Gating belongs in
 * the tool endpoint.
 */

export async function entitlementCheckController(
  request: Request,
  response: Response,
) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }

  const { toolId } = entitlementBodySchema.parse(request.body);
  const decision = await canExecuteTool(userId, toolId);
  response.status(200).json(decision);
}

export async function entitlementConsumeController(
  request: Request,
  response: Response,
) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }

  const { toolId } = entitlementBodySchema.parse(request.body);
  const result = await consumeTool(userId, toolId);
  response.status(200).json(result);
}

/**
 * GET /api/entitlement/balance
 *
 * Read-only snapshot from Prisma (no entitlement.engine). Auth required.
 */
export async function entitlementBalanceController(
  request: Request,
  response: Response,
) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      credit_balance: true,
      plan: true,
      subscription_status: true,
    },
  });

  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  response.status(200).json({
    credit_balance: user.credit_balance,
    plan: user.plan,
    subscription_status: user.subscription_status,
  });
}

/**
 * GET /api/entitlement/transactions?limit=10
 *
 * Last N `CreditTransaction` rows for the caller, newest first. Read-only
 * Prisma query; `limit` is clamped to [1, 100].
 */
export async function entitlementTransactionsController(
  request: Request,
  response: Response,
) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }

  const rawLimit = request.query.limit;
  const parsedLimit =
    typeof rawLimit === "string" ? Number.parseInt(rawLimit, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 10;
  const take = Math.min(Math.max(1, limit), 100);

  const rows = await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      amount: true,
      toolId: true,
      createdAt: true,
    },
  });

  response.status(200).json(
    rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      toolId: row.toolId,
      createdAt: row.createdAt.toISOString(),
    })),
  );
}

/**
 * POST /api/entitlement/download-log — create a pending row before streaming download; IP/UA captured server-side.
 */
export async function downloadLogCreateController(request: Request, response: Response) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }
  const body = downloadLogCreateSchema.parse(request.body);
  const ua = request.headers["user-agent"];
  const row = await prisma.downloadLog.create({
    data: {
      userId,
      resultId: body.resultId ?? null,
      toolId: body.toolId,
      clientIp: clientIpFromRequest(request),
      userAgent: typeof ua === "string" ? ua.slice(0, 1024) : null,
    },
  });
  response.status(201).json({ id: row.id, status: row.status });
}

/**
 * POST /api/entitlement/download-log/:id/ack — browser-side download completed; marks SUCCESS.
 */
export async function downloadLogAckController(request: Request, response: Response) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }
  const idParse = z.string().cuid().safeParse(request.params["id"]);
  if (!idParse.success) {
    throw new HttpError(400, "Invalid log id.");
  }
  const found = await prisma.downloadLog.findFirst({
    where: { id: idParse.data, userId },
  });
  if (!found) {
    throw new HttpError(404, "Log not found.");
  }
  if (found.status === "SUCCESS") {
    response.status(200).json({ ok: true, already: true });
    return;
  }
  await prisma.downloadLog.update({
    where: { id: idParse.data },
    data: { status: "SUCCESS", ackedAt: new Date() },
  });
  response.status(200).json({ ok: true });
}
