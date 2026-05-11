import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NumberFlow from "@number-flow/react";
import type { Language } from "../../i18n/landing";
import { pricingSectionCopy } from "../../i18n/pricingSection";
import { PLANS } from "../../lib/planConfig";
import type {
  Currency,
  BillingCycle,
  PlanDefinition,
} from "../../lib/planConfig";
import { useCheckoutCurrency } from "../../contexts/CheckoutCurrencyContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRawPrice(
  plan: PlanDefinition,
  currency: Currency,
  cycle: BillingCycle,
): number {
  const p =
    cycle === "YEARLY"
      ? plan.pricing.yearly[currency]
      : plan.pricing.monthly[currency];
  return currency === "USD" ? p / 100 : p;
}

function fmt(value: number, currency: Currency): string {
  if (currency === "USD") return `$${value.toFixed(2)}`;
  return `₺${value.toLocaleString("tr-TR")}`;
}

// ─── Billing Toggle (for Business card) ──────────────────────────────────────

function BillingToggle({
  cycle,
  onChange,
  lang,
}: {
  cycle: BillingCycle;
  onChange: (c: BillingCycle) => void;
  lang: Language;
}) {
  const tr = lang === "tr";
  return (
    <div className="flex items-center justify-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10 text-xs">
      {(["MONTHLY", "YEARLY"] as BillingCycle[]).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`relative px-3 py-1.5 rounded-md font-semibold transition-colors ${
            cycle === c ? "text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          {cycle === c && (
            <motion.span
              layoutId="billing-pill"
              className="absolute inset-0 rounded-md bg-white/15"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative">
            {c === "MONTHLY"
              ? tr
                ? "Aylık"
                : "Monthly"
              : tr
                ? "Yıllık"
                : "Yearly"}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Feature Check Row ────────────────────────────────────────────────────────

function Feature({ text, highlight }: { text: string; highlight: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <div
        className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
          highlight ? "bg-blue-500/25" : "bg-white/8"
        }`}
      >
        <span
          className={`text-[9px] font-bold ${highlight ? "text-blue-300" : "text-gray-500"}`}
        >
          ✓
        </span>
      </div>
      <span className={highlight ? "text-gray-200" : "text-gray-400"}>
        {text}
      </span>
    </li>
  );
}

// ─── Individual Plan Cards ────────────────────────────────────────────────────

function FreeCard({
  plan,
  currency,
  lang,
  onCta,
}: {
  plan: PlanDefinition;
  currency: Currency;
  lang: Language;
  onCta: () => void;
}) {
  const tr = lang === "tr";
  const features = tr ? plan.featuresTr : plan.featuresEn;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0 }}
      className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-7 flex flex-col h-full hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300"
    >
      <div className="text-2xl mb-3">🆓</div>
      <h3 className="text-xl font-bold text-white mb-1">
        {tr ? plan.nameTr : plan.nameEn}
      </h3>
      <p className="text-gray-500 text-sm mb-5">
        {tr ? "Başla, kart gerekmez." : "Get started, no card required."}
      </p>

      <div className="mb-6 flex items-baseline gap-1.5">
        <span className="text-5xl font-black text-white">₺0</span>
        <span className="text-gray-500 text-sm">{tr ? "/ ay" : "/ mo"}</span>
      </div>

      <ul className="space-y-2.5 flex-1 mb-7">
        {features.map((f) => (
          <Feature key={f} text={f} highlight={false} />
        ))}
      </ul>

      <button
        onClick={onCta}
        className="w-full py-3 rounded-xl border border-white/20 text-white text-sm font-semibold hover:bg-white/8 transition-all"
      >
        {tr ? "Ücretsiz Başla" : "Start for Free"}
      </button>
    </motion.div>
  );
}

