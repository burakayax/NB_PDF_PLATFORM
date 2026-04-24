import { useEffect } from "react";
import type { Language } from "../../i18n/landing";
import { creditShopModalCopy } from "../../i18n/creditShopModal";
import type { FakePaymentProduct } from "../../api/fakePayment";
import { CREDIT_PACKS } from "../../lib/creditPacks";

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  language: Language;
  buyingProduct: FakePaymentProduct | null;
  onBuyPack: (product: FakePaymentProduct) => void;
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
            return (
              <article
                key={pack.product}
                className={`upgrade-modal__plan ${i === 1 ? "upgrade-modal__plan--pro" : ""}`}
              >
                {i === 1 ? <span className="upgrade-modal__ribbon upgrade-modal__ribbon--popular">{C.popular}</span> : null}
                <h3 className="upgrade-modal__plan-name">{C.packCredits(pack.credits)}</h3>
                <p className="upgrade-modal__plan-price upgrade-modal__plan-price--sm">{C.packPriceTry(pack.priceTry)}</p>
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
