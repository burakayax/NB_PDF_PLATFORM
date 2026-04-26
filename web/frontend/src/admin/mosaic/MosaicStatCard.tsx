import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";

type Props = {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  /** 0..1 değerleri (sparkline) */
  spark: number[];
  trendLabel?: string;
  accent: "violet" | "cyan" | "emerald" | "amber";
};

const accentGlow = {
  violet: "from-violet-500/15 to-transparent",
  cyan: "from-cyan-500/15 to-transparent",
  emerald: "from-emerald-500/15 to-transparent",
  amber: "from-amber-500/15 to-transparent",
} as const;

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return <div className="h-10 w-full" />;
  }
  const w = 120;
  const h = 36;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0.0001);
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / (max - min)) * (h - 2 * pad);
    return `${x},${y}`;
  });
  const d = `M ${pts.join(" L ")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full text-slate-500/80" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L ${w - pad} ${h} L ${pad} ${h} Z`}
        fill="url(#sparkfill)"
        className="text-cyan-500/30"
      />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan-400/80" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MosaicStatCard({ label, value, sub, icon: Icon, spark, trendLabel, accent }: Props) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-700/40 bg-slate-800/40 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),inset_0_-1px_0_0_rgba(0,0,0,0.2)]"
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentGlow[accent]} opacity-90`}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-white md:text-3xl">{value}</p>
          {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 text-slate-300 ring-1 ring-white/[0.06]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="relative mt-4 border-t border-slate-700/30 pt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-slate-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {trendLabel ?? "7 gün"}
          </span>
        </div>
        <MiniSparkline data={spark} />
      </div>
    </div>
  );
}
