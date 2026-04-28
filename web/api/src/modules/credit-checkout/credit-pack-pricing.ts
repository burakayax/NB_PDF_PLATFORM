/**
 * Kredi paketi katalogu — `fake-payment.service` ile aynı tutar tutulmalı.
 */
export const CREDIT_PACK_CATALOG: Record<
  | "CREDITS_50"
  | "CREDITS_100"
  | "CREDITS_120"
  | "CREDITS_300"
  | "TIER_STARTER"
  | "TIER_PROFESSIONAL",
  { amountTry: number; credits: number }
> = {
  CREDITS_50: { amountTry: 29, credits: 50 },
  CREDITS_100: { amountTry: 49, credits: 100 },
  CREDITS_120: { amountTry: 59, credits: 120 },
  CREDITS_300: { amountTry: 129, credits: 300 },
  /** Bronz / workspace tier — one-time. */
  TIER_STARTER: { amountTry: 149, credits: 100 },
  /** Altın / workspace tier — one-time. */
  TIER_PROFESSIONAL: { amountTry: 399, credits: 500 },
};

export type CreditPackSku = keyof typeof CREDIT_PACK_CATALOG;

export function isCreditPackSku(product: string): product is CreditPackSku {
  return product in CREDIT_PACK_CATALOG;
}

export function formatTry2(value: number): string {
  return value.toFixed(2);
}

/** iyzico requires `price` / `paidPrice` as strings with two decimals (e.g. `"149.00"`). */
export function normalizeIyzicoMoneyString(input: string | number): string {
  const n = typeof input === "number" ? input : parsePriceTry(String(input).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid iyzico amount: ${String(input)}`);
  }
  return n.toFixed(2);
}

export function eqIyzicoMoney(a: unknown, b: unknown): boolean {
  try {
    return normalizeIyzicoMoneyString(typeof a === "number" ? a : String(a ?? "")) === normalizeIyzicoMoneyString(
      typeof b === "number" ? b : String(b ?? ""),
    );
  } catch {
    return String(a ?? "") === String(b ?? "");
  }
}

/** Çıkış niyeti teklifi: ek yüzde (kupon sonrası fiyat üzerinden). */
export const EXIT_INTENT_EXTRA_PERCENT = 10;
/** Aynı kullanıcıda çıkış indiriminin tekrar sunulma aralığı. */
export const EXIT_INTENT_COOLDOWN_DAYS = 30;

export function parsePriceTry(s: string): number {
  return Math.round(parseFloat(s) * 100) / 100;
}