function PlusCard({
  plan,
  currency,
  lang,
  onCta,
}: {
  plan: PlanDefinition;
  currency: Currency;
  lang: Language;
  onCta: () => void;
}) {
  const tr = lang === "tr";
  const features = tr ? plan.featuresTr : plan.featuresEn;
  const price = getRawPrice(plan, currency, "MONTHLY");
  const sym = currency === "TRY" ? "₺" : "$";
  const unit = currency === "TRY" ? (tr ? "/ ay" : "/ mo") : "/ mo";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0.08 }}
      style={{ scale: 1.02 }}
      className="relative rounded-2xl border border-blue-500/50 bg-gradient-to-b from-blue-950/60 to-slate-950/60 p-7 flex flex-col h-full shadow-2xl shadow-blue-500/15 ring-1 ring-blue-500/20"
    >
      {/* Glow */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            animation: "lp-ping-slow 3s ease-in-out infinite",
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.3), transparent 70%)",
          }}
        />
      </div>

      {/* Badge */}
      <div className="absolute -top-3.5 inset-x-0 flex justify-center">
        <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-blue-500/30">
          ⭐ {tr ? "En Popüler" : "Most Popular"}
        </span>
      </div>

      <div className="text-2xl mb-3 mt-2">🚀</div>
      <h3 className="text-xl font-bold text-white mb-1">
        {tr ? plan.nameTr : plan.nameEn}
      </h3>
      <p className="text-blue-300/70 text-sm mb-5">
        {tr
          ? "Bireyler için akıllı seçim."
          : "The smart choice for individuals."}
      </p>

      <div className="mb-6 flex items-baseline gap-1.5">
        <span className="text-gray-400 text-lg font-semibold">{sym}</span>
        <NumberFlow
          value={price}
          className="text-5xl font-black text-white tabular-nums"
          transformTiming={{ duration: 400, easing: "ease-out" }}
        />
        <span className="text-gray-400 text-sm">{unit}</span>
      </div>

      <ul className="space-y-2.5 flex-1 mb-7">
        {features.map((f) => (
          <Feature key={f} text={f} highlight={true} />
        ))}
      </ul>

      <button
        onClick={onCta}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/30 transition-all"
      >
        {tr ? "Plus'ı Başlat" : "Start Plus"}
      </button>
    </motion.div>
  );
}

function ProCard({
  plan,
  currency,
  lang,
  onCta,
}: {
  plan: PlanDefinition;
  currency: Currency;
  lang: Language;
  onCta: () => void;
}) {
  const tr = lang === "tr";
  const features = tr ? plan.featuresTr : plan.featuresEn;
  const yearlyPrice = plan.pricing.yearly[currency];
  const monthlyEq =
    currency === "USD"
      ? `$${(yearlyPrice / 100 / 12 / 100).toFixed(2)}/mo`
      : `₺${Math.round(yearlyPrice / 12).toLocaleString("tr-TR")}/${tr ? "ay" : "mo"}`;
  const displayYearly =
    currency === "USD"
      ? `$${(yearlyPrice / 100 / 100).toFixed(2)}`
      : `₺${yearlyPrice.toLocaleString("tr-TR")}`;
  const monthlyEqNum =
    currency === "USD" ? yearlyPrice / 100 / 12 / 100 : yearlyPrice / 12;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0.14 }}
      className="relative rounded-2xl border border-amber-500/25 bg-white/[0.03] p-7 flex flex-col h-full hover:border-amber-500/40 hover:bg-white/[0.05] transition-all duration-300"
    >
      {/* Badge */}
      <div className="absolute -top-3.5 inset-x-0 flex justify-center">
        <span className="relative overflow-hidden bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
          <span
            className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            style={{ animation: "shimmer 2.5s ease-in-out infinite" }}
          />
          <span className="relative">
            ⚡ {tr ? "+%20 Daha Fazla İşlem" : "+20% More Operations"}
          </span>
        </span>
      </div>

      <div className="text-2xl mb-3 mt-2">💎</div>
      <h3 className="text-xl font-bold text-white mb-1">
        {tr ? plan.nameTr : plan.nameEn}
      </h3>
      <p className="text-gray-500 text-sm mb-5">
        {tr
          ? "Düzenli kullananlar için en iyi seçim."
          : "For power users who stay."}
      </p>

      {/* Yearly price */}
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-4xl font-black text-white">{displayYearly}</span>
        <span className="text-gray-500 text-sm">{tr ? "/ yıl" : "/ year"}</span>
      </div>
      {/* Monthly equivalent */}
      <div className="mb-6">
        <span className="text-emerald-400 text-sm font-semibold">
          {tr ? "Sadece " : "Only "}
          {monthlyEq}
        </span>
        <span className="text-gray-600 text-xs ml-1.5">
          ({tr ? "aylık eşdeğer" : "monthly equivalent"})
        </span>
      </div>

      {/* Savings anchor */}
      <div className="mb-5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
        {tr
          ? `Aylık eşdeğere göre yılda ₺${Math.round(plan.pricing.monthly.TRY * 12 - plan.pricing.yearly.TRY).toLocaleString("tr-TR")} tasarruf`
          : `Save $${Math.round((plan.pricing.monthly.USD - plan.pricing.yearly.USD / 100) / 100)}/year vs monthly`}
      </div>

      <ul className="space-y-2.5 flex-1 mb-7">
        {features.map((f) => (
          <Feature key={f} text={f} highlight={false} />
        ))}
      </ul>

      <p className="text-gray-600 text-xs mb-3 text-center">
        {tr
          ? "Yıllık taahhüt — düzenli kullanıcılar için ideal"
          : "Yearly commitment — best for regular users"}
      </p>

      <button
        onClick={onCta}
        className="w-full py-3 rounded-xl border border-amber-500/40 text-amber-300 text-sm font-semibold hover:bg-amber-500/10 transition-all"
      >
        {tr ? "Pro'ya Geç" : "Go Pro"}
      </button>
    </motion.div>
  );
}

