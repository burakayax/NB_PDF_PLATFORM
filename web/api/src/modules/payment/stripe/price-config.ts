import type { Plan } from "@prisma/client";

/**
 * Sunucu-otoriteli Stripe fiyat kataloğu. Anahtar = Stripe Price ID.
 *
 * Webhook her Checkout Session tamamlandığında gelen `line_items` fiyatını
 * BU tabloya karşı doğrular; listede olmayan bir price_id REDDEDİLİR.
 *
 * ⚠️ Admin UI bu dosyayı DÜZENLEMEZ. Brief gereği "hard-coded source of truth".
 * Pazarlama amaçlı görüntü fiyatları (landing UI) SiteSetting içinde kalmaya
 * devam eder; satın alma doğrulaması yalnızca buradan yapılır.
 *
 * Boş bırakıldı — Phase 3 gerçek entegrasyon adımında Stripe Dashboard
 * (veya Stripe MCP) ile oluşturulan Price ID'leri buraya yazılır.
 */
export type StripePriceEntry =
  | { readonly kind: "subscription"; readonly plan: Plan; readonly months: number }
  | { readonly kind: "credits"; readonly credits: number };

export const PRICE_CONFIG: Readonly<Record<string, StripePriceEntry>> = {
  // Örnek (Phase 3'te doldurulacak):
  // "price_ABC_pro_monthly":    { kind: "subscription", plan: "PRO",      months:  1 },
  // "price_ABC_pro_annual":     { kind: "subscription", plan: "PRO",      months: 12 },
  // "price_ABC_business_month": { kind: "subscription", plan: "BUSINESS", months:  1 },
  // "price_ABC_credits_100":    { kind: "credits",      credits: 100 },
};

export function lookupPrice(priceId: string): StripePriceEntry | null {
  return PRICE_CONFIG[priceId] ?? null;
}
