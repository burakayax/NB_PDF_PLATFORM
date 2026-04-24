import { saasAuthorizedFetch } from "./subscription";
import { getSaasApiBase } from "./saasBase";
import { AUTH_ACCESS_TOKEN_STORAGE_KEY } from "./auth";

/**
 * Client for `/api/fake-payment/*` — exercises checkout → redirect or
 * immediate confirm without Stripe or other PSPs.
 */

export type FakePaymentProduct =
  | "PRO"
  | "BUSINESS"
  | "CREDITS_50"
  | "CREDITS_100"
  | "CREDITS_120"
  | "CREDITS_300";

/** Thrown when `POST /api/fake-payment/checkout` returns 404 (route not mounted). */
export const PAYMENT_CHECKOUT_NOT_FOUND = "PAYMENT_CHECKOUT_NOT_FOUND";

export type FakeCheckoutSession = {
  sessionId: string;
  amount: number;
  credits: number;
  redirectUrl: string;
};

export type FakeConfirmResult =
  | {
      ok: true;
      sessionId: string;
      product: FakePaymentProduct;
      creditsGranted: number;
      creditsBefore: number;
      creditsAfter: number;
      transactionId: string;
      subscriptionExpiry: string | null;
      alreadyConfirmed?: false;
    }
  | {
      ok: true;
      alreadyConfirmed: true;
      sessionId: string;
      product: FakePaymentProduct;
    };

function readLatestAccessToken(fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  return window.localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY) ?? fallback;
}

/** Absolute URL for SPA navigation (API returns a path-only `redirectUrl`). */
export function resolveFakePaymentRedirect(redirectUrl: string): string {
  if (redirectUrl.startsWith("http://") || redirectUrl.startsWith("https://")) {
    return redirectUrl;
  }
  if (typeof window === "undefined") {
    return redirectUrl;
  }
  const path = redirectUrl.startsWith("/") ? redirectUrl : `/${redirectUrl}`;
  return `${window.location.origin}${path}`;
}

export async function startFakeCheckout(
  accessToken: string,
  plan: FakePaymentProduct,
): Promise<FakeCheckoutSession> {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/fake-payment/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      credentials: "include",
      body: JSON.stringify({ plan }),
    }),
  );
  if (response.status === 404) {
    throw new Error(PAYMENT_CHECKOUT_NOT_FOUND);
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Fake checkout failed (${response.status}).`);
  }
  return (await response.json()) as FakeCheckoutSession;
}

export async function confirmFakeCheckout(
  accessToken: string,
  sessionId: string,
): Promise<FakeConfirmResult> {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/fake-payment/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    }),
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Fake confirm failed (${response.status}).`);
  }
  return (await response.json()) as FakeConfirmResult;
}

/**
 * Single-flight fake purchase (no full-page redirect). For redirect-based
 * E2E, use `startFakeCheckout` + `window.location.assign(resolveFakePaymentRedirect(redirectUrl))`
 * and complete on `/fake-payment/success`.
 */
export async function buyCreditsInstant(
  accessToken: string,
  plan: FakePaymentProduct,
): Promise<FakeConfirmResult> {
  const session = await startFakeCheckout(accessToken, plan);
  return confirmFakeCheckout(accessToken, session.sessionId);
}
