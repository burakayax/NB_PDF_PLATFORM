import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { getClientIp } from "../../middleware/api-security.middleware.js";
import { createPaymentCheckoutSession } from "./payment.service.js";
import { getPublicTierPricingRows } from "./payment-pricing-tiers.js";
import { isCheckoutCurrency, type CheckoutCurrency } from "./pricing-matrix.js";
import { prisma } from "../../lib/prisma.js";

const planPaymentBodySchema = z.object({
  planId: z.enum(["STARTER", "PLUS", "PRO", "BUSINESS"]),
  currency: z.enum(["TRY", "USD", "EUR"]).optional().default("TRY"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional().default("MONTHLY"),
});

/** TRY prices — decimal format ("799.00" = 799 TL). iyzico requires two-decimal strings. */
const PLAN_PRICES_TRY: Record<"STARTER" | "PLUS" | "PRO" | "BUSINESS", { monthly: string; yearly: string }> = {
  STARTER: { monthly: "49.00", yearly: "490.00" },
  PLUS: { monthly: "149.00", yearly: "1490.00" },
  PRO: { monthly: "299.00", yearly: "2990.00" },
  BUSINESS: { monthly: "799.00", yearly: "7990.00" },
};

/** USD prices — decimal format ("250.00" = $250). */
const PLAN_PRICES_USD: Record<"STARTER" | "PLUS" | "PRO" | "BUSINESS", { monthly: string; yearly: string }> = {
  STARTER: { monthly: "15.99", yearly: "159.00" },
  PLUS: { monthly: "47.99", yearly: "479.90" },
  PRO: { monthly: "97.99", yearly: "979.90" },
  BUSINESS: { monthly: "250.00", yearly: "2500.00" },
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

  const { planId, billingCycle } = parsed.data;
  // EUR iyzico tarafından desteklenmez; USD fiyat bandına yönlendir
  const rawCurrency = parsed.data.currency;
  const checkoutCurrency: CheckoutCurrency = rawCurrency === "EUR" ? "USD" : (rawCurrency as CheckoutCurrency);

  // Güvenlik: USD ödeme + TR fatura adresi → bloke et.
  // TR fatura adresli kullanıcılar TRY kanalını kullanmalıdır.
  if (checkoutCurrency !== "TRY") {
    const userId = request.authUser?.id;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { billingCountryCode: true },
      });
      const billingCountry = (user?.billingCountryCode ?? "").toUpperCase().trim();
      if (!billingCountry || billingCountry === "TR") {
        throw new HttpError(
          400,
          "Türkiye fatura adresli hesaplar TRY ödeme kanalını kullanmalıdır. " +
          "Lütfen TRY seçeneğiyle devam edin veya yurt dışı fatura adresinizi güncelleyin.",
        );
      }
    }
  }

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
