import { getSaasApiBase } from "./saasBase";
import type { PlanDefinition } from "./subscription";

export type SystemNotificationsPayload = {
  enabled: boolean;
  variant: string;
  messageEn: string;
  messageTr: string;
  linkUrl: string;
  linkLabelEn: string;
  linkLabelTr: string;
};

export type PublicSiteConfig = {
  analyticsEnabled: boolean;
  theme: string;
  defaultLanguage: string;
  freeDailyLimitDisplay?: number;
  maintenanceMode?: boolean;
  betaFeatures?: Record<string, boolean>;
  featureFlags?: Record<string, boolean>;
  notifications?: SystemNotificationsPayload;
};

export async function fetchPublicCms(): Promise<{ content: Record<string, unknown> }> {
  const base = getSaasApiBase().replace(/\/$/, "");
  const r = await fetch(`${base}/api/public/cms`, { credentials: "include" });
  if (!r.ok) {
    throw new Error(await r.text());
  }
  return r.json() as Promise<{ content: Record<string, unknown> }>;
}

export async function fetchPublicSiteConfig(): Promise<PublicSiteConfig> {
  const base = getSaasApiBase().replace(/\/$/, "");
  const r = await fetch(`${base}/api/public/site-config`, { credentials: "include" });
  if (!r.ok) {
    throw new Error(await r.text());
  }
  return r.json() as Promise<PublicSiteConfig>;
}

export type PublicTOOLSPublicSlice = {
  disabledFeatures: string[];
  displayFreeDailyLimit: number | null;
};

export type PublicPricingPayload = {
  pricingRegion: "TR" | "INTL";
  detectedCountry: string | null;
  checkoutCurrency: "TRY";
  tryPrices: { businessMonthly: string; proMonthly: string; proAnnual: string };
  usdDisplay: { basicMonthly: string; proMonthly: string; proAnnual: string };
  annualSavePercent: number;
  internationalCheckoutNote: { en: string; tr: string };
};

export type PublicRuntimePayload = {
  cms: Record<string, unknown>;
  site: PublicSiteConfig;
  plans: PlanDefinition[];
  TOOLSPublic: PublicTOOLSPublicSlice;
  pricing: PublicPricingPayload;
  flags: {
    maintenanceMode: boolean;
    betaFeatures: Record<string, boolean>;
    featureFlags: Record<string, boolean>;
  };
  notifications: SystemNotificationsPayload;
};

export async function fetchPublicRuntime(): Promise<PublicRuntimePayload> {
  const base = getSaasApiBase().replace(/\/$/, "");
  /** Bypass intermediary caches (CDN / SW) so maintenance toggles apply immediately after notifyRuntimeRefresh. */
  const cacheBust = `_=${Date.now()}`;
  const r = await fetch(`${base}/api/public/runtime?${cacheBust}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  const text = await r.text();
  let data: PublicRuntimePayload;
  try {
    data = JSON.parse(text) as PublicRuntimePayload;
  } catch {
    throw new Error(text || "Runtime config failed");
  }
  /** Maintenance returns 503 + JSON so crawlers see Service Unavailable while the SPA still parses flags. */
  if (!r.ok && r.status !== 503) {
    throw new Error(text || "Runtime config failed");
  }
  return data;
}
