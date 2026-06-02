import type { Request, Response } from "express";
import type { Express } from "express";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { normalizeCouponCode } from "../coupon/coupon.service.js";
import {
  adminAdjustCreditsBodySchema,
  adminAppSettingsPutSchema,
  emailAutomationBodySchema,
  marketingBroadcastBodySchema,
  adminAuditQuerySchema,
  adminBlockedEmailBodySchema,
  adminBlockedEmailQuerySchema,
  adminCreateUserSchema,
  adminCouponCreateSchema,
  adminCouponPatchSchema,
  adminDeleteUserQuerySchema,
  adminGrantCreditsSchema,
  adminListUsersQuerySchema,
  adminPatchSettingsSchema,
  adminPaymentPricesBodySchema,
  adminResetBodySchema,
  adminRevisionsQuerySchema,
  adminRollbackBodySchema,
  adminToolRegistryPutSchema,
  adminUpdateUserSchema,
  adminUsageExportQuerySchema,
  adminUsageSeriesQuerySchema,
} from "./admin.schema.js";
import {
  grantCredits,
  subtractCreditsByAdmin,
} from "../subscription/entitlement.engine.js";
import {
  adminAddBlockedEmailRaw,
  adminPutPaymentPrices,
  adminRemoveBlockedEmailRaw,
  buildUsageExportCsv,
  createUserForAdmin,
  deleteUserForAdmin,
  getAdminOverview,
  getAllSiteSettings,
  getAppSettingsForAdmin,
  getCmsContent,
  getPlansAdminPayload,
  getTOOLSAdminPayload,
  getUsageSeries,
  listToolRegistryForAdmin,
  listUsersForAdmin,
  patchSiteSettings,
  sanitizeGlobalFlagsForAdminResponse,
  putCmsContent,
  putPackagesMarketing,
  putPlansOverride,
  putTOOLSConfig,
  updateAppSettingsForAdmin,
  updateToolRegistryForAdmin,
  updateUserForAdmin,
} from "./admin.service.js";
import {
  broadcastCampaignToAllUsers,
  getMarketingAdminPayload,
  putMarketingAutomation,
} from "./marketing-admin.service.js";
import { readEmailAutomationConfig } from "../marketing/email-automation.js";
import {
  buildPublicMediaUrl,
  listMediaAssets,
  persistMediaUpload,
} from "./media.service.js";
import {
  listAdminAuditLogs,
  listSettingRevisions,
  rollbackSettingRevision,
  type AdminActor,
  logAdminAudit,
} from "./admin-audit.service.js";
import { resetAdminScopesToDefaults } from "./admin-reset.service.js";
import {
  BETA_FLAG_CATALOG,
  FEATURE_FLAG_CATALOG,
  RESETTABLE_SCOPES,
} from "./admin-system-defaults.js";
import {
  processRefund,
  REFUND_WINDOW_DAYS,
} from "../payment/payment.service.js";
import { adminRefundBodySchema } from "./admin.schema.js";

function requireUserId(request: Request): string {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }
  return userId;
}

function adminActor(request: Request): AdminActor {
  const u = request.authUser;
  if (!u?.id || !u?.email) {
    throw new HttpError(401, "Authentication is required.");
  }
  return { userId: u.id, email: u.email };
}

export async function adminOverviewController(
  _request: Request,
  response: Response,
) {
  const stats = await getAdminOverview();
  response.json(stats);
}

export async function adminListUsersController(
  request: Request,
  response: Response,
) {
  const parsed = adminListUsersQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid query.",
    );
  }
  const result = await listUsersForAdmin(parsed.data);
  response.json(result);
}

export async function adminUpdateUserController(
  request: Request,
  response: Response,
) {
  const raw = request.params.id;
  const userId = Array.isArray(raw) ? raw[0] : raw;
  if (!userId) {
    throw new HttpError(400, "User id is required.");
  }
  const parsed = adminUpdateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  const actor = adminActor(request);
  const updated = await updateUserForAdmin(userId, parsed.data, actor);
  response.json(updated);
}

export async function adminDeleteUserController(
  request: Request,
  response: Response,
) {
  const raw = request.params.id;
  const userId = Array.isArray(raw) ? raw[0] : raw;
  if (!userId) {
    throw new HttpError(400, "User id is required.");
  }
  const q = adminDeleteUserQuerySchema.safeParse(request.query);
  const blockEmail = q.success ? q.data.blockEmail : false;
  const actor = adminActor(request);
  await deleteUserForAdmin(userId, actor, blockEmail);
  response.json({ ok: true });
}

