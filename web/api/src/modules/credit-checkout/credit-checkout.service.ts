import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { createCreditPackIyzicoSession } from "../payment/payment.service.js";
import {
  formatMoney2,
  getTierOneTimePrice,
  isCheckoutCurrency,
  type CheckoutCurrency,
} from "../payment/pricing-matrix.js";
import { createPricedCreditPackFakeSession } from "../fake-payment/fake-payment.service.js";
import { validateCouponForUser } from "../coupon/coupon.service.js";
import {
  CREDIT_PACK_CATALOG,
  EXIT_INTENT_COOLDOWN_DAYS,
  EXIT_INTENT_EXTRA_PERCENT,
  formatTry2,
  isCreditPackSku,
  type CreditPackSku,
} from "./credit-pack-pricing.js";
import { signCreditPricingToken, verifyCreditPricingToken, type CreditPricingPayload } from "./pricing-token.js";

function msDays(d: number): number {
  return d * 24 * 60 * 60 * 1000;
}

function isExitIntentEligible(lastAt: Date | null | undefined): boolean {
  if (!lastAt) {
    return true;
  }
  return Date.now() - lastAt.getTime() >= msDays(EXIT_INTENT_COOLDOWN_DAYS);
}

function computeLinePrices(params: {
  baseAmount: number;
  discountPercent: number | null;
  applyExitIntent: boolean;
  exitIntentEligible: boolean;
}): { finalAmount: number; exitApplied: boolean } {
  let p = params.baseAmount;
  if (params.discountPercent != null && params.discountPercent > 0) {
    p = Math.round(p * (1 - params.discountPercent / 100) * 100) / 100;
  }
  let exitApplied = false;
  if (params.applyExitIntent && params.exitIntentEligible) {
    p = Math.round(p * (1 - EXIT_INTENT_EXTRA_PERCENT / 100) * 100) / 100;
    exitApplied = true;
  }
  return { finalAmount: Math.max(p, 0.01), exitApplied };
}

function catalogBaseMoney(product: CreditPackSku, currency: CheckoutCurrency): number {
  if (product === "TIER_STARTER" || product === "TIER_PROFESSIONAL") {
    return getTierOneTimePrice(product, currency);
  }
  if (currency !== "TRY") {
    throw new HttpError(400, "Small credit packs are only sold in TRY.");
  }
  return CREDIT_PACK_CATALOG[product].amountTry;
}

function checkoutCurrencyForProduct(product: CreditPackSku, requested: unknown): CheckoutCurrency {
  const tier = product === "TIER_STARTER" || product === "TIER_PROFESSIONAL";
  if (!tier) {
    return "TRY";
  }
  if (requested === undefined || requested === null) {
    return "TRY";
  }
  if (typeof requested === "string" && isCheckoutCurrency(requested)) {
    return requested;
  }
  throw new HttpError(400, "Invalid currency.");
}

export type CreditPreviewResult = {
  product: CreditPackSku;
  currency: CheckoutCurrency;
  /** List price (same currency). */
  baseAmount: string;
  /** Payable amount after coupon / exit intent (same currency). */
  finalAmount: string;
  credits: number;
  couponId: string | null;
  exitIntentApplied: boolean;
  exitOfferEligible: boolean;
  discountPercent: number | null;
  pricingToken: string;
};

export async function previewCreditPackCheckout(params: {
  userId: string;
  product: string;
  couponCode?: string | null;
  applyExitIntent?: boolean;
  /** Required for TIER_* packs; ignored (TRY) for legacy credit SKUs. */
  currency?: string;
}): Promise<CreditPreviewResult> {
  if (!isCreditPackSku(params.product)) {
    throw new HttpError(400, "Invalid credit pack product.");
  }
  const product = params.product;
  const row = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { lastExitIntentCreditDiscountAt: true },
  });
  if (!row) {
    throw new HttpError(404, "User not found.");
  }

  const credits = CREDIT_PACK_CATALOG[product].credits;
  const currency = checkoutCurrencyForProduct(product, params.currency);

  const baseMoney = catalogBaseMoney(product, currency);
  const baseStr = formatMoney2(currency, baseMoney);

  let couponId: string | null = null;
  let discountPercent: number | null = null;
  if (params.couponCode?.trim()) {
    const v = await validateCouponForUser(params.couponCode, params.userId);
    if (!v.ok) {
      throw new HttpError(
        400,
        v.reason === "limit" ? "This promo code has reached your usage limit." : "Invalid or inactive promo code.",
      );
    }
    couponId = v.coupon.id;
    discountPercent = v.coupon.discountPercent;
  }

  const exitOfferEligible = isExitIntentEligible(row.lastExitIntentCreditDiscountAt);
  const { finalAmount, exitApplied } = computeLinePrices({
    baseAmount: baseMoney,
    discountPercent,
    applyExitIntent: Boolean(params.applyExitIntent),
    exitIntentEligible: exitOfferEligible,
  });
  const finalStr = currency === "TRY" ? formatTry2(finalAmount) : formatMoney2(currency, finalAmount);

  const tokenPayload: CreditPricingPayload = {
    v: 2,
    sub: params.userId,
    currency,
    product,
    basePrice: baseStr,
    finalPrice: finalStr,
    credits,
    couponId,
    exitIntent: exitApplied,
  };
  return {
    product,
    currency,
    baseAmount: baseStr,
    finalAmount: finalStr,
    credits,
    couponId,
    exitIntentApplied: exitApplied,
    exitOfferEligible,
    discountPercent,
    pricingToken: signCreditPricingToken(tokenPayload),
  };
}

export type CreditStartResult =
  | {
      mode: "fake";
      sessionId: string;
      amount: number;
      credits: number;
      redirectUrl: string;
    }
  | {
      mode: "iyzico";
      token: string;
      checkoutFormContent: string;
      paymentPageUrl?: string;
      conversationId: string;
    };

export async function startCreditPackCheckoutFromToken(params: {
  userId: string;
  clientIp: string;
  pricingToken: string;
}): Promise<CreditStartResult> {
  const p = verifyCreditPricingToken(params.pricingToken, params.userId);

  if (!env.creditCheckoutUseFake) {
    return createCreditPackIyzicoSession({
      userId: params.userId,
      payload: p,
      clientIp: params.clientIp,
    });
  }

  const fake = createPricedCreditPackFakeSession({
    userId: params.userId,
    payload: p,
  });
  return { mode: "fake", ...fake };
}

export async function validateCreditCouponCode(params: { userId: string; code: string }): Promise<{
  valid: boolean;
  discountPercent?: number;
  message?: string;
}> {
  const v = await validateCouponForUser(params.code, params.userId);
  if (v.ok) {
    return { valid: true, discountPercent: v.coupon.discountPercent };
  }
  return {
    valid: false,
    message: v.reason === "limit" ? "Usage limit reached for this code." : "Invalid or inactive code.",
  };
}
