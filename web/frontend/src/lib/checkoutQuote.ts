import type { PlanDefinition, PlanId } from "./planConfig";

/**
 * ÖDEME ÖZETİ HESABI — sunucudaki (`payments.controller.ts` + `lib/vat.ts`) hesabın
 * birebir aynısı. Ekranda "Ödenecek tutar" olarak gösterilen rakam, iyzico'ya giden
 * rakamla AYNI olmak zorundadır; bu dosya o kuralın tek ön yüz kopyasıdır.
 *
 * TL fiyatlar KDV DAHİLDİR. Sunucu önce KDV'siz neti bulur, kupon/indirimi netten
 * düşer, KDV'yi indirimli net üzerine ekler. USD'de KDV yoktur (ihracat).
 */

export const KDV_RATE = 0.2;
/** Yıllık ödemede ek koltuklara uygulanan katsayı (10 ay fiyatına 12 ay ≈ %17) — sunucuyla AYNI. */
export const YEARLY_SEAT_DISCOUNT = 0.83;
/** Ek koltuk (kişi/ay) — `web/api/src/lib/plan-catalogue.ts` → EXTRA_SEAT_PRICE ile AYNI. TL KDV dahil. */
export const EXTRA_SEAT_UNIT = { TRY: 219, USD: 7.99 } as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Aylık KDV dahil TL'den yıllık KDV dahil TL (~10 ay, 12'nin tam katı). Sunucudaki `yearlyGrossFromMonthly` ile AYNI. */
export function yearlyGrossFromMonthly(monthlyTry: number): number {
  return Math.round((monthlyTry * 10) / 12) * 12;
}

/**
 * Yönetim panelindeki (Paketler) TL fiyatlarını plan listesine uygular. Ana sayfa kartı
 * ve ödeme özeti AYNI fonksiyonu kullanır; sunucu da aynı değerleri tahsil eder.
 * Yalnız TL, yalnız Pro (aylık+yıllık) ve Business (aylık; yıllık türetilir).
 */
export function applyTryPriceOverrides(
  plans: PlanDefinition[],
  tryPrices: { proMonthly: string; proAnnual: string; businessMonthly: string } | null | undefined,
): PlanDefinition[] {
  if (!tryPrices) return plans;
  const toCents = (s: string) => {
    const n = Math.round(Number.parseFloat(s) * 100);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const proM = toCents(tryPrices.proMonthly);
  const proY = toCents(tryPrices.proAnnual);
  const bizM = toCents(tryPrices.businessMonthly);
  return plans.map((p) => {
    if (p.id === "PRO" && proM) {
      return {
        ...p,
        pricing: {
          monthly: { ...p.pricing.monthly, TRY: proM },
          yearly: { ...p.pricing.yearly, TRY: proY ?? p.pricing.yearly.TRY },
        },
      };
    }
    if (p.id === "BUSINESS" && bizM) {
      return {
        ...p,
        pricing: {
          monthly: { ...p.pricing.monthly, TRY: bizM },
          yearly: { ...p.pricing.yearly, TRY: yearlyGrossFromMonthly(bizM / 100) * 100 },
        },
      };
    }
    return p;
  });
}

export type CheckoutQuote = {
  currency: "TRY" | "USD";
  /** İskonto öncesi matrah (TL'de KDV hariç; USD'de KDV zaten yok). */
  listNet: number;
  discountAmount: number;
  /** İskonto sonrası matrah. */
  net: number;
  vatRate: number;
  vat: number;
  /** Müşterinin ödeyeceği (iyzico'ya giden) tutar. */
  total: number;
  /** İskonto öncesi ödenecek tutar (üstü çizili göstermek için). */
  listTotal: number;
};

export function buildCheckoutQuote(input: {
  plan: PlanDefinition | undefined;
  planId: PlanId;
  cycle: "MONTHLY" | "YEARLY";
  currency: "TRY" | "USD";
  extraSeats: number;
  seatsOnly: boolean;
  discountPercent: number | null;
}): CheckoutQuote | null {
  const { plan, cycle, currency, seatsOnly } = input;
  if (!seatsOnly && !plan) return null;
  const yearly = cycle === "YEARLY";
  const vatRate = currency === "TRY" ? KDV_RATE : 0;

  // Plan bedeli (KDV hariç). Ek koltuk yalnız Business'ta satılır.
  let planNet = 0;
  if (!seatsOnly && plan) {
    const minor = yearly ? plan.pricing.yearly[currency] : plan.pricing.monthly[currency];
    const gross = minor / 100;
    planNet = currency === "TRY" ? round2(gross / (1 + KDV_RATE)) : gross;
  }
  const seatCount = seatsOnly || input.planId === "BUSINESS" ? input.extraSeats : 0;
  const seatUnitGross = EXTRA_SEAT_UNIT[currency];
  const seatUnitNet = currency === "TRY" ? round2(seatUnitGross / (1 + KDV_RATE)) : seatUnitGross;
  const seatMonthly = seatCount * seatUnitNet;
  const seatTotal = yearly ? round2(seatMonthly * 12 * YEARLY_SEAT_DISCOUNT) : seatMonthly;

  const listNet = round2(planNet + seatTotal);
  let net = listNet;
  if (input.discountPercent && input.discountPercent > 0) {
    net = Math.max(round2(listNet * (1 - input.discountPercent / 100)), 0.01);
  }
  const vat = round2(net * vatRate);
  const total = round2(net + vat);
  const listTotal = round2(listNet + round2(listNet * vatRate));
  return {
    currency,
    listNet,
    discountAmount: round2(listNet - net),
    net,
    vatRate,
    vat,
    total,
    listTotal,
  };
}
