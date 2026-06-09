import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCountryCode } from "../lib/geoCountry";
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
    /* Intl yoksa dil sinyaline düş */
  }
  const lang = (typeof navigator !== "undefined" ? navigator.language : "").toLowerCase();
  if (lang === "tr" || lang.startsWith("tr-")) {
    return "TRY";
  }
  return "USD";
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
  // İlk değer ağ beklemeden Intl/dil ipucundan (anında, render bloklamaz).
  const [currency, setCurrency] = useState<CheckoutCurrency>(inferCurrencyFromClientHints);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    // Paylaşılan, 24 saat önbellekli geolokasyon (oturum başına tek istek).
    void getCountryCode()
      .then((cc) => {
        if (!cancelled) {
          setCurrency(mergeGeoAndHints(cc));
          setLoading(false);
        }
      })
      .catch(() => {
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
