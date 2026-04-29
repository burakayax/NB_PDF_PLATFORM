/** Matches `POST /api/payments/initialize` body.tier — keep in sync with API. */
export type PricingTierId = "starter" | "professional" | "unlimited_pro";

export type TierHighlight = "popular";

export type TierCardDef = {
  id: PricingTierId;
  nameEn: string;
  nameTr: string;
  fallbackPriceTry: number;
  fallbackCredits: number | null;
  periodLabelEn: string;
  periodLabelTr: string;
  contentEn: string;
  contentTr: string;
  highlight?: TierHighlight;
  featuresEn: readonly string[];
  featuresTr: readonly string[];
};

export const PRICING_TIER_CARDS: readonly TierCardDef[] = [
  {
    id: "starter",
    nameEn: "Bronz Paket (Entry)",
    nameTr: "Bronz Paket (Giriş)",
    fallbackPriceTry: 149,
    fallbackCredits: 100,
    periodLabelEn: "One-time",
    periodLabelTr: "Tek seferlik",
    contentEn: "100 credits",
    contentTr: "100 Kredi",
    featuresEn: ["Lifetime usage", "No expiration", "All PDF tools"],
    featuresTr: ["Ömür boyu kullanım", "Bitiş tarihi yok", "Tüm PDF araçları"],
  },
  {
    id: "professional",
    nameEn: "Gold Pack",
    nameTr: "Altın Paket",
    fallbackPriceTry: 399,
    fallbackCredits: 500,
    periodLabelEn: "One-time",
    periodLabelTr: "Tek seferlik",
    contentEn: "500 credits",
    contentTr: "500 Kredi",
    highlight: "popular",
    featuresEn: ["Best value per credit", "Priority support", "No credit cap rush"],
    featuresTr: ["En iyi fiyat/kredi", "Öncelikli destek", "Yüksek hacim için"],
  },
  {
    id: "unlimited_pro",
    nameEn: "Unlimited Pro",
    nameTr: "Limitsiz Pro",
    fallbackPriceTry: 699,
    fallbackCredits: null,
    periodLabelEn: "per month",
    periodLabelTr: "ay",
    contentEn: "Unlimited operations",
    contentTr: "SINIRSIZ İŞLEM",
    featuresEn: ["Unlimited operations", "Priority support", "Cancel anytime"],
    featuresTr: ["Sınırsız işlem", "Öncelikli destek", "İstediğiniz zaman iptal"],
  },
] as const;
