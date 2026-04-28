/**
 * Fixed tier prices — keep aligned with `web/api/src/modules/payment/pricing-matrix.ts`.
 */
import type { CreditPackProduct } from "./creditPacks";

export type CheckoutCurrency = "TRY" | "USD" | "EUR";

const BRONZ = { TRY: 149, USD: 4.99, EUR: 4.99 };
const ALTIN = { TRY: 399, USD: 12.99, EUR: 12.99 };
const PRO = { TRY: 699, USD: 19.99, EUR: 19.99 };

export function packAmount(product: CreditPackProduct, c: CheckoutCurrency): number {
  if (product === "TIER_STARTER") return BRONZ[c];
  if (product === "TIER_PROFESSIONAL") return ALTIN[c];
  return PRO[c];
}

export function formatCheckoutMoney(amount: number, currency: CheckoutCurrency, language: "tr" | "en"): string {
  switch (currency) {
    case "TRY":
      return `${amount.toLocaleString(language === "tr" ? "tr-TR" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ₺`;
    case "USD":
      return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "EUR":
      return `€${amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    default: {
      const _x: never = currency;
      return String(_x);
    }
  }
}
