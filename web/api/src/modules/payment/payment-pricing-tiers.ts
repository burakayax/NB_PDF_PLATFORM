import { CREDIT_PACK_CATALOG } from "../credit-checkout/credit-pack-pricing.js";
import { formatMoney2, getTierOneTimePrice, getUnlimitedProPrice, type CheckoutCurrency } from "./pricing-matrix.js";

export type TierPricingPublicRow = {
  id: "starter" | "professional" | "unlimited_pro";
  credits: number | null;
  billing: "one_time" | "subscription_monthly";
  /** Monetary amount in the requested `currency`. */
  amount: number;
  amountFormatted: string;
  currency: CheckoutCurrency;
};

/**
 * Canonical fixed pricing for UI + PSP: two one-time credit tiers + monthly Unlimited Pro.
 */
export function getPublicTierPricingRows(currency: CheckoutCurrency): TierPricingPublicRow[] {
  const s = CREDIT_PACK_CATALOG.TIER_STARTER;
  const p = CREDIT_PACK_CATALOG.TIER_PROFESSIONAL;
  const br = getTierOneTimePrice("TIER_STARTER", currency);
  const ar = getTierOneTimePrice("TIER_PROFESSIONAL", currency);
  const u = getUnlimitedProPrice(currency);
  return [
    {
      id: "starter",
      credits: s.credits,
      billing: "one_time",
      amount: br,
      amountFormatted: formatMoney2(currency, br),
      currency,
    },
    {
      id: "professional",
      credits: p.credits,
      billing: "one_time",
      amount: ar,
      amountFormatted: formatMoney2(currency, ar),
      currency,
    },
    {
      id: "unlimited_pro",
      credits: null,
      billing: "subscription_monthly",
      amount: u,
      amountFormatted: formatMoney2(currency, u),
      currency,
    },
  ];
}