function BusinessCard({
  plan,
  currency,
  lang,
  onCta,
}: {
  plan: PlanDefinition;
  currency: Currency;
  lang: Language;
  onCta: () => void;
}) {
  const tr = lang === "tr";
  const features = tr ? plan.featuresTr : plan.featuresEn;
  const [cycle, setCycle] = useState<BillingCycle>("YEARLY");
  const price = getRawPrice(plan, currency, cycle);
  const sym = currency === "TRY" ? "₺" : "$";
  const unit =
    cycle === "YEARLY" ? (tr ? "/ yıl" : "/ year") : tr ? "/ ay" : "/ mo";

  const monthlySavePct = 20;
  const isYearly = cycle === "YEARLY";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0.2 }}
      className="relative rounded-2xl border border-violet-500/25 bg-white/[0.03] p-7 flex flex-col h-full hover:border-violet-500/40 hover:bg-white/[0.05] transition-all duration-300"
    >
      {/* Badge */}
      <div className="absolute -top-3.5 inset-x-0 flex justify-center">
        <span className="bg-violet-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
          👥 {tr ? "Ekipler İçin" : "For Teams"}
        </span>
      </div>

      <div className="text-2xl mb-3 mt-2">🏢</div>
      <h3 className="text-xl font-bold text-white mb-1">
        {tr ? plan.nameTr : plan.nameEn}
      </h3>
      <p className="text-gray-500 text-sm mb-4">
        {tr ? "Ekibinizle büyüyün." : "Scale with your team."}
      </p>

      {/* Billing toggle inside card */}
      <div className="mb-4">
        <BillingToggle cycle={cycle} onChange={setCycle} lang={lang} />
      </div>

      {isYearly && (
        <div className="mb-2">
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            {tr ? `%${monthlySavePct} Tasarruf` : `Save ${monthlySavePct}%`}
          </span>
        </div>
      )}

      <div className="mb-6 flex items-baseline gap-1.5">
        <span className="text-gray-400 text-lg font-semibold">{sym}</span>
        <AnimatePresence mode="wait">
          <NumberFlow
            key={`${cycle}-${currency}`}
            value={price}
            className="text-5xl font-black text-white tabular-nums"
            transformTiming={{ duration: 400, easing: "ease-out" }}
          />
        </AnimatePresence>
        <span className="text-gray-400 text-sm">{unit}</span>
      </div>

      <ul className="space-y-2.5 flex-1 mb-7">
        {features.map((f) => (
          <Feature key={f} text={f} highlight={false} />
        ))}
      </ul>

      <p className="text-gray-600 text-xs mb-3 text-center">
        {tr
          ? "Koltuk başına fiyatlandırma — ekibinizle ölçeklenir"
          : "Per seat pricing — scales with your team"}
      </p>

      <button
        onClick={onCta}
        className="w-full py-3 rounded-xl border border-violet-500/40 text-violet-300 text-sm font-semibold hover:bg-violet-500/10 transition-all"
      >
        {tr ? "Business'ı Başlat" : "Start Business"}
      </button>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PricingSectionProps {
  language: Language;
  onUseWebApp: () => void;
  onSelectPlan?: (planId: "STARTER" | "PLUS" | "PRO" | "BUSINESS") => void;
}

