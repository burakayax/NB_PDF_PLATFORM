import {
  DEFAULT_PAYMENT_PRICES_TRY,
  getResolvedPackagesConfig,
  invalidatePaymentPricesCache as invalidatePackagesPricesCache,
  putPaymentPricesTry as putPackagesPaymentPricesTry,
  type PriceBook,
} from "../../lib/packages-config.service.js";

export { DEFAULT_PAYMENT_PRICES_TRY };
export type { PriceBook };

export type PaymentPricesTry = Record<"PRO" | "BUSINESS" | "PRO_ANNUAL", string>;

/** Geriye dönük kısa görünüm (Pro/Business TL). Yeni kod `getPriceBook()` kullanmalı. */
export async function getPaymentPricesTry(): Promise<PaymentPricesTry> {
  const { prices } = await getResolvedPackagesConfig();
  return prices;
}

/** Tüm ücretli planların TL (KDV dahil) + USD fiyatları ve ek koltuk — ödemenin ve ekranların TEK kaynağı. */
export async function getPriceBook(): Promise<PriceBook> {
  const { priceBook } = await getResolvedPackagesConfig();
  return priceBook;
}

export function invalidatePaymentPricesCache() {
  invalidatePackagesPricesCache();
}

export async function putPaymentPricesTry(prices: Record<"PRO" | "BUSINESS", string>) {
  await putPackagesPaymentPricesTry(prices);
}
