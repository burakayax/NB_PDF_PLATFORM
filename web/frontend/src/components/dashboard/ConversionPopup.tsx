import { useEffect, useId, useRef } from "react";
import type { Language } from "../../i18n/landing";
import {
  conversionPopupCopy,
  type ConversionPopupVariant,
} from "../../i18n/conversionPopup";

export type ConversionPopupProps = {
  open: boolean;
  variant: ConversionPopupVariant | null;
  language: Language;
  onDismiss: () => void;
  onPrimary: () => void;
  onSecondary?: () => void;
};

/**
 * Lightweight, dismissible conversion surface. Three variants map to the
 * product triggers documented in the conversion spec; copy lives in i18n
 * only — no business rules here.
 */
export function ConversionPopup({
  open,
  variant,
  language,
  onDismiss,
  onPrimary,
  onSecondary,
}: ConversionPopupProps) {
  const C = conversionPopupCopy(language);
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onDismiss();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDismiss]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLButtonElement>(".conversion-popup__cta-primary")?.focus();
    }, 120);
    return () => window.clearTimeout(t);
  }, [open, variant]);

  if (!open || !variant) {
    return null;
  }

  const titles = {
    insufficient_credits: C.insufficientCreditsTitle,
    pro_unlock: C.proUnlockTitle,
    buy_credits: C.buyCreditsTitle,
  } as const;
  const bodies = {
    insufficient_credits: C.insufficientCreditsBody,
    pro_unlock: C.proUnlockBody,
    buy_credits: C.buyCreditsBody,
  } as const;
  const primaryLabels = {
    insufficient_credits: C.insufficientCreditsPrimary,
    pro_unlock: C.proUnlockPrimary,
    buy_credits: C.buyCreditsPrimary,
  } as const;
  const secondaryLabels = {
    insufficient_credits: C.insufficientCreditsSecondary,
    pro_unlock: C.proUnlockSecondary,
    buy_credits: C.buyCreditsSecondary,
  } as const;

  return (
    <div
      className="conversion-popup-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div
        ref={panelRef}
        className="conversion-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="conversion-popup__accent" aria-hidden />
        <div className="conversion-popup__head">
          <p className="conversion-popup__eyebrow" aria-hidden>
            {language === "tr" ? "Öneri" : "Offer"}
          </p>
          <button type="button" className="conversion-popup__close" onClick={onDismiss} aria-label={C.closeAria}>
            ×
          </button>
        </div>

        <h2 id={titleId} className="conversion-popup__title">
          {titles[variant]}
        </h2>
        <p id={descId} className="conversion-popup__subtitle">
          {bodies[variant]}
        </p>

        <div className="conversion-popup__actions">
          <button type="button" className="conversion-popup__cta-primary" onClick={onPrimary}>
            {primaryLabels[variant]}
          </button>
          <button
            type="button"
            className="conversion-popup__cta-secondary"
            onClick={onSecondary ?? onDismiss}
          >
            {secondaryLabels[variant]}
          </button>
        </div>
      </div>
    </div>
  );
}
