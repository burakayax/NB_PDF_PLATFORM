import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart2, Globe, Radio, UserPlus, UserRound, Wrench } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { AdminOverview } from "../../api/admin";
import { pdfToolLabelTr } from "../lib/pdfToolLabels";

type Props = { overview: AdminOverview; uiMode?: unknown };
type Period = "daily" | "weekly" | "monthly";

// ── Yardımcılar ──────────────────────────────────────────────────────────────
function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 100);
}

const ACCENT = {
  violet: { text: "text-violet-300", ring: "ring-violet-400/25", bg: "bg-violet-500/10", bar: "bg-violet-400", stroke: "rgb(167 139 250)" },
  cyan: { text: "text-cyan-300", ring: "ring-cyan-400/25", bg: "bg-cyan-500/10", bar: "bg-cyan-400", stroke: "rgb(34 211 238)" },
  emerald: { text: "text-emerald-300", ring: "ring-emerald-400/25", bg: "bg-emerald-500/10", bar: "bg-emerald-400", stroke: "rgb(16 185 129)" },
  amber: { text: "text-amber-300", ring: "ring-amber-400/25", bg: "bg-amber-500/10", bar: "bg-amber-400", stroke: "rgb(251 191 36)" },
} as const;
type Accent = keyof typeof ACCENT;

// Gerçek verili mini sparkline (sahte veri YOK).
function Spark({ data, stroke }: { data: number[]; stroke: string }) {
  if (data.length < 2) return <div className="h-8" />;
  const w = 120, h = 32, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${pad + (i / (data.length - 1)) * (w - 2 * pad)},${h - pad - ((v - min) / span) * (h - 2 * pad)}`);
  const d = `M ${pts.join(" L ")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={`${d} L ${w - pad} ${h} L ${pad} ${h} Z`} fill={stroke} opacity="0.1" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function KpiCard({ label, value, sub, icon: Icon, accent, delta, deltaLabel, spark }: {
  label: string; value: string; sub?: string; icon: LucideIcon; accent: Accent;
  delta?: number | null; deltaLabel?: string; spark?: number[];
}) {
  const a = ACCENT[accent];
  const up = (delta ?? 0) >= 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition hover:border-white/[0.12]">
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.bg} ${a.text} ring-1 ${a.ring}`}><Icon className="h-4 w-4" /></span>
        {delta !== undefined && delta !== null ? (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${up ? "bg-emerald-500/12 text-emerald-300" : "bg-rose-500/12 text-rose-300"}`}>
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-white">{value}</p>
      <p className="mt-1 min-h-[16px] text-xs text-slate-500">{sub}{delta !== undefined && delta !== null && deltaLabel ? <span className="text-slate-600"> · {deltaLabel}</span> : null}</p>
      {spark && spark.length > 1 ? <div className="mt-3"><Spark data={spark} stroke={a.stroke} /></div> : null}
    </div>
  );
}

// Görsel dağılım çubuğu (düz liste yerine).
function DistBar({ label, value, max, accent }: { label: string; value: number; max: number; accent: Accent }) {
  const a = ACCENT[accent];
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-slate-300">{label}</span>
        <span className="shrink-0 font-mono text-xs text-slate-400">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <div className={`h-full rounded-full ${a.bar}`} style={{ width: `${pct}%`, opacity: 0.8 }} />
      </div>
    </li>
  );
}

function aggregateByPeriod(data: { date: string; count: number }[], period: Period): { label: string; count: number }[] {
  if (period === "daily") return data.slice(-14).map((d) => ({ label: d.date.slice(5), count: d.count }));
  if (period === "weekly") {
    const weeks = new Map<string, number>();
    for (const d of data) { const dt = new Date(d.date); const mon = new Date(dt); mon.setDate(dt.getDate() - dt.getDay() + 1); const key = mon.toISOString().slice(0, 10); weeks.set(key, (weeks.get(key) ?? 0) + d.count); }
    return [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([k, count]) => ({ label: k.slice(5), count }));
  }
  const months = new Map<string, number>();
  for (const d of data) { const key = d.date.slice(0, 7); months.set(key, (months.get(key) ?? 0) + d.count); }
  return [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, count]) => ({ label: k, count }));
}

function aggregateSalesByPeriod(data: { date: string; plan: string; count: number }[], period: Period): { label: string; PRO: number; BUSINESS: number }[] {
  const buckets = new Map<string, { PRO: number; BUSINESS: number }>();
  for (const d of data) {
    let key = d.date;
    if (period === "weekly") { const dt = new Date(d.date); const mon = new Date(dt); mon.setDate(dt.getDate() - dt.getDay() + 1); key = mon.toISOString().slice(0, 10); }
    else if (period === "monthly") key = d.date.slice(0, 7);
    const b = buckets.get(key) ?? { PRO: 0, BUSINESS: 0 };
    if (d.plan === "PRO") b.PRO += d.count; else if (d.plan === "BUSINESS") b.BUSINESS += d.count;
    buckets.set(key, b);
  }
  return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(period === "daily" ? -14 : period === "weekly" ? -8 : -6).map(([k, v]) => ({ label: period === "monthly" ? k : k.slice(5), ...v }));
}

