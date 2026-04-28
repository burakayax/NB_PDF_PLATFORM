import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { getClientIp } from "../../middleware/api-security.middleware.js";
import { initializeTierCheckout } from "./payment.service.js";
import { getPublicTierPricingRows } from "./payment-pricing-tiers.js";
import { isCheckoutCurrency, type CheckoutCurrency } from "./pricing-matrix.js";

const tierBodySchema = z.object({
  tier: z.enum(["starter", "professional", "unlimited_pro"]),
  currency: z.enum(["TRY", "USD", "EUR"]).optional(),
});

export async function initializePaymentsController(request: Request, response: Response): Promise<void> {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }
  const parsed = tierBodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request body.");
  }

  const currency = parsed.data.currency ?? "TRY";
  const session = await initializeTierCheckout({
    userId,
    tier: parsed.data.tier,
    clientIp: getClientIp(request),
    currency,
  });

  response.status(200).json(session);
}

export async function getPaymentsPricingPublicController(request: Request, response: Response): Promise<void> {
  const raw = request.query.currency;
  let c: CheckoutCurrency = "TRY";
  if (typeof raw === "string" && isCheckoutCurrency(raw)) {
    c = raw;
  }
  response.status(200).json({
    currency: c,
    tiers: getPublicTierPricingRows(c),
  });
}
