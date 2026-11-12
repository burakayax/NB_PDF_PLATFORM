import { useCallback, useEffect, useState } from "react";
import { CalendarRange, Loader2, ReceiptText } from "lucide-react";

import { fetchAdminPaymentsSummary, type AdminPaymentsSummary, type AdminSummaryGroup } from "../../api/admin";

/**
 * Ödeme / iade / KDV özet tablosu: tarih aralığı + gün/ay/yıl seçimi.
 * KDV, KESİLMİŞ faturalardan hesaplanır (iade faturaları düşülür); faturası henüz kesilmemiş ödemelerin
 * tahmini KDV'si ayrı gösterilir ve toplama katılmaz. Döviz ödemeler TL toplamlarına karıştırılmaz.
 */

const GROUPS: Array<{ key: AdminSummaryGroup; label: string }> = [
  { key: "day", label: "Gün" },
  { key: "month", label: "Ay" },
  { key: "year", label: "Yıl" },
];

const tl = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

/** Yerel (Türkiye) takvim günü, YYYY-MM-DD. */
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function periodLabel(period: string, group: AdminSummaryGroup): string {
  if (group === "day") {
    const [y, m, d] = period.split("-");
    return `${d}.${m}.${y}`;
  }
  if (group === "month") {
    const [y, m] = period.split("-");
    const names = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    return `${names[Number(m) - 1] ?? m} ${y}`;
  }
  return period;
}

export function PaymentsSummary({ accessToken }: { accessToken: string }) {
  const today = new Date();
  const [group, setGroup] = useState<AdminSummaryGroup>("month");
  const [from, setFrom] = useState(ymd(new Date(today.getFullYear(), 0, 1)));
  const [to, setTo] = useState(ymd(today));
  const [data, setData] = useState<AdminPaymentsSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      setData(await fetchAdminPaymentsSummary(accessToken, { from, to, group }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Özet okunamadı.");
    } finally {
      setBusy(false);
    }
  }, [accessToken, from, to, group]);

  useEffect(() => {
    void load();
  }, [load]);

  const field =
    "rounded-lg border border-white/[0.1] bg-black/30 px-2.5 py-1.5 text-[12.5px] text-slate-100 focus:border-cyan-400/50 focus:outline-none [color-scheme:dark]";

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4" aria-label="Ödeme ve KDV özeti">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[14px] font-bold text-white">
            <CalendarRange className="h-4 w-4 text-cyan-300" aria-hidden /> Ödeme, iade ve KDV özeti
          </h3>
          <p className="mt-0.5 text-[11.5px] text-slate-400">Türkiye saatiyle. KDV, kesilmiş faturalardan hesaplanır (iade faturaları düşülür).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" aria-label="Başlangıç" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={field} />
          <span className="text-slate-500">–</span>
          <input type="date" aria-label="Bitiş" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={field} />
          <div className="inline-flex overflow-hidden rounded-lg border border-white/[0.12]" role="group" aria-label="Gruplama">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                data-testid={`group-${g.key}`}
                onClick={() => setGroup(g.key)}
                className={`px-3 py-1.5 text-[12px] font-semibold transition ${
                  group === g.key ? "bg-cyan-500/20 text-cyan-100" : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {err && <p className="mt-3 text-[12px] text-rose-200">{err}</p>}

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.12] to-transparent p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-200/90">
            <ReceiptText className="h-3.5 w-3.5" aria-hidden /> Bu ay ödenecek KDV
          </p>
          <p className="mt-1 text-[22px] font-bold tracking-tight text-white" data-testid="kdv-month">
            {data ? tl(data.currentMonth.kdvNet) : "…"}
          </p>
          <p className="text-[11px] text-slate-400">{data ? periodLabel(data.currentMonth.period, "month") : ""} · kesilen faturalar − iade faturaları</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Seçilen aralıkta net KDV</p>
          <p className="mt-1 text-[22px] font-bold tracking-tight text-white" data-testid="kdv-range">{data ? tl(data.totals.kdvNet) : "…"}</p>
          <p className="text-[11px] text-slate-400">{data ? `Kesilen ${tl(data.totals.kdvIssued)} − iade ${tl(data.totals.kdvCredited)}` : ""}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Faturası bekleyen tahmini KDV</p>
          <p className="mt-1 text-[22px] font-bold tracking-tight text-white">{data ? tl(data.totals.pendingKdvEstimate) : "…"}</p>
          <p className="text-[11px] text-slate-400">Henüz kesilmedi; toplama katılmaz</p>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-white/[0.07]">
        <table className="w-full min-w-[720px] text-left text-[12.5px]">
          <thead className="bg-white/[0.04] text-[10.5px] uppercase tracking-[0.07em] text-slate-400">
            <tr>
              <th className="px-3 py-2">Dönem</th>
              <th className="px-3 py-2 text-right">Ödeme</th>
              <th className="px-3 py-2 text-right">İade</th>
              <th className="px-3 py-2 text-right">Net</th>
              <th className="px-3 py-2 text-right">Kesilen KDV</th>
              <th className="px-3 py-2 text-right">İade KDV</th>
              <th className="px-3 py-2 text-right">Ödenecek KDV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-slate-200">
            {busy && !data && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Yükleniyor…</td>
              </tr>
            )}
            {data && data.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-slate-400">Bu aralıkta kayıt yok.</td>
              </tr>
            )}
            {data?.rows.map((r) => (
              <tr key={r.period}>
                <td className="px-3 py-2 font-semibold text-white">{periodLabel(r.period, data.group)}</td>
                <td className="px-3 py-2 text-right">{r.paidCount} · {tl(r.paidTotal)}</td>
                <td className="px-3 py-2 text-right">{r.refundedCount} · {tl(r.refundedTotal)}</td>
                <td className="px-3 py-2 text-right">{tl(r.netTotal)}</td>
                <td className="px-3 py-2 text-right">{tl(r.kdvIssued)}</td>
                <td className="px-3 py-2 text-right">{tl(r.kdvCredited)}</td>
                <td className="px-3 py-2 text-right font-semibold text-amber-200">{tl(r.kdvNet)}</td>
              </tr>
            ))}
          </tbody>
          {data && data.rows.length > 0 && (
            <tfoot className="bg-white/[0.04] text-slate-100">
              <tr>
                <td className="px-3 py-2 font-bold">Toplam</td>
                <td className="px-3 py-2 text-right font-semibold">{data.totals.paidCount} · {tl(data.totals.paidTotal)}</td>
                <td className="px-3 py-2 text-right font-semibold">{data.totals.refundedCount} · {tl(data.totals.refundedTotal)}</td>
                <td className="px-3 py-2 text-right font-semibold">{tl(data.totals.netTotal)}</td>
                <td className="px-3 py-2 text-right font-semibold">{tl(data.totals.kdvIssued)}</td>
                <td className="px-3 py-2 text-right font-semibold">{tl(data.totals.kdvCredited)}</td>
                <td className="px-3 py-2 text-right font-bold text-amber-200">{tl(data.totals.kdvNet)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {data && data.totals.foreignCount > 0 && (
        <p className="mt-2 text-[11.5px] text-slate-400">Bu aralıkta {data.totals.foreignCount} döviz (USD/EUR) ödeme var; TL toplamlarına dahil edilmedi.</p>
      )}
      {data?.truncated && <p className="mt-2 text-[11.5px] text-amber-200">Kayıt sayısı çok fazla; aralığı daraltın (liste kısaltıldı).</p>}
    </section>
  );
}
