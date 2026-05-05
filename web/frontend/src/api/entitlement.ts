import { saasAuthorizedFetch } from "./subscription";
import { getSaasApiBase } from "./saasBase";
import { AUTH_ACCESS_TOKEN_STORAGE_KEY } from "./auth";

export type PlanName = "FREE" | "PLUS" | "PRO" | "BUSINESS";
export type SubscriptionStatus =
  | "none"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

/** Wire shape from `GET /api/entitlement/balance` (read-only Prisma). */
export type EntitlementBalanceWire = {
  credit_balance: number;
  plan: PlanName;
  subscription_status: SubscriptionStatus;
};

/**
 * Normalized balance for UI. Built from the balance endpoint plus session
 * identity; `subscriptionExpiry` is not returned by the read API (always
 * null here). `hasActiveSubscription` follows plan + status only.
 */
export type UserBalance = {
  userId: string;
  creditBalance: number;
  plan: PlanName;
  role: "USER" | "ADMIN";
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiry: string | null;
  hasActiveSubscription: boolean;
};

export function normalizeUserBalance(
  wire: EntitlementBalanceWire,
  ctx: { userId: string; role: "USER" | "ADMIN" },
): UserBalance {
  const hasActiveSubscription =
    wire.plan !== "FREE" && wire.subscription_status === "active";
  return {
    userId: ctx.userId,
    creditBalance: wire.credit_balance,
    plan: wire.plan,
    role: ctx.role,
    subscriptionStatus: wire.subscription_status,
    subscriptionExpiry: null,
    hasActiveSubscription,
  };
}

function readLatestAccessToken(fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  return window.localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY) ?? fallback;
}

/**
 * Fetch the caller's credit balance + plan from `GET /api/entitlement/balance`
 * and merge session identity into `UserBalance` for components.
 */
export async function fetchUserBalance(
  accessToken: string,
  ctx: { userId: string; role: "USER" | "ADMIN" },
): Promise<UserBalance> {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/entitlement/balance`, {
      headers: {
        Authorization: `Bearer ${t}`,
      },
      credentials: "include",
    }),
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Balance fetch failed (${response.status}).`);
  }
  const wire = (await response.json()) as EntitlementBalanceWire;
  return normalizeUserBalance(wire, ctx);
}

/**
 * Ledger row types mirror `CreditTransactionRecord` in the engine.
 *   - `consume`   — tool run (amount <= 0; 0 for subscription/admin bypass)
 *   - `bonus`     — automated grant (onboarding, fake-payment confirm)
 *   - `admin_add` — manual top-up through the admin panel
 *   - `refund`    — credit returned after a failed/support-triggered op
 */
export type CreditTransactionType = "consume" | "bonus" | "admin_add" | "refund";

export type CreditTransaction = {
  id: string;
  type: CreditTransactionType;
  amount: number;
  toolId: string | null;
  createdAt: string;
};

/**
 * Pulls the last `limit` ledger rows for the caller, newest first.
 * API returns a JSON array; `limit` is clamped server-side to [1, 100].
 */
export async function fetchCreditTransactions(
  accessToken: string,
  limit = 10,
): Promise<CreditTransaction[]> {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/entitlement/transactions?limit=${encodeURIComponent(String(limit))}`, {
      headers: {
        Authorization: `Bearer ${t}`,
      },
      credentials: "include",
    }),
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Transactions fetch failed (${response.status}).`);
  }
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as CreditTransaction[]) : [];
}

export type DownloadLogCreateBody = { resultId?: string | null; toolId: string };

export async function createDownloadLog(accessToken: string, body: DownloadLogCreateBody): Promise<{ id: string; status: string }> {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/entitlement/download-log`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        resultId: body.resultId?.trim() ? body.resultId.trim() : null,
        toolId: body.toolId,
      }),
    }),
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Download log create failed (${response.status}).`);
  }
  return (await response.json()) as { id: string; status: string };
}

export async function ackDownloadLog(accessToken: string, logId: string): Promise<void> {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/entitlement/download-log/${encodeURIComponent(logId)}/ack`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
      credentials: "include",
    }),
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `ACK failed (${response.status}).`);
  }
}
