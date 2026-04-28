import type { Language } from "./landing";

export function creditShopModalCopy(lang: Language) {
  const tr = lang === "tr";
  const fmt = (n: number) =>
    `${n.toLocaleString(tr ? "tr-TR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
  return {
    title: tr ? "Paketler ve fiyatlar" : "Plans & pricing",
    subtitle: tr
      ? "Tek seferlik kredi paketleri veya Limitsiz Pro aylık abonelik. Araçlar kredi harcar; abonelikte sınırsız devam edersiniz."
      : "One-time credit packs or Unlimited Pro monthly subscription. Tools spend credits; subscription gives unlimited runs.",
    popular: tr ? "En Popüler" : "Most popular",
    packContent: (credits: number | null, subscription: boolean) =>
      subscription || credits == null
        ? tr
          ? "SINIRSIZ İŞLEM"
          : "Unlimited operations"
        : tr
          ? `${credits} kredi`
          : `${credits} credits`,
    packPriceTry: (n: number, subscription: boolean) => {
      const base = fmt(n);
      return subscription ? (tr ? `${base} / ay` : `${base} / mo`) : base;
    },
    packHint: tr ? "Ödeme güvenli kanal üzerinden alınır." : "Secure checkout through our payment flow.",
    ctaBuy: tr ? "Satın Al" : "Buy",
    buying: tr ? "İşleniyor…" : "Processing…",
    trustLine: tr
      ? "Ödeme güvenli kanal üzerinden alınır. Krediler veya abonelik onay sonrası hesabınıza yansır."
      : "Checkout runs through our payment flow; credits or subscription apply after confirmation.",
    close: tr ? "Kapat" : "Close",
  };
}
