import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { z } from "zod";
import type { CheckoutCurrency } from "../payment/pricing-matrix.js";
import type { CreditPackSku } from "./credit-pack-pricing.js";

const payloadSchemaV2 = z.object({
  v: z.literal(2),
  sub: z.string(),
  currency: z.enum(["TRY", "USD", "EUR"]),
  product: z.enum([
    "CREDITS_50",
    "CREDITS_100",
    "CREDITS_120",
    "CREDITS_300",
    "TIER_STARTER",
    "TIER_PROFESSIONAL",
  ]),
  basePrice: z.string().regex(/^\d+\.\d{2}$/),
  finalPrice: z.string().regex(/^\d+\.\d{2}$/),
  credits: z.number().int().positive(),
  couponId: z.string().nullable(),
  exitIntent: z.boolean(),
});

export type CreditPricingPayload = {
  v: 2;
  sub: string;
  currency: CheckoutCurrency;
  product: CreditPackSku;
  basePrice: string;
  finalPrice: string;
  credits: number;
  couponId: string | null;
  exitIntent: boolean;
};

export function signCreditPricingToken(payload: CreditPricingPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

export function verifyCreditPricingToken(token: string, userId: string): CreditPricingPayload {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new HttpError(400, "Invalid or expired pricing session. Please refresh the summary.");
  }
  const p = payloadSchemaV2.safeParse(decoded);
  if (!p.success || p.data.sub !== userId) {
    throw new HttpError(400, "Invalid pricing session.");
  }
  return p.data;
}
