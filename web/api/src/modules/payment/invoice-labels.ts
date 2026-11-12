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

/** Örn. "Plus Abonelik (1 Aylık)". */
export function subscriptionInvoiceName(input: {
  plan: string | null | undefined;
  billingCycle?: string | null;
  subscriptionDays?: number | null;
}): string {
  return `${planInvoiceLabel(input.plan)} Abonelik (${billingPeriodLabel(input)})`;
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
