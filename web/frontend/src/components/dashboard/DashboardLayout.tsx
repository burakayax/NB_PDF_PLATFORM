import { useState } from "react";
import { X, Menu } from "lucide-react";
import type { AuthUser } from "../../api/auth";
import type { Language } from "../../i18n/landing";
import type { FeatureKey } from "../../api/subscription";
import type { UserBalance } from "../../api/entitlement";
import type { SidebarToolId } from "./DashboardSidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStatsCards } from "./DashboardStatsCards";
import { DashboardRecentActivity } from "./DashboardRecentActivity";
import { DashboardToolsSection } from "./DashboardToolsSection";
import { SidebarToolGlyph } from "./sidebarToolLucide";
import { SIDEBAR_TOOL_ORDER, sidebarToolLabel, ws } from "../../i18n/workspace";

interface DashboardLayoutProps {
  user: AuthUser;
  language: Language;
  userBalance?: UserBalance | null;
  lockedFeatures?: Set<FeatureKey>;
  enabledToolIds?: FeatureKey[];
  selectedTool: SidebarToolId;
  onSelectTool: (id: SidebarToolId) => void;
  accessToken?: string | null;
  limitsizProActive?: boolean;
  onUpgrade?: () => void;
  onAdminClick?: () => void;
  onOpenSettings?: () => void;
  resolveToolLabel?: (id: FeatureKey) => string;
}

function MobileDrawerNav({
  language,
  lockedFeatures,
  enabledToolIds,
  selectedTool,
  resolveToolLabel,
  onSelect,
}: {
  language: Language;
  lockedFeatures: Set<FeatureKey>;
  enabledToolIds?: FeatureKey[];
  selectedTool: SidebarToolId;
  resolveToolLabel?: (id: FeatureKey) => string;
  onSelect: (id: SidebarToolId) => void;
}) {
  const L = ws(language);
  const toolOrder = enabledToolIds?.length ? enabledToolIds : SIDEBAR_TOOL_ORDER;
  const labelFor = resolveToolLabel ?? ((id: FeatureKey) => sidebarToolLabel(id, language));

  return (
    <nav className="flex flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Tools">
      {toolOrder.map((id) => {
        const isActive = selectedTool === id;
        const locked = lockedFeatures.has(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            title={locked ? L.lockedFeatureTooltip : undefined}
            className={`nb-transition flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium ${
              isActive
                ? "border border-nb-primary/45 bg-nb-primary/14 text-nb-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "border border-transparent text-nb-muted hover:bg-white/[0.06] hover:text-nb-text"
            } ${locked ? "ring-1 ring-amber-400/35 shadow-[0_0_28px_-10px_rgba(245,158,11,0.55)]" : ""}`}
          >
            <span className={isActive ? "text-nb-primary-mid" : "text-nb-muted"}>
              {locked ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <SidebarToolGlyph id={id} className="h-5 w-5" active={isActive} />
              )}
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate">{labelFor(id)}</span>
              {locked && (
                <span className="shrink-0 rounded-md border border-amber-400/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300/95">
                  {L.featureLockedBadge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function DashboardLayout({
  user,
  language,
  userBalance,
  lockedFeatures = new Set(),
  enabledToolIds,
  selectedTool,
  onSelectTool,
  accessToken,
  limitsizProActive,
  onUpgrade,
  onAdminClick,
  onOpenSettings,
  resolveToolLabel,
}: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const tr = language === "tr";

  const handleToolSelect = (id: SidebarToolId) => {
    onSelectTool(id);
    setMobileOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-nb-bg">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-nb-bg-elevated/98 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label={tr ? "Araç menüsü" : "Tool menu"}
        aria-hidden={!mobileOpen}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
          <span className="text-sm font-semibold text-nb-heading">
            {tr ? "PDF Araçları" : "PDF Tools"}
          </span>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={tr ? "Menüyü kapat" : "Close menu"}
            className="nb-transition flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] text-nb-muted hover:text-nb-text"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <MobileDrawerNav
          language={language}
          lockedFeatures={lockedFeatures}
          enabledToolIds={enabledToolIds}
          selectedTool={selectedTool}
          resolveToolLabel={resolveToolLabel}
          onSelect={handleToolSelect}
        />
      </aside>

      {/* Desktop sidebar — w-60 (240px), matches md:pl-60 on main */}
      <DashboardSidebar
        active={selectedTool}
        onSelect={handleToolSelect}
        language={language}
        lockedFeatures={lockedFeatures}
        userBalance={userBalance}
        userRole={user.role}
        enabledToolIds={enabledToolIds}
        resolveToolLabel={resolveToolLabel}
        limitsizProActive={limitsizProActive}
        onAdminClick={onAdminClick}
        accessToken={accessToken}
        onUpgrade={onUpgrade}
      />

      {/* Main content — pt-14 for top nav, md:pl-60 matches sidebar w-60 */}
      <main className="flex min-h-screen w-full flex-col overflow-x-hidden pt-14 md:pl-60">
        {/* Mobile hamburger strip */}
        <div className="flex h-11 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-nb-bg/95 px-3 backdrop-blur-md md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={tr ? "Araç menüsünü aç" : "Open tool menu"}
            aria-expanded={mobileOpen}
            className="nb-transition flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-nb-panel/60 text-nb-muted hover:border-nb-primary/30 hover:text-nb-text"
          >
            <Menu className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-xs font-medium text-nb-muted">
            {tr ? "Araçlar" : "Tools"}
          </span>
        </div>

        {/* Page content */}
        <div className="flex flex-1 flex-col gap-4 p-3 sm:gap-5 sm:p-4 md:p-6 lg:gap-6 lg:p-7 2xl:gap-7 2xl:p-8">
          <DashboardHeader
            user={user}
            language={language}
            onOpenSettings={onOpenSettings}
          />

          <DashboardStatsCards
            language={language}
            userBalance={userBalance}
            plan={userBalance?.plan}
            onUpgrade={onUpgrade}
          />

          {/* Mobile/tablet: dropdown only | Desktop: tool grid */}
          <DashboardToolsSection
            language={language}
            lockedFeatures={lockedFeatures}
            enabledToolIds={enabledToolIds}
            selectedTool={
              selectedTool === "subscription" ? null : (selectedTool as FeatureKey)
            }
            onSelectTool={handleToolSelect as (id: FeatureKey) => void}
          />

          <DashboardRecentActivity
            language={language}
            accessToken={accessToken}
          />
        </div>
      </main>
    </div>
  );
}
