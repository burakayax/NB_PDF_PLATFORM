import { Check } from "lucide-react";
import { useEffect } from "react";
import type { Language } from "../../i18n/landing";
import { creditShopModalCopy } from "../../i18n/creditShopModal";
import type { CreditPackProduct } from "../../lib/creditPacks";
import { CREDIT_PACK_MARKETING_FEATURES, CREDIT_PACKS } from "../../lib/creditPacks";

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  language: Language;
  buyingProduct: CreditPackProduct | null;
  onBuyPack: (product: CreditPackProduct) => void;
};

export function UpgradeModal({ open, onClose, language, buyingProduct, onBuyPack }: UpgradeModalProps) {
  const C = creditShopModalCopy(language);

  useEffect(() => {
    if (!open) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="upgrade-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="upgrade-modal upgrade-modal--regional"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        aria-describedby="upgrade-modal-subtitle"
      >
        <div className="upgrade-modal__glow" aria-hidden />

        <div className="upgrade-modal__header">
          <div className="upgrade-modal__brand">
            <span className="upgrade-modal__brand-mark">NB</span>
            <span className="upgrade-modal__brand-text">PDF TOOLS</span>
          </div>
          <button type="button" className="upgrade-modal__close" onClick={onClose} aria-label={C.close}>
            ×
          </button>
        </div>

        <h2 id="upgrade-modal-title" className="upgrade-modal__title">
          {C.title}
        </h2>
        <p id="upgrade-modal-subtitle" className="upgrade-modal__subtitle">
          {C.subtitle}
        </p>

        <div className="upgrade-modal__plans upgrade-modal__plans--three">
          {CREDIT_PACKS.map((pack, i) => {
            const busy = buyingProduct === pack.product;
            const tierName = language === "tr" ? pack.nameTr : pack.nameEn;
            return (
              <article
                key={pack.product}
                className={`upgrade-modal__plan ${i === 1 ? "upgrade-modal__plan--pro" : ""}`}
              >
                {i === 1 ? <span className="upgrade-modal__ribbon upgrade-modal__ribbon--popular">{C.popular}</span> : null}
                <h3 className="upgrade-modal__plan-name">{tierName}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/55">{C.packContent(pack.credits, pack.subscription)}</p>
                <p className="upgrade-modal__plan-price upgrade-modal__plan-price--sm">{C.packPriceTry(pack.priceTry, pack.subscription)}</p>
                <ul className="upgrade-modal__feat-list mb-4 mt-3 space-y-1.5 text-left" role="list">
                  {(language === "tr" ? CREDIT_PACK_MARKETING_FEATURES[pack.product].tr : CREDIT_PACK_MARKETING_FEATURES[pack.product].en).map((line) => (
                    <li key={line} className="flex gap-2 text-[13px] leading-snug text-slate-400">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={3} aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm leading-relaxed text-nb-muted">{C.packHint}</p>
                <button
                  type="button"
                  className={`upgrade-modal__cta ${i === 1 ? "upgrade-modal__cta--pro" : "upgrade-modal__cta--business"}`}
                  disabled={buyingProduct !== null}
                  onClick={() => onBuyPack(pack.product)}
                >
                  {busy ? C.buying : C.ctaBuy}
                </button>
              </article>
            );
          })}
        </div>

        <div className="upgrade-modal__trust">
          <span>{C.trustLine}</span>
        </div>
      </div>
    </div>
  );
}
