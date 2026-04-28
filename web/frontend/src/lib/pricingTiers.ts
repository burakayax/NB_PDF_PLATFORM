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
  },
] as const;
