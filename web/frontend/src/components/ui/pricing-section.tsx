import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NumberFlow from "@number-flow/react";
import type { Language } from "../../i18n/landing";
import { pricingSectionCopy } from "../../i18n/pricingSection";
import { PLANS } from "../../lib/planConfig";
import type { Currency, BillingCycle, PlanDefinition } from "../../lib/planConfig";
import { useCheckoutCurrency } from "../../contexts/CheckoutCurrencyContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function faceValue(raw: number): number {
  return raw / 100;
}

function monthlyEquivPrice(plan: PlanDefinition, currency: Currency, cycle: BillingCycle): number {
  if (cycle === "YEARLY") return faceValue(plan.pricing.yearly[currency]) / 12;
  return faceValue(plan.pricing.monthly[currency]);
}

function fmt(value: number, currency: Currency): string {
  if (currency === "USD") return `$${value.toFixed(2)}`;
  return `₺${Math.round(value).toLocaleString("tr-TR")}`;
}

function yearlySavingsPct(plan: PlanDefinition, currency: Currency): number {
  const monthly = faceValue(plan.pricing.monthly[currency]);
  const yearlyMonthlyEq = faceValue(plan.pricing.yearly[currency]) / 12;
  if (monthly === 0) return 0;
  return Math.round((1 - yearlyMonthlyEq / monthly) * 100);
}

// ─── Per-card Billing Toggle ──────────────────────────────────────────────────

