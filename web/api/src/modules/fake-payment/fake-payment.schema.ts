import { z } from "zod";

/**
 * Purchasable products for the fake PSP. `FREE` is not a checkout target.
 * Credit-only SKUs do not change `User.plan`; PRO/BUSINESS activate a
 * subscription tier and grant their bundled credits in one confirm step.
 */
export const fakePaymentProductSchema = z.enum([
  "PRO",
  "BUSINESS",
  "CREDITS_50",
  "CREDITS_100",
  "CREDITS_120",
  "CREDITS_300",
]);
export type FakePaymentProduct = z.infer<typeof fakePaymentProductSchema>;

export const fakePaymentCheckoutBodySchema = z.object({
  plan: fakePaymentProductSchema,
});

export const fakePaymentConfirmBodySchema = z.object({
  sessionId: z.string().min(1).max(200),
});
