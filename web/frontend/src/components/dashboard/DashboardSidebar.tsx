import type { FeatureKey } from "../../api/subscription";
import type { UserBalance } from "../../api/entitlement";
import type { Language } from "../../i18n/landing";
import { SIDEBAR_TOOL_ORDER, sidebarToolCreditLine, sidebarToolLabel, ws } from "../../i18n/workspace";
import { SidebarToolGlyph } from "./sidebarToolLucide";

export type SidebarToolId = FeatureKey | "subscription";

type DashboardSidebarProps = {
  active: SidebarToolId;
  onSelect: (id: SidebarToolId) => void;
  language: Language;
  lockedFeatures: Set<FeatureKey>;
  /** Credit balance from `/api/entitlement/balance`. */
  userBalance?: UserBalance | null;
  userRole?: string;
  enabledToolIds?: FeatureKey[];
  resolveToolLabel?: (id: FeatureKey) => string;
  /** Limitsiz Pro — bottom badge only; no purchase chrome in sidebar. */
  limitsizProActive?: boolean;
  onAdminClick?: () => void;
  accessToken?: string | null;
  onUpgrade?: () => void;
};

/**
 * Desktop workspace rail: PDF tools only (+ optional VIP strip). Nav, language, and account live in `DashboardTopNav`.
 */
export function DashboardSidebar({
  active,
  onSelect,
  language,
  lockedFeatures,
  userBalance,
  userRole,
  enabledToolIds,
  resolveToolLabel,
  limitsizProActive,
  onAdminClick,
  accessToken,
  onUpgrade,
}: DashboardSidebarProps) {
  const L = ws(language);
  const toolOrder = enabledToolIds?.length ? enabledToolIds : SIDEBAR_TOOL_ORDER;
  const labelForTool = resolveToolLabel ?? ((id: FeatureKey) => sidebarToolLabel(id, language));
  const showVipStrip = userRole !== "ADMIN" && Boolean(limitsizProActive && userBalance);

  return (
    <aside className="fixed bottom-0 left-0 top-14 z-40 hidden w-60 flex-col border-r border-white/[0.08] bg-gradient-to-b from-nb-bg-elevated/92 via-[#0c1424]/95 to-nb-bg-elevated/92 shadow-[4px_0_32px_-6px_rgba(0,0,0,0.55)] backdrop-blur-xl backdrop-saturate-150 md:flex">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="TOOLS">
        {toolOrder.map((id) => {
          const isActive = active === id;
          const locked = lockedFeatures.has(id);
          const label = labelForTool(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              title={locked ? L.lockedFeatureTooltip : undefined}
              aria-label={locked ? `${label}. ${L.lockedFeatureTooltip}` : undefined}
              className={`nb-transition flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium ${
                isActive
                  ? "border border-nb-primary/45 bg-nb-primary/14 text-nb-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_-8px_rgba(59,130,246,0.45)]"
                  : "border border-transparent text-nb-muted hover:scale-[1.02] hover:bg-white/[0.06] hover:text-nb-text hover:shadow-md"
              } ${
                locked
                  ? "ring-1 ring-amber-400/35 shadow-[0_0_28px_-10px_rgba(245,158,11,0.55),inset_0_1px_0_rgba(255,255,255,0.04)] hover:ring-amber-400/50 hover:shadow-[0_0_36px_-8px_rgba(245,158,11,0.6)]"
                  : ""
              }`}
            >
              <span className={isActive ? "text-nb-primary-mid" : "text-nb-muted"}>
                {locked ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                ) : (
                  <SidebarToolGlyph id={id} className="h-5 w-5" active={isActive} />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-stretch justify-center gap-0.5 text-left">
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate">{label}</span>
                  {locked ? (
                    <span
                      className="shrink-0 rounded-md border border-amber-400/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300/95 shadow-[0_0_12px_-4px_rgba(251,191,36,0.45)]"
                      aria-hidden
                    >
                      {L.featureLockedBadge}
                    </span>
                  ) : null}
                </span>
                {locked ? null : (
                  <span className="pl-0 text-[10px] font-medium leading-tight text-nb-muted/80">{sidebarToolCreditLine(id, language)}</span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      {showVipStrip ? (
        <div className="border-t border-white/[0.06] px-3 py-3">
          <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/14 via-emerald-600/12 to-nb-panel/55 px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="text-lg font-black tracking-tight text-amber-200">{L.unlimitedSidebarBadge}</p>
            <p className="mt-1 text-[11px] font-medium leading-snug text-emerald-100/90">{L.unlimitedAccessActive}</p>
          </div>
        </div>
      ) : null}

      {userRole === "ADMIN" && onAdminClick ? (
        <div className="border-t border-white/[0.06] px-3 py-3">
          <button
            type="button"
            onClick={onAdminClick}
            className="nb-transition flex w-full items-center gap-2.5 rounded-2xl border border-violet-500/35 bg-violet-500/10 px-3 py-2.5 text-left text-sm font-semibold text-violet-200 hover:bg-violet-500/20 hover:text-violet-100 hover:shadow-[0_0_20px_-6px_rgba(139,92,246,0.5)]"
          >
            <svg className="h-5 w-5 shrink-0 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 11.943c0 6.001 4.448 10.956 10.22 11.944C19.122 22.899 23.57 17.944 23.57 11.943a11.955 11.955 0 00-.598-5.943A11.959 11.959 0 0112 2.714z" />
            </svg>
            <span>Admin Paneli</span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}

export function DashboardSidebarMobileRail({
  active,
  onSelect,
  language,
  lockedFeatures,
  userRole,
  enabledToolIds,
  resolveToolLabel,
}: DashboardSidebarProps) {
  const L = ws(language);
  const toolOrder = enabledToolIds?.length ? enabledToolIds : SIDEBAR_TOOL_ORDER;
  const labelForTool = resolveToolLabel ?? ((id: FeatureKey) => sidebarToolLabel(id, language));
  const labelFor = (id: FeatureKey) => labelForTool(id);

  return (
    <div className="sticky top-14 z-30 border-b border-white/[0.06] bg-nb-bg/95 backdrop-blur-md md:hidden">
      <div className="flex gap-1.5 overflow-x-auto py-2 pl-2 pr-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {toolOrder.map((id) => {
          const isActive = active === id;
          const locked = lockedFeatures.has(id);
          const short = labelForTool(id).replace(/\s+/g, "");
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              title={locked ? L.lockedFeatureTooltip : undefined}
              aria-label={locked ? `${labelFor(id)}. ${L.lockedFeatureTooltip}` : undefined}
              className={`nb-transition shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold whitespace-nowrap ${
                isActive
                  ? "border-nb-primary/45 bg-nb-primary/15 text-nb-accent"
                  : "border-white/[0.08] bg-nb-panel/60 text-nb-muted hover:border-nb-primary/25 hover:text-nb-text"
              } ${locked ? "ring-1 ring-amber-400/40 shadow-[0_0_18px_-6px_rgba(245,158,11,0.55)] hover:ring-amber-400/55" : ""}`}
            >
              {short}
              {locked ? " ⧉" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