const tooltipStyle = { background: "rgb(15 23 42 / 0.96)", border: "1px solid rgb(51 65 85 / 0.6)", borderRadius: "12px", fontSize: 12, padding: "8px 12px" };
const PeriodToggle = ({ value, onChange }: { value: Period; onChange: (p: Period) => void }) => (
  <div className="flex gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
    {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
      <button key={p} type="button" onClick={() => onChange(p)}
        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${value === p ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"}`}>
        {p === "daily" ? "Günlük" : p === "weekly" ? "Haftalık" : "Aylık"}
      </button>
    ))}
  </div>
);

const Panel = ({ title, sub, right, children }: { title: string; sub?: ReactNode; right?: ReactNode; children: ReactNode }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-sm font-semibold text-white">{title}</h3>{sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}</div>
      {right}
    </div>
    {children}
  </div>
);

// ── Ana bileşen ──────────────────────────────────────────────────────────────
export function AdminDashboardHome({ overview }: Props) {
  const [regPeriod, setRegPeriod] = useState<Period>("daily");
  const [salesPeriod, setSalesPeriod] = useState<Period>("monthly");
  const updatedAt = new Date(overview.generatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const usage = overview.usageByDay ?? [];
  const regs = overview.registrationsByDay ?? [];

  // Gerçek delta hesapları (sahte veri yok)
  const opsToday = overview.todayTotalOperations;
  const opsYesterday = usage.length >= 2 ? usage[usage.length - 2].totalOperations : 0;
  const opsDelta = pctDelta(opsToday, opsYesterday);
  const opsSpark = usage.slice(-14).map((d) => d.totalOperations);

  const sum = (arr: { count: number }[]) => arr.reduce((s, x) => s + x.count, 0);
  const regWeek = useMemo(() => sum(regs.slice(-7)), [regs]);
  const regPrevWeek = useMemo(() => sum(regs.slice(-14, -7)), [regs]);
  const usersDelta = pctDelta(regWeek, regPrevWeek);
  const regSpark = regs.slice(-14).map((d) => d.count);
  const regToday = regs.find((d) => d.date === overview.usageDateUtc)?.count ?? 0;
  const regMonth = useMemo(() => sum(regs), [regs]);

  const trendData = usage.slice(-30).map((d) => ({ d: d.date.slice(5), o: d.totalOperations }));
  const regChartData = useMemo(() => aggregateByPeriod(regs, regPeriod), [regs, regPeriod]);
  const salesChartData = useMemo(() => aggregateSalesByPeriod(overview.subscriptionSalesByDay ?? [], salesPeriod), [overview.subscriptionSalesByDay, salesPeriod]);

  const maxPkg = Math.max(1, ...overview.usagePerPackage.map((p) => p.userCount));
  const maxTool = Math.max(1, ...overview.mostUsedTOOLS.map((t) => t.operationsAttributed));
  const maxCountry = Math.max(1, ...overview.geo.topCountries.map((c) => c.count));

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Genel Bakış</h2>
          <p className="text-xs text-slate-500">Canlı metrikler · otomatik yenilenir</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />Canlı · {updatedAt}
        </span>
      </div>

      {/* KPI satırı — gerçek delta */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Kayıtlı kullanıcı" value={overview.totalUsers.toLocaleString("tr-TR")} sub={`+${regWeek} bu hafta`} icon={UserRound} accent="violet" delta={usersDelta} deltaLabel="geçen haftaya göre" spark={regSpark} />
        <KpiCard label="Bugün işlem" value={opsToday.toLocaleString("tr-TR")} sub={`${overview.activeUsersToday} aktif kullanıcı`} icon={BarChart2} accent="cyan" delta={opsDelta} deltaLabel="düne göre" spark={opsSpark} />
        <KpiCard label="Canlı oturum" value={String(overview.distinctSessionsActiveNow)} sub={`${overview.presenceWindowMinutes} dk pencere`} icon={Radio} accent="emerald" />
        <KpiCard label="Tamamlanan ödeme" value={String(overview.checkoutsCompleted)} sub={`${overview.checkoutsPending} bekleyen`} icon={Activity} accent="amber" />
      </div>

      {/* Operasyon hacmi + En çok araçlar */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Operasyon hacmi" sub="Son 30 gün (UTC)">
            <div className="mt-4 h-[240px] w-full">
              {trendData.length < 1 ? <p className="py-16 text-center text-sm text-slate-500">Günlük seri yok</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <defs><linearGradient id="opFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity={0.3} /><stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(51 65 85 / 0.35)" />
                    <XAxis dataKey="d" tick={{ fill: "rgb(100 116 139)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={{ fill: "rgb(100 116 139)", fontSize: 10 }} width={36} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "rgb(226 232 240)" }} />
                    <Area type="monotone" dataKey="o" name="İşlem" stroke="rgb(34 211 238)" strokeWidth={2.5} fill="url(#opFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>
        </div>
        <Panel title="En çok kullanılan araçlar" sub="Son 30 gün">
          {overview.mostUsedTOOLS.length === 0 ? <p className="mt-4 text-sm text-slate-500">Henüz veri yok</p> : (
            <ul className="mt-4 space-y-3">
              {overview.mostUsedTOOLS.slice(0, 7).map((t) => (
                <DistBar key={t.featureKey} label={pdfToolLabelTr(t.featureKey)} value={t.operationsAttributed} max={maxTool} accent="cyan" />
              ))}
            </ul>
          )}
          {overview.mostUsedTOOLSAllTimeFallback ? <p className="mt-3 text-xs text-amber-200/70">Tüm zaman verisi (son 30 gün boş)</p> : null}
        </Panel>
      </div>

      {/* Yeni kayıtlar */}
      <Panel title="Yeni kayıtlar" sub={`Bugün ${regToday} · Bu hafta ${regWeek} · Bu ay ${regMonth}`} right={<PeriodToggle value={regPeriod} onChange={setRegPeriod} />}>
        <div className="mt-4 h-[170px] w-full">
          {regChartData.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">Henüz kayıt verisi yok</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regChartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(51 65 85 / 0.35)" />
                <XAxis dataKey="label" tick={{ fill: "rgb(100 116 139)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "rgb(100 116 139)", fontSize: 10 }} width={30} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "rgb(226 232 240)" }} cursor={{ fill: "rgb(255 255 255 / 0.03)" }} />
                <Bar dataKey="count" name="Kayıt" fill="rgb(167 139 250)" radius={[5, 5, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      {/* Abonelik satışları */}
      <Panel title="Abonelik satışları" sub="Tamamlanan ödemeler (plana göre)" right={<PeriodToggle value={salesPeriod} onChange={setSalesPeriod} />}>
        <div className="mt-4 h-[170px] w-full">
          {salesChartData.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">Henüz satış verisi yok</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesChartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(51 65 85 / 0.35)" />
                <XAxis dataKey="label" tick={{ fill: "rgb(100 116 139)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "rgb(100 116 139)", fontSize: 10 }} width={30} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "rgb(226 232 240)" }} cursor={{ fill: "rgb(255 255 255 / 0.03)" }} />
                <Bar dataKey="PRO" name="PRO" fill="rgb(34 211 238)" radius={[5, 5, 0, 0]} maxBarSize={28} />
                <Bar dataKey="BUSINESS" name="BUSINESS" fill="rgb(16 185 129)" radius={[5, 5, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-3 flex gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-400"><span className="h-2.5 w-2.5 rounded-sm bg-cyan-400" /> PRO</span>
          <span className="flex items-center gap-1.5 text-slate-400"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> BUSINESS</span>
        </div>
      </Panel>

      {/* Dağılımlar — görsel çubuklar */}
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Paket dağılımı">
          <ul className="mt-4 space-y-3">
            {overview.usagePerPackage.map((p) => (
              <DistBar key={p.plan} label={p.plan} value={p.userCount} max={maxPkg} accent="violet" />
            ))}
          </ul>
        </Panel>
        <Panel title="Ülke dağılımı" sub={<span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />En çok ziyaretçi</span>}>
          {overview.geo.topCountries.length === 0 ? <p className="mt-4 text-sm text-slate-500">Konum verisi yok</p> : (
            <ul className="mt-4 space-y-3">
              {overview.geo.topCountries.slice(0, 6).map((c) => (
                <DistBar key={c.country} label={c.country} value={c.count} max={maxCountry} accent="emerald" />
              ))}
            </ul>
          )}
          {overview.geo.topCities && overview.geo.topCities.length > 0 ? (
            <div className="mt-4 border-t border-white/[0.05] pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">Şehirler</p>
              <ul className="space-y-1 text-xs">
                {overview.geo.topCities.slice(0, 5).map((c) => (
                  <li key={`${c.city}-${c.country}`} className="flex items-center justify-between gap-2">
                    <span className="truncate text-slate-400">{c.city}{c.country ? ` · ${c.country}` : ""}</span>
                    <span className="shrink-0 font-mono text-slate-500">{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
        <Panel title="Araç kullanımı" sub="En çok işlem (30g)">
          {overview.mostUsedTOOLS.length === 0 ? <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-500"><Wrench className="h-3.5 w-3.5" />Henüz veri yok</p> : (
            <ul className="mt-4 space-y-3">
              {overview.mostUsedTOOLS.slice(0, 6).map((t) => (
                <DistBar key={t.featureKey} label={pdfToolLabelTr(t.featureKey)} value={t.operationsAttributed} max={maxTool} accent="amber" />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
