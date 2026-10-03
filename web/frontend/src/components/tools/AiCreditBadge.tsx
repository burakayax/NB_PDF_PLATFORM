import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import type { Language } from "../../i18n/landing";
import type { AiQuota } from "../../api/ai";
import { AI_TOOL_COSTS } from "../../lib/aiCredits";

/** Aylık kalan hak (kredi HARİÇ). Eski/yeni sunucu uyumu için yedekli hesap. */
export function monthlyLeft(q: AiQuota): number {
  if (typeof q.monthlyRemaining === "number") return q.monthlyRemaining;
  if (q.limit === null) return 0;
  return Math.max(0, q.limit - q.used);
}

/** Satın alınmış kredi bakiyesi. */
export function creditBalance(q: AiQuota): number {
  return Math.max(0, q.bonus ?? 0);
}

function fmtDate(iso: string | undefined, tr: boolean): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(tr ? "tr-TR" : "en-US", { day: "numeric", month: "long" });
}

/**
 * "?" düğmesi ve açılan açıklama: aylık hak / kredi nedir, ne zaman sıfırlanır, hangi durumda düşer.
 * Başka yerlerde (profil, kullanım paneli) da tek başına kullanılabilir.
 */
export function AiCreditHelp({
  language,
  quota,
  onTopUp,
  align = "left",
  topic = "all",
}: {
  language: Language;
  quota?: AiQuota | null;
  onTopUp?: () => void;
  align?: "left" | "right";
  /** Hangi başlığın açıklaması: yalnız aylık hak, yalnız kredi ya da ikisi birden. */
  topic?: "monthly" | "credit" | "all";
}) {
  const tr = language === "tr";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const reset = fmtDate(quota?.resetAt, tr);
  const unlimited = !!quota?.unlimited;
  const showMonthly = topic !== "credit";
  const showCredit = topic !== "monthly";
  const title =
    topic === "monthly" ? (tr ? "Aylık hak" : "Monthly allowance") : topic === "credit" ? (tr ? "Kredi" : "Credits") : tr ? "Aylık hak ve kredi" : "Monthly allowance & credits";

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={topic === "monthly" ? (tr ? "Aylık hak nedir?" : "What is the monthly allowance?") : topic === "credit" ? (tr ? "Kredi nedir?" : "What are credits?") : tr ? "Aylık hak ve kredi nedir?" : "What are monthly allowance and credits?"}
        aria-expanded={open}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.1] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/50"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={title}
          className={`absolute top-7 z-[60] max-h-[min(75vh,32rem)] w-[min(23rem,88vw)] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.12] bg-[#0b1020] p-4 text-left shadow-2xl ${align === "right" ? "right-0" : "left-0"}`}
        >
          <p className="text-[13px] font-black text-white">{title}</p>

          {showMonthly && (<>
          <p className="mt-2.5 text-[12px] font-bold text-fuchsia-200">{tr ? "Aylık hak nedir?" : "What is the monthly allowance?"}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-300">
            {tr
              ? `Paketinizle gelir. Her ay başında yenilenir${reset ? ` (sıradaki yenilenme: ${reset})` : ""}; kullanılmayan hak bir sonraki aya devretmez. Basit araçlarda (özet, sohbet, çeviri, veri çıkarma, karşılaştırma, veri gizleme) ve sözleşmenin hızlı taramasında kullanılır.`
              : `Comes with your plan. Renews at the start of each month${reset ? ` (next renewal: ${reset})` : ""}; unused allowance does not roll over. Used by the standard tools and the contract quick scan.`}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-300">
            {tr
              ? "Hakkınız bitince basit araçlar otomatik olarak kredinizden düşmeye başlar. Detaylı sözleşme denetimi aylık hakka hiç dokunmaz."
              : "When it runs out, standard tools start using your credits automatically. The detailed contract audit never uses the monthly allowance."}
          </p>
          </>)}

          {showCredit && (<>
          <p className="mt-2.5 text-[12px] font-bold text-fuchsia-200">{tr ? "Kredi nedir?" : "What are credits?"}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-300">
            {tr
              ? "Ek kredi paketinden satın alırsınız. Süresi dolmaz, ay sonunda sıfırlanmaz."
              : "Bought in extra credit packs. They never expire and do not reset at month end."}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-300">
            {tr
              ? "Kredi bakiyeniz sıfırsa hiç kredi satın almamışsınız ya da hepsini kullanmışsınız demektir. Detaylı sözleşme denetimi yalnızca krediyle çalışır."
              : "A zero balance means you have not bought credits or have used them all. The detailed contract audit only runs on credits."}
          </p>
          </>)}

          <p className="mt-2.5 text-[12px] font-bold text-fuchsia-200">{tr ? "Hangi durumda düşer?" : "When are they deducted?"}</p>
          <ul className="mt-0.5 space-y-1 text-[12px] leading-relaxed text-slate-300">
            {showMonthly && <li>• {tr ? "Basit araçlar ve sözleşme hızlı taraması: önce aylık hakkınızdan düşer; hakkınız bitince otomatik olarak krediden düşer." : "Standard tools and the contract quick scan: your monthly allowance is used first; credits are used automatically once it runs out."}</li>}
            {showCredit && <li>• {tr ? "Detaylı sözleşme denetimi (ağır araç): aylık hakka dokunmaz, yalnızca krediden düşer." : "Detailed contract audit (heavy tool): never uses the monthly allowance, only credits."}</li>}
            <li>• {tr ? "İşlem başarısız olursa harcanan hak/kredi iade edilir." : "If an operation fails, the allowance/credits spent are refunded."}</li>
            {unlimited && <li>• {tr ? "Yönetici hesabında sınır yoktur; hiçbir şey düşülmez." : "Admin accounts have no limit; nothing is deducted."}</li>}
          </ul>

          <p className="mt-2.5 text-[12px] font-bold text-fuchsia-200">{tr ? "Hangi araç ne kadar harcar?" : "What does each tool cost?"}</p>
          <ul className="mt-1 space-y-1">
            {AI_TOOL_COSTS.map((t) => (
              <li key={t.en} className="flex items-start justify-between gap-3 text-[12px] leading-snug">
                <span className={t.heavy ? "font-semibold text-white" : "text-slate-300"}>{tr ? t.tr : t.en}</span>
                <span className="shrink-0 text-right tabular-nums text-slate-200">{tr ? t.cost : (t.costEn ?? t.cost)}</span>
              </li>
            ))}
          </ul>

          {onTopUp && !unlimited && (
            <button
              type="button"
              onClick={() => { setOpen(false); onTopUp(); }}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-3 py-2 text-[12.5px] font-bold text-white transition hover:brightness-110"
            >
              {tr ? "Kredi paketlerini gör" : "See credit packs"}
            </button>
          )}
        </div>
      )}
    </span>
  );
}

