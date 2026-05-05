import type { AuthUser } from "../../api/auth";
import type { PlanName } from "../../api/entitlement";
import { getSaasApiBase } from "../../api/saasBase";
import { useSettings } from "../../hooks/useSettings";
import type { Language } from "../../i18n/landing";
import { resolveCmsAssetUrl } from "../../lib/landingCmsMerge";
import { ws } from "../../i18n/workspace";
import { Coins, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { UserMenu } from "./UserMenu";

const LANG_OPTIONS: { code: Language; flag: string; label: string }[] = [
  { code: "tr", flag: "🇹🇷", label: "Türkçe" },
  { code: "en", flag: "🇬🇧", label: "English" },
];

function LanguageDropdown({
  language,
  onLanguageChange,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const current =
    LANG_OPTIONS.find((o) => o.code === language) ?? LANG_OPTIONS[0];

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="nb-transition inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-nb-bg-soft/90 px-2.5 py-1.5 text-xs font-semibold text-nb-text shadow-sm hover:border-white/[0.16] hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-nb-primary/40 sm:px-3"
      >
        <span className="text-base leading-none" aria-hidden>
          {current.flag}
        </span>
        <span className="font-bold tracking-wide">
          {current.code.toUpperCase()}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-nb-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-[60] min-w-[11rem] overflow-hidden rounded-xl border border-white/[0.1] bg-nb-bg-elevated py-1 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.55)] backdrop-blur-md"
        >
          {LANG_OPTIONS.map((opt) => (
            <li
              key={opt.code}
              role="option"
              aria-selected={language === opt.code}
            >
              <button
                type="button"
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition-colors ${
                  language === opt.code
                    ? "bg-nb-primary/15 text-nb-accent"
                    : "text-nb-text hover:bg-white/[0.06]"
                }`}
                onClick={() => {
                  onLanguageChange(opt.code);
                  setOpen(false);
                }}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {opt.flag}
                </span>
                <span>{opt.label}</span>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-nb-muted">
                  {opt.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type DashboardTopNavProps = {
  user: AuthUser;
  language: Language;
  onLanguageChange: (language: Language) => void;
  /** Current plan name from entitlement balance. */
  plan?: PlanName | null;
  /** Remaining ops / credit balance for the chip. */
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
  plan,
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
  const { cms } = useSettings();
  const dashboardLogoSrc = useMemo(() => {
    const assets = cms?.assets as { logoUrl?: string } | undefined;
    return (
      resolveCmsAssetUrl(assets?.logoUrl, getSaasApiBase()) ??
      "/nb_pdf_TOOLS_icon.png"
    );
  }, [cms]);
  const showCreditsCenter =
    user.role !== "ADMIN" &&
    (creditBalanceLoading || typeof creditBalance === "number" || plan != null);
  const upgradeVisible = Boolean(
    onUpgradeClick &&
    showCreditsCenter &&
    !limitsizProActive &&
    plan !== "PRO" &&
    plan !== "BUSINESS",
  );
  const creditsPanelVisible = Boolean(
    onOpenCreditsPanel && user.role !== "ADMIN",
  );

  const centerLabel = () => {
    if (creditBalanceLoading) return "…";
    if (limitsizProActive) return W.unlimitedAccessActive;
    if (plan === "BUSINESS") return tr ? "Business Planı" : "Business Plan";
    if (plan === "PRO") return tr ? "Pro Planı" : "Pro Plan";
    if (plan === "PLUS") return tr ? "Plus Planı" : "Plus Plan";
    if (hasActiveSubscription) return W.usageUnlimited;
    // FREE plan – show remaining ops count
    const ops = (creditBalance ?? 0).toLocaleString(tr ? "tr-TR" : "en-US");
    return tr ? `Ücretsiz · ${ops} işlem kaldı` : `Free · ${ops} ops left`;
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between gap-4 border-b border-white/[0.1] bg-gradient-to-r from-nb-bg/90 via-nb-bg-elevated/92 to-nb-bg/90 px-3 shadow-[0_4px_28px_-6px_rgba(0,0,0,0.5)] backdrop-blur-xl backdrop-saturate-150 md:px-6">
      <button
        type="button"
        onClick={onLogoClick}
        className="nb-transition flex min-w-0 items-center gap-2 rounded-2xl px-1 py-1 text-left hover:scale-[1.01] hover:bg-white/[0.06] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-nb-primary/45 sm:gap-3"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-nb-primary/35 bg-gradient-to-br from-nb-primary/20 to-nb-primary/8 shadow-[0_0_28px_rgba(59,130,246,0.28)]">
          <img
            src={dashboardLogoSrc}
            alt=""
            className="h-5 w-5 rounded-md object-cover"
          />
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            NB Global Studio
          </span>
          <span className="block text-[15px] font-semibold tracking-[0.12em] text-nb-text">
            PDF PLATFORM
          </span>
        </span>
      </button>

      <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-4">
        {showCreditsCenter ? (
          <>
            {limitsizProActive ? (
              creditsPanelVisible ? (
                <button
                  type="button"
                  onClick={() => onOpenCreditsPanel?.()}
                  className="inline-flex max-w-[min(100%,17rem)] flex-col items-start gap-0.5 rounded-full border border-amber-400/35 bg-gradient-to-r from-amber-500/14 to-emerald-600/12 px-3.5 py-1.5 text-left shadow-[0_0_20px_-8px_rgba(245,158,11,0.35)] transition hover:bg-amber-500/18 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/35 sm:flex-row sm:items-center sm:gap-2"
                >
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tight text-amber-200 sm:text-xs">
                    <Coins
                      className="h-3.5 w-3.5 shrink-0 text-amber-300/95"
                      aria-hidden
                    />
                    {W.unlimitedSidebarBadge}
                  </span>
                  <span className="text-[10px] font-semibold leading-tight text-emerald-100/95 sm:text-[11px]">
                    {W.unlimitedAccessActive}
                  </span>
                </button>
              ) : (
                <span className="inline-flex max-w-[min(100%,17rem)] flex-col items-start gap-0.5 rounded-full border border-amber-400/35 bg-gradient-to-r from-amber-500/12 to-emerald-600/10 px-3 py-1.5 text-left shadow-[0_0_20px_-8px_rgba(245,158,11,0.35)] sm:flex-row sm:items-center sm:gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tight text-amber-200 sm:text-xs">
                    <Coins
                      className="h-3.5 w-3.5 shrink-0 text-amber-300/95"
                      aria-hidden
                    />
                    {W.unlimitedSidebarBadge}
                  </span>
                  <span className="text-[10px] font-semibold leading-tight text-emerald-100/95 sm:text-[11px]">
                    {W.unlimitedAccessActive}
                  </span>
                </span>
              )
            ) : creditsPanelVisible ? (
              <button
                type="button"
                onClick={() => onOpenCreditsPanel?.()}
                className="inline-flex max-w-[min(100vw-12rem,18rem)] items-center gap-2 truncate rounded-full border border-white/[0.06] bg-slate-800/95 px-3.5 py-1.5 text-left text-[13px] font-semibold tabular-nums tracking-tight text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-black/20 transition hover:bg-slate-700/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 sm:max-w-[22rem]"
                aria-label={
                  tr
                    ? `${W.navbarCreditsLabel}: ${centerLabel()}`
                    : `Credits: ${centerLabel()}`
                }
              >
                <Coins
                  className="h-4 w-4 shrink-0 text-amber-300/90"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{centerLabel()}</span>
              </button>
            ) : (
              <span className="inline-flex max-w-[min(100vw-12rem,18rem)] items-center gap-2 truncate rounded-full border border-white/[0.06] bg-slate-800/95 px-3.5 py-1.5 text-[13px] font-semibold tabular-nums text-slate-100 ring-1 ring-black/20 sm:max-w-[22rem]">
                <Coins
                  className="h-4 w-4 shrink-0 text-amber-300/90"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{centerLabel()}</span>
              </span>
            )}
            {upgradeVisible ? (
              <button
                type="button"
                onClick={onUpgradeClick}
                className="nb-transition shrink-0 rounded-full border border-cyan-400/45 bg-gradient-to-r from-cyan-500/28 to-indigo-500/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-cyan-50 shadow-[0_0_22px_-8px_rgba(34,211,238,0.5)] hover:border-cyan-300/55 hover:from-cyan-500/38 hover:to-indigo-500/35 sm:px-3.5 sm:text-[11px]"
              >
                {W.navbarUpgrade}
              </button>
            ) : null}
          </>
        ) : null}

        <LanguageDropdown
          language={language}
          onLanguageChange={onLanguageChange}
        />

        {showAdminEntry && onOpenAdmin ? (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="nb-transition shrink-0 rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-100 hover:bg-violet-500/25 sm:px-3 sm:text-[11px]"
          >
            {tr ? "Yönetim" : "Admin"}
          </button>
        ) : null}

        <UserMenu
          user={user}
          language={language}
          onProfile={onProfile}
          onPassword={onPassword}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
