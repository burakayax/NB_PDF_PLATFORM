import { useEffect, useRef, useState } from "react";
import { legalDocuments } from "../../content/legal";
import type { Language } from "../../i18n/landing";

const COPY = {
  tr: {
    necessary: "Zorunlu",
    necessaryDesc: "Oturum, güvenlik ve temel platform işlemleri. Devre dışı bırakılamaz.",
    analytics: "Analitik (Google Analytics GA4)",
    analyticsDesc: "Hizmetlerimizi iyileştirmek için anonim kullanım istatistikleri.",
    errorMonitoring: "Hata İzleme (Sentry)",
    errorMonitoringDesc: "Hataları daha hızlı çözmek için tanı raporları. Yalnızca onayınızla aktif olur.",
    paymentProcessing: "Ödeme İşleme (İyzico)",
    paymentProcessingDesc: "Abonelik ödemelerini güvenli şekilde işlemek için zorunludur. Devre dışı bırakılamaz.",
    marketing: "Pazarlama",
    marketingDesc: "Kişiselleştirilmiş içerik ve reklamlar için çerezler.",
    customize: "Tercihleri Özelleştir",
    acceptAll: "Tümünü Kabul Et",
    acceptNecessary: "Yalnızca Zorunlu",
    save: "Tercihleri Kaydet",
    cancel: "İptal",
  },
  en: {
    necessary: "Essential",
    necessaryDesc: "Session, security and core platform operations. Cannot be disabled.",
    analytics: "Analytics (Google Analytics GA4)",
    analyticsDesc: "Anonymous usage statistics to improve our service.",
    errorMonitoring: "Error Monitoring (Sentry)",
    errorMonitoringDesc: "Diagnostic reports to fix bugs faster. Only active with your consent.",
    paymentProcessing: "Payment Processing (İyzico)",
    paymentProcessingDesc: "Required to process subscription payments securely. Cannot be disabled.",
    marketing: "Marketing",
    marketingDesc: "Cookies for personalized content and ads.",
    customize: "Customize Preferences",
    acceptAll: "Accept All",
    acceptNecessary: "Necessary Only",
    save: "Save Preferences",
    cancel: "Cancel",
  },
} as const;

type SavedPrefs = { analytics: boolean; errorMonitoring: boolean; marketing: boolean };

type CookieNoticeProps = {
  language: Language;
  visible: boolean;
  onAcceptAll: () => void;
  onAcceptNecessaryOnly: () => void;
  onSavePreferences: (prefs: SavedPrefs) => void;
  onOpenPrivacy: () => void;
  /** @deprecated kullan onAcceptAll */
  onAccept?: () => void;
};

