import type { UserBalance } from "../api/entitlement";

/**
 * Active Limitsiz Pro (monthly unlimited) — PRO plan with active subscription.
 * Used to hide purchase surfaces and show VIP chrome.
 */
export function isLimitsizProUnlimited(balance: UserBalance | null | undefined): boolean {
  return Boolean(balance?.hasActiveSubscription && balance.plan === "PRO");
}
