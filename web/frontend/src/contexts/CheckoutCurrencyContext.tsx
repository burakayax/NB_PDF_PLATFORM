import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
export type CheckoutCurrency = "TRY" | "USD" | "EUR";

/** Deprecated: persisted manual overrides from older header toggle; cleared on boot. */
const LEGACY_STORAGE_KEY = "nb-checkout-currency-v1";

const EU = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

export function defaultCurrencyFromCountryCode(countryCode: string | null | undefined): CheckoutCurrency {
  const cc = countryCode?.trim().toUpperCase() ?? "";
  if (cc === "TR") return "TRY";
  if (EU.has(cc)) return "EUR";
  return "USD";
}

/** When geo IP is unavailable — timezone + locale + rough EU TZ hints. */
export function inferCurrencyFromClientHints(): CheckoutCurrency {
  if (typeof window === "undefined" || typeof Intl === "undefined") {
    return "TRY";
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (/Istanbul|Türkiye|Turkey/i.test(tz)) {
      return "TRY";
    }
    // Common EU metropolitan zones → EUR pricing band
    /** Rough EUR pricing band when IP lookup fails (`Europe/Istanbul` is TRY-only above). */
    const euTzPattern =
      /^(Africa\/Ceuta|Etc\/GMT-[01]|Europe\/(Amsterdam|Andorra|Athens|Berlin|Brussels|Budapest|Busingen|Chisinau|Copenhagen|Dublin|Gibraltar|Guernsey|Helsinki|Isle_of_Man|Jersey|Kaliningrad|Kyiv|Lisbon|Ljubljana|London|Luxembourg|Madrid|Malta|Mariehamn|Minsk|Monaco|Moscow|Oslo|Paris|Podgorica|Prague|Riga|Rome|Samara|San_Marino|Sarajevo|Simferopol|Skopje|Sofia|Stockholm|Tallinn|Tirane|Tiraspol|Uzhgorod|Vaduz|Vatican|Vienna|Vilnius|Volgograd|Warsaw|Zagreb|Zaporozhye|Zurich))$/;
    if (euTzPattern.test(tz)) {
      return "EUR";
    }
  } catch {
    /* noop */
  }
  const lang = (typeof navigator !== "undefined" ? navigator.language : "").toLowerCase();
  if (lang === "tr" || lang.startsWith("tr-")) {
    return "TRY";
  }
  return "USD";
}

async function fetchWithTimeout(resource: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const tid = globalThis.setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(resource, { signal: ctrl.signal });
  } finally {
    globalThis.clearTimeout(tid);
  }
}

async function fetchCountryFromIp(): Promise<string | null> {
  const tryProviders: Array<() => Promise<string | null>> = [
    async () => {
      const r = await fetchWithTimeout("https://ipapi.co/json/", 6000);
      if (!r.ok) return null;
      const j = (await r.json()) as { country_code?: string; error?: boolean };
      if (j.error || !j.country_code) return null;
      return j.country_code.trim();
    },
    async () => {
      const r = await fetchWithTimeout("https://ipwho.is/me", 6000);
      if (!r.ok) return null;
      const j = (await r.json()) as { success?: boolean; country_code?: string };
      if (j.success === false || !j.country_code) return null;
      return String(j.country_code).trim();
    },
  ];

  for (const p of tryProviders) {
    try {
      const cc = await p();
      if (cc) {
        return cc;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function mergeGeoAndHints(geo: string | null): CheckoutCurrency {
  // IP sonucu en güvenilir sinyal; gelirse onu kullan
  if (geo) return defaultCurrencyFromCountryCode(geo);
  // IP yoksa timezone/dil fallback
  return inferCurrencyFromClientHints();
}

type Ctx = {
  currency: CheckoutCurrency;
  loading: boolean;
};

const CheckoutCurrencyContext = createContext<Ctx | null>(null);

export function CheckoutCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CheckoutCurrency>(() => inferCurrencyFromClientHints());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    void fetchCountryFromIp().then((cc) => {
      if (!cancelled) {
        setCurrency(mergeGeoAndHints(cc));
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setCurrency(inferCurrencyFromClientHints());
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ currency, loading }), [currency, loading]);

  return <CheckoutCurrencyContext.Provider value={value}>{children}</CheckoutCurrencyContext.Provider>;
}

const _FALLBACK_CTX: Ctx = { currency: "USD", loading: false };

export function useCheckoutCurrency(): Ctx {
  const v = useContext(CheckoutCurrencyContext);
  return v ?? _FALLBACK_CTX;
}
