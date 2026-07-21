import { useEffect, useId, useRef } from "react";
import type { Language } from "../../i18n/landing";

export type ConversionUpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  onMaybeLater: () => void;
  language: Language;
  operationsToday: number;
};

function copy(language: Language) {
  const tr = language === "tr";
  return {
    eyebrow: tr ? "Sınırsıza geç" : "Go unlimited",
    title: tr ? "Sınırsız PDF işlemenin kilidini açın" : "Unlock unlimited PDF processing",
    subtitle: tr
      ? "Limit sizi yavaşlatmasın. Üst planla daha fazla işlem, daha büyük dosyalar ve tüm yapay zekâ araçları anında açılır."
      : "Don't let limits slow you down. A higher plan instantly unlocks more operations, larger files, and every AI tool.",
    speedStrip: tr
      ? "Üst planlarda daha fazla işlem, daha büyük dosyalar ve öncelikli işlem kuyruğu."
      : "Higher plans include more operations, larger files, and a priority queue.",
    features: tr
      ? [
          "Daha fazla aylık işlem",
          "Daha büyük dosya boyutu",
          "✨ Yapay zekâ araçları (özetle, veri çıkar…)",
          "Öncelikli işlem kuyruğu",
        ]
      : [
          "More monthly operations",
          "Larger file size support",
          "✨ AI tools (summarize, extract…)",
          "Priority processing queue",
        ],
    guarantee: tr
      ? "🛡️ 7 gün koşulsuz para-iade garantisi — risksiz deneyin."
      : "🛡️ 7-day money-back guarantee — no questions asked.",
    usageLine: (ops: number) =>
      tr
        ? `Bugün ${ops} işlem yaptınız — hız kesmeden devam edin.`
        : `You've run ${ops} operations today — keep going without limits.`,
    ctaPrimary: tr ? "Şimdi yükselt" : "Upgrade now",
    ctaSecondary: tr ? "Belki sonra" : "Maybe later",
    close: tr ? "Kapat" : "Close",
  };
}

export function ConversionUpgradeModal({
  open,
  onClose,
  onUpgrade,
  onMaybeLater,
  language,
  operationsToday,
}: ConversionUpgradeModalProps) {
  const C = copy(language);
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLButtonElement>(".conv-upgrade-modal__cta-primary")?.focus();
    }, 120);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="conv-upgrade-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="conv-upgrade-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="conv-upgrade-modal__accent" aria-hidden />
        <div className="conv-upgrade-modal__head">
          <p className="conv-upgrade-modal__eyebrow" aria-hidden>
            {C.eyebrow}
          </p>
          <button type="button" className="conv-upgrade-modal__close" onClick={onClose} aria-label={C.close}>
            ×
          </button>
        </div>

        <h2 id={titleId} className="conv-upgrade-modal__title">
          {C.title}
        </h2>
        <p id={descId} className="conv-upgrade-modal__subtitle">
          {C.subtitle}
        </p>

        <p className="conv-upgrade-modal__speed" role="status">
          {C.speedStrip}
        </p>

        <ul className="conv-upgrade-modal__features">
          {C.features.map((line) => (
            <li key={line}>
              <span className="conv-upgrade-modal__check" aria-hidden>
                ✓
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <p className="conv-upgrade-modal__usage">{C.usageLine(operationsToday)}</p>

        <p className="conv-upgrade-modal__guarantee" role="note">
          {C.guarantee}
        </p>

        <div className="conv-upgrade-modal__actions">
          <button type="button" className="conv-upgrade-modal__cta-primary" onClick={onUpgrade}>
            {C.ctaPrimary}
          </button>
          <button type="button" className="conv-upgrade-modal__cta-secondary" onClick={onMaybeLater}>
            {C.ctaSecondary}
          </button>
        </div>
      </div>
    </div>
  );
}
