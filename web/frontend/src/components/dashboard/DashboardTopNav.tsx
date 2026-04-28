import type { AuthUser } from "../../api/auth";
import { getSaasApiBase } from "../../api/saasBase";
import { useCheckoutCurrency } from "../../contexts/CheckoutCurrencyContext";
import { useSettings } from "../../hooks/useSettings";
import type { Language } from "../../i18n/landing";
import { resolveCmsAssetUrl } from "../../lib/landingCmsMerge";
import { ws } from "../../i18n/workspace";
import { useMemo } from "react";
import { UserMenu } from "./UserMenu";

type DashboardTopNavProps = {
  user: AuthUser;
  language: Language;
  onLanguageChange: (language: Language) => void;
  /** Credit snapshot for navbar chip; omit for ADMIN or before balance loads. */
  creditBalance?: number | null;
  creditBalanceLoading?: boolean;
  hasActiveSubscription?: boolean;
  /** Limitsiz Pro (active PRO subscription) — infinity UI, hide upgrade, special copy. */
  limitsizProActive?: boolean;
  onLogoClick: () => void;
  onProfile: () => void;
  onPassword: () => void;
  onLogout: () => void;
  onUpgradeClick?: () => void;
  /** Opens credits / subscription panel (workspace). */
  onOpenCreditsPanel?: () => void;
  showAdminEntry?: boolean;
  onOpenAdmin?: () => void;
};

