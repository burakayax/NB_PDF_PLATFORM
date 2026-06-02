// KDV hesaplama servisi — Türkiye 2023+ oranı %20
//
// Güvenli taraf (safe-harbor) kuralı:
//   - TRY ödemesi           → daima KDV (%20), istisna yok
//   - Beyan edilen ülke TR  → KDV
//   - Ülke bilinmiyor/boş   → KDV (şüphe hâlinde vergi al)
//   - Yabancı ülke + USD    → İhracat İstisnası (KDV %0)
//
// iyzico callback'ten gelen cardCountry ek sinyal olarak kullanılır;
// TR kart tespit edilirse uyarı loglanır (bkz. payment.service.ts).

const KDV_RATE = 0.20;

export interface VATResult {
  rate: number;
  isExport: boolean;
}

export interface CheckoutPricing {
  grossAmount: string;
  netAmount: string;
  kdvRate: number;
  kdvAmount: string;
  isExport: boolean;
}

export type VATDisplayLang = "tr" | "en";

export interface VATDisplayLabels {
  priceLabel: string;
  vatLabel: string | null;
  totalLabel: string;
}

/**
 * Ödeme sırasındaki tüm sinyalleri birleştirerek etkin müşteri ülkesini döner.
 *
 * Öncelik sırası (güvenli taraf):
 *  1. TRY para birimi → her zaman "TR"
 *  2. Beyan edilen fatura ülkesi (billingCountryCode)
 *  3. Hiçbiri yoksa → "TR" (KDV uygula, şüphede vergi kaybetme)
 */
export function resolveEffectiveCountry(
  checkoutCurrency: string | null | undefined,
  billingCountryCode: string | null | undefined,
): string {
  const cur = (checkoutCurrency ?? "").toUpperCase().trim();
  // TRY ödemesi kesinlikle Türkiye
  if (cur === "TRY") return "TR";
  // Fatura ülkesi beyanı
  const declared = (billingCountryCode ?? "").toUpperCase().trim();
  if (declared) return declared;
  // Bilinmiyor — güvenli taraf: KDV uygula
  return "TR";
}

/**
 * Fatura ülkesi ve ödeme para birimini birlikte değerlendirerek KDV kararı verir.
 *
 * İhracat istisnası için iki koşulun aynı anda sağlanması gerekir:
 *   1. checkoutCurrency ≠ "TRY"
 *   2. Etkin ülke ≠ "TR"
 */
export function calculateVAT(
  countryCode: string | null | undefined,
  checkoutCurrency?: string | null,
): VATResult {
  const effective = resolveEffectiveCountry(checkoutCurrency, countryCode);
  if (effective === "TR") {
    return { rate: KDV_RATE, isExport: false };
  }
  return { rate: 0, isExport: true };
}

export function buildCheckoutPricing(
  basePriceTry: string,
  countryCode: string | null | undefined,
  checkoutCurrency?: string | null,
): CheckoutPricing {
  const gross = parseFloat(basePriceTry.replace(",", "."));
  if (!isFinite(gross) || gross <= 0) {
    throw new Error(`Invalid base price: ${basePriceTry}`);
  }

  const { rate, isExport } = calculateVAT(countryCode, checkoutCurrency);

  if (rate === 0) {
    return {
      grossAmount: gross.toFixed(2),
      netAmount: gross.toFixed(2),
      kdvRate: 0,
      kdvAmount: "0.00",
      isExport: true,
    };
  }

  const kdv = Math.round(gross * rate * 100) / 100;
  const grossAmount = Math.round((gross + kdv) * 100) / 100;
  return {
    grossAmount: grossAmount.toFixed(2),
    netAmount: gross.toFixed(2),
    kdvRate: rate,
    kdvAmount: kdv.toFixed(2),
    isExport: false,
  };
}

function formatTRY(amount: string): string {
  const n = parseFloat(amount);
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

export function formatVATDisplay(
  pricing: CheckoutPricing,
  lang: VATDisplayLang,
): VATDisplayLabels {
  if (pricing.isExport || pricing.kdvRate === 0) {
    return {
      priceLabel: formatTRY(pricing.grossAmount),
      vatLabel: lang === "tr" ? "KDV Muaf (İhracat İstisnası)" : "VAT Exempt (Export)",
      totalLabel: formatTRY(pricing.grossAmount),
    };
  }

  const ratePercent = Math.round(pricing.kdvRate * 100);
  return {
    priceLabel: lang === "tr"
      ? `${formatTRY(pricing.netAmount)} + KDV`
      : `${formatTRY(pricing.netAmount)} + VAT`,
    vatLabel: lang === "tr"
      ? `KDV (%${ratePercent}): ${formatTRY(pricing.kdvAmount)}`
      : `VAT (${ratePercent}%): ${formatTRY(pricing.kdvAmount)}`,
    totalLabel: lang === "tr"
      ? `Toplam: ${formatTRY(pricing.grossAmount)}`
      : `Total: ${formatTRY(pricing.grossAmount)}`,
  };
}