/**
 * Araç başlığındaki AI hak göstergesi: "Aylık: 27/40 · Kredi: 60" + "?" açıklaması + "+ Kredi".
 * Yönetici hesabında yalnızca "Sınırsız" gösterir.
 */
export function AiCreditBadge({
  quota,
  language,
  onTopUp,
}: {
  quota: AiQuota;
  language: Language;
  onTopUp?: () => void;
}) {
  const tr = language === "tr";
  if (quota.unlimited) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">{tr ? "Sınırsız" : "Unlimited"}</span>
        <AiCreditHelp language={language} quota={quota} />
      </span>
    );
  }
  const monthly = monthlyLeft(quota);
  const credits = creditBalance(quota);
  const monthlyEmpty = monthly <= 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {(quota.limit ?? 0) > 0 && (
        <>
          <span
            title={tr ? "Aylık hak: paketinizle gelir, her ay yenilenir" : "Monthly allowance: comes with your plan, renews monthly"}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${monthlyEmpty ? "border-red-400/35 bg-red-500/10 text-red-300" : "border-white/10 bg-white/[0.04] text-slate-300"}`}
          >
            {tr ? "Aylık" : "Monthly"}: {monthly}/{quota.limit ?? 0}
          </span>
          <AiCreditHelp language={language} quota={quota} topic="monthly" />
        </>
      )}
      <span
        title={tr ? "Kredi: satın aldığınız, süresi dolmayan bakiye" : "Credits: purchased balance, never expires"}
        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${credits > 0 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.04] text-slate-400"}`}
      >
        {tr ? "Kredi" : "Credits"}: {credits}
      </span>
      <AiCreditHelp language={language} quota={quota} onTopUp={onTopUp} topic="credit" />
      {onTopUp && (
        <button
          type="button"
          onClick={onTopUp}
          title={tr ? "Ek AI kredisi al" : "Get extra AI credits"}
          className="rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold text-fuchsia-200 transition hover:bg-fuchsia-500/20"
        >
          + {tr ? "Kredi" : "Credits"}
        </button>
      )}
    </span>
  );
}
