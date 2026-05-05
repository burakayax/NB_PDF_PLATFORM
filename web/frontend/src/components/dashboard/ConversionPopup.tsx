import { useEffect, useId, useRef } from "react";
import type { Language } from "../../i18n/landing";

export type ConversionPopupVariant = "plan_limit_reached" | "pro_unlock" | "upgrade";

export type ConversionPopupProps = {
  open: boolean;
  variant: ConversionPopupVariant | null;
  language: Language;
  onDismiss: () => void;
  onPrimary: () => void;
  onSecondary?: () => void;
};

function copy(language: Language) {
  const tr = language === "tr";
  return {
    planLimitTitle: tr ? "Plan limitinize ulaştınız" : "You've reached your plan limit",
    planLimitBody: tr
      ? "Bu ay için işlem limitiniz doldu. Devam etmek için planınızı yükseltin."
      : "You've used all your operations for this month. Upgrade your plan to continue.",
    planLimitPrimary: tr ? "Planları Gör" : "View Plans",
    planLimitSecondary: tr ? "Kapat" : "Close",

    proUnlockTitle: tr ? "Daha fazlası için yükseltin" : "Upgrade for more",
    proUnlockBody: tr
      ? "Daha fazla işlem, daha büyük dosyalar ve gelişmiş araçlar için planınızı yükseltin."
      : "Upgrade your plan for more operations, larger files, and advanced tools.",
    proUnlockPrimary: tr ? "Planları Gör" : "View Plans",
    proUnlockSecondary: tr ? "Şimdi değil" : "Not now",

    upgradeTitle: tr ? "Plan yükseltin" : "Upgrade your plan",
    upgradeBody: tr
      ? "Daha iyi bir plan seçerek tüm araçlara erişin."
      : "Choose a better plan to access all tools.",
    upgradePrimary: tr ? "Planları Gör" : "View Plans",
    upgradeSecondary: tr ? "Kapat" : "Dismiss",

    closeAria: tr ? "Kapat" : "Close",
  };
}

export function ConversionPopup({
  open,
  variant,
  language,
  onDismiss,
  onPrimary,
  onSecondary,
}: ConversionPopupProps) {
  const C = copy(language);
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDismiss]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLButtonElement>(".conversion-popup__cta-primary")?.focus();
    }, 120);
    return () => window.clearTimeout(t);
  }, [open, variant]);

  if (!open || !variant) return null;

  const titles: Record<ConversionPopupVariant, string> = {
    plan_limit_reached: C.planLimitTitle,
    pro_unlock: C.proUnlockTitle,
    upgrade: C.upgradeTitle,
  };
  const bodies: Record<ConversionPopupVariant, string> = {
    plan_limit_reached: C.planLimitBody,
    pro_unlock: C.proUnlockBody,
    upgrade: C.upgradeBody,
  };
  const primaryLabels: Record<ConversionPopupVariant, string> = {
    plan_limit_reached: C.planLimitPrimary,
    pro_unlock: C.proUnlockPrimary,
    upgrade: C.upgradePrimary,
  };
  const secondaryLabels: Record<ConversionPopupVariant, string> = {
    plan_limit_reached: C.planLimitSecondary,
    pro_unlock: C.proUnlockSecondary,
    upgrade: C.upgradeSecondary,
  };

  return (
    <div
      className="conversion-popup-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
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