function CardBillingToggle({
  cycle,
  onChange,
  lang,
  savePct,
  cardId,
}: {
  cycle: BillingCycle;
  onChange: (c: BillingCycle) => void;
  lang: Language;
  savePct: number;
  cardId: string;
}) {
  const tr = lang === "tr";
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs shadow-inner mb-4">
      {(["MONTHLY", "YEARLY"] as BillingCycle[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`relative flex-1 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
            cycle === c ? "text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          {cycle === c && (
            <motion.span
              layoutId={`billing-pill-${cardId}`}
              className="absolute inset-0 rounded-lg bg-white/15"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center justify-center gap-1.5">
            {c === "MONTHLY" ? (tr ? "Aylık" : "Monthly") : (tr ? "Yıllık" : "Yearly")}
            {c === "YEARLY" && savePct > 0 && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                -{savePct}%
              </span>
            )}
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
        <span className={`text-[9px] font-bold ${highlight ? "text-blue-300" : "text-gray-500"}`}>
          ✓
        </span>
      </div>
      <span className={highlight ? "text-gray-200" : "text-gray-400"}>{text}</span>
    </li>
  );
}

// ─── Plan Cards ───────────────────────────────────────────────────────────────

function FreeCard({
  plan,
  lang,
  currency,
  displaySymbol,
  onCta,
}: {
  plan: PlanDefinition;
  lang: Language;
  currency: Currency;
  displaySymbol?: string;
  onCta: () => void;
}) {
  const tr = lang === "tr";
  const features = tr ? plan.featuresTr : plan.featuresEn;
  const sym = displaySymbol ?? (currency === "TRY" ? "₺" : "$");
  const freeLabel = `${sym}0`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0 }}
      className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:p-7 flex flex-col h-full hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300"
    >
      <div className="text-2xl mb-3">🆓</div>
      <h3 className="text-xl font-bold text-white mb-1">{tr ? plan.nameTr : plan.nameEn}</h3>
      <p className="text-gray-500 text-sm mb-5">{tr ? "Başla, kart gerekmez." : "Get started, no card required."}</p>
      <div className="mb-6 flex items-baseline gap-1.5">
        <span className="text-4xl lg:text-5xl font-black text-white">{freeLabel}</span>
        <span className="text-gray-500 text-sm">{tr ? "/ ay" : "/ mo"}</span>
      </div>
      <ul className="space-y-2.5 flex-1 mb-7">
        {features.map((f) => <Feature key={f} text={f} highlight={false} />)}
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

function MonthlyOnlyCard({
  plan,
  currency,
  lang,
  delay,
  displaySymbol,
  onCta,
}: {
  plan: PlanDefinition;
  currency: Currency;
  lang: Language;
  delay: number;
  displaySymbol?: string;
  onCta: () => void;
}) {
  const tr = lang === "tr";
  const features = tr ? plan.featuresTr : plan.featuresEn;
  const price = faceValue(plan.pricing.monthly[currency]);
  const sym = displaySymbol ?? (currency === "TRY" ? "₺" : "$");
  const isPlus = plan.id === "PLUS";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
      style={isPlus ? { scale: 1.02 } : undefined}
      className={`relative rounded-2xl p-5 lg:p-7 flex flex-col h-full transition-all duration-300 ${
        isPlus
          ? "border border-blue-500/50 bg-gradient-to-b from-blue-950/60 to-slate-950/60 shadow-2xl shadow-blue-500/15 ring-1 ring-blue-500/20"
          : "border border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      {isPlus && (
        <>
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                animation: "lp-ping-slow 3s ease-in-out infinite",
                background: "radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.3), transparent 70%)",
              }}
            />
          </div>
          <div className="absolute -top-3.5 inset-x-0 flex justify-center">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-blue-500/30">
              ⭐ {tr ? "En Popüler" : "Most Popular"}
            </span>
          </div>
        </>
      )}
      {!isPlus && plan.badge && (
        <div className="absolute -top-3.5 inset-x-0 flex justify-center">
          <span className="bg-gradient-to-r from-green-600 to-teal-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
            {tr ? plan.badge.textTr : plan.badge.textEn}
          </span>
        </div>
      )}

      <div className="text-2xl mb-3 mt-2">{isPlus ? "🚀" : "⚡"}</div>
      <h3 className="text-xl font-bold text-white mb-1">{tr ? plan.nameTr : plan.nameEn}</h3>
      <p className={`text-sm mb-5 ${isPlus ? "text-blue-300/70" : "text-gray-500"}`}>
        {isPlus
          ? (tr ? "Bireyler için akıllı seçim." : "The smart choice for individuals.")
          : (tr ? "PDF işine yeni başlayanlar için." : "Perfect for getting started.")}
      </p>

      <div className="mb-6 flex items-baseline gap-1.5">
        <span className="text-gray-400 text-lg font-semibold">{sym}</span>
        <NumberFlow
          value={price}
          format={{ maximumFractionDigits: currency === "USD" ? 2 : 0 }}
          className="text-4xl lg:text-5xl font-black text-white tabular-nums"
          spinTiming={{ duration: 450, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }}
          transformTiming={{ duration: 450, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
        <span className="text-gray-400 text-sm">{tr ? "/ ay" : "/ mo"}</span>
      </div>

      <ul className="space-y-2.5 flex-1 mb-7">
        {features.map((f) => <Feature key={f} text={f} highlight={isPlus} />)}
      </ul>

      <button
        onClick={onCta}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
          isPlus
            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/30 py-3.5"
            : "border border-white/20 text-white hover:bg-white/8"
        }`}
      >
        {isPlus ? (tr ? "Plus'ı Başlat" : "Start Plus") : (tr ? "Başlangıç'ı Başlat" : "Start Starter")}
      </button>
    </motion.div>
  );
}

/** Pro and Business each manage their own billing cycle toggle internally. */
const EXTRA_SEAT_PRICE_TRY = 19900; // kuruş (₺199/ay)
const EXTRA_SEAT_PRICE_USD = 599;   // kuruş ($5.99/ay)

function CycleAwareCard({
  plan,
  currency,
  lang,
  delay,
  displaySymbol,
  onCta,
}: {
  plan: PlanDefinition;
  currency: Currency;
  lang: Language;
  delay: number;
  displaySymbol?: string;
  onCta: (cycle: BillingCycle, extraSeats: number) => void;
}) {
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [extraSeats, setExtraSeats] = useState(0);
  const tr = lang === "tr";
  const features = tr ? plan.featuresTr : plan.featuresEn;
  const isPro = plan.id === "PRO";
  const sym = displaySymbol ?? (currency === "TRY" ? "₺" : "$");

  const baseMonthlyPrice = monthlyEquivPrice(plan, currency, cycle);
  const extraSeatUnitPrice = faceValue(currency === "TRY" ? EXTRA_SEAT_PRICE_TRY : EXTRA_SEAT_PRICE_USD);
  const extraSeatTotal = !isPro ? extraSeats * extraSeatUnitPrice : 0;
  const displayPrice = baseMonthlyPrice + extraSeatTotal;
  const isYearly = cycle === "YEARLY";
  const baseYearlyTotal = faceValue(plan.pricing.yearly[currency]);
  const yearlyTotal = !isPro ? baseYearlyTotal + extraSeats * extraSeatUnitPrice * 12 : baseYearlyTotal;
  const savePct = yearlySavingsPct(plan, currency);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
      className={`relative rounded-2xl p-5 lg:p-7 flex flex-col h-full transition-all duration-300 ${
        isPro
          ? "border border-amber-500/25 bg-white/[0.03] hover:border-amber-500/40 hover:bg-white/[0.05]"
          : "border border-violet-500/25 bg-white/[0.03] hover:border-violet-500/40 hover:bg-white/[0.05]"
      }`}
    >
      {/* Badge */}
      <div className="absolute -top-3.5 inset-x-0 flex justify-center">
        {isPro ? (
          <span className="relative overflow-hidden bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
            <span
              className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              style={{ animation: "shimmer 2.5s ease-in-out infinite" }}
            />
            <span className="relative">⚡ {tr ? "+%20 Daha Fazla İşlem" : "+20% More Operations"}</span>
          </span>
        ) : (
          <span className="bg-violet-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
            🏢 {tr ? "Kurumsal" : "Enterprise"}
          </span>
        )}
      </div>

      <div className="text-2xl mb-3 mt-2">{isPro ? "💎" : "🏢"}</div>
      <h3 className="text-xl font-bold text-white mb-1">{tr ? plan.nameTr : plan.nameEn}</h3>
      <p className="text-gray-500 text-sm mb-3">
        {isPro
          ? (tr ? "Düzenli kullananlar için en iyi seçim." : "For power users who stay.")
          : (tr ? "Kurumsal ekipler ve organizasyonlar için." : "Built for enterprise teams and organizations.")}
      </p>

      {/* Per-card billing toggle */}
      <CardBillingToggle
        cycle={cycle}
        onChange={setCycle}
        lang={lang}
        savePct={savePct}
        cardId={plan.id}
      />

      {/* Extra seats stepper — Business only */}
      {!isPro && (
        <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-300">
                {tr ? "Ekstra Kişi" : "Extra Seats"}
              </p>
              <p className="text-[10px] text-slate-500">
                {tr
                  ? `5 kişi dahil · +${currency === "TRY" ? "₺199" : "$5.99"}/kişi/ay`
                  : `5 seats included · +${currency === "TRY" ? "₺199" : "$5.99"}/seat/mo`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExtraSeats((n) => Math.max(0, n - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-bold text-white">{extraSeats}</span>
              <button
                type="button"
                onClick={() => setExtraSeats((n) => Math.min(95, n + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
              >
                +
              </button>
            </div>
          </div>
          {extraSeats > 0 && (
            <p className="mt-1.5 text-[10px] text-violet-400">
              {tr
                ? `${5 + extraSeats} kişi · ${fmt(extraSeatTotal, currency)}/ay ekstra`
                : `${5 + extraSeats} seats · ${fmt(extraSeatTotal, currency)}/mo extra`}
            </p>
          )}
        </div>
      )}

      {/* Yearly savings badge */}
      <AnimatePresence>
        {isYearly && savePct > 0 && (
          <motion.div
            key="save-badge"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25 }}
          >
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              {tr ? `%${savePct} Tasarruf` : `Save ${savePct}%`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Price — counter-style animation */}
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-gray-400 text-lg font-semibold">{sym}</span>
        <NumberFlow
          value={displayPrice}
          format={{ maximumFractionDigits: currency === "USD" ? 2 : 0 }}
          className="text-4xl lg:text-5xl font-black text-white tabular-nums"
          spinTiming={{ duration: 500, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }}
          transformTiming={{ duration: 500, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
        <span className="text-gray-400 text-sm">{tr ? "/ ay" : "/ mo"}</span>
      </div>

      {/* Billing note */}
      <div className="mb-5 h-5">
        <AnimatePresence mode="wait">
          {isYearly ? (
            <motion.p
              key="yearly-note"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-gray-500 text-xs"
            >
              {tr
                ? `${fmt(yearlyTotal, currency)} yıllık faturalandırılır`
                : `${fmt(yearlyTotal, currency)} billed annually`}
            </motion.p>
          ) : (
            <motion.p
              key="monthly-note"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-gray-500 text-xs"
            >
              {tr ? "Aylık faturalandırılır" : "Billed monthly"}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <ul className="space-y-2.5 flex-1 mb-7">
        {features.map((f) => <Feature key={f} text={f} highlight={false} />)}
      </ul>

      <p className="text-gray-600 text-xs mb-3 text-center">
        {isPro
          ? (tr ? "Yıllık taahhüt en iyi fiyat-değer dengesini sunar" : "Yearly commitment offers the best value")
          : (tr ? "Kurumsal lisanslama · organizasyonunuzla ölçeklenir" : "Enterprise licensing built to scale with your organization")}
      </p>

      <button
        onClick={() => onCta(cycle, isPro ? 0 : extraSeats)}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
          isPro
            ? "border border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            : "border border-violet-500/40 text-violet-300 hover:bg-violet-500/10"
        }`}
      >
        {isPro
          ? (tr ? "Pro'ya Geç" : "Go Pro")
          : (tr
              ? `Business'ı Başlat${extraSeats > 0 ? ` · ${5 + extraSeats} Kişi` : ""}`
              : `Start Business${extraSeats > 0 ? ` · ${5 + extraSeats} Seats` : ""}`)}
      </button>
    </motion.div>
  );
}

