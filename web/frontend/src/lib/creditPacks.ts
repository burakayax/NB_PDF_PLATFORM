import type { FakePaymentProduct } from "../api/fakePayment";

/** Credit-only SKUs shown in dashboard, upgrade modal, and landing. */
export const CREDIT_PACK_PRODUCTS = ["CREDITS_50", "CREDITS_120", "CREDITS_300"] as const;

export type CreditPackProduct = (typeof CREDIT_PACK_PRODUCTS)[number];

export type CreditPackDefinition = {
  product: CreditPackProduct;
  credits: number;
  priceTry: number;
};

export const CREDIT_PACKS: readonly CreditPackDefinition[] = [
  { product: "CREDITS_50", credits: 50, priceTry: 29 },
  { product: "CREDITS_120", credits: 120, priceTry: 59 },
  { product: "CREDITS_300", credits: 300, priceTry: 129 },
] as const;

export function isCreditPackProduct(p: FakePaymentProduct): p is CreditPackProduct {
  return (CREDIT_PACK_PRODUCTS as readonly string[]).includes(p);
}
