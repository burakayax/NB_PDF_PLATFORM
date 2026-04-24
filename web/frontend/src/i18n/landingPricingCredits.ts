import type { Language } from "./landing";

export function landingPricingCreditsCopy(lang: Language) {
  const tr = lang === "tr";
  return {
    popular: tr ? "Çok satan" : "Popular",
    packLabel: tr ? "Kredi paketi" : "Credit pack",
    creditsLine: (n: number) => (tr ? `${n} kredi` : `${n} credits`),
    packBlurb: tr
      ? "Ödeme sonrası krediler hesabınıza eklenir; araçlar her kullanımda kredi harcar."
      : "After checkout, credits are added to your account. Each tool run spends credits.",
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
