import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BarChart2, GitBranch, Radio, UserRound, Zap } from "lucide-react";
import type { AdminOverview } from "../../api/admin";
import type { AdminUiMode } from "../adminTypes";
import { AdminImpactCard, AdminMutedBox } from "../mosaic/adminPrimitives";
import { MosaicStatCard } from "../mosaic/MosaicStatCard";
import { pdfToolLabelTr } from "../lib/pdfToolLabels";

type Props = { overview: AdminOverview; uiMode: AdminUiMode };

function sparkFromUsage(overview: AdminOverview, field: "ops" | "users" | "sessions" | "checkout"): number[] {
  const days = overview.usageByDay.slice(-7);
  if (field === "ops") {
    return days.length
      ? days.map((d) => d.totalOperations / (Math.max(...days.map((x) => x.totalOperations), 1) || 1))
      : [0, 0.2, 0.4, 0.3, 0.5, 0.6, 0.4];
  }
  if (field === "users") {
    return days.length
      ? days.map((d) => d.totalOperations / 1000 + 0.1)
      : [0.1, 0.15, 0.2, 0.18, 0.22, 0.25, 0.2];
  }
  if (field === "sessions") {
    return [0.2, 0.35, 0.3, 0.45, 0.4, 0.5, 0.55];
  }
  return [0.1, 0.2, 0.15, 0.3, 0.25, 0.4, 0.35];
}

function buildActivityFeed(overview: AdminOverview): { id: string; label: string; sub: string; time: string }[] {
  const out: { id: string; label: string; sub: string; time: string }[] = [];
  const t = (d: string) => new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  for (const day of overview.usageByDay.slice(-3)) {
    out.push({
      id: `day-${day.date}`,
      label: "Günlük işlemler",
      sub: `${day.totalOperations} işlem · ${t(day.date)}`,
      time: t(day.date),
    });
  }
  for (const m of overview.mostUsedTOOLS.slice(0, 4)) {
    out.push({
      id: `tool-${m.featureKey}`,
      label: pdfToolLabelTr(m.featureKey),
      sub: `${m.operationsAttributed} işlem (30g) · ${m.featureKey}`,
      time: "30g",
    });
  }
  if (out.length === 0) {
    out.push({
      id: "empty-hint",
      label: "Henüz hareket yok",
      sub: "PDF işlemi başladıkça bu akış dolar",
      time: "—",
    });
  }
  return out.slice(0, 8);
}

const chartColor = {
  line: "rgb(34, 211, 238)",
  fill: "rgba(34, 211, 238, 0.12)",
};

