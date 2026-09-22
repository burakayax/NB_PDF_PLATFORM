import { Lightbulb } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { howToForTool } from "./toolHowToSteps";

/**
 * "NASIL ÇALIŞIR?" KARTI — her aracın başında duran, numaralı adım listesi.
 *
 * Amaç: bilgisayarla arası olmayan birinin de araca bakıp ne yapacağını
 * anlaması. Bu yüzden adımlar teknik terim içermez, kullanıcının EKRANDA NE
 * GÖRECEĞİNİ ve NEREYE BASACAĞINI söyler. Metinler tek yerde (toolHowToSteps)
 * tutulur; yeni araç eklerken oraya bir kayıt eklemek yeterlidir.
 */

export function ToolHowTo({
  slug,
  language,
  className = "",
  compact = false,
}: {
  /** SEO araç slug'ı (ör. "merge-pdf"). Karşılığı yoksa kart gösterilmez. */
  slug: string;
  language: Language;
  className?: string;
  /** Dar kolonlarda (yan panel) daha küçük tipografi. */
  compact?: boolean;
}) {
  const steps = howToForTool(slug, language);
  if (!steps || steps.length === 0) return null;
  const tr = language === "tr";

  return (
    <section
      aria-label={tr ? "Nasıl çalışır" : "How it works"}
      className={`rounded-2xl border border-cyan-400/20 bg-gradient-to-b from-cyan-500/[0.09] to-transparent ${compact ? "p-3.5" : "p-4 sm:p-5"} ${className}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/25">
          <Lightbulb className="h-4 w-4" />
        </span>
        <p className={`font-bold text-white ${compact ? "text-[12px]" : "text-[14px]"}`}>
          {tr ? "Nasıl çalışır?" : "How it works"}
        </p>
      </div>
      <ol className={compact ? "space-y-2" : "grid gap-2.5 sm:grid-cols-3"}>
        {steps.map((step, i) => (
          <li key={i} className={compact ? "flex gap-2.5" : "flex gap-2.5 rounded-xl bg-white/[0.02] p-2.5"}>
            <span
              className={`mt-px flex shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-bold text-cyan-200 ${
                compact ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-[11px]"
              }`}
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className={`block font-semibold text-slate-100 ${compact ? "text-[12px]" : "text-[13px]"}`}>
                {step.title}
              </span>
              <span className={`block leading-relaxed text-slate-400 ${compact ? "text-[11px]" : "text-[12px]"}`}>
                {step.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
