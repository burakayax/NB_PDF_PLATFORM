import { memo } from "react";
import { Check } from "lucide-react";

import type { Language } from "../../i18n/landing";
import {
  CREDIT_PACKS,
  CREDIT_PACK_MARKETING_FEATURES,
  type CreditPackProduct,
} from "../../lib/creditPacks";
import { formatCheckoutMoney, packAmount, type CheckoutCurrency } from "../../lib/pricingMatrix";
import { PRICING_TIER_CARDS } from "../../lib/pricingTiers";

const PRODUCT_TO_TIER_ID = {
  TIER_STARTER: "starter",
  TIER_PROFESSIONAL: "professional",
  UNLIMITED_PRO: "unlimited_pro",
} as const;

type Props = {
  selected: CreditPackProduct;
  currency: CheckoutCurrency;
  language: Language;
  onSelect: (p: CreditPackProduct) => void;
};

function CheckoutPackSelectionCardsInner({
  selected,
  currency,
  language,
  onSelect,
}: Props) {
  const tr = language === "tr";

  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:items-stretch min-[620px]:grid-cols-3">
      {CREDIT_PACKS.map((pack) => {
        const tierMeta = PRICING_TIER_CARDS.find((t) => t.id === PRODUCT_TO_TIER_ID[pack.product]);
        const isPopular = tierMeta?.highlight === "popular";
        const isSel = selected === pack.product;
        const features =
          CREDIT_PACK_MARKETING_FEATURES[pack.product]?.[language === "tr" ? "tr" : "en"] ?? [];

        const priceStr = formatCheckoutMoney(packAmount(pack.product, currency), currency, tr ? "tr" : "en");
        const priceDisplay = pack.subscription ? `${priceStr}${tr ? " / ay" : " / mo"}` : priceStr;

        const selClasses = isPopular
          ? "border-indigo-400/70 shadow-[0_0_28px_-8px_rgba(99,102,241,0.5)]"
          : "border-teal-400/55 shadow-[0_0_20px_-10px_rgba(45,212,191,0.32)]";
        const idleClasses = isPopular
          ? "border-indigo-500/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          : "border-white/[0.10]";

        return (
          <button
            key={pack.product}
            type="button"
            onClick={() => onSelect(pack.product)}
            style={{
              contain: "layout style",
              transition: "all 0.3s ease-in-out",
            }}
            className={`relative flex min-h-[308px] min-w-0 w-full max-w-full flex-col overflow-hidden rounded-2xl bg-[#080b10] border-2 text-left motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:min-w-[200px] hover:border-white/[0.14] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/45 ${isSel ? selClasses : idleClasses}`}
          >
            <span className="pointer-events-none absolute right-2.5 top-2.5 z-10 inline-flex min-h-[22px] items-center justify-end">
              {isPopular ? (
                <span
                  className="rounded-full bg-gradient-to-r from-amber-500/92 via-amber-400 to-orange-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-950 shadow-sm"
                  aria-hidden
                >
                  {tr ? "En uygun fiyat" : "Best value"}
                </span>
              ) : (
                <span className="block w-[1px]" aria-hidden />
              )}
            </span>

            <div className="flex min-h-0 flex-1 flex-col p-4 pt-9">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {tr ? pack.nameTr : pack.nameEn}
              </p>

              {!pack.subscription && typeof pack.credits === "number" ? (
                <p className="mt-2 text-xl font-black tabular-nums tracking-tight text-white">
                  {pack.credits} {tr ? "kr" : "cr"}
                </p>
              ) : (
                <p className="mt-2 text-xl font-black tracking-tight text-white">
                  <span aria-hidden className="align-middle">
                    ∞
                  </span>{" "}
                  <span className="text-[13px] font-semibold text-slate-400">{tr ? "/ ay" : "/ mo"}</span>
                </p>
              )}

              <p
                className={`mt-3 text-[1.35rem] font-black tabular-nums leading-none tracking-tight ${isPopular ? "text-white" : "text-slate-100"}`}
              >
                {priceDisplay}
              </p>

              <ul
                className="mt-4 flex flex-1 flex-col gap-1.5 border-t border-white/[0.06] pt-4 text-left min-h-[6.75rem] sm:min-h-[7.25rem]"
                role="list"
              >
                {features.map((line) => (
                  <li
                    key={line}
                    className="flex gap-2 text-[11px] leading-snug text-slate-400 sm:text-[12px]"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/95" strokeWidth={3} aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <span
                className={`mt-auto block border-t border-transparent pt-4 text-center text-[10px] font-semibold uppercase tracking-wider ${isSel ? "text-teal-200/90" : "text-slate-600"}`}
              >
                {isSel ? (tr ? "Seçili" : "Selected") : tr ? "Seçmek için tıklayın" : "Tap to select"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export const CheckoutPackSelectionCards = memo(
  CheckoutPackSelectionCardsInner,
  (prev, next) =>
    prev.selected === next.selected &&
    prev.currency === next.currency &&
    prev.language === next.language &&
    prev.onSelect === next.onSelect,
);
