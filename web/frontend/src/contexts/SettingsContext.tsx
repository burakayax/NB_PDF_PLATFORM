import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  fetchPublicRuntime,
  type PublicPricingPayload,
  type PublicRuntimePayload,
  type SystemNotificationsPayload,
} from "../api/public";
import { isCmsPreviewActive, readCmsPreviewDraft } from "../lib/cmsPreview";
import { persistMaintenanceHint } from "../lib/maintenanceHint";
import { RUNTIME_REFRESH_BROADCAST, RUNTIME_REFRESH_EVENT } from "../lib/runtimeRefreshEvents";

const defaultNotifications: SystemNotificationsPayload = {
  enabled: false,
  variant: "info",
  messageEn: "",
  messageTr: "",
  linkUrl: "",
  linkLabelEn: "",
  linkLabelTr: "",
};

const defaultPricing: PublicPricingPayload = {
  pricingRegion: "INTL",
  detectedCountry: null,
  checkoutCurrency: "TRY",
  tryPrices: { businessMonthly: "79.00", proMonthly: "129.00", proAnnual: "799.00" },
  usdDisplay: { basicMonthly: "4.99", proMonthly: "9.99", proAnnual: "59.99" },
  annualSavePercent: 50,
  internationalCheckoutNote: {
    en: "Checkout is processed in Turkish Lira (TRY) via our payment partner; your bank may show an equivalent in your currency.",
    tr: "Ödeme, ödeme ortağımız üzerinden Türk Lirası (TRY) ile tahsil edilir; bankanız kendi para biriminizde bir karşılık gösterebilir.",
  },
};

const defaultPayload: PublicRuntimePayload = {
  cms: {},
  site: {
    analyticsEnabled: true,
    theme: "dark",
    defaultLanguage: "en",
    freeDailyLimitDisplay: 5,
    maintenanceMode: false,
    betaFeatures: {},
    featureFlags: {},
    notifications: defaultNotifications,
  },
  plans: [],
  TOOLSPublic: { disabledFeatures: [], displayFreeDailyLimit: null },
  pricing: defaultPricing,
  flags: { maintenanceMode: false, betaFeatures: {}, featureFlags: {} },
  notifications: defaultNotifications,
};

type SettingsContextValue = PublicRuntimePayload & {
  loading: boolean;
  error: string | null;
  revision: number;
  refresh: () => Promise<void>;
  /** First successful fetchPublicRuntime completion (any revision). Until true, maintenance flag is not authoritative for UI gating. */
  runtimeHydrated: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<PublicRuntimePayload>(defaultPayload);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [runtimeHydrated, setRuntimeHydrated] = useState(false);
  const initialFetchCompletedRef = useRef(false);

  const load = useCallback(async () => {
    const showBlockingSpinner = !initialFetchCompletedRef.current;
    if (showBlockingSpinner) {
      setLoading(true);
    }
    setError(null);
    try {
      const raw = await fetchPublicRuntime();
      const viteMaintenance = import.meta.env.VITE_MAINTENANCE_MODE === "true";
      const data: PublicRuntimePayload = {
        ...raw,
        site: {
          ...raw.site,
          maintenanceMode: viteMaintenance || raw.site.maintenanceMode === true,
        },
        flags: {
          ...raw.flags,
          maintenanceMode: viteMaintenance || raw.flags.maintenanceMode === true,
        },
      };
      setPayload(data);
      persistMaintenanceHint(data.flags.maintenanceMode === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Runtime config failed");
      setPayload(defaultPayload);
    } finally {
      setRuntimeHydrated(true);
      if (showBlockingSpinner) {
        setLoading(false);
        initialFetchCompletedRef.current = true;
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, revision]);

  useEffect(() => {
    const bumpRevision = () => setRevision((r) => r + 1);

    window.addEventListener(RUNTIME_REFRESH_EVENT, bumpRevision);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(RUNTIME_REFRESH_BROADCAST);
      bc.onmessage = bumpRevision;
    } catch {
      /* unsupported */
    }

    let visibilityTimer: number | undefined;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      window.clearTimeout(visibilityTimer);
      visibilityTimer = window.setTimeout(() => bumpRevision(), 750);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener(RUNTIME_REFRESH_EVENT, bumpRevision);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(visibilityTimer);
      bc?.close();
    };
  }, []);

  const refresh = useCallback(async () => {
    setRevision((r) => r + 1);
  }, []);

  const value = useMemo<SettingsContextValue>(() => {
    let cms = payload.cms;
    if (isCmsPreviewActive()) {
      const draft = readCmsPreviewDraft();
      if (draft) {
        cms = draft;
      }
    }
    return {
      ...payload,
      cms,
      loading,
      error,
      revision,
      refresh,
      runtimeHydrated,
    };
  }, [payload, loading, error, revision, refresh, runtimeHydrated]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
