import type { Language } from "./landing";

export function landingPricingCreditsCopy(lang: Language) {
  const tr = lang === "tr";
  return {
    popular: tr ? "En Popüler" : "Most popular",
    packContentLine: (credits: number | null, subscription: boolean) => {
      if (subscription || credits == null) {
        return tr ? "SINIRSIZ İŞLEM" : "Unlimited operations";
      }
      return tr ? `${credits} kredi` : `${credits} credits`;
    },
    packBlurbOneTime: tr
      ? "Tek seferlik ödeme; ödeme sonrası krediler hesabınıza eklenir."
      : "One-time payment; credits are added after checkout.",
    packBlurbSubscription: tr
      ? "Aylık abonelik; Limitsiz Pro ile ödeme sayfasından güvenli şekilde başlatılır."
      : "Monthly subscription; Unlimited Pro checkout starts on our secure payment page.",
    ctaBuy: tr ? "Satın Al" : "Buy",
    examplesLead: tr
      ? "Örnek maliyetler (araç başına kredi):"
      : "Example costs (credits per tool):",
    exampleSplit: tr ? "PDF bölme: 2 kredi" : "PDF split: 2 credits",
    exampleMerge: tr ? "PDF birleştirme: 3 kredi" : "PDF merge: 3 credits",
    freeTeaser: tr
      ? "Hesap oluşturun; kredi paketlerini çalışma alanından satın alın."
      : "Create an account — buy packs from your workspace.",
    ctaStart: tr ? "Çalışma alanına git" : "Open workspace",
  };
}
