/**
 * Workspace checkout catalog — Bronz / Altın / Limitsiz Pro.
 * `TIER_*` match `web/api/.../credit-pack-pricing.ts`; `UNLIMITED_PRO` opens subscription checkout (`/api/payments/initialize`).
 */
export const CREDIT_PACK_PRODUCTS = ["TIER_STARTER", "TIER_PROFESSIONAL", "UNLIMITED_PRO"] as const;

export type CreditPackProduct = (typeof CREDIT_PACK_PRODUCTS)[number];

export type CreditPackDefinition = {
  product: CreditPackProduct;
  /** One-time credit amount; `null` = subscription. */
  credits: number | null;
  priceTry: number;
  subscription: boolean;
  nameTr: string;
  nameEn: string;
};

/** Marketing bullets shown on dashboard / upgrade flows (lifetime applies to prepaid credits). */
export const CREDIT_PACK_MARKETING_FEATURES: Record<
  CreditPackProduct,
  { readonly tr: readonly string[]; readonly en: readonly string[] }
> = {
  TIER_STARTER: {
    tr: ["Ömür boyu kullanım", "Bitiş tarihi yok", "Tüm araçlar"],
    en: ["Lifetime usage", "No expiration", "All PDF tools"],
  },
  TIER_PROFESSIONAL: {
    tr: ["En iyi fiyat / kredi", "Öncelikli destek", "Kurumsal projeler için ideal"],
    en: ["Best value per credit", "Priority support", "Ideal for power users"],
  },
  UNLIMITED_PRO: {
    tr: ["Sınırsız işlem", "Öncelikli destek", "İstediğiniz zaman iptal"],
    en: ["Unlimited operations", "Priority support", "Cancel anytime"],
  },
};

export const CREDIT_PACKS: readonly CreditPackDefinition[] = [
  {
    product: "TIER_STARTER",
    credits: 100,
    priceTry: 149,
    subscription: false,
    nameTr: "Bronz Paket (Giriş)",
    nameEn: "Bronze Pack (Entry)",
  },
  {
    product: "TIER_PROFESSIONAL",
    credits: 500,
    priceTry: 399,
    subscription: false,
    nameTr: "Altın Paket",
    nameEn: "Gold Pack",
  },
  {
    product: "UNLIMITED_PRO",
    credits: null,
    priceTry: 699,
    subscription: true,
    nameTr: "Limitsiz Pro",
    nameEn: "Unlimited Pro",
  },
] as const;

export function isCreditPackProduct(p: unknown): p is CreditPackProduct {
  return (CREDIT_PACK_PRODUCTS as readonly string[]).includes(String(p));
}
