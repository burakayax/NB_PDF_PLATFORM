import type { Language } from "./landing";

export type ConversionPopupVariant = "insufficient_credits" | "pro_unlock" | "buy_credits";

export function conversionPopupCopy(language: Language) {
  const tr = language === "tr";
  return {
    insufficientCreditsTitle: tr ? "Yeterli krediniz yok" : "You don't have enough credits",
    insufficientCreditsBody: tr
      ? "İndirmeye veya yeni işlemlere devam etmek için kredi satın alın."
      : "Buy credits to keep downloading and running tools.",
    insufficientCreditsPrimary: tr ? "Kredi satın al" : "Buy Credits",
    insufficientCreditsSecondary: tr ? "Kredi paketlerini aç" : "View packs",

    proUnlockTitle: tr ? "Kredi ile devam edin" : "Continue with credits",
    proUnlockBody: tr
      ? "İşlemler kredi harcar. Paket satın alarak hemen devam edebilirsiniz."
      : "Every run uses credits. Buy a pack to keep going.",
    proUnlockPrimary: tr ? "Kredi paketleri" : "Credit packs",
    proUnlockSecondary: tr ? "Şimdi değil" : "Not now",

    buyCreditsTitle: tr ? "Kredi satın alın" : "Buy credits",
    buyCreditsBody: tr
      ? "İşleminiz tamamlanamadı; kredi ekleyerek yeniden deneyebilirsiniz."
      : "Something went wrong with your run; add credits and try again.",
    buyCreditsPrimary: tr ? "Kredi satın al" : "Buy credits",
    buyCreditsSecondary: tr ? "Kapat" : "Dismiss",

    closeAria: tr ? "Kapat" : "Close",
  };
}
