import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CheckoutCurrency } from "../lib/pricingMatrix";

const STORAGE_KEY = "nb-checkout-currency-v1";

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

async function fetchCountryFromIp(): Promise<string | null> {
  try {
    const r = await fetch("https://ipapi.co/json/");
    const j = (await r.json()) as { country_code?: string; error?: boolean };
    if (j.error) return null;
    return j.country_code ?? null;
  } catch {
    return null;
  }
}

type Ctx = {
  currency: CheckoutCurrency;
  setCurrency: (c: CheckoutCurrency) => void;
};

const CheckoutCurrencyContext = createContext<Ctx | null>(null);

export function CheckoutCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CheckoutCurrency>("TRY");

  useEffect(() => {
    let cancelled = false;
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "TRY" || saved === "USD" || saved === "EUR") {
      setCurrencyState(saved);
      return;
    }
    void fetchCountryFromIp().then((cc) => {
      if (!cancelled) {
        setCurrencyState(defaultCurrencyFromCountryCode(cc));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrency = useCallback((c: CheckoutCurrency) => {
    setCurrencyState(c);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, c);
    }
  }, []);

  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency]);

  return <CheckoutCurrencyContext.Provider value={value}>{children}</CheckoutCurrencyContext.Provider>;
}

export function useCheckoutCurrency(): Ctx {
  const v = useContext(CheckoutCurrencyContext);
  if (!v) {
    throw new Error("useCheckoutCurrency requires CheckoutCurrencyProvider");
  }
  return v;
}
