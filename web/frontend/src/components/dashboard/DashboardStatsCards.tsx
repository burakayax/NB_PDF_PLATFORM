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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5 2xl:gap-6">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5 2xl:gap-6">
      {/* Toplam İşlem */}
      <div className="nb-transition rounded-2xl border border-white/[0.08] bg-nb-panel/60 p-3 hover:border-white/[0.14] hover:bg-nb-panel lg:p-5 2xl:p-6 shadow-[0_0_24px_-8px_rgba(34,211,238,0.35)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-nb-primary/20 to-nb-primary/8 text-nb-primary lg:h-10 lg:w-10">
          <Layers className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden />
        </span>
        <p className="mt-3 text-xl font-bold tabular-nums text-nb-heading lg:text-3xl 2xl:text-4xl">
          {totalUsed.toLocaleString(tr ? "tr-TR" : "en-US")}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-nb-muted sm:text-xs lg:text-sm">
          {tr ? "Toplam İşlem" : "Total Operations"}
        </p>
        <p className="mt-0.5 hidden text-[10px] text-nb-muted/70 sm:block sm:text-xs">
          {tr ? "Tüm zamanlar" : "All time"}
        </p>
      </div>

      {/* Kalan İşlem */}
      <div className="nb-transition rounded-2xl border border-white/[0.08] bg-nb-panel/60 p-3 hover:border-white/[0.14] hover:bg-nb-panel lg:p-5 2xl:p-6 shadow-[0_0_24px_-8px_rgba(52,211,153,0.35)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/8 text-emerald-400 lg:h-10 lg:w-10">
          <CreditCard className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden />
        </span>
        <p className="mt-3 text-xl font-bold tabular-nums text-nb-heading lg:text-3xl 2xl:text-4xl">
          {remainingOps.toLocaleString(tr ? "tr-TR" : "en-US")}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-nb-muted sm:text-xs lg:text-sm">
          {tr ? "Kalan İşlem" : "Remaining Ops"}
        </p>
        <p className="mt-0.5 hidden text-[10px] text-nb-muted/70 sm:block sm:text-xs">
          {tr ? "Bu dönem" : "This period"}
        </p>
      </div>

      {/* Abonelik */}
      <div className="nb-transition rounded-2xl border border-white/[0.08] bg-nb-panel/60 p-3 hover:border-white/[0.14] hover:bg-nb-panel lg:p-5 2xl:p-6 shadow-[0_0_24px_-8px_rgba(139,92,246,0.35)]">
        <div className="flex items-start justify-between gap-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/8 text-violet-400 lg:h-10 lg:w-10">
            <Zap className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden />
          </span>
          {isFree && onUpgrade && (
            <button
              type="button"
              onClick={onUpgrade}
              className="nb-transition shrink-0 rounded-lg border border-nb-primary/40 bg-nb-primary/10 px-2 py-1 text-[10px] font-semibold text-nb-primary-mid hover:bg-nb-primary/20 lg:px-2.5 lg:text-xs"
            >
              {tr ? "Yükselt" : "Upgrade"}
            </button>
          )}
        </div>
        <p className="mt-3 text-xl font-bold tabular-nums text-nb-heading lg:text-3xl 2xl:text-4xl">
          {planLabel()}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-nb-muted sm:text-xs lg:text-sm">
          {tr ? "Abonelik" : "Subscription"}
        </p>
        <p className="mt-0.5 hidden text-[10px] text-nb-muted/70 sm:block sm:text-xs">
          {plan && plan !== "FREE" ? (tr ? "Aktif" : "Active") : (tr ? "Ücretsiz Plan" : "Free Plan")}
        </p>
      </div>

      {/* Son Aktivite */}
      <div className="nb-transition rounded-2xl border border-white/[0.08] bg-nb-panel/60 p-3 hover:border-white/[0.14] hover:bg-nb-panel lg:p-5 2xl:p-6 shadow-[0_0_24px_-8px_rgba(245,158,11,0.35)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/8 text-amber-400 lg:h-10 lg:w-10">
          <Activity className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden />
        </span>
        <p className="mt-3 text-xl font-bold tabular-nums text-nb-heading lg:text-3xl 2xl:text-4xl">
          {tr ? "Bugün" : "Today"}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-nb-muted sm:text-xs lg:text-sm">
          {tr ? "Son Aktivite" : "Last Activity"}
        </p>
        <p className="mt-0.5 hidden text-[10px] text-nb-muted/70 sm:block sm:text-xs">
          {new Date().toLocaleTimeString(tr ? "tr-TR" : "en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
