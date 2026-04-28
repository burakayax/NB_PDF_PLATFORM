/**
 * Fixed global tier prices — no FX conversion. Same numbers used for iyzico checkout.
 * BRONZ = TIER_STARTER, ALTIN = TIER_PROFESSIONAL, LİMİTSİZ PRO = unlimited monthly.
 */
export const CHECKOUT_CURRENCIES = ["TRY", "USD", "EUR"] as const;
export type CheckoutCurrency = (typeof CHECKOUT_CURRENCIES)[number];

export function isCheckoutCurrency(c: string): c is CheckoutCurrency {
  return (CHECKOUT_CURRENCIES as readonly string[]).includes(c);
}

/** EU member states (ISO 3166-1 alpha-2) → default EUR in checkout. */
export const EU_COUNTRY_CODES = new Set<string>([
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

export function defaultCurrencyForCountry(countryCode: string | null | undefined): CheckoutCurrency {
  const cc = countryCode?.trim().toUpperCase() ?? "";
  if (cc === "TR") {
    return "TRY";
  }
  if (EU_COUNTRY_CODES.has(cc)) {
    return "EUR";
  }
  return "USD";
}

const BRONZ = { TRY: 149, USD: 4.99, EUR: 4.99 };
const ALTIN = { TRY: 399, USD: 12.99, EUR: 12.99 };
const LIMITSIZ = { TRY: 699, USD: 19.99, EUR: 19.99 };

export function getTierOneTimePrice(
  sku: "TIER_STARTER" | "TIER_PROFESSIONAL",
  currency: CheckoutCurrency,
): number {
  const table = sku === "TIER_STARTER" ? BRONZ : ALTIN;
  return table[currency];
}

export function getUnlimitedProPrice(currency: CheckoutCurrency): number {
  return LIMITSIZ[currency];
}

export function formatMoney2(_currency: CheckoutCurrency, amount: number): string {
  return amount.toFixed(2);
}