export async function adminGetUserDetailController(
  request: Request,
  response: Response,
) {
  const raw = request.params.id;
  const userId = Array.isArray(raw) ? raw[0] : raw;
  if (!userId) {
    throw new HttpError(400, "User id is required.");
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      plan: true,
      role: true,
      createdAt: true,
      toolUsageCountsJson: true,
      paymentCheckouts: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          plan: true,
          status: true,
          priceTry: true,
          paymentCurrency: true,
          createdAt: true,
          completedAt: true,
        },
      },
    },
  });
  if (!user) {
    throw new HttpError(404, "User not found.");
  }
  let toolUsageCounts: Record<string, number> = {};
  try {
    toolUsageCounts = JSON.parse(user.toolUsageCountsJson) as Record<
      string,
      number
    >;
  } catch {
    /* ignore */
  }
  response.json({ ...user, toolUsageCounts });
}

export async function adminListBlockedEmailsController(
  request: Request,
  response: Response,
) {
  const page = Math.max(1, Number.parseInt(String(request.query["page"] ?? "1"), 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(request.query["limit"] ?? "50"), 10) || 50));
  const skip = (page - 1) * limit;
  const [total, items] = await Promise.all([
    prisma.blockedEmail.count(),
    prisma.blockedEmail.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: { email: true, reason: true, createdAt: true },
    }),
  ]);
  response.json({ total, page, limit, items });
}

export async function adminAddBlockedEmailController(
  request: Request,
  response: Response,
) {
  const parsed = adminBlockedEmailBodySchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  await adminAddBlockedEmailRaw(parsed.data.email, parsed.data.reason ?? null);
  const actor = adminActor(request);
  await logAdminAudit(
    actor,
    "blocked_email.add",
    parsed.data.email,
    `E-posta engellendi: ${parsed.data.email}`,
  );
  response.status(201).json({ ok: true });
}

export async function adminRemoveBlockedEmailController(
  request: Request,
  response: Response,
) {
  const parsed = adminBlockedEmailQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(400, "Query parameter email is required.");
  }
  await adminRemoveBlockedEmailRaw(parsed.data.email);
  const actor = adminActor(request);
  await logAdminAudit(
    actor,
    "blocked_email.remove",
    parsed.data.email,
    `Engel kaldırıldı: ${parsed.data.email}`,
  );
  response.json({ ok: true });
}

export async function adminPutPaymentPricesController(
  request: Request,
  response: Response,
) {
  const parsed = adminPaymentPricesBodySchema.safeParse(
    request.body?.prices ?? request.body,
  );
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  await adminPutPaymentPrices(parsed.data, adminActor(request));
  response.json({ ok: true });
}

export async function adminCreateUserController(
  request: Request,
  response: Response,
) {
  const parsed = adminCreateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  const user = await createUserForAdmin(parsed.data);
  const actor = adminActor(request);
  await logAdminAudit(
    actor,
    "user.create",
    user.id,
    `Yeni kullanıcı: ${user.email}`,
  );
  response.status(201).json(user);
}

export async function adminGetSettingsController(
  _request: Request,
  response: Response,
) {
  const settings = await getAllSiteSettings();
  sanitizeGlobalFlagsForAdminResponse(settings);
  response.json({ settings });
}

export async function adminPatchSettingsController(
  request: Request,
  response: Response,
) {
  const parsed = adminPatchSettingsSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  await patchSiteSettings(parsed.data.patches, adminActor(request));
  response.json({ ok: true });
}

export async function adminGetCmsController(
  _request: Request,
  response: Response,
) {
  const content = await getCmsContent();
  response.json({ content });
}

export async function adminPutCmsController(
  request: Request,
  response: Response,
) {
  await putCmsContent(
    request.body?.content ?? request.body,
    adminActor(request),
  );
  response.json({ ok: true });
}

export async function adminPlansController(
  _request: Request,
  response: Response,
) {
  const payload = await getPlansAdminPayload();
  response.json(payload);
}

export async function adminPutPackagesMarketingController(
  request: Request,
  response: Response,
) {
  await putPackagesMarketing(
    request.body?.marketing ?? request.body,
    adminActor(request),
  );
  response.json({ ok: true });
}

export async function adminTOOLSController(
  _request: Request,
  response: Response,
) {
  const payload = await getTOOLSAdminPayload();
  response.json(payload);
}

