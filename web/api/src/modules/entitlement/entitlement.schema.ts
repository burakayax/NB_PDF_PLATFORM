import { z } from "zod";

/**
 * Shared body schema for both entitlement endpoints. The caller identifies
 * themselves via the Authorization Bearer token — we never accept a `userId`
 * from the request body. That removes an entire class of abuse ("consume for
 * another user") while keeping the wire format minimal.
 */
export const entitlementBodySchema = z.object({
  toolId: z
    .string()
    .min(1, "toolId is required")
    .max(64, "toolId is too long"),
});

export type EntitlementBody = z.infer<typeof entitlementBodySchema>;

export const downloadLogCreateSchema = z.object({
  resultId: z.union([z.string().min(1).max(128), z.null()]).optional(),
  toolId: z.string().min(1).max(64),
});