export function AdminDashboardHome({ overview, uiMode }: Props) {
  const advanced = uiMode === "advanced";
  const updatedAt = new Date(overview.generatedAt).toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
  const sOps = sparkFromUsage(overview, "ops");
  const sUsers = sparkFromUsage(overview, "users");
  const sPres = sparkFromUsage(overview, "sessions");
  const sChk = sparkFromUsage(overview, "checkout");

  const trendData = overview.usageByDay.slice(-30).map((d) => ({
    d: d.date.slice(5),
    o: d.totalOperations,
  }));

  const feed = buildActivityFeed(overview);

  return (
    <div className="space-y-8">
      {advanced ? (
        <AdminImpactCard title="Bu sayfada neler var?">
          <p>
            Aşağıdaki istatistikler <strong className="text-slate-100">salt okunur</strong> — izleme amaçlıdır. Ağ grafiğinde 30 güne kadar
            operasyon hacmi gösterilir; son hareketler, günlük ve araç toplamlarından üretilen bir <strong className="text-slate-100">özet
            akıştır</strong> (Cruip tarzı).
          </p>
        </AdminImpactCard>
      ) : (
        <AdminMutedBox>
          Özet: kayıt, işlem, canlı oturum ve ödeme. Düzenleme için <strong className="text-slate-200">İçerik</strong> sekmesine geçin.
        </AdminMutedBox>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-200">
          <span className="font-semibold text-cyan-100">Canlı metrik</span> — otomatik yenilenir
        </p>
        <p className="font-mono text-xs font-semibold text-slate-300">SON: {updatedAt}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MosaicStatCard
          label="Kayıtlı kullanıcılar"
          value={String(overview.totalUsers)}
          sub="Tüm hesaplar"
          icon={UserRound}
          spark={sUsers}
          accent="violet"
        />
        <MosaicStatCard
          label="Bugün işlem (UTC)"
          value={String(overview.todayTotalOperations)}
          sub={`Aktif kullanıcı bugün: ${overview.activeUsersToday}`}
          icon={BarChart2}
          spark={sOps}
          accent="cyan"
        />
        <MosaicStatCard
          label="Canlı oturum"
          value={String(overview.distinctSessionsActiveNow)}
          sub={`${overview.presenceWindowMinutes} dk pencere`}
          icon={Radio}
          spark={sPres}
          accent="emerald"
        />
        <MosaicStatCard
          label="Ödeme (tamamlandı)"
          value={String(overview.checkoutsCompleted)}
          sub={`Bekleyen: ${overview.checkoutsPending}`}
          icon={Activity}
          spark={sChk}
          accent="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900/35 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">Operasyon hacmi</h3>
                <p className="text-xs text-slate-500">Recharts alan · son 30 gün (UTC)</p>
              </div>
              <Zap className="h-5 w-5 text-cyan-500/50" />
            </div>
            <div className="mt-4 h-[220px] w-full">
              {trendData.length < 1 ? (
                <p className="py-12 text-center text-sm text-slate-500">Günlük seri yok</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="opFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColor.line} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={chartColor.line} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(51 65 85 / 0.4)" />
                    <XAxis dataKey="d" tick={{ fill: "rgb(148 163 184)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "rgb(148 163 184)", fontSize: 10 }} width={32} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgb(15 23 42 / 0.95)",
                        border: "1px solid rgb(51 65 85 / 0.5)",
                        borderRadius: "12px",
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "rgb(226 232 240)" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="o"
                      name="İşlem"
                      stroke={chartColor.line}
                      strokeWidth={2}
                      fill="url(#opFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900/35 p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="border-b border-slate-800/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Son hareketler</h3>
            <p className="text-xs text-slate-500">Mosaic tarzı özet</p>
          </div>
          <ul className="max-h-[280px] flex-1 divide-y divide-slate-800/50 overflow-y-auto">
            {feed.map((row) => (
              <li key={row.id} className="flex gap-3 px-4 py-3 transition hover:bg-slate-800/30">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 ring-1 ring-white/[0.05]">
                  <GitBranch className="h-3.5 w-3.5 text-cyan-400/80" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200">{row.label}</p>
                  <p className="text-xs text-slate-500">{row.sub}</p>
                </div>
                <span className="shrink-0 text-[10px] font-medium uppercase text-slate-600">{row.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {advanced ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900/25 p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Paket dağılımı</h3>
            <ul className="mt-3 space-y-2">
              {overview.usagePerPackage.map((p) => (
                <li key={p.plan} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{p.plan}</span>
                  <span className="font-mono text-cyan-300">{p.userCount}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-slate-800/50 pt-2 text-xs text-slate-500">
              A/B test ve ürün yönetimi verisi — ödemeler toplu listede
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900/25 p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">En çok kullanılan araçlar (30g)</h3>
            {overview.mostUsedTOOLS.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Henüz veri yok</p>
            ) : (
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
                {overview.mostUsedTOOLS.map((t) => (
                  <li key={t.featureKey} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate text-slate-200">
                      {pdfToolLabelTr(t.featureKey)} <span className="text-slate-600">· {t.featureKey}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-400">{t.operationsAttributed}</span>
                  </li>
                ))}
              </ul>
            )}
            {overview.mostUsedTOOLSAllTimeFallback ? (
              <p className="mt-2 text-xs text-amber-200/80">Tüm zaman verisi — son 30 gün boş</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