export async function adminPutTOOLSController(
  request: Request,
  response: Response,
) {
  await putTOOLSConfig(
    request.body?.config ?? request.body,
    adminActor(request),
  );
  response.json({ ok: true });
}

export async function adminPutPlansOverrideController(
  request: Request,
  response: Response,
) {
  await putPlansOverride(
    request.body?.override ?? request.body,
    adminActor(request),
  );
  response.json({ ok: true });
}

export async function adminControlMetaController(
  _request: Request,
  response: Response,
) {
  response.json({
    featureFlagCatalog: FEATURE_FLAG_CATALOG,
    betaFlagCatalog: BETA_FLAG_CATALOG,
    resettableScopes: RESETTABLE_SCOPES,
  });
}

export async function adminAuditLogController(
  request: Request,
  response: Response,
) {
  const parsed = adminAuditQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid query.",
    );
  }
  const rows = await listAdminAuditLogs(parsed.data.limit);
  response.json({
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      userId: r.userId,
      userEmail: r.userEmail,
      action: r.action,
      targetKey: r.targetKey,
      summary: r.summary,
      meta: r.metaJson ? (JSON.parse(r.metaJson) as unknown) : null,
    })),
  });
}

export async function adminSettingRevisionsController(
  request: Request,
  response: Response,
) {
  const parsed = adminRevisionsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid query.",
    );
  }
  const rows = await listSettingRevisions(parsed.data.scope, parsed.data.limit);
  response.json({
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      scope: r.scope,
      userEmail: r.userEmail,
      summary: r.summary,
    })),
  });
}

export async function adminRollbackRevisionController(
  request: Request,
  response: Response,
) {
  const parsed = adminRollbackBodySchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  const result = await rollbackSettingRevision(
    parsed.data.revisionId,
    adminActor(request),
  );
  response.json(result);
}

export async function adminSystemResetController(
  request: Request,
  response: Response,
) {
  const parsed = adminResetBodySchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  const result = await resetAdminScopesToDefaults(
    parsed.data.scopes,
    adminActor(request),
  );
  response.json(result);
}

export async function adminUploadMediaController(
  request: Request,
  response: Response,
) {
  const file = (request as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    throw new HttpError(400, "No file uploaded.");
  }
  const buf = file.buffer as Buffer | undefined;
  if (!buf) {
    throw new HttpError(
      500,
      "Upload buffer missing; check multer memory storage.",
    );
  }

  // Magic byte validation — ensures actual file content matches the declared type.
  const MAGIC: Record<string, [number, Buffer][]> = {
    "image/png":      [[0, Buffer.from([0x89, 0x50, 0x4e, 0x47])]],
    "image/jpeg":     [[0, Buffer.from([0xff, 0xd8, 0xff])]],
    "image/gif":      [[0, Buffer.from("GIF87a")], [0, Buffer.from("GIF89a")]],
    "image/webp":     [[0, Buffer.from("RIFF")], [8, Buffer.from("WEBP")]],
    "application/pdf":[[0, Buffer.from("%PDF-")]],
  };
  const signatures = MAGIC[file.mimetype];
  if (!signatures) {
    throw new HttpError(415, "Unsupported file type.");
  }
  const matches = (offset: number, sig: Buffer) =>
    buf.length >= offset + sig.length && buf.slice(offset, offset + sig.length).equals(sig);

  // For WebP both signatures must match; for all others at least one must match.
  const valid =
    file.mimetype === "image/webp"
      ? matches(0, signatures[0][1]) && matches(8, signatures[1][1])
      : signatures.some(([offset, sig]) => matches(offset, sig));

  if (!valid) {
    throw new HttpError(415, "File content does not match its declared type.");
  }

  const row = await persistMediaUpload({
    buffer: buf,
    originalName: file.originalname,
    mimeType: file.mimetype,
    byteSize: file.size,
  });
  response.status(201).json({
    id: row.id,
    storageKey: row.storageKey,
    originalName: row.originalName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    createdAt: row.createdAt.toISOString(),
    url: buildPublicMediaUrl(row.storageKey),
  });
}

export async function adminListMediaController(
  _request: Request,
  response: Response,
) {
  const items = await listMediaAssets();
  response.json({
    items: items.map((a) => ({
      id: a.id,
      storageKey: a.storageKey,
      originalName: a.originalName,
      mimeType: a.mimeType,
      byteSize: a.byteSize,
      createdAt: a.createdAt.toISOString(),
      url: buildPublicMediaUrl(a.storageKey),
    })),
  });
}