// ─── Premium FAQ ──────────────────────────────────────────────────────────────

function PricingFaq({ language }: { language: Language }) {
  const [open, setOpen] = useState<number | null>(null);
  const tr = language === "tr";

  const items = tr
    ? [
        {
          q: "7 günlük para iade garantisi nasıl çalışır?",
          a: "İlk ödemenizden itibaren 7 gün içinde, herhangi bir neden göstermeksizin tam iade talep edebilirsiniz. İade talebinizi destek ekibimize iletmeniz yeterli — işlem 3–5 iş günü içinde tamamlanır.",
        },
        {
          q: "Aboneliği iptal ettiğimde ne olur?",
          a: "İptal ettiğinizde mevcut fatura döneminiz sonuna kadar tüm özellikler aktif kalır. Dönem bitiminde hesabınız otomatik olarak Ücretsiz plana geçer, verileriniz silinmez.",
        },
        {
          q: "Ücretsiz planda kredi kartı gerekli mi?",
          a: "Hayır. Ücretsiz plan için herhangi bir ödeme bilgisi istenmez. Hesap oluşturarak hemen başlayabilirsiniz.",
        },
        {
          q: "Starter ve Plus planları yıllık seçenek sunuyor mu?",
          a: "Hayır. Starter ve Plus planları yalnızca aylık olarak faturlandırılır; istediğiniz ay iptal edebilirsiniz. Pro ve Business için aylık/yıllık seçeneği mevcuttur.",
        },
        {
          q: "Pro ve Business arasındaki fark nedir?",
          a: "Pro bireysel güç kullanıcıları için optimize edilmiştir. Business ise çok kullanıcılı ekipler, kurumsal onay akışları ve organizasyon genelinde PDF yönetimi için tasarlanmıştır.",
        },
        {
          q: "Yıllık plana geçince hemen mi uygulanır?",
          a: "Evet. Yıllık plana geçiş anında aktif olur ve yıllık toplam ücret tek seferinde tahsil edilir. Kalan aylık ücret orantılı olarak hesaplanır.",
        },
        {
          q: "İşlenen dosyalarım ne kadar süre saklanıyor?",
          a: "Web uygulamasında işlenen dosyalar 1 saat sonra kalıcı olarak silinir. Windows masaüstü uygulamasında dosyalar hiç sunucuya gönderilmez — tüm işlem cihazınızda gerçekleşir.",
        },
      ]
    : [
        {
          q: "How does the 7-day money-back guarantee work?",
          a: "Within 7 days of your first payment, you can request a full refund for any reason. Just contact our support team — refunds are processed within 3–5 business days.",
        },
        {
          q: "What happens when I cancel my subscription?",
          a: "When you cancel, all features remain active until the end of your current billing period. After that, your account automatically reverts to the Free plan — your data is never deleted.",
        },
        {
          q: "Do I need a credit card for the free plan?",
          a: "No. No payment information is required for the Free plan. Simply create an account and start immediately.",
        },
        {
          q: "Do Starter and Plus plans offer a yearly option?",
          a: "No. Starter and Plus are billed monthly only and can be cancelled any month. Pro and Business offer both monthly and yearly billing.",
        },
        {
          q: "What's the difference between Pro and Business?",
          a: "Pro is optimized for individual power users. Business is designed for multi-user teams, enterprise approval workflows, and organization-wide PDF management.",
        },
        {
          q: "Does switching to yearly take effect immediately?",
          a: "Yes. Switching to yearly is instant and the annual total is charged in one payment. Any remaining monthly balance is calculated on a pro-rated basis.",
        },
        {
          q: "How long are my processed files stored?",
          a: "Files processed via the web app are permanently deleted after 1 hour. With the Windows desktop app, files never leave your device — all processing happens locally.",
        },
      ];

  return (
    <div className="mt-14 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <p className="text-gray-400 text-base font-semibold">
          {tr ? "Sık Sorulan Sorular" : "Frequently Asked Questions"}
        </p>
      </div>
      <div className="space-y-3">
        {items.map(({ q, a }, i) => {
          const isOpen = open === i;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              className={`rounded-xl border transition-all duration-300 overflow-hidden ${
                isOpen
                  ? "border-blue-500/40 bg-blue-500/[0.06] shadow-[0_0_20px_rgba(59,130,246,0.08)]"
                  : "border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left group"
                aria-expanded={isOpen}
              >
                <span className={`text-sm font-semibold transition-colors ${isOpen ? "text-white" : "text-gray-300 group-hover:text-white"}`}>
                  {q}
                </span>
                <motion.span
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs transition-colors ${
                    isOpen ? "border-blue-500/50 text-blue-400" : "border-white/15 text-gray-500"
                  }`}
                  aria-hidden="true"
                >
                  +
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const } }}
                    exit={{ height: 0, opacity: 0, transition: { duration: 0.22 } }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-4 text-sm text-gray-400 leading-relaxed">
                      {a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PricingSectionProps {
  language: Language;
  onUseWebApp: () => void;
  onSelectPlan?: (planId: "STARTER" | "PLUS" | "PRO" | "BUSINESS", billingCycle: BillingCycle, extraSeats?: number) => void;
}

export default function PricingSection({ language, onUseWebApp, onSelectPlan }: PricingSectionProps) {
  const tr = language === "tr";
  const copy = pricingSectionCopy(language);
  const { currency: checkoutCurrency } = useCheckoutCurrency();
  // EUR kullanıcıya gösterim için, ödeme USD bandıyla işlenir.
  // "USD" fiyatlar gösterildiğinde simge "$" yerine "€" gösterilir.
  const isEurDisplay = checkoutCurrency === "EUR";
  const currency: Currency = checkoutCurrency === "TRY" ? "TRY" : "USD";
  const currencySymbol = checkoutCurrency === "TRY" ? "₺" : checkoutCurrency === "EUR" ? "€" : "$";

  const [free, starter, plus, pro, business] = PLANS;

  return (
    <section id="pricing" className="relative py-20 md:py-28 overflow-hidden">
      {/* Glow background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.07)_0%,transparent_70%)]" />

      <style>{`
        @keyframes shimmer {
          0%,100% { transform: translateX(-150%) skewX(-12deg); }
          50% { transform: translateX(250%) skewX(-12deg); }
        }
      `}</style>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            ✦ {tr ? "Fiyatlandırma" : "Pricing"}
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {tr ? "Her Ölçeğe Uygun Plan" : "Plans for Every Scale"}
          </h2>
          <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto mb-6">
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
            className="inline-flex items-center gap-3 px-4 sm:px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 mb-8"
          >
            <span className="text-xl">💰</span>
            <div className="text-left">
              <p className="text-emerald-300 font-bold text-sm">{copy.refundHeading}</p>
              <p className="text-emerald-400/70 text-xs mt-0.5 max-w-xs">{copy.refundBody}</p>
            </div>
          </motion.div>
        </motion.div>

        {/* 5-column grid — responsive */}
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 items-stretch">
          <FreeCard
            plan={free}
            lang={language}
            currency={currency}
            displaySymbol={currencySymbol}
            onCta={onUseWebApp}
          />
          <MonthlyOnlyCard
            plan={starter}
            currency={currency}
            lang={language}
            delay={0.04}
            displaySymbol={currencySymbol}
            onCta={onSelectPlan ? () => onSelectPlan("STARTER", "MONTHLY") : onUseWebApp}
          />
          <MonthlyOnlyCard
            plan={plus}
            currency={currency}
            lang={language}
            delay={0.08}
            displaySymbol={currencySymbol}
            onCta={onSelectPlan ? () => onSelectPlan("PLUS", "MONTHLY") : onUseWebApp}
          />
          <CycleAwareCard
            plan={pro}
            currency={currency}
            lang={language}
            delay={0.12}
            displaySymbol={currencySymbol}
            onCta={onSelectPlan ? (cycle) => onSelectPlan("PRO", cycle, 0) : () => onUseWebApp()}
          />
          <CycleAwareCard
            plan={business}
            currency={currency}
            lang={language}
            delay={0.16}
            displaySymbol={currencySymbol}
            onCta={onSelectPlan ? (cycle, extraSeats) => onSelectPlan("BUSINESS", cycle, extraSeats) : () => onUseWebApp()}
          />
        </div>

        {/* VAT info note */}
        <p className="text-center text-gray-600 text-xs mt-8">
          {tr
            ? "Türkiye'deki kullanıcılar için %20 KDV uygulanmaktadır. Yurt dışı kullanıcılar KDV'den muaftır."
            : "20% VAT applies for users in Turkey. International users are VAT exempt."}
        </p>

        {/* Trust line */}
        <p className="text-center text-gray-600 text-sm mt-4">
          {tr
            ? "SSL şifreli · GDPR uyumlu · İstediğiniz zaman iptal · 7 gün para iade garantisi"
            : "SSL encryption · GDPR compliant · Cancel anytime · 7-day money-back guarantee"}
          <span className="block mt-2 font-semibold">
            🔒 {tr ? "iyzico ile güvenli ödeme" : "Secure payments via iyzico"}
          </span>
          {isEurDisplay && (
            <span className="block mt-1 text-xs text-amber-400/80">
              {tr
                ? "EUR fiyatlar gösterim amaçlıdır; ödeme USD bant fiyatıyla işlenir."
                : "EUR prices are for display. Payment is processed at the equivalent USD rate."}
            </span>
          )}
        </p>

        {/* Refund detail block */}
        <div className="mt-10 max-w-2xl mx-auto rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 sm:p-6 text-center">
          <p className="text-emerald-300 font-bold text-base mb-2">{copy.refundBadge}</p>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">{copy.refundBody}</p>
          <p className="text-gray-500 text-xs leading-relaxed">{copy.refundAfterBody}</p>
        </div>

        {/* Premium FAQ */}
        <PricingFaq language={language} />
      </div>
    </section>
  );
}
