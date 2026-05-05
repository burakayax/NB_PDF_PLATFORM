import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import {
  checkQuota,
  incrementQuota,
  getQuotaSummary,
} from "../../lib/quota.js";
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
 * POST /api/entitlement/check
 *
 * Quota-based check (no credit deduction). Returns { allowed, reason, ... }.
 * Compatible with Python backend's entitlement_check() call.
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
  const result = await checkQuota(userId, toolId, 1, 0);

  response.status(200).json({
    allowed: result.allowed,
    reason: result.reason ?? (result.allowed ? "quota_available" : "quota_exceeded"),
    cost: 0,
    creditsBefore: 0,
    creditsAfter: 0,
    dailyUsed: result.dailyUsed,
    dailyLimit: result.dailyLimit,
    monthlyUsed: result.monthlyUsed,
    monthlyLimit: result.monthlyLimit,
    resetAt: result.resetAt?.toISOString() ?? null,
  });
}

/**
 * POST /api/entitlement/consume
 *
 * Records the operation in OperationLog and increments quota counters.
 */
export async function entitlementConsumeController(
  request: Request,
  response: Response,
) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }

  const { toolId } = entitlementBodySchema.parse(request.body);
  const fileCount = typeof request.body.fileCount === "number" ? request.body.fileCount : 1;
  const totalSizeMB = typeof request.body.totalSizeMB === "number" ? request.body.totalSizeMB : 0;
  const processingTimeMs = typeof request.body.processingTimeMs === "number"
    ? request.body.processingTimeMs
    : undefined;

  // Re-check quota before incrementing (race condition guard)
  const quotaCheck = await checkQuota(userId, toolId, fileCount, totalSizeMB);
  if (!quotaCheck.allowed) {
    response.status(200).json({
      status: "denied",
      allowed: false,
      reason: quotaCheck.reason,
      transactionId: null,
      cost: 0,
      creditsBefore: 0,
      creditsAfter: 0,
    });
    return;
  }

  await incrementQuota(userId, toolId, fileCount, totalSizeMB, processingTimeMs);

  const summary = await getQuotaSummary(userId);

  response.status(200).json({
    status: "ok",
    allowed: true,
    reason: "quota_available",
    transactionId: null,
    cost: 0,
    creditsBefore: 0,
    creditsAfter: 0,
    dailyUsed: summary?.daily.used,
    dailyLimit: summary?.daily.limit,
    monthlyUsed: summary?.monthly.used,
    monthlyLimit: summary?.monthly.limit,
  });
}

/**
 * GET /api/entitlement/balance
 *
 * Returns quota summary (replaces old credit balance endpoint).
 */
export async function entitlementBalanceController(
  request: Request,
  response: Response,
) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }

  const summary = await getQuotaSummary(userId);
  if (!summary) {
    throw new HttpError(404, "User or organization not found.");
  }

  response.status(200).json({
    plan: summary.plan,
    daily: summary.daily,
    monthly: summary.monthly,
    watermarkEnabled: summary.watermarkEnabled,
    batchLimit: summary.batchLimit,
    fileSizeLimitMB: summary.fileSizeLimitMB,
  });
}

/**
 * GET /api/entitlement/transactions → operation log (replaces credit transactions)
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  const rows = await prisma.operationLog.findMany({
    where: { userId, organizationId: user?.organizationId ?? "" },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      toolType: true,
      fileCount: true,
      totalFileSizeMB: true,
      status: true,
      createdAt: true,
    },
  });

  response.status(200).json(
    rows.map((r: { id: string; toolType: string; fileCount: number; totalFileSizeMB: number; status: string; createdAt: Date }) => ({
      id: r.id,
      toolType: r.toolType,
      fileCount: r.fileCount,
      totalFileSizeMB: r.totalFileSizeMB,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}

/** POST /api/entitlement/download-log */
export async function downloadLogCreateController(
  request: Request,
  response: Response,
) {
  const userId = request.authUser?.id;
  if (!userId) throw new HttpError(401, "Authentication is required.");
  const body = downloadLogCreateSchema.parse(request.body);
  const ua = request.headers["user-agent"];
  const row = await prisma.downloadLog.create({
    data: {
      userId,
      resultId: body.resultId,
      toolId: body.toolId,
      clientIp: clientIpFromRequest(request),
      userAgent: typeof ua === "string" ? ua.slice(0, 1024) : null,
    },
  });
  response.status(201).json({ id: row.id, status: row.status });
}

/** POST /api/entitlement/download-log/:id/ack */
export async function downloadLogAckController(
  request: Request,
  response: Response,
) {
  const userId = request.authUser?.id;
  if (!userId) throw new HttpError(401, "Authentication is required.");
  const idParse = z.string().cuid().safeParse(request.params["id"]);
  if (!idParse.success) throw new HttpError(400, "Invalid log id.");
  const found = await prisma.downloadLog.findFirst({
    where: { id: idParse.data, userId },
  });
  if (!found) throw new HttpError(404, "Log not found.");
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
