import { Activity, CreditCard, Layers, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import type { UserBalance } from "../../api/entitlement";
import type { PlanName } from "../../api/entitlement";

interface DashboardStatsCardsProps {
  language: Language;
  userBalance?: UserBalance | null;
  plan?: PlanName | null;
  loading?: boolean;
  onUpgrade?: () => void;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/[0.06] bg-nb-panel/60 p-4 lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/[0.06]" />
        <div className="h-5 w-16 rounded-md bg-white/[0.06]" />
      </div>
      <div className="mt-3 h-7 w-24 rounded-md bg-white/[0.06]" />
      <div className="mt-2 h-4 w-32 rounded-md bg-white/[0.04]" />
    </div>
  );
}

export function DashboardStatsCards({
  language,
  userBalance,
  plan,
  loading,
  onUpgrade,
}: DashboardStatsCardsProps) {
  const tr = language === "tr";

  const planLabel = () => {
    if (!plan) return tr ? "Ücretsiz" : "Free";
    if (plan === "FREE") return tr ? "Ücretsiz" : "Free";
    if (plan === "PRO") return "Pro";
    if (plan === "BUSINESS") return "Business";
    return plan;
  };

  const isFree = !plan || plan === "FREE";

  const dailyUsed = userBalance?.daily?.used ?? 0;
  const dailyLimit = userBalance?.daily?.limit ?? null;
  const remainingOps = dailyLimit !== null ? Math.max(0, dailyLimit - dailyUsed) : (userBalance?.creditBalance ?? 0);
  const totalUsed = dailyUsed;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:gap-4 lg:grid-cols-4 lg:gap-5 2xl:gap-6">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Mobile layout - 2 key stats only
  const mobileStats = [
    { key: 'used', icon: Layers, color: 'cyan', label: tr ? "Toplam" : "Total", value: totalUsed },
    { key: 'remaining', icon: CreditCard, color: 'emerald', label: tr ? "Kalan" : "Remaining", value: remainingOps }
  ];

  return (
    <>
      {/* Mobile: Compact 2-column */}
      <div className="block md:hidden grid grid-cols-2 gap-2">
        {mobileStats.map(stat => (
          <div key={stat.key} className="rounded-lg border border-white/[0.06] bg-nb-panel/40 p-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-sm">
              <stat.icon className="h-3 w-3" aria-hidden />
            </span>
            <p className="mt-1.5 text-base font-bold tabular-nums text-nb-heading">
              {stat.value.toLocaleString(tr ? "tr-TR" : "en-US")}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-nb-muted">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tablet & Desktop: Full 4-column grid */}
      <div className="hidden md:grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:gap-4 lg:grid-cols-4 lg:gap-5 2xl:gap-6">
      {/* Toplam İşlem */}
      <div className="nb-transition rounded-xl sm:rounded-2xl border border-white/[0.08] bg-nb-panel/60 p-2.5 sm:p-3 md:p-4 hover:border-white/[0.14] hover:bg-nb-panel lg:p-5 2xl:p-6 shadow-[0_0_24px_-8px_rgba(34,211,238,0.35)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-nb-primary/20 to-nb-primary/8 text-nb-primary sm:h-9 sm:w-9 lg:h-10 lg:w-10">
          <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" aria-hidden />
        </span>
        <p className="mt-2 sm:mt-3 text-base sm:text-lg font-bold tabular-nums text-nb-heading md:text-xl lg:text-3xl 2xl:text-4xl">
          {totalUsed.toLocaleString(tr ? "tr-TR" : "en-US")}
        </p>
        <p className="mt-1 sm:mt-0.5 text-[10px] sm:text-[11px] font-medium text-nb-muted sm:text-xs lg:text-sm">
          {tr ? "Toplam İşlem" : "Total Operations"}
        </p>
        <p className="mt-0.5 hidden text-[9px] text-nb-muted/70 sm:block sm:text-[10px] md:text-xs">
          {tr ? "Tüm zamanlar" : "All time"}
        </p>
      </div>

      {/* Kalan İşlem */}
      <div className="nb-transition rounded-xl sm:rounded-2xl border border-white/[0.08] bg-nb-panel/60 p-2.5 sm:p-3 md:p-4 hover:border-white/[0.14] hover:bg-nb-panel lg:p-5 2xl:p-6 shadow-[0_0_24px_-8px_rgba(52,211,153,0.35)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/8 text-emerald-400 sm:h-9 sm:w-9 lg:h-10 lg:w-10">
          <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" aria-hidden />
        </span>
        <p className="mt-2 sm:mt-3 text-base sm:text-lg font-bold tabular-nums text-nb-heading md:text-xl lg:text-3xl 2xl:text-4xl">
          {remainingOps.toLocaleString(tr ? "tr-TR" : "en-US")}
        </p>
        <p className="mt-1 sm:mt-0.5 text-[10px] sm:text-[11px] font-medium text-nb-muted sm:text-xs lg:text-sm">
          {tr ? "Kalan İşlem" : "Remaining Ops"}
        </p>
        <p className="mt-0.5 hidden text-[9px] text-nb-muted/70 sm:block sm:text-[10px] md:text-xs">
          {tr ? "Bu dönem" : "This period"}
        </p>
      </div>

      {/* Abonelik - Upgrade button hidden on mobile */}
      <div className="nb-transition rounded-xl sm:rounded-2xl border border-white/[0.08] bg-nb-panel/60 p-2.5 sm:p-3 md:p-4 hover:border-white/[0.14] hover:bg-nb-panel lg:p-5 2xl:p-6 shadow-[0_0_24px_-8px_rgba(139,92,246,0.35)]">
        <div className="flex items-start justify-between gap-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/8 text-violet-400 sm:h-9 sm:w-9 lg:h-10 lg:w-10">
            <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" aria-hidden />
          </span>
          {isFree && onUpgrade && (
            <button
              type="button"
              onClick={onUpgrade}
              className="nb-transition shrink-0 rounded border border-nb-primary/40 bg-nb-primary/10 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-semibold text-nb-primary-mid hover:bg-nb-primary/20 lg:px-2.5 lg:text-xs hidden sm:block"
            >
              {tr ? "Yükselt" : "Upgrade"}
            </button>
          )}
        </div>
        <p className="mt-2 sm:mt-3 text-base sm:text-lg font-bold tabular-nums text-nb-heading md:text-xl lg:text-3xl 2xl:text-4xl">
          {planLabel()}
        </p>
        <p className="mt-1 sm:mt-0.5 text-[10px] sm:text-[11px] font-medium text-nb-muted sm:text-xs lg:text-sm">
          {tr ? "Abonelik" : "Subscription"}
        </p>
        <p className="mt-0.5 hidden text-[9px] text-nb-muted/70 sm:block sm:text-[10px] md:text-xs">
          {plan && plan !== "FREE" ? (tr ? "Aktif" : "Active") : (tr ? "Ücretsiz Plan" : "Free Plan")}
        </p>
      </div>

      {/* Son Aktivite */}
      <div className="nb-transition rounded-xl sm:rounded-2xl border border-white/[0.08] bg-nb-panel/60 p-2.5 sm:p-3 md:p-4 hover:border-white/[0.14] hover:bg-nb-panel lg:p-5 2xl:p-6 shadow-[0_0_24px_-8px_rgba(245,158,11,0.35)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/8 text-amber-400 sm:h-9 sm:w-9 lg:h-10 lg:w-10">
          <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" aria-hidden />
        </span>
        <p className="mt-2 sm:mt-3 text-base sm:text-lg font-bold tabular-nums text-nb-heading md:text-xl lg:text-3xl 2xl:text-4xl">
          {tr ? "Bugün" : "Today"}
        </p>
        <p className="mt-1 sm:mt-0.5 text-[10px] sm:text-[11px] font-medium text-nb-muted sm:text-xs lg:text-sm">
          {tr ? "Son Aktivite" : "Last Activity"}
        </p>
        <p className="mt-0.5 hidden text-[9px] text-nb-muted/70 sm:block sm:text-[10px] md:text-xs">
          {new Date().toLocaleTimeString(tr ? "tr-TR" : "en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
    </>
  );
}
