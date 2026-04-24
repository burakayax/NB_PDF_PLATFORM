import type { Language } from "./landing";

export function creditShopModalCopy(lang: Language) {
  const tr = lang === "tr";
  return {
    title: tr ? "Kredi paketleri" : "Credit packs",
    subtitle: tr
      ? "Araçlar her kullanımda kredi harcar. İhtiyacınız kadar kredi yükleyin."
      : "Each tool run spends credits. Top up with the bundle that fits you.",
    popular: tr ? "Çok satan" : "Popular",
    packCredits: (n: number) => (tr ? `${n} kredi` : `${n} credits`),
    packPriceTry: (n: number) => `₺${n}`,
    packHint: tr ? "Anında hesabınıza eklenir." : "Credits are added to your account instantly.",
    ctaBuy: tr ? "Satın Al" : "Buy",
    buying: tr ? "İşleniyor…" : "Processing…",
    trustLine: tr
      ? "Ödeme güvenli kanal üzerinden alınır. Krediler onay sonrası bakiyenize yansır."
      : "Checkout runs through our payment flow; credits appear after confirmation.",
    close: tr ? "Kapat" : "Close",
  };
}
