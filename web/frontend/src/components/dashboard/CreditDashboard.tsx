import type { Language } from "../../i18n/landing";
import { ws } from "../../i18n/workspace";
import type {
  CreditTransaction,
  CreditTransactionType,
  UserBalance,
} from "../../api/entitlement";
import type { FakePaymentProduct } from "../../api/fakePayment";
import { CREDIT_PACKS } from "../../lib/creditPacks";

/**
 * Credit-based account dashboard: balance hero, purchasable packs, ledger.
 */
export type CreditDashboardProps = {
  language: Language;
  balance: UserBalance | null;
  balanceLoading: boolean;
  transactions: CreditTransaction[] | null;
  transactionsLoading: boolean;
  onBuyPack: (product: FakePaymentProduct) => void;
  buyingProduct: FakePaymentProduct | null;
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

function transactionTypeLabel(
  type: CreditTransactionType,
  W: ReturnType<typeof ws>,
): string {
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

export function CreditDashboard({
  language,
  balance,
  balanceLoading,
  transactions,
  transactionsLoading,
  onBuyPack,
  buyingProduct,
}: CreditDashboardProps) {
  const W = ws(language);
  const creditNum = balance?.creditBalance ?? null;
  const showLowCreditWarning = Boolean(
    balance &&
      !balance.hasActiveSubscription &&
      balance.role !== "ADMIN" &&
      typeof creditNum === "number" &&
      creditNum > 0 &&
      creditNum < 5,
  );

  const remainingLine =
    balanceLoading || !balance
      ? "…"
      : W.creditRemainingFormatted((creditNum ?? 0).toLocaleString(localeFor(language)));

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
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-nb-muted">
          {W.creditDashboardBalanceLabel}
        </p>
        <p className="text-4xl font-black tabular-nums leading-none tracking-tight text-nb-text sm:text-5xl">
          {remainingLine}
        </p>
        <p className="text-sm leading-relaxed text-nb-muted">{W.creditDashboardBalanceFootnote}</p>
      </div>

      <section
        className="credit-dashboard__packs rounded-2xl border border-nb-primary/25 bg-gradient-to-br from-nb-primary/10 via-nb-bg-elevated/60 to-transparent p-5"
        aria-labelledby="credit-dashboard-packs-heading"
      >
        <h3 id="credit-dashboard-packs-heading" className="text-lg font-bold text-nb-text">
          {W.creditDashboardPacksHeading}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-nb-muted">{W.creditDashboardPacksBody}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack, i) => {
            const busy = buyingProduct === pack.product;
            return (
              <div
                key={pack.product}
                className={`flex flex-col rounded-xl border bg-nb-panel/50 p-4 ${
                  i === 1 ? "border-cyan-400/40 shadow-[0_0_24px_-8px_rgba(34,211,238,0.35)]" : "border-white/10"
                }`}
              >
                <p className="text-lg font-bold text-nb-text">{W.creditPackLine(pack.credits)}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-nb-accent">₺{pack.priceTry}</p>
                <button
                  type="button"
                  disabled={buyingProduct !== null}
                  onClick={() => onBuyPack(pack.product)}
                  className="nb-transition mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-nb-primary/50 bg-nb-primary/15 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.05em] text-nb-accent hover:bg-nb-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? W.creditDashboardBuyingCredits : W.creditPackBuyCta}
                </button>
              </div>
            );
          })}
        </div>
      </section>

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
              const amountClass = positive
                ? "text-emerald-300"
                : zero
                  ? "text-nb-muted"
                  : "text-rose-300";
              return (
                <li key={row.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-nb-text">{transactionTypeLabel(row.type, W)}</p>
                    <p className="text-xs text-nb-muted">
                      {row.toolId ? `${W.creditTxToolLabel(row.toolId)} · ` : ""}
                      {formatTimestamp(row.createdAt, language)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 tabular-nums text-sm font-bold ${amountClass}`}
                    aria-label={`${formatAmount(row.amount)} credits`}
                  >
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
