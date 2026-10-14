import { useEffect, useRef, useState } from "react";
import { Gauge, Sparkles } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { AI_MONTHLY_CREDITS_BY_PLAN } from "../../lib/aiCredits";
import { PLANS } from "../../lib/planConfig";

export type DailyPool = { used: number; limit: number | null; resetAt?: string };

/**
 * GÜNLÜK HAK HAVUZU — üst çubuktaki rozet.
 *
 * Sunucuda işlenen araçlar (sıkıştır, Word/Excel dönüşümleri…) ortak bir günlük havuzdan harcar.
 * Cihazda çalışan araçlar (birleştir, böl, döndür, sil, sırala, görsel→PDF) havuzdan DÜŞMEZ; bu
 * yüzden kullanıcıya hem kalanı hem de neyin sayılmadığını gösteririz.
 *
 * Günlük sınırı olmayan planlarda (limit = null) hiç çizilmez. Rakamlar sunucudan gelir
 * (`/api/entitlement/balance` → daily); burada yalnızca gösterilir, hiçbir şey hesaplanıp karar
 * verilmez. Pro reklamındaki sayılar plan kataloğundan okunur (elle yazılmaz).
 */
export function DailyPoolChip({
  language,
  daily,
  onUpgrade,
}: {
  language: Language;
  daily?: DailyPool | null;
  /** Verilirse popover'da "Pro'ya geç" düğmesi çıkar (ödeme/yükseltme ekranını açar). */
  onUpgrade?: () => void;
}) {
  const tr = language === "tr";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!daily || daily.limit === null || daily.limit <= 0) return null;

  const limit = daily.limit;
  const left = Math.max(0, limit - daily.used);
  const ratio = Math.min(1, left / limit);
  const tone =
    left === 0
      ? "border-red-500/50 bg-red-950/70 text-red-200"
      : left <= 1
        ? "border-amber-400/45 bg-amber-500/15 text-amber-100"
        : "border-cyan-400/30 bg-cyan-500/10 text-cyan-100";
  const bar = left === 0 ? "bg-red-400" : left <= 1 ? "bg-amber-400" : "bg-cyan-400";

  const pro = PLANS.find((p) => p.id === "PRO");
  const proMonthly = pro?.monthlyOpsLimit ?? null;
  const resetText = daily.resetAt
    ? new Date(daily.resetAt).toLocaleTimeString(tr ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div ref={wrapRef} className="relative inline-flex" data-testid="daily-pool-chip">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          tr
            ? `Bugünkü işlem hakkı: ${left} / ${limit} kaldı`
            : `Today's operations: ${left} of ${limit} left`
        }
        className={`nb-transition inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-2 text-[12px] font-bold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 sm:px-3 sm:text-[13px] ${tone}`}
      >
        <Gauge className="hidden h-3.5 w-3.5 shrink-0 sm:block" aria-hidden />
        <span>
          <span className="hidden md:inline">{tr ? "Bugün " : "Today "}</span>
          {left}/{limit}
          <span className="hidden md:inline">{tr ? " hak" : " left"}</span>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={tr ? "Günlük hak havuzu" : "Daily allowance"}
          className="fixed inset-x-3 top-16 z-[70] rounded-2xl border border-white/[0.12] bg-nb-bg-elevated/98 p-4 text-left shadow-[0_18px_44px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-80"
        >
          <p className="text-[13px] font-bold text-white">{tr ? "Günlük işlem hakkın" : "Your daily allowance"}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
            <span className="text-[12px] font-bold tabular-nums text-slate-200">
              {left}/{limit}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-[12px] leading-snug text-slate-300">
            <li>
              {tr
                ? "Sunucuda yapılan işlemler (sıkıştır, Word/Excel dönüşümü…) 1 hak harcar. PDF→PowerPoint ve PDF→Excel 2 hak sayılır."
                : "Server-side operations (compress, Word/Excel conversion…) use 1. PDF→PowerPoint and PDF→Excel count as 2."}
            </li>
            <li className="text-emerald-300/90">
              {tr
                ? "Cihazında çalışan araçlar (birleştir, böl, döndür, sil, sırala, görsel→PDF) hakkından düşmez."
                : "Tools that run on your device (merge, split, rotate, delete, reorder, image→PDF) never use your allowance."}
            </li>
            <li className="text-slate-400">
              {tr
                ? `Hakkın gece yarısı yenilenir${resetText ? ` (${resetText})` : ""}.`
                : `Your allowance renews at midnight${resetText ? ` (${resetText})` : ""}.`}
            </li>
          </ul>
          <div className="mt-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/[0.08] p-3 text-[12px] leading-snug text-fuchsia-100">
            <p className="flex items-center gap-1.5 font-bold">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {tr ? "Pro'ya geçersen" : "With Pro"}
            </p>
            <p className="mt-1 text-fuchsia-100/85">
              {tr
                ? `Günlük sınır yok${proMonthly ? `, ayda ${proMonthly.toLocaleString("tr-TR")} işlem` : ""} ve ayda ${AI_MONTHLY_CREDITS_BY_PLAN.PRO} yapay zekâ işlemi.`
                : `No daily limit${proMonthly ? `, ${proMonthly.toLocaleString("en-US")} operations a month` : ""} and ${AI_MONTHLY_CREDITS_BY_PLAN.PRO} AI operations a month.`}
            </p>
            {onUpgrade ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onUpgrade();
                }}
                className="nb-transition mt-2 inline-flex min-h-[36px] items-center rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-3 text-[12px] font-bold text-white hover:brightness-110"
              >
                {tr ? "Pro'ya geç" : "Go Pro"}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
