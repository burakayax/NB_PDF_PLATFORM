import { ArrowRight, Sparkles } from "lucide-react";

/**
 * Yapay zekâ özelliğini "satın al" demeden, tam işe yarayacağı anda değerini hissettiren vurgulu kart.
 * Renk (fuşya→amber) yalnızca yapay zekâ için kullanılır; böylece sayfada ayrışır.
 */
export function CvAiNudge({ title, text, cta, onClick, compact = false }: { title: string; text: string; cta: string; onClick: () => void; compact?: boolean }) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-fuchsia-500/60 via-violet-500/50 to-amber-400/60 p-px shadow-[0_14px_40px_-22px_rgba(217,70,239,0.8)]">
      <div className={`flex flex-col gap-2.5 rounded-[15px] bg-slate-950/95 text-left ${compact ? "p-3" : "p-3.5"} sm:flex-row sm:items-center sm:gap-3.5`}>
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-amber-400/25 text-amber-200 ring-1 ring-fuchsia-300/30 sm:flex"><Sparkles className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-white"><Sparkles className="h-4 w-4 shrink-0 text-amber-300 sm:hidden" />{title}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-slate-300">{text}</p>
        </div>
        <button type="button" onClick={onClick} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-amber-500 px-4 py-2.5 text-[13px] font-bold text-slate-950 shadow-[0_10px_26px_-10px_rgba(217,70,239,0.9)] hover:brightness-110">
          {cta}<ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
