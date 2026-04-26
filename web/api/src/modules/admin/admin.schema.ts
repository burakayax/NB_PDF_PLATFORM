import { z } from "zod";

const planEnum = z.enum(["FREE", "PRO", "BUSINESS"]);
const roleEnum = z.enum(["USER", "ADMIN"]);

export const adminListUsersQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["createdAt", "email", "plan"]).default("createdAt"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  /** Boş / all = tüm planlar. */
  plan: z.enum(["FREE", "PRO", "BUSINESS", "all"]).optional().default("all"),
  /** E-posta doğrulama filtresi. */
  verified: z.enum(["all", "yes", "no"]).optional().default("all"),
});

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  firstName: z.string().max(120).optional().default(""),
  lastName: z.string().max(120).optional().default(""),
  plan: planEnum.default("FREE"),
  skipEmailVerification: z.boolean().default(true),
});

export const adminUpdateUserSchema = z.object({
  firstName: z.string().max(120).nullable().optional(),
  lastName: z.string().max(120).nullable().optional(),
  plan: planEnum.optional(),
  role: roleEnum.optional(),
  isVerified: z.boolean().optional(),
  subscriptionExpiry: z.union([z.string(), z.null()]).optional(),
});

export const adminPatchSettingsSchema = z.object({
  patches: z.record(z.unknown()),
});

export const adminUsageExportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const adminUsageSeriesQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
});

export const adminDeleteUserQuerySchema = z.object({
  blockEmail: z
    .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export const adminPaymentPricesBodySchema = z.object({
  PRO: z.string().min(1).max(32),
  BUSINESS: z.string().min(1).max(32),
});

export const adminBlockedEmailBodySchema = z.object({
  email: z.string().email(),
  reason: z.string().max(500).optional(),
});

export const adminBlockedEmailQuerySchema = z.object({
  email: z.string().email(),
});

export const adminAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(120),
});

export const adminRevisionsQuerySchema = z.object({
  scope: z.string().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(100).optional().default(40),
});

export const adminRollbackBodySchema = z.object({
  revisionId: z.string().min(1),
});

/**
 * `POST /api/admin/credits/grant` body.
 *
 * `amount` is a positive integer of credits to add (the engine rejects
 * non-integer and non-positive values defensively, we mirror that at the
 * edge so the client gets a 400 instead of a 500).
 *
 * `reason` is a short free-text justification the admin types in the UI.
 * It's persisted to `AdminAuditLog` — not to `CreditTransaction`, which
 * only carries the `admin_add` type + amount. Surfaces looking for "why
 * was this granted" join against the audit log by `transactionId`.
 */
export const adminGrantCreditsSchema = z.object({
  userId: z.string().min(1).max(200),
  amount: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(1).max(500),
});

export const adminResetBodySchema = z.object({
  scopes: z.array(z.string().min(1).max(120)).min(1).max(16),
  confirm: z.literal("RESET"),
});

const optionalUrlOrEmpty = z
  .union([z.string().url().max(2000), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" ? null : v));

export const adminAppSettingsPutSchema = z.object({
  siteName: z.string().min(1).max(200).optional(),
  logoUrl: optionalUrlOrEmpty,
  globalMaintenanceMode: z.boolean().optional(),
  seoTitle: z.union([z.string().max(500), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v)),
  seoDescription: z.union([z.string().max(2000), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v)),
  seoKeywords: z.union([z.string().max(500), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v)),
});

export const adminToolRegistryPutSchema = z
  .object({
    cost: z.number().int().min(0).max(10_000).optional(),
    isVisible: z.boolean().optional(),
    isMaintenanceMode: z.boolean().optional(),
  })
  .refine((d) => d.cost !== undefined || d.isVisible !== undefined || d.isMaintenanceMode !== undefined, {
    message: "At least one of cost, isVisible, isMaintenanceMode is required.",
  });

/**
 * Non-zero credit adjustment: positive = grant (`admin_add`), negative = take (`admin_subtract` up to balance).
 */
export const adminAdjustCreditsBodySchema = z.object({
  userId: z.string().min(1).max(200),
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0, "Amount must be non-zero.")
    .refine((n) => n >= -1_000_000 && n <= 1_000_000, "Amount out of range."),
  reason: z.string().trim().min(1).max(500),
});

export const emailAutomationBodySchema = z.object({
  lowCreditEnabled: z.boolean().optional(),
  welcomeEnabled: z.boolean().optional(),
  lowCreditThreshold: z.coerce.number().int().min(0).max(1000).optional(),
  lowCreditCooldownDays: z.coerce.number().int().min(1).max(30).optional(),
  discountCtaUrl: z.string().max(2000).optional(),
});

export const marketingBroadcastBodySchema = z.object({
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(200_000),
  batchSize: z.coerce.number().int().min(5).max(80).optional().default(40),
});

export const adminCouponCreateSchema = z.object({
  code: z.string().min(2).max(40),
  discountPercent: z.coerce.number().int().min(1).max(100),
  isActive: z.boolean().optional(),
  usageLimitPerUser: z.coerce.number().int().min(1).max(1000).optional(),
});

export const adminCouponPatchSchema = z.object({
  isActive: z.boolean().optional(),
  discountPercent: z.coerce.number().int().min(1).max(100).optional(),
  usageLimitPerUser: z.coerce.number().int().min(1).max(1000).optional(),
});