export default function PricingSection({
  language,
  onUseWebApp,
  onSelectPlan,
}: PricingSectionProps) {
  const tr = language === "tr";
  const copy = pricingSectionCopy(language);
  const { currency: checkoutCurrency } = useCheckoutCurrency();
  const currency: Currency = checkoutCurrency === "TRY" ? "TRY" : "USD";

  const [free, starter, plus, pro, business] = PLANS;

  return (
    <section id="pricing" className="relative py-28 overflow-hidden">
      {/* Glow background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.07)_0%,transparent_70%)]" />

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0%,100% { transform: translateX(-150%) skewX(-12deg); }
          50% { transform: translateX(250%) skewX(-12deg); }
        }
      `}</style>

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            ✦ {tr ? "Fiyatlandırma" : "Pricing"}
          </span>
          <h2
            className="text-4xl md:text-5xl font-extrabold text-white mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {tr ? "Her Ölçeğe Uygun Plan" : "Plans for Every Scale"}
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-6">
            {tr
              ? "Ücretsiz başla, büyüdükçe yükselt. İstediğin zaman iptal et."
              : "Start free, upgrade as you grow. Cancel anytime."}
          </p>

          {/* 7-Day Money-Back Guarantee Banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 mb-8"
          >
            <span className="text-xl">💰</span>
            <div className="text-left">
              <p className="text-emerald-300 font-bold text-sm">
                {copy.refundHeading}
              </p>
              <p className="text-emerald-400/70 text-xs mt-0.5 max-w-xs">
                {copy.refundBody}
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* 5-column grid */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5 items-stretch">
          <FreeCard
            plan={free}
            currency={currency}
            lang={language}
            onCta={onUseWebApp}
          />
          <PlusCard
            plan={starter}
            currency={currency}
            lang={language}
            onCta={onSelectPlan ? () => onSelectPlan("STARTER") : onUseWebApp}
          />
          <PlusCard
            plan={plus}
            currency={currency}
            lang={language}
            onCta={onSelectPlan ? () => onSelectPlan("PLUS") : onUseWebApp}
          />
          <ProCard
            plan={pro}
            currency={currency}
            lang={language}
            onCta={onSelectPlan ? () => onSelectPlan("PRO") : onUseWebApp}
          />
          <BusinessCard
            plan={business}
            currency={currency}
            lang={language}
            onCta={onSelectPlan ? () => onSelectPlan("BUSINESS") : onUseWebApp}
          />
        </div>

        {/* Trust line */}
        <p className="text-center text-gray-600 text-sm mt-10">
          {tr
            ? "SSL şifreli · GDPR uyumlu · İstediğiniz zaman iptal · 7 gün para iade garantisi"
            : "SSL encryption · GDPR compliant · Cancel anytime · 7-day money-back guarantee"}
          <span className="block mt-2 font-semibold">
            🔒 {tr ? "iyzico ile güvenli ödeme" : "Secure payments via iyzico"}
          </span>
        </p>

        {/* Refund detail block */}
        <div className="mt-10 max-w-2xl mx-auto rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 text-center">
          <p className="text-emerald-300 font-bold text-base mb-2">
            {copy.refundBadge}
          </p>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">
            {copy.refundBody}
          </p>
          <p className="text-gray-500 text-xs leading-relaxed">
            {copy.refundAfterBody}
          </p>
        </div>

        {/* Inline FAQ */}
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              q: copy.faqRefundQ,
              a: copy.faqRefundA,
            },
            {
              q: copy.faqCancelAfterQ,
              a: copy.faqCancelAfterA,
            },
            {
              q: tr
                ? "Ücretsiz planda kredi kartı gerekli mi?"
                : "Do I need a credit card for the free plan?",
              a: tr
                ? "Hayır. Ücretsiz plan için kart bilgisi gerekmez."
                : "No. No credit card required for the free plan.",
            },
            {
              q: tr
                ? "İstediğim zaman iptal edebilir miyim?"
                : "Can I cancel anytime?",
              a: tr
                ? "Evet. Dilediğiniz zaman iptal edebilirsiniz, ücret alınmaz."
                : "Yes. Cancel anytime with no fees.",
            },
            {
              q: tr
                ? "Pro planı neden yalnızca yıllık?"
                : "Why is Pro yearly-only?",
              a: tr
                ? "Pro, düzenli kullanıcılara en iyi fiyat-değer dengesini sunar. Yıllık taahhüt sayesinde aylık eşdeğere göre önemli tasarruf sağlarsınız."
                : "Pro offers the best value for committed users. The yearly plan provides significant savings vs monthly equivalent.",
            },
          ].map(({ q, a }) => (
            <div
              key={q}
              className="bg-white/[0.03] rounded-xl border border-white/8 p-5"
            >
              <p className="text-white font-semibold text-sm mb-2">{q}</p>
              <p className="text-gray-400 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
