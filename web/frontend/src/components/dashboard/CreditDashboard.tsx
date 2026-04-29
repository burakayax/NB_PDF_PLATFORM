import { Check } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ws } from "../../i18n/workspace";
import type { CreditTransaction, CreditTransactionType, UserBalance } from "../../api/entitlement";
import type { CreditPackProduct } from "../../lib/creditPacks";
import { CREDIT_PACK_MARKETING_FEATURES, CREDIT_PACKS } from "../../lib/creditPacks";

/** Credit-based account dashboard: balance hero, purchasable packs, ledger. */
export type CreditDashboardProps = {
  language: Language;
  balance: UserBalance | null;
  balanceLoading: boolean;
  transactions: CreditTransaction[] | null;
  transactionsLoading: boolean;
  onBuyPack: (product: CreditPackProduct) => void;
  buyingProduct: CreditPackProduct | null;
  onOpenPlansPage?: () => void;
  limitsizProActive?: boolean;
};

function localeFor(language: Language): string {
  return language === "tr" ? "tr-TR" : "en-US";
}

function formatTimestamp(iso: string, language: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(localeFor(language), {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function transactionTypeLabel(type: CreditTransactionType, W: ReturnType<typeof ws>): string {
  switch (type) {
    case "consume":
      return W.creditTxTypeConsume;
    case "bonus":
      return W.creditTxTypeBonus;
    case "admin_add":
      return W.creditTxTypeAdminAdd;
    case "refund":
      return W.creditTxTypeRefund;
  }
}

function formatAmount(amount: number): string {
  if (amount > 0) {
    return `+${amount}`;
  }
  return String(amount);
}

function packPriceDashboard(priceTry: number, language: Language, subscription: boolean): string {
  const trLocale = language === "tr" ? "tr-TR" : "en-US";
  const base = priceTry.toLocaleString(trLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tl = `${base} TL`;
  return subscription ? (language === "tr" ? `${tl} / ay` : `${tl} / mo`) : tl;
}

export function CreditDashboard({
  language,
  balance,
  balanceLoading,
  transactions,
  transactionsLoading,
  onBuyPack,
  buyingProduct,
  onOpenPlansPage,
  limitsizProActive,
}: CreditDashboardProps) {
  const W = ws(language);
  const hidePurchase = Boolean(limitsizProActive);
  const creditNum = balance?.creditBalance ?? null;
  const showLowCreditWarning = Boolean(
    balance &&
      !balance.hasActiveSubscription &&
      balance.role !== "ADMIN" &&
      typeof creditNum === "number" &&
      creditNum > 0 &&
      creditNum < 5,
  );

  const heroLabel = hidePurchase ? W.creditDashboardSubscriptionLabel : W.creditDashboardBalanceLabel;
  const heroBig =
    balanceLoading || !balance
      ? "…"
      : hidePurchase
        ? W.unlimitedSidebarBadge
        : W.creditRemainingFormatted((creditNum ?? 0).toLocaleString(localeFor(language)));
  const heroFootnote = hidePurchase ? W.unlimitedAccessActive : W.creditDashboardBalanceFootnote;

  return (
    <section className="credit-dashboard flex flex-col gap-6">
      <header className="credit-dashboard__header">
        <p className="section-kicker">{W.creditDashboardKicker}</p>
        <h2 className="credit-dashboard__title">{W.creditDashboardHeading}</h2>
      </header>

      {showLowCreditWarning ? (
        <div
          className="rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-950/55 via-amber-950/35 to-transparent px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          role="status"
        >
          <p className="text-sm font-semibold text-amber-50/95">{W.creditRunningOutBanner}</p>
        </div>
      ) : null}

      <div className="credit-dashboard__hero flex flex-col gap-4 rounded-2xl border border-nb-primary/35 bg-gradient-to-br from-nb-primary/15 via-nb-bg-elevated/70 to-nb-panel/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-nb-muted">{heroLabel}</p>
        <p className="text-4xl font-black tabular-nums leading-none tracking-tight text-nb-text sm:text-5xl">{heroBig}</p>
        <p className="text-sm leading-relaxed text-nb-muted">{heroFootnote}</p>
        {onOpenPlansPage && !hidePurchase ? (
          <button
            type="button"
            onClick={onOpenPlansPage}
            className="nb-transition mt-3 w-full rounded-xl border border-cyan-500/35 bg-cyan-500/10 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-cyan-100 hover:bg-cyan-500/18"
          >
            {language === "tr" ? "Tüm planları gör · iyzico" : "View all plans · iyzico"}
          </button>
        ) : null}
      </div>

      {!hidePurchase ? (
        <section
          className="credit-dashboard__packs mx-auto w-full max-w-7xl rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] via-nb-bg-elevated/50 to-transparent px-5 py-8 backdrop-blur-sm sm:px-8 lg:px-10"
          aria-labelledby="credit-dashboard-packs-heading"
        >
          <div className="mx-auto mb-10 max-w-2xl text-center">
          <h3 id="credit-dashboard-packs-heading" className="text-2xl font-bold tracking-tight text-white md:text-[1.75rem]">
            {W.creditDashboardPacksHeading}
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-400">{W.creditDashboardPacksBody}</p>
          </div>
          <div className="mx-auto mt-10 grid gap-8 sm:gap-10 lg:grid-cols-3">
            {CREDIT_PACKS.map((pack, i) => {
              const busy = buyingProduct === pack.product;
              const tierName = language === "tr" ? pack.nameTr : pack.nameEn;
              const popular = i === 1;
              const features = CREDIT_PACK_MARKETING_FEATURES[pack.product][language === "tr" ? "tr" : "en"];
              return (
                <article
                  key={pack.product}
                  className={`group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 ease-out ${
                    popular
                      ? "border-amber-500/35 bg-gradient-to-b from-slate-900/95 via-slate-950/90 to-black/95 shadow-[0_0_0_1px_rgba(251,191,36,0.12),inset_0_1px_0_rgba(255,255,255,0.06),0_32px_64px_-32px_rgba(245,158,11,0.28)] hover:-translate-y-1 hover:shadow-[0_28px_70px_-28px_rgba(251,146,60,0.4)] lg:scale-[1.02]"
                      : "border-slate-800 bg-slate-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-[0_24px_48px_-28px_rgba(15,23,42,0.65)]"
                  }`}
                >
                  {popular ? (
                    <div
                      className="relative flex shrink-0 items-center justify-center bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-center shadow-[0_12px_32px_-12px_rgba(245,158,11,0.55)]"
                      aria-hidden
                    >
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white drop-shadow-sm">
                        {language === "tr" ? "En iyi seçim" : "Best value"}
                      </span>
                      <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col px-6 pb-8 pt-7 md:px-7">
                  <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-500">{tierName}</p>
                  {pack.subscription ? (
                    <>
                      <p className="mt-6 bg-gradient-to-br from-white to-slate-300 bg-clip-text text-[2.875rem] font-black leading-none tracking-tight tabular-nums text-transparent md:text-[3.25rem]">
                        ∞
                      </p>
                      <p className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-cyan-200/95">
                        {language === "tr" ? "Sınırsız işlem" : "Unlimited"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-6 bg-gradient-to-br from-white to-slate-400 bg-clip-text text-[2.875rem] font-black leading-none tracking-tight tabular-nums text-transparent md:text-[3.25rem]">
                        {(pack.credits ?? 0).toLocaleString(localeFor(language))}
                      </p>
                      <p className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-cyan-200/95">
                        {language === "tr" ? "Kredi" : "credits"}
                      </p>
                    </>
                  )}
                  <div className="mt-8 border-t border-white/[0.07] pt-8">
                    <p className={`text-[1.875rem] font-black tabular-nums leading-none ${popular ? "text-amber-200" : "text-white"}`}>
                      {packPriceDashboard(pack.priceTry, language, pack.subscription)}
                    </p>
                  </div>
                  <ul className="mt-7 space-y-3 text-left" role="list">
                    {features.map((line) => (
                      <li key={line} className="flex gap-3 text-[13px] leading-snug text-slate-300 md:text-[14px]">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${popular ? "text-amber-300" : "text-emerald-400"}`}
                          strokeWidth={2.75}
                          aria-hidden
                        />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={buyingProduct !== null}
                    onClick={() => onBuyPack(pack.product)}
                    className={`nb-transition mt-auto inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl px-4 py-3.5 text-sm font-bold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      popular
                        ? "border border-white/25 bg-white text-slate-900 shadow-[0_16px_40px_-12px_rgba(255,255,255,0.35)] hover:bg-slate-100"
                        : "border border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.14]"
                    }`}
                  >
                    {busy ? W.creditDashboardBuyingCredits : W.creditPackBuyCta}
                  </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section
        className="credit-dashboard__history rounded-2xl border border-white/[0.08] bg-nb-panel/55 p-5"
        aria-labelledby="credit-dashboard-history-heading"
      >
        <h3 id="credit-dashboard-history-heading" className="text-lg font-bold text-nb-text">
          {W.creditDashboardRecentHeading}
        </h3>
        {transactionsLoading && !transactions ? (
          <p className="mt-3 text-sm text-nb-muted">{W.creditDashboardRecentLoading}</p>
        ) : transactions && transactions.length > 0 ? (
          <ol className="credit-dashboard__ledger mt-3 divide-y divide-white/[0.06]">
            {transactions.map((row) => {
              const positive = row.amount > 0;
              const zero = row.amount === 0;
              const amountClass = positive ? "text-emerald-300" : zero ? "text-nb-muted" : "text-rose-300";
              return (
                <li key={row.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-nb-text">{transactionTypeLabel(row.type, W)}</p>
                    <p className="text-xs text-nb-muted">
                      {row.toolId ? `${W.creditTxToolLabel(row.toolId)} · ` : ""}
                      {formatTimestamp(row.createdAt, language)}
                    </p>
                  </div>
                  <span className={`shrink-0 tabular-nums text-sm font-bold ${amountClass}`} aria-label={`${formatAmount(row.amount)} credits`}>
                    {formatAmount(row.amount)}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-nb-muted">{W.creditDashboardRecentEmpty}</p>
        )}
      </section>
    </section>
  );
}
