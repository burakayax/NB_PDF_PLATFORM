import type { Language } from "./landing";

/** Delay / friction modal — credit-first copy (EN + TR). */
export function conversionUpgradeModalCopy(lang: Language) {
  const tr = lang === "tr";
  return {
    eyebrow: tr ? "Kredi modeli" : "Credits",
    title: tr ? "İşlem sırasında kısa bir bekleme" : "A short wait during processing",
    subtitle: tr
      ? "Yoğunluk olduğunda sıra oluşabilir. Kredi bakiyenizle işlemlerinize devam edersiniz."
      : "When it’s busy, jobs may queue. Your credit balance keeps you moving.",
    speedStrip: tr
      ? "Kredi sistemi: her araç çalıştırma bakiyenizden düşer."
      : "Credit system: each tool run draws from your balance.",
    features: tr
      ? [
          "Kullandığın kadar öde",
          "Bakiyeni panelden izle",
          "Paketleri istediğin zaman al",
          "Hareket geçmişi şeffaf",
        ]
      : [
          "Pay only for what you use",
          "Track balance in the dashboard",
          "Buy packs whenever you need",
          "Full ledger of credit changes",
        ],
    usageLine: (credits: number) =>
      tr
        ? `Kalan kredi: ${credits}. Paket alarak devam edebilirsiniz.`
        : `Credits left: ${credits}. Buy a pack to top up.`,
    ctaPrimary: tr ? "Kredi paketlerini gör" : "See credit packs",
    ctaSecondary: tr ? "Belki sonra" : "Maybe later",
    close: tr ? "Kapat" : "Close",
  };
}
