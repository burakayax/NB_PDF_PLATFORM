import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { getClientIp } from "../../middleware/api-security.middleware.js";
import { createPaymentCheckoutSession } from "./payment.service.js";
import { getPublicTierPricingRows } from "./payment-pricing-tiers.js";
import { isCheckoutCurrency, type CheckoutCurrency } from "./pricing-matrix.js";

const planPaymentBodySchema = z.object({
  planId: z.enum(["PLUS", "PRO", "BUSINESS"]),
  currency: z.enum(["TRY", "USD"]).optional().default("TRY"),
});

/** TRY prices matching planConfig.ts */
const PLAN_PRICES_TRY: Record<"PLUS" | "PRO" | "BUSINESS", string> = {
  PLUS: "220.00",
  PRO: "1900.00",
  BUSINESS: "650.00",
};

/** USD prices (as dollars, 2 decimal): planConfig values in cents / 100 */
const PLAN_PRICES_USD: Record<"PLUS" | "PRO" | "BUSINESS", string> = {
  PLUS: "6.99",
  PRO: "59.00",
  BUSINESS: "20.00",
};

const BASKET_NAMES_TR: Record<"PLUS" | "PRO" | "BUSINESS", string> = {
  PLUS: "PDF PLATFORM Plus (1 ay)",
  PRO: "PDF PLATFORM Pro (1 yıl)",
  BUSINESS: "PDF PLATFORM Business (1 ay)",
};

export async function initializePaymentsController(request: Request, response: Response): Promise<void> {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }

  const parsed = planPaymentBodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request body.");
  }

  const { planId, currency } = parsed.data;
  const checkoutCurrency = currency as CheckoutCurrency;

  const priceTryOverride =
    checkoutCurrency === "USD"
      ? PLAN_PRICES_USD[planId]
      : PLAN_PRICES_TRY[planId];

  const billing = planId === "PRO" ? "annual" : "monthly";
  const subscriptionDaysOverride = planId === "PRO" ? 365 : 30;

  const session = await createPaymentCheckoutSession({
    userId,
    plan: planId,
    billing,
    clientIp: getClientIp(request),
    priceTryOverride,
    checkoutCurrency,
    subscriptionDaysOverride,
    basketItemName: BASKET_NAMES_TR[planId],
  });

  response.status(200).json({
    mode: "iyzico",
    token: session.token,
    checkoutFormContent: session.checkoutFormContent,
    paymentPageUrl: session.paymentPageUrl,
    conversationId: session.conversationId,
  });
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
