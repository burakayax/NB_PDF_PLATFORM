import { getSaasApiBase } from "./saasBase";
import type { PricingTierId } from "../lib/pricingTiers";
import type { CheckoutCurrency } from "../lib/pricingMatrix";
import { saasAuthorizedFetch } from "./subscription";
import { AUTH_ACCESS_TOKEN_STORAGE_KEY } from "./auth";

export type TierCheckoutResponse =
  | {
      mode: "iyzico";
      token: string;
      checkoutFormContent: string;
      paymentPageUrl?: string;
      conversationId: string;
    }
  | {
      mode: "fake";
      sessionId: string;
      amount: number;
      credits: number;
      redirectUrl: string;
    };

function readLatestAccessToken(fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  return window.localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY) ?? fallback;
}

async function ensureOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) {
    return;
  }
  const ct = response.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const payload = (await response.json()) as { message?: string; error?: string };
    throw new Error(payload.message ?? payload.error ?? fallback);
  }
  const text = await response.text();
  throw new Error(text || fallback);
}

export type PublicTierPricingRow = {
  id: "starter" | "professional" | "unlimited_pro";
  credits: number | null;
  billing: "one_time" | "subscription_monthly";
  amount: number;
  amountFormatted: string;
  currency: CheckoutCurrency | string;
};

export type PaymentsPricingResponse = {
  currency: CheckoutCurrency | string;
  tiers: PublicTierPricingRow[];
};

/**
 * Canonical tier prices from server fixed matrix (`?currency=`).
 */
export async function fetchPaymentsPricing(currency: CheckoutCurrency): Promise<PaymentsPricingResponse> {
  const q = `?currency=${encodeURIComponent(currency)}`;
  const response = await fetch(`${getSaasApiBase()}/api/payments/pricing${q}`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Pricing unavailable (${response.status}).`);
  }
  return response.json() as Promise<PaymentsPricingResponse>;
}

export async function initializeTierPayment(
  accessToken: string,
  tier: PricingTierId,
  currency: CheckoutCurrency,
): Promise<TierCheckoutResponse> {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/payments/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ tier, currency }),
    }),
  );
  await ensureOk(response, "Could not initialize payment.");
  return response.json() as Promise<TierCheckoutResponse>;
}
