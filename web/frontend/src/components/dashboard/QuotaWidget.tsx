import { useEffect, useState } from "react";
import { QuotaCountdown } from "../ui/quota-countdown";

interface QuotaSummary {
  plan: string;
  daily: { used: number; limit: number | null; resetAt: string };
  monthly: { used: number; limit: number | null };
  watermarkEnabled: boolean;
  batchLimit: number;
  fileSizeLimitMB: number;
  isAdmin?: boolean;
}

function ProgressBar({ value, max, warn }: { value: number; max: number; warn: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          pct >= 100 ? "bg-red-500" : warn ? "bg-amber-500" : "bg-blue-500"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function QuotaWidget({
  language = "tr",
  onUpgrade,
  accessToken,
  isTeamMember = false,
}: {
  language?: string;
  onUpgrade?: () => void;
  accessToken?: string | null;
  isTeamMember?: boolean;
}) {
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [error, setError] = useState(false);

  const tr = language === "tr";

  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        const res = await fetch("/api/entitlement/balance", { headers });
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        setQuota(data);
      } catch {
        setError(true);
      }
    };
    fetchQuota();
    const id = setInterval(fetchQuota, 60_000);
    return () => clearInterval(id);
  }, [accessToken]);

  if (error || !quota) return null;

  const dailyPct = quota.daily.limit
    ? (quota.daily.used / quota.daily.limit) * 100
    : 0;
  const monthlyPct = quota.monthly.limit
    ? (quota.monthly.used / quota.monthly.limit) * 100
    : 0;

  const dailyFull = quota.daily.limit !== null && quota.daily.used >= quota.daily.limit;
  const monthlyFull = quota.monthly.limit !== null && quota.monthly.used >= quota.monthly.limit;
  const monthlyWarn = monthlyPct >= 80 && !monthlyFull;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const resetAt = quota.daily.resetAt ? new Date(quota.daily.resetAt) : null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      {/* Daily limit full banner */}
      {dailyFull && quota.plan === "FREE" && (
        <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm">
          <p className="text-red-300 font-semibold mb-1">
            {tr
              ? "Bugünkü ücretsiz işlem kotanız doldu."
              : "You've used all your free daily operations."}
          </p>
          <p className="text-red-400/70 text-xs">
            {tr
              ? "Sınırsız günlük kullanım için Plus planına geçin."
              : "Upgrade to Plus for unlimited daily usage."}
          </p>
        </div>
      )}

      {/* Monthly 80% warning */}
      {monthlyWarn && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
          {tr
            ? `Aylık işlem kotanızın %${Math.round(monthlyPct)}'ini kullandınız.`
            : `You've used ${Math.round(monthlyPct)}% of your monthly operations.`}
        </div>
      )}

      {/* Daily row */}
      {quota.daily.limit !== null && (
        <div>
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="text-gray-400 font-medium">
              {tr ? "Bugün" : "Today"}:{" "}
              <span className={dailyFull ? "text-red-400" : "text-white"}>
                {quota.daily.used}/{quota.daily.limit}
              </span>
            </span>
            {resetAt && <QuotaCountdown resetAt={resetAt} timezone={timezone} />}
          </div>
          <ProgressBar value={quota.daily.used} max={quota.daily.limit} warn={dailyPct >= 80} />
        </div>
      )}

      {/* Monthly row */}
      {quota.monthly.limit !== null && (
        <div>
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="text-gray-400 font-medium">
              {tr ? "Bu ay" : "This month"}:{" "}
              <span className={monthlyFull ? "text-red-400" : monthlyWarn ? "text-amber-400" : "text-white"}>
                {quota.monthly.used}/{quota.monthly.limit}
              </span>
            </span>
            <span className="text-gray-600 text-[10px]">
              {quota.plan}
            </span>
          </div>
          <ProgressBar value={quota.monthly.used} max={quota.monthly.limit} warn={monthlyWarn} />
        </div>
      )}

      {/* Unlimited indicator */}
      {quota.daily.limit === null && quota.monthly.limit === null && (
        <div className="text-xs text-emerald-400 font-medium">
          ✓ {tr ? "Sınırsız işlem" : "Unlimited operations"}
        </div>
      )}

      {/* Upgrade CTA — team members never see this */}
      {!isTeamMember && onUpgrade && (quota.plan === "FREE" || quota.plan === "PLUS") && (
        <button
          onClick={onUpgrade}
          className="w-full py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600/80 to-blue-600/80 hover:from-violet-500/90 hover:to-blue-500/90 text-white transition-all"
        >
          {tr ? "Planını Yükselt →" : "Upgrade Plan →"}
        </button>
      )}

      {/* Metadata chips */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {quota.isAdmin && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium">
            Admin
          </span>
        )}
        {quota.batchLimit > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500">
            {tr ? `Toplu: ${quota.batchLimit} dosya` : `Batch: ${quota.batchLimit} files`}
          </span>
        )}
        {quota.fileSizeLimitMB > 0 && quota.fileSizeLimitMB < 999999 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500">
            {tr ? `Maks. ${quota.fileSizeLimitMB} MB` : `Max ${quota.fileSizeLimitMB} MB`}
          </span>
        )}
        {quota.watermarkEnabled && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
            {tr ? "Filigran aktif" : "Watermark on"}
          </span>
        )}
      </div>
    </div>
  );
}
