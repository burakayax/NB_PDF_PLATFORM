import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { getClientIp } from "../../middleware/api-security.middleware.js";
import { createPaymentCheckoutSession } from "./payment.service.js";
import { getPublicTierPricingRows } from "./payment-pricing-tiers.js";
import { isCheckoutCurrency, type CheckoutCurrency } from "./pricing-matrix.js";

const planPaymentBodySchema = z.object({
  planId: z.enum(["STARTER", "PLUS", "PRO", "BUSINESS"]),
  currency: z.enum(["TRY", "USD"]).optional().default("TRY"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional().default("MONTHLY"),
});

/** TRY prices in cents */
const PLAN_PRICES_TRY: Record<"STARTER" | "PLUS" | "PRO" | "BUSINESS", { monthly: string; yearly: string }> = {
  STARTER: { monthly: "4900", yearly: "49000" },
  PLUS: { monthly: "14900", yearly: "149000" },
  PRO: { monthly: "29900", yearly: "299000" },
  BUSINESS: { monthly: "79900", yearly: "799000" },
};

/** USD prices in cents */
const PLAN_PRICES_USD: Record<"STARTER" | "PLUS" | "PRO" | "BUSINESS", { monthly: string; yearly: string }> = {
  STARTER: { monthly: "1599", yearly: "15900" },
  PLUS: { monthly: "4799", yearly: "47990" },
  PRO: { monthly: "9799", yearly: "97990" },
  BUSINESS: { monthly: "25000", yearly: "250000" },
};

const BASKET_NAMES_TR: Record<"STARTER" | "PLUS" | "PRO" | "BUSINESS", string> = {
  STARTER: "PDF PLATFORM Başlangıç",
  PLUS: "PDF PLATFORM Plus",
  PRO: "PDF PLATFORM Pro",
  BUSINESS: "PDF PLATFORM Business",
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

  const { planId, currency, billingCycle } = parsed.data;
  const checkoutCurrency = currency as CheckoutCurrency;

  const isYearly = billingCycle === "YEARLY";
  const priceObj = checkoutCurrency === "USD" ? PLAN_PRICES_USD[planId] : PLAN_PRICES_TRY[planId];
  const priceTryOverride = isYearly ? priceObj.yearly : priceObj.monthly;
  const billing = isYearly ? "annual" : "monthly";
  const subscriptionDaysOverride = isYearly ? 365 : 30;

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
