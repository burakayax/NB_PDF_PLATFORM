import { AUTH_ACCESS_TOKEN_STORAGE_KEY, refreshAuthSession, type AuthUser } from "./auth";
import { getSaasApiBase } from "./saasBase";

type SaasSessionSync = (session: { accessToken: string; user: AuthUser }) => void;

let saasSessionSync: SaasSessionSync | null = null;

/** React oturumu; 401 sonrası yenilemede yeni jeton state + localStorage’a yazılır. */
export function registerSaasSessionSync(fn: SaasSessionSync | null) {
  saasSessionSync = fn;
}

function readLatestAccessToken(fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  return window.localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY) ?? fallback;
}

/** Shared by subscription, admin, and entitlement API clients (401 → refresh session). */
export async function saasAuthorizedFetch(initialToken: string, run: (token: string) => Promise<Response>): Promise<Response> {
  let response = await run(initialToken);
  if (response.status !== 401 || !saasSessionSync) {
    return response;
  }
  try {
    const refreshed = await refreshAuthSession();
    if (!refreshed?.accessToken) {
      return response;
    }
    saasSessionSync({ accessToken: refreshed.accessToken, user: refreshed.user });
    const token = readLatestAccessToken(refreshed.accessToken);
    return await run(token);
  } catch {
    return response;
  }
}

export type PlanName = "FREE" | "PRO" | "BUSINESS";
export type FeatureKey =
  | "split"
  | "merge"
  | "pdf-to-word"
  | "word-to-pdf"
  | "excel-to-pdf"
  | "pdf-to-excel"
  | "compress"
  | "encrypt"
  | "delete-pages"
  | "rotate-pdf"
  | "organize-pdf"
  | "unlock-pdf"
  | "watermark"
  | "page-numbers"
  | "repair-pdf"
  | "pdf-to-ppt"
  | "ppt-to-pdf"
  | "pdf-to-image"
  | "image-to-pdf"
  | "html-to-pdf";

/*
 * The monetisation surface returned by `/api/subscription/plans` and
 * `/api/subscription/current` used to carry daily-quota fields
 * (`dailyLimit`, `usedToday`, `conversionTracking`, `postLimit*`, progressive
 * friction helpers, processing-tier hints, the `SaasFrictionPayload` shape,
 * etc.). Those fields belonged to a legacy daily-limit system that has been
 * retired — the credit-based entitlement engine is the only source of truth
 * for what a user can run and for how much they have left.
 *
 * UI code MUST read credit state from `fetchUserBalance` (see
 * `./entitlement.ts`). The types below intentionally expose ONLY the
 * plan/role metadata that's still meaningful (display name, monthly price,
 * allowed features). Any consumer that still wants quota semantics has to
 * go through the entitlement engine.
 */

export type PlanDefinition = {
  name: PlanName;
  displayName: string;
  description: string;
  allowedFeatures: FeatureKey[];
  multiUser: boolean;
  /** Aylık abonelik fiyatı (TRY), ücretli planlar için API’den gelir. */
  monthlyPriceTry?: string | null;
  /** PRO yıllık paket (TRY), yalnızca PRO satırında. */
  annualPriceTry?: string | null;
};

export type SubscriptionSummary = {
  currentPlan: PlanDefinition;
  allowedFeatures: FeatureKey[];
};

/** Sunucu hesaplı kalan gün; geri sayım için istemci tarihi kullanılmaz. */
export type SubscriptionStatus = {
  plan: PlanName;
  remaining_days: number | null;
  plan_downgraded?: boolean;
};

async function ensureOk(response: Response, defaultMessage: string) {
  if (response.ok) {
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { message?: string };
    throw new Error(payload.message || defaultMessage);
  }

  const message = await response.text();
  throw new Error(message || defaultMessage);
}

export async function fetchPlans() {
  const response = await fetch(`${getSaasApiBase()}/api/subscription/plans`);
  await ensureOk(response, "Plans could not be loaded.");
  const payload = (await response.json()) as { plans: PlanDefinition[] };
  return payload.plans;
}

export async function fetchSubscriptionSummary(accessToken: string) {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/subscription/current`, {
      headers: {
        Authorization: `Bearer ${t}`,
      },
      credentials: "include",
    }),
  );
  await ensureOk(response, "Subscription summary could not be loaded.");
  return response.json() as Promise<SubscriptionSummary>;
}

export async function fetchSubscriptionStatus(accessToken: string) {
  const token = readLatestAccessToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/subscription/status`, {
      headers: {
        Authorization: `Bearer ${t}`,
      },
      credentials: "include",
    }),
  );
  await ensureOk(response, "Subscription status could not be loaded.");
  return response.json() as Promise<SubscriptionStatus>;
}