export async function adminUsageSeriesController(
  request: Request,
  response: Response,
) {
  const parsed = adminUsageSeriesQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid query.",
    );
  }
  const series = await getUsageSeries(parsed.data.days);
  response.json({ series });
}

export async function adminUsageExportController(
  request: Request,
  response: Response,
) {
  const parsed = adminUsageExportQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid query.",
    );
  }
  const csv = await buildUsageExportCsv(parsed.data.from, parsed.data.to);
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="usage-${parsed.data.from}-${parsed.data.to}.csv"`,
  );
  response.send("\uFEFF" + csv);
}

/**
 * Manual admin top-up: credits are added through the entitlement engine
 * (`grantCredits` with `type: "admin_add"`) so the `CreditTransaction`
 * journal stays the single ledger. The admin's `reason` free-text is
 * persisted to `AdminAuditLog` (linked via the returned `transactionId`)
 * — not to `CreditTransaction`, which stores only structured fields.
 *
 * The `requireAdmin` middleware on the admin router enforces the ADMIN
 * role; this controller assumes it has run.
 */
export async function adminGrantCreditsController(
  request: Request,
  response: Response,
) {
  const parsed = adminGrantCreditsSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  const { userId, amount, reason } = parsed.data;
  const actor = adminActor(request);

  let result;
  try {
    result = await grantCredits(userId, amount, "admin_add");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("user not found")) {
      throw new HttpError(404, "User not found.");
    }
    throw new HttpError(400, message);
  }

  await logAdminAudit(
    actor,
    "credits.grant",
    userId,
    `Admin granted ${amount} credits (reason: ${reason})`,
    {
      amount,
      reason,
      transactionId: result.transactionId,
      creditsBefore: result.creditsBefore,
      creditsAfter: result.creditsAfter,
    },
  );

  response.status(200).json({
    ok: true,
    userId,
    amount,
    reason,
    transactionId: result.transactionId,
    creditsBefore: result.creditsBefore,
    creditsAfter: result.creditsAfter,
  });
}

export async function adminListToolRegistryController(
  _request: Request,
  response: Response,
) {
  const items = await listToolRegistryForAdmin();
  response.json({ items });
}

export async function adminPutToolRegistryController(
  request: Request,
  response: Response,
) {
  const raw = request.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) {
    throw new HttpError(400, "Tool id is required.");
  }
  const parsed = adminToolRegistryPutSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  const updated = await updateToolRegistryForAdmin(
    id,
    parsed.data,
    adminActor(request),
  );
  response.json(updated);
}

export async function adminGetAppSettingsController(
  _request: Request,
  response: Response,
) {
  const row = await getAppSettingsForAdmin();
  response.json(row);
}

export async function adminPutAppSettingsController(
  request: Request,
  response: Response,
) {
  const parsed = adminAppSettingsPutSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    throw new HttpError(400, "At least one field is required.");
  }
  const updated = await updateAppSettingsForAdmin(
    parsed.data,
    adminActor(request),
  );
  response.json(updated);
}

/**
 * Non-zero signed adjustment: positive top-up (`admin_add`), negative removal (`admin_subtract`).
 */
export async function adminAdjustCreditsController(
  request: Request,
  response: Response,
) {
  const parsed = adminAdjustCreditsBodySchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  const { userId, amount, reason } = parsed.data;
  const actor = adminActor(request);

  try {
    if (amount > 0) {
      const result = await grantCredits(userId, amount, "admin_add");
      await logAdminAudit(
        actor,
        "credits.grant",
        userId,
        `Admin adjusted +${amount} credits (reason: ${reason})`,
        {
          amount,
          reason,
          transactionId: result.transactionId,
          creditsBefore: result.creditsBefore,
          creditsAfter: result.creditsAfter,
        },
      );
      return response.status(200).json({
        ok: true,
        userId,
        amount,
        reason,
        transactionId: result.transactionId,
        creditsBefore: result.creditsBefore,
        creditsAfter: result.creditsAfter,
      });
    }
    const result = await subtractCreditsByAdmin(userId, Math.abs(amount));
    await logAdminAudit(
      actor,
      "credits.subtract",
      userId,
      `Admin adjusted ${amount} credits (reason: ${reason})`,
      {
        amount,
        reason,
        transactionId: result.transactionId || null,
        creditsBefore: result.creditsBefore,
        creditsAfter: result.creditsAfter,
      },
    );
    return response.status(200).json({
      ok: true,
      userId,
      amount,
      reason,
      transactionId: result.transactionId || null,
      creditsBefore: result.creditsBefore,
      creditsAfter: result.creditsAfter,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("user not found")) {
      throw new HttpError(404, "User not found.");
    }
    throw new HttpError(400, message);
  }
}

/**
 * POST /api/admin/payments/:conversationId/refund
 * Admin tarafından manuel iade işlemi.
 * - 7 günlük pencereyi `forceOverrideWindow: true` ile aşabilir.
 * - İade gerçekleşirse kullanıcı planı FREE'ye düşer.
 */
export async function adminIssueRefundController(
  request: Request,
  response: Response,
) {
  const { conversationId } = request.params as { conversationId: string };
  if (!conversationId?.trim()) {
    throw new HttpError(400, "conversationId is required.");
  }

  const parsed = adminRefundBodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid body.");
  }
  const { reason, forceOverrideWindow } = parsed.data;
  const actor = adminActor(request);

  // forceOverrideWindow modunda pencere kontrolü atlanır — normal modda processRefund yapar
  let result;
  if (forceOverrideWindow) {
    // Pencere kontrolü olmadan doğrudan iade et
    const { prisma } = await import("../../lib/prisma.js");
    const checkout = await prisma.paymentCheckout.findUnique({ where: { conversationId } });
    if (!checkout) {
      throw new HttpError(404, "Payment not found.");
    }
    if (checkout.status === "refunded") {
      throw new HttpError(409, "Payment already refunded.");
    }
    if (checkout.status !== "completed") {
      throw new HttpError(400, `Cannot refund a payment with status "${checkout.status}".`);
    }
    await prisma.$transaction(async (tx) => {
      await tx.paymentCheckout.update({
        where: { conversationId },
        data: { status: "refunded", refundedAt: new Date(), refundReason: `[admin-force] ${reason}`.slice(0, 500) },
      });
      await tx.user.update({ where: { id: checkout.userId }, data: { plan: "FREE" } });
      if (checkout.organizationId) {
        await tx.organization.update({
          where: { id: checkout.organizationId },
          data: { plan: "FREE", subscriptionStatus: "canceled", subscriptionExpiry: null },
        });
      }
    });
    result = { ok: true as const, conversationId, userId: checkout.userId, planBefore: checkout.plan };
  } else {
    result = await processRefund(conversationId, `admin: ${reason}`);
  }

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      not_found: 404,
      already_refunded: 409,
      window_expired: 422,
      not_completed: 400,
    };
    const reasonMsg: Record<string, string> = {
      not_found: "Payment record not found.",
      already_refunded: "This payment has already been refunded.",
      window_expired: `Refund window of ${REFUND_WINDOW_DAYS} days has expired. Use forceOverrideWindow: true to override.`,
      not_completed: "Cannot refund a payment that has not been completed.",
    };
    throw new HttpError(statusMap[result.reason] ?? 400, reasonMsg[result.reason] ?? "Refund failed.");
  }

  await logAdminAudit(
    actor,
    "payment.refund",
    conversationId,
    `Admin issued refund for conversationId=${conversationId}, planBefore=${result.planBefore}, reason: ${reason}${forceOverrideWindow ? " [window-override]" : ""}`,
    { conversationId, userId: result.userId, planBefore: result.planBefore, reason, forceOverrideWindow },
  );

  response.status(200).json({
    ok: true,
    conversationId,
    userId: result.userId,
    planBefore: result.planBefore,
    planAfter: "FREE",
    refundedAt: new Date().toISOString(),
  });
}

export async function adminGetMarketingController(
  _request: Request,
  response: Response,
) {
  const payload = await getMarketingAdminPayload();
  response.json(payload);
}

export async function adminPutMarketingAutomationController(
  request: Request,
  response: Response,
) {
  const parsed = emailAutomationBodySchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  const current = await readEmailAutomationConfig();
  const next = { ...current, ...parsed.data };
  await putMarketingAutomation(next, adminActor(request));
  response.json({ ok: true, automation: next });
}

export async function adminPostMarketingBroadcastController(
  request: Request,
  response: Response,
) {
  const parsed = marketingBroadcastBodySchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  const { subject, html, batchSize } = parsed.data;
  const result = await broadcastCampaignToAllUsers(
    subject,
    html,
    batchSize,
    adminActor(request),
  );
  response.json({ ok: true, ...result });
}

export async function adminListCouponsController(
  request: Request,
  response: Response,
) {
  const page = Math.max(1, Number.parseInt(String(request.query["page"] ?? "1"), 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(request.query["limit"] ?? "50"), 10) || 50));
  const skip = (page - 1) * limit;
  const [total, items] = await Promise.all([
    prisma.coupon.count(),
    prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { _count: { select: { uses: true } } },
    }),
  ]);
  response.json({
    total,
    page,
    limit,
    items: items.map((c) => ({
      id: c.id,
      code: c.code,
      discountPercent: c.discountPercent,
      isActive: c.isActive,
      usageLimitPerUser: c.usageLimitPerUser,
      totalUses: c._count.uses,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function adminCreateCouponController(
  request: Request,
  response: Response,
) {
  const parsed = adminCouponCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  const code = normalizeCouponCode(parsed.data.code);
  try {
    const created = await prisma.coupon.create({
      data: {
        code,
        discountPercent: parsed.data.discountPercent,
        isActive: parsed.data.isActive ?? true,
        usageLimitPerUser: parsed.data.usageLimitPerUser ?? 1,
      },
    });
    response.status(201).json({
      id: created.id,
      code: created.code,
      discountPercent: created.discountPercent,
      isActive: created.isActive,
      usageLimitPerUser: created.usageLimitPerUser,
      totalUses: 0,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new HttpError(409, "A coupon with this code already exists.");
    }
    throw e;
  }
}

export async function adminPatchCouponController(
  request: Request,
  response: Response,
) {
  const paramId = request.params["id"];
  const id = typeof paramId === "string" ? paramId : "";
  if (!id) {
    throw new HttpError(400, "Missing coupon id.");
  }
  const parsed = adminCouponPatchSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid body.",
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    throw new HttpError(400, "No fields to update.");
  }
  const updated = await prisma.coupon.update({
    where: { id },
    data: parsed.data,
  });
  const totalUses = await prisma.couponUse.count({ where: { couponId: id } });
  response.json({
    id: updated.id,
    code: updated.code,
    discountPercent: updated.discountPercent,
    isActive: updated.isActive,
    usageLimitPerUser: updated.usageLimitPerUser,
    totalUses,
    createdAt: updated.createdAt.toISOString(),
  });
}

/** Son 1 yıllık indirme denemeleri; yönetim listesi. */
export async function adminListDownloadLogsController(
  request: Request,
  response: Response,
) {
  const page = Math.max(1, Number.parseInt(String(request.query["page"] ?? "1"), 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(request.query["limit"] ?? "50"), 10) || 50));
  const skip = (page - 1) * limit;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const where = { createdAt: { gte: oneYearAgo } };
  const [total, rows] = await Promise.all([
    prisma.downloadLog.count({ where }),
    prisma.downloadLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { user: { select: { email: true } } },
    }),
  ]);
  response.json({
    total,
    page,
    limit,
    items: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.user.email,
      resultId: r.resultId,
      toolId: r.toolId,
      clientIp: r.clientIp,
      userAgent: r.userAgent,
      status: r.status,
      ackedAt: r.ackedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function adminDownloadLogProofController(
  request: Request,
  response: Response,
) {
  const id =
    typeof request.params["id"] === "string" ? request.params["id"] : "";
  if (!id) {
    throw new HttpError(400, "Missing id.");
  }
  const row = await prisma.downloadLog.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });
  if (!row) {
    throw new HttpError(404, "Not found.");
  }
  const text =
    `PDF PLATFORM — Download technical record\n` +
    `Record ID: ${row.id}\n` +
    `Created (UTC): ${row.createdAt.toISOString()}\n` +
    `User ID: ${row.userId}\n` +
    `User email: ${row.user.email}\n` +
    `Tool: ${row.toolId}\n` +
    `Result ID: ${row.resultId ?? "(none)"}\n` +
    `Client IP (request time): ${row.clientIp ?? "(unknown)"}\n` +
    `User-Agent: ${row.userAgent ?? "(unknown)"}\n` +
    `Status: ${row.status}\n` +
    `Acknowledged (UTC): ${row.ackedAt?.toISOString() ?? "(pending)"}\n` +
    `\n` +
    `This document is generated for dispute resolution. ` +
    `SUCCESS means the client sent an ACK after the file stream completed in the browser.\n`;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="download-proof-${row.id}.txt"`,
  );
  response.send(text);
}
