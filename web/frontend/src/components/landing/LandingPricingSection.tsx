import type { Language } from "../../i18n/landing";
import { landingPricingCreditsCopy } from "../../i18n/landingPricingCredits";
import { CREDIT_PACKS } from "../../lib/creditPacks";

type Props = {
  language: Language;
  kicker: string;
  title: string;
  description: string;
  onUseWebApp: () => void;
};

/**
 * Landing pricing: credit packs only (no subscription tiers).
 */
export function LandingPricingSection({ language, kicker, title, description, onUseWebApp }: Props) {
  const P = landingPricingCreditsCopy(language);

  return (
    <section className="py-10" data-nb-preview="pricing">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">{kicker}</p>
        <h3 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h3>
        <p className="mt-4 text-base leading-8 text-slate-300">{description}</p>
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-slate-200">
          {P.examplesLead}
        </p>
        <ul className="mt-3 space-y-1 text-sm text-cyan-100/95">
          <li>{P.exampleSplit}</li>
          <li>{P.exampleMerge}</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {CREDIT_PACKS.map((pack, i) => (
          <article
            key={pack.product}
            className={`group flex flex-col rounded-[24px] border p-5 md:p-7 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] md:rounded-[30px] ${
              i === 1
                ? "border-cyan-400/40 bg-gradient-to-br from-cyan-500/[0.12] to-indigo-500/[0.1] shadow-[0_28px_80px_-16px_rgba(34,211,238,0.22)] ring-1 ring-cyan-400/25"
                : "border-white/10 bg-white/[0.045] hover:bg-white/[0.07]"
            }`}
          >
            <div className="flex-1 text-left">
              {i === 1 ? (
                <span className="mb-2 inline-block rounded-full border border-cyan-400/45 bg-cyan-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                  {P.popular}
                </span>
              ) : null}
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 group-hover:text-cyan-400 transition-colors">
                {P.packLabel}
              </p>
              <h4 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                {P.creditsLine(pack.credits)}
              </h4>
              <p className="mt-2 text-3xl font-black tabular-nums text-cyan-200">₺{pack.priceTry}</p>
              <p className="mt-4 text-sm leading-6 text-slate-300">{P.packBlurb}</p>
            </div>
            <button
              type="button"
              onClick={onUseWebApp}
              className={`mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold transition-all ${
                i === 1
                  ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 hover:scale-[1.02]"
                  : "border border-white/[0.1] bg-white/[0.05] text-white hover:bg-white/10 hover:scale-[1.02]"
              }`}
            >
              {P.ctaBuy}
            </button>
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        <p className="text-center text-sm text-slate-400">{P.freeTeaser}</p>
        <button
          type="button"
          onClick={onUseWebApp}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-6 text-sm font-semibold text-white hover:bg-white/10"
        >
          {P.ctaStart}
        </button>
      </div>
    </section>
  );
}
