/**
 * Faturadaki "Mal/Hizmet" adı. Marka (PDF PLATFORM) BirFatura'da ayrıca yazıldığı için ad içinde TEKRAR edilmez
 * ("PDF PLATFORM PDF PLATFORM PLUS Abonelik" hatası buradan çıkmıştı). Dönem (aylık/yıllık) her hesapta yazılır.
 */

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter",
  PLUS: "Plus",
  PRO: "Pro",
  BUSINESS: "Business",
};

export function planInvoiceLabel(plan: string | null | undefined): string {
  const key = String(plan ?? "").trim().toUpperCase();
  return PLAN_LABELS[key] ?? (key ? key.charAt(0) + key.slice(1).toLowerCase() : "Pro");
}

export function billingPeriodLabel(input: { billingCycle?: string | null; subscriptionDays?: number | null }): string {
  const yearly = input.billingCycle === "YEARLY" || (input.subscriptionDays ?? 30) >= 365;
  return yearly ? "1 Yıllık" : "1 Aylık";
}

/**
 * Örn. "Plus Abonelik (1 Aylık)". Business'ta ek koltuk varsa kalem adında yazılır, çünkü
 * tutar koltukları da kapsar ("Business + 3 Ek Koltuk"); yalnız koltuk alımında "3 Ek Koltuk".
 */
export function subscriptionInvoiceName(input: {
  plan: string | null | undefined;
  billingCycle?: string | null;
  subscriptionDays?: number | null;
  extraSeats?: number | null;
  seatsOnly?: boolean | null;
}): string {
  const period = billingPeriodLabel(input);
  const seats = Math.max(0, Math.floor(input.extraSeats ?? 0));
  if (input.seatsOnly && seats > 0) return `${seats} Ek Koltuk (${period})`;
  if (seats > 0) return `${planInvoiceLabel(input.plan)} Abonelik + ${seats} Ek Koltuk (${period})`;
  return `${planInvoiceLabel(input.plan)} Abonelik (${period})`;
}

/**
 * Ödeme sağlayıcısını Python tarafına bildirir: PayTR ödemelerinde "paytr:<sipariş no>" gelmelidir
 * (aksi halde faturada yanlışlıkla "iyzico" yazılır).
 */
export function invoicePaymentId(checkout: { iyzicoPaymentId?: string | null; conversationId: string }, fallback?: string | null): string {
  const stored = checkout.iyzicoPaymentId ?? "";
  if (stored.toLowerCase().startsWith("paytr:")) return stored;
  return fallback && fallback.trim() ? fallback : (stored || checkout.conversationId);
}
