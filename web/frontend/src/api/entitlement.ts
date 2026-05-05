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

/** Wire shape from `GET /api/entitlement/balance` */
export type EntitlementBalanceWire = {
  plan: PlanName;
  daily: { used: number; limit: number | null; resetAt: string };
  monthly: { used: number; limit: number | null };
  watermarkEnabled: boolean;
  batchLimit: number;
  fileSizeLimitMB: number;
  isAdmin: boolean;
};

export type UserBalance = {
  userId: string;
  creditBalance: number;
  plan: PlanName;
  role: "USER" | "ADMIN";
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiry: string | null;
  hasActiveSubscription: boolean;
  batchLimit: number;
  isAdmin: boolean;
  daily: { used: number; limit: number | null; resetAt: string };
  monthly: { used: number; limit: number | null };
  watermarkEnabled: boolean;
  fileSizeLimitMB: number;
};

export function normalizeUserBalance(
  wire: EntitlementBalanceWire,
  ctx: { userId: string; role: "USER" | "ADMIN" },
): UserBalance {
  const isAdmin = wire.isAdmin ?? ctx.role === "ADMIN";
  const hasActiveSubscription = wire.plan !== "FREE" || isAdmin;
  return {
    userId: ctx.userId,
    creditBalance: 0,
    plan: wire.plan,
    role: isAdmin ? "ADMIN" : "USER",
    subscriptionStatus: wire.plan !== "FREE" ? "active" : "none",
    subscriptionExpiry: null,
    hasActiveSubscription,
    batchLimit: wire.batchLimit ?? 0,
    isAdmin,
    daily: wire.daily ?? { used: 0, limit: null, resetAt: "" },
    monthly: wire.monthly ?? { used: 0, limit: null },
    watermarkEnabled: wire.watermarkEnabled ?? false,
    fileSizeLimitMB: wire.fileSizeLimitMB ?? 999999,
  };
}

function readLatestAccessToken(fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  return window.localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY) ?? fallback;
}

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

export type CreditTransactionType = "consume" | "bonus" | "admin_add" | "refund";

export type CreditTransaction = {
  id: string;
  type: CreditTransactionType;
  amount: number;
  toolId: string | null;
  createdAt: string;
};

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