export function DashboardTopNav({
  user,
  language,
  onLanguageChange,
  creditBalance,
  creditBalanceLoading,
  hasActiveSubscription,
  limitsizProActive,
  onLogoClick,
  onProfile,
  onPassword,
  onLogout,
  onUpgradeClick,
  onOpenCreditsPanel,
  showAdminEntry,
  onOpenAdmin,
}: DashboardTopNavProps) {
  const W = ws(language);
  const tr = language === "tr";
  const { currency: checkoutCurrency, setCurrency: setCheckoutCurrency } = useCheckoutCurrency();
  const { cms } = useSettings();
  const dashboardLogoSrc = useMemo(() => {
    const assets = cms?.assets as { logoUrl?: string } | undefined;
    return resolveCmsAssetUrl(assets?.logoUrl, getSaasApiBase()) ?? "/nb_pdf_TOOLS_icon.png";
  }, [cms]);
  const showCreditsCenter = user.role !== "ADMIN" && (creditBalanceLoading || typeof creditBalance === "number");
  const upgradeVisible = Boolean(onUpgradeClick && showCreditsCenter && !limitsizProActive);
  const creditsPanelVisible = Boolean(onOpenCreditsPanel && user.role !== "ADMIN");

  const centerLabel = () => {
    if (creditBalanceLoading) {
      return "…";
    }
    if (limitsizProActive) {
      return W.unlimitedAccessActive;
    }
    if (hasActiveSubscription && !limitsizProActive) {
      return W.usageUnlimited;
    }
    return `${W.navbarCreditsLabel}: ${(creditBalance ?? 0).toLocaleString(tr ? "tr-TR" : "en-US")}`;
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-white/[0.1] bg-gradient-to-r from-nb-bg/90 via-nb-bg-elevated/92 to-nb-bg/90 px-2 shadow-[0_4px_28px_-6px_rgba(0,0,0,0.5)] backdrop-blur-xl backdrop-saturate-150 sm:gap-3 md:px-6">
      <button
        type="button"
        onClick={onLogoClick}
        className="nb-transition flex min-w-0 items-center gap-2 rounded-2xl px-1 py-1 text-left hover:scale-[1.01] hover:bg-white/[0.06] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-nb-primary/45 sm:gap-3"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-nb-primary/35 bg-gradient-to-br from-nb-primary/20 to-nb-primary/8 shadow-[0_0_28px_rgba(59,130,246,0.28)]">
          <img src={dashboardLogoSrc} alt="" className="h-5 w-5 rounded-md object-cover" />
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">NB Global Studio</span>
          <span className="block text-[15px] font-semibold tracking-[0.12em] text-nb-text">NB PDF PLARTFORM</span>
        </span>
        <span className="max-w-[140px] truncate text-sm font-semibold tracking-wide text-nb-text sm:hidden">NB PDF</span>
      </button>

      {showCreditsCenter ? (
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-0.5 sm:gap-2">
          <div className="flex min-w-0 flex-1 justify-center">
            {limitsizProActive ? (
              <span className="inline-flex max-w-[min(100%,min(340px,100vw-10rem))] flex-col items-center gap-0.5 rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/15 via-emerald-600/12 to-amber-500/8 px-3 py-2 text-center shadow-[0_0_24px_-8px_rgba(245,158,11,0.35)] sm:py-2.5">
                <span className="text-xs font-black tracking-tight text-amber-200 sm:text-sm">{W.unlimitedSidebarBadge}</span>
                <span className="text-[10px] font-semibold leading-tight text-emerald-100/95 sm:text-[11px]">{W.unlimitedAccessActive}</span>
              </span>
            ) : (
              <span className="max-w-[min(100%,min(280px,100vw-10rem))] truncate rounded-full border border-white/[0.08] bg-nb-panel/60 px-2 py-1 text-center text-[10px] font-semibold leading-snug tracking-wide text-cyan-200/95 sm:max-w-[min(100%,min(360px,100vw-14rem))] sm:px-3 sm:text-[11px]">
                {centerLabel()}
              </span>
            )}
          </div>
          {creditsPanelVisible ? (
            <button
              type="button"
              onClick={onOpenCreditsPanel}
              className="nb-transition shrink-0 rounded-full border border-white/[0.1] bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-nb-muted hover:border-nb-primary/35 hover:bg-white/[0.08] hover:text-nb-text sm:px-3 sm:text-[11px]"
            >
              {W.planNav}
            </button>
          ) : null}
          {upgradeVisible ? (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="nb-transition shrink-0 rounded-full border border-cyan-400/45 bg-gradient-to-r from-cyan-500/28 to-indigo-500/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-cyan-50 shadow-[0_0_22px_-8px_rgba(34,211,238,0.5)] hover:border-cyan-300/55 hover:from-cyan-500/38 hover:to-indigo-500/35 sm:px-3 sm:text-[11px]"
            >
              {W.navbarUpgrade}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1 sm:gap-2">
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-nb-muted lg:inline">TL / $ / €</span>
        {(["TRY", "USD", "EUR"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCheckoutCurrency(c)}
            className={`nb-transition rounded-xl border px-2 py-1 text-[10px] font-black tracking-wide ${
              checkoutCurrency === c
                ? "border-amber-400/45 bg-amber-500/15 text-amber-100"
                : "border-white/[0.08] bg-nb-bg-soft/80 text-nb-muted hover:border-amber-400/25 hover:text-nb-text"
            }`}
            aria-pressed={checkoutCurrency === c}
          >
            {c}
          </button>
        ))}
        <span className="mx-0.5 hidden h-4 w-px bg-white/[0.12] sm:inline" aria-hidden />
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-nb-muted md:inline">{W.langSection}</span>
        <button
          type="button"
          onClick={() => onLanguageChange("tr")}
          className={`nb-transition rounded-xl border px-2.5 py-1 text-[11px] font-bold tracking-wide md:min-w-[2.75rem] ${
            language === "tr"
              ? "border-nb-primary/45 bg-nb-primary/15 text-nb-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              : "border-white/[0.08] bg-nb-bg-soft/80 text-nb-muted hover:border-nb-primary/25 hover:text-nb-text"
          }`}
          aria-pressed={language === "tr"}
        >
          TR
        </button>
        <button
          type="button"
          onClick={() => onLanguageChange("en")}
          className={`nb-transition rounded-xl border px-2.5 py-1 text-[11px] font-bold tracking-wide md:min-w-[2.75rem] ${
            language === "en"
              ? "border-nb-primary/45 bg-nb-primary/15 text-nb-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              : "border-white/[0.08] bg-nb-bg-soft/80 text-nb-muted hover:border-nb-primary/25 hover:text-nb-text"
          }`}
          aria-pressed={language === "en"}
        >
          EN
        </button>
      </div>

      {showAdminEntry && onOpenAdmin ? (
        <button
          type="button"
          onClick={onOpenAdmin}
          className="nb-transition shrink-0 rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-100 hover:bg-violet-500/25 sm:px-3 sm:text-[11px]"
        >
          {tr ? "Yönetim" : "Admin"}
        </button>
      ) : null}

      <UserMenu user={user} language={language} onProfile={onProfile} onPassword={onPassword} onLogout={onLogout} />
    </header>
  );
}
