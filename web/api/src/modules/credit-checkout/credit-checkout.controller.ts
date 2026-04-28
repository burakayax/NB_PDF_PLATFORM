import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { getClientIp } from "../../middleware/api-security.middleware.js";
import {
  previewCreditPackCheckout,
  startCreditPackCheckoutFromToken,
  validateCreditCouponCode,
} from "./credit-checkout.service.js";

const previewBodySchema = z.object({
  product: z.string().min(1),
  couponCode: z.string().optional().nullable(),
  applyExitIntent: z.boolean().optional(),
  currency: z.enum(["TRY", "USD", "EUR"]).optional(),
});

const startBodySchema = z.object({
  pricingToken: z.string().min(10),
});

const validateCouponBodySchema = z.object({
  code: z.string().min(1),
});

export async function creditCheckoutPreviewController(request: Request, response: Response): Promise<void> {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }
  const parsed = previewBodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid body.");
  }
  const result = await previewCreditPackCheckout({
    userId,
    product: parsed.data.product,
    couponCode: parsed.data.couponCode,
    applyExitIntent: parsed.data.applyExitIntent,
    currency: parsed.data.currency,
  });
  response.status(200).json(result);
}

export async function creditCheckoutStartController(request: Request, response: Response): Promise<void> {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }
  const parsed = startBodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid body.");
  }
  const result = await startCreditPackCheckoutFromToken({
    userId,
    clientIp: getClientIp(request),
    pricingToken: parsed.data.pricingToken,
  });
  response.status(200).json(result);
}

export async function creditCheckoutValidateCouponController(request: Request, response: Response): Promise<void> {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }
  const parsed = validateCouponBodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid body.");
  }
  const result = await validateCreditCouponCode({ userId, code: parsed.data.code });
  response.status(200).json(result);
}
