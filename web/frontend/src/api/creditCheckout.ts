import { saasAuthorizedFetch } from "./subscription";
import { getSaasApiBase } from "./saasBase";
import { AUTH_ACCESS_TOKEN_STORAGE_KEY } from "./auth";

function readLatestAccessToken(fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  return window.localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY) ?? fallback;
}

export type CreditPackProduct = "CREDITS_50" | "CREDITS_100" | "CREDITS_120" | "CREDITS_300";

export type CreditPreviewResponse = {
  product: CreditPackProduct;
  basePriceTry: string;
  finalPriceTry: string;
  credits: number;
  couponId: string | null;
  exitIntentApplied: boolean;
  exitOfferEligible: boolean;
  discountPercent: number | null;
  pricingToken: string;
};

export type CreditStartResponse =
  | { mode: "fake"; sessionId: string; amount: number; credits: number; redirectUrl: string }
  | {
      mode: "iyzico";
      token: string;
      checkoutFormContent: string;
      paymentPageUrl?: string;
      conversationId: string;
    };

export async function postCreditCheckoutPreview(
  accessToken: string,
  body: { product: string; couponCode?: string | null; applyExitIntent?: boolean },
): Promise<CreditPreviewResponse> {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/credit-checkout/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      credentials: "include",
      body: JSON.stringify(body),
    }),
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Preview failed (${response.status}).`);
  }
  return (await response.json()) as CreditPreviewResponse;
}

export async function postCreditCheckoutStart(accessToken: string, pricingToken: string): Promise<CreditStartResponse> {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/credit-checkout/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      credentials: "include",
      body: JSON.stringify({ pricingToken }),
    }),
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Checkout start failed (${response.status}).`);
  }
  return (await response.json()) as CreditStartResponse;
}

export async function postValidateCreditCoupon(
  accessToken: string,
  code: string,
): Promise<{ valid: boolean; discountPercent?: number; message?: string }> {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/credit-checkout/validate-coupon`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      credentials: "include",
      body: JSON.stringify({ code }),
    }),
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Validation failed (${response.status}).`);
  }
  return (await response.json()) as { valid: boolean; discountPercent?: number; message?: string };
}
