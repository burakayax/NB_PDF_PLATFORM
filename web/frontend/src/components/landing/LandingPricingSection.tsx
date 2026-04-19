import type { PublicPricingPayload } from "../../api/public";
import { PricingPsychologyStack } from "../PricingPsychologyStack";
import { formatRegionalPlanPrice, regionalCurrencyHint } from "../../lib/formatRegionalPrice";
import { getAnnualPricePsychology, getMonthlyPricePsychology } from "../../lib/pricingPsychology";
import { pricingSectionCopy } from "../../i18n/pricingSection";
import type { Language } from "../../i18n/landing";
import { useState } from "react";

type Props = {
  language: Language;
  pricing: PublicPricingPayload | undefined;
  kicker: string;
  title: string;
  description: string;
  onUseWebApp: () => void;
};

export function LandingPricingSection({ language, pricing, kicker, title, description, onUseWebApp }: Props) {
  const P = pricingSectionCopy(language);
  const savePct = pricing?.annualSavePercent ?? 0;
  const hint = regionalCurrencyHint(pricing, language);

  const freePrice = language === "tr" ? "Ücretsiz" : "Free";
  const pb = formatRegionalPlanPrice(pricing, "basicMonthly", language);
  const pm = formatRegionalPlanPrice(pricing, "proMonthly", language);
  const pa = formatRegionalPlanPrice(pricing, "proAnnual", language);
  const perDay = (amount: string) => P.onlyPerDay(amount);
  const psychBasic = getMonthlyPricePsychology(pricing, "basic", language, perDay);
  const psychPro = getMonthlyPricePsychology(pricing, "pro", language, perDay);
  const psychAnnual = getAnnualPricePsychology(pricing, language, perDay);
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section className="py-10" data-nb-preview="pricing">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">{kicker}</p>
        <h3 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h3>
        <p className="mt-4 text-base leading-8 text-slate-300">{description}</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          {pricing?.pricingRegion === "TR" ? P.regionTry : P.regionIntl}
        </p>
        {hint ? <p className="mt-2 text-sm leading-relaxed text-amber-200/90">{hint}</p> : null}
      </div>
  
      {/* KARTLARIN BAŞLADIĞI YER */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-stretch">
        
        {/* 1. KART: ÜCRETSİZ */}
        <article className="group flex flex-col rounded-[24px] md:rounded-[30px] border border-white/10 bg-white/[0.045] p-5 md:p-7 transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.07] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="flex-1 text-left">
            <p className="text-xs md:text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 group-hover:text-cyan-400 transition-colors">{P.freeTitle}</p>
            <h4 className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight text-white">{freePrice}</h4>
            <p className="mt-4 text-sm leading-6 md:leading-7 text-slate-300">{P.freeDesc}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-200">
              <li className="flex gap-2"><span className="text-cyan-400">✓</span>{P.featFree1}</li>
              <li className="flex gap-2"><span className="text-cyan-400">✓</span>{P.featFree2}</li>
              <li className="flex gap-2"><span className="text-cyan-400">✓</span>{P.featFree3}</li>
            </ul>
          </div>
          <button type="button" onClick={onUseWebApp} className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.05] px-5 text-sm font-semibold text-white transition-all group-hover:bg-white/10 group-hover:scale-[1.02]">
            {P.ctaStart}
          </button>
        </article>

        {/* 2. KART: BASIC */}
        <article className="group flex flex-col rounded-[24px] md:rounded-[30px] border border-white/10 bg-white/[0.045] p-5 md:p-7 transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.07] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="flex-1 text-left">
            <p className="text-xs md:text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 group-hover:text-cyan-400 transition-colors">{P.basicTitle}</p>
            <PricingPsychologyStack variant="landing" stack={psychBasic} fallback={<h4 className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight text-white">{pb}</h4>} />
            <p className="mt-4 text-sm leading-6 md:leading-7 text-slate-300">{P.basicDesc}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-200">
              <li className="flex gap-2"><span className="text-cyan-400">✓</span>{P.featPaid1}</li>
              <li className="flex gap-2"><span className="text-cyan-400">✓</span>{P.featPaid2}</li>
              <li className="flex gap-2"><span className="text-cyan-400">✓</span>{P.featBasicNote}</li>
            </ul>
          </div>
          <button type="button" onClick={onUseWebApp} className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.05] px-5 text-sm font-semibold text-white transition-all group-hover:bg-white/10 group-hover:scale-[1.02]">
            {P.ctaChoose}
          </button>
        </article>

        {/* 3. KART: PRO (Özel Efektli) */}
        <article className="group flex flex-col rounded-[24px] md:rounded-[30px] border border-indigo-400/35 bg-gradient-to-br from-cyan-500/[0.08] to-indigo-500/[0.1] p-5 md:p-7 shadow-[0_28px_80px_-16px_rgba(34,211,238,0.22)] ring-1 ring-cyan-400/25 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_35px_90px_-10px_rgba(34,211,238,0.35)]">
          <div className="flex-1 text-left">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs md:text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">{P.proTitle}</p>
              <span className="shrink-0 rounded-full border border-cyan-400/45 bg-gradient-to-r from-cyan-500/35 to-indigo-500/30 px-2 py-0.5 text-[9px] font-bold uppercase text-white animate-pulse">
                {P.mostPopular}
              </span>
            </div>
            <PricingPsychologyStack variant="landing" stack={psychPro} fallback={<h4 className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight text-white">{pm}</h4>} />
            <p className="mt-4 text-sm leading-6 md:leading-7 text-slate-200">{P.proDesc}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-100">
              <li className="flex gap-2"><span className="text-cyan-300">✓</span>{P.featPaid1}</li>
              <li className="flex gap-2"><span className="text-cyan-300">✓</span>{P.featPaid2}</li>
              <li className="flex gap-2"><span className="text-cyan-300">✓</span>{P.featPaid3}</li>
            </ul>
          </div>
          <button type="button" onClick={onUseWebApp} className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition-all hover:bg-cyan-300 hover:scale-[1.03]">
            {P.ctaPro}
          </button>
        </article>

        {/* 4. KART: YILLIK */}
        <article className="group flex flex-col rounded-[24px] md:rounded-[30px] border border-indigo-400/30 bg-indigo-950/[0.25] p-5 md:p-7 transition-all duration-500 hover:-translate-y-2 hover:bg-indigo-900/30 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs md:text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200/90">{P.annualTitle}</p>
              {savePct > 0 && (
                <span className="rounded-full border border-indigo-400/35 bg-indigo-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-indigo-100">
                  %{savePct} {language === "tr" ? "TASARRUF" : "SAVE"}
                </span>
              )}
            </div>
            <PricingPsychologyStack variant="landing" stack={psychAnnual} fallback={<h4 className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight text-white">{pa}</h4>} />
            <p className="mt-4 text-sm leading-6 md:leading-7 text-slate-300">{P.annualDesc}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-200">
              <li className="flex gap-2"><span className="text-indigo-300">✓</span>{P.featPaid1}</li>
              <li className="flex gap-2"><span className="text-indigo-300">✓</span>{P.featPaid2}</li>
              <li className="flex gap-2"><span className="text-indigo-300">✓</span>{P.featPaid3}</li>
            </ul>
          </div>
          <button type="button" onClick={onUseWebApp} className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-indigo-400/45 bg-indigo-500/80 px-5 text-sm font-semibold text-white transition-all hover:bg-indigo-400 group-hover:scale-[1.02]">
            {P.ctaAnnual}
          </button>
        </article>
      </div>
      {/* KARTLARIN BİTTİĞİ YER */}
  
      {/* Güven Rozetleri ve Karşılaştırma Tablosu (Aynı Kalabilir) */}
      {/* ... alt kısımdaki tablo kodunu buraya ekleyin ... */}
    </section>
  );
}