export function CookieNotice({
  language,
  visible,
  onAcceptAll,
  onAcceptNecessaryOnly,
  onSavePreferences,
  onOpenPrivacy,
  onAccept,
}: CookieNoticeProps) {
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [errorMonitoring, setErrorMonitoring] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (visible) {
      const id = requestAnimationFrame(() => { primaryBtnRef.current?.focus(); });
      return () => cancelAnimationFrame(id);
    }
  }, [visible, showCustomize]);

  if (!visible) return null;

  const copy = legalDocuments[language].cookieNotice;
  const t = COPY[language];

  const handleAcceptAll = () => { onAcceptAll(); onAccept?.(); };

  const alwaysOnBadge = (
    <span className="mt-0.5 shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
      {language === "tr" ? "Aktif" : "Active"}
    </span>
  );

  if (showCustomize) {
    return (
      <div
        role="dialog" aria-modal="true" aria-label={copy.title}
        aria-describedby="cookie-customize-description"
        className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6"
      >
        <div className="mx-auto w-full max-w-2xl rounded-[24px] border border-white/[0.08] bg-nb-bg/95 p-6 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-nb-accent">{copy.title}</p>

          <div className="mt-5 space-y-3">
            {/* Zorunlu — her zaman aktif */}
            <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-nb-text">{t.necessary}</p>
                <p className="mt-0.5 text-xs text-nb-muted">{t.necessaryDesc}</p>
              </div>
              {alwaysOnBadge}
            </div>

            {/* Analitik */}
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-nb-text">{t.analytics}</p>
                <p className="mt-0.5 text-xs text-nb-muted">{t.analyticsDesc}</p>
              </div>
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-cyan-400" aria-label={t.analytics} />
            </label>

            {/* Hata İzleme */}
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-nb-text">{t.errorMonitoring}</p>
                <p className="mt-0.5 text-xs text-nb-muted">{t.errorMonitoringDesc}</p>
              </div>
              <input type="checkbox" checked={errorMonitoring} onChange={(e) => setErrorMonitoring(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-cyan-400" aria-label={t.errorMonitoring} />
            </label>

            {/* Pazarlama */}
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-nb-text">{t.marketing}</p>
                <p className="mt-0.5 text-xs text-nb-muted">{t.marketingDesc}</p>
              </div>
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-cyan-400" aria-label={t.marketing} />
            </label>

            {/* Ödeme İşleme — her zaman aktif */}
            <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-nb-text">{t.paymentProcessing}</p>
                <p className="mt-0.5 text-xs text-nb-muted">{t.paymentProcessingDesc}</p>
              </div>
              {alwaysOnBadge}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button ref={primaryBtnRef} type="button"
              onClick={() => onSavePreferences({ analytics, errorMonitoring, marketing })}
              className="rounded-xl bg-gradient-to-b from-nb-primary-mid to-nb-primary px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110">
              {t.save}
            </button>
            <button type="button" onClick={() => setShowCustomize(false)}
              className="rounded-xl border border-white/[0.1] bg-nb-panel/70 px-5 py-2.5 text-sm font-semibold text-nb-muted transition hover:text-nb-text">
              {t.cancel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog" aria-modal="true" aria-label={copy.title}
      aria-describedby="cookie-notice-description"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-[20px] border border-white/[0.08] bg-nb-bg/95 p-4 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-xl sm:max-w-4xl sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:rounded-[24px] sm:p-6">
        <div className="flex-1 flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-nb-accent sm:text-sm">{copy.title}</p>
          <div id="cookie-notice-description" className="mt-2 max-h-[180px] overflow-y-auto sm:max-h-none sm:overflow-y-visible">
            <p className="text-xs leading-relaxed text-nb-muted sm:text-sm sm:leading-7">{copy.description}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:min-w-[260px] sm:gap-3 sm:items-end">
          <button ref={primaryBtnRef} type="button" onClick={handleAcceptAll} aria-label={t.acceptAll}
            className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-gradient-to-b from-nb-primary-mid to-nb-primary px-4 text-xs font-semibold text-slate-950 shadow-[0_12px_32px_-8px_rgba(34,211,238,0.4)] transition duration-200 ease-out hover:brightness-110 sm:min-h-11 sm:rounded-xl sm:px-5 sm:text-sm">
            {t.acceptAll}
          </button>
          <button type="button" onClick={onAcceptNecessaryOnly} aria-label={t.acceptNecessary}
            className="inline-flex min-h-8 w-full items-center justify-center rounded-lg border border-white/[0.1] bg-nb-panel/70 px-4 text-xs font-semibold text-nb-muted transition hover:text-nb-text sm:min-h-10 sm:rounded-xl sm:px-5 sm:text-sm">
            {t.acceptNecessary}
          </button>
          <div className="flex gap-3 justify-center sm:justify-end sm:gap-4">
            <button type="button" onClick={() => setShowCustomize(true)}
              className="text-xs font-medium text-nb-muted transition hover:text-nb-text sm:text-sm">
              {t.customize}
            </button>
            <button type="button" onClick={onOpenPrivacy} aria-label={copy.learnMore}
              className="text-xs font-medium text-nb-muted transition hover:text-nb-text sm:text-sm">
              {copy.learnMore}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
