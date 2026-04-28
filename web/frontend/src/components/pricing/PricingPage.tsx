import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Language } from "../../i18n/landing";
import type { AuthUser, UpdateProfileInput } from "../../api/auth";
import { fetchPaymentsPricing, initializeTierPayment, type PublicTierPricingRow } from "../../api/payments";
import { launchIyzicoCheckout } from "../../lib/iyzicoLaunch";
import { resolveFakePaymentRedirect } from "../../api/fakePayment";
import { PRICING_TIER_CARDS, type PricingTierId } from "../../lib/pricingTiers";
import { formatCheckoutMoney, type CheckoutCurrency } from "../../lib/pricingMatrix";
import { useCheckoutCurrency } from "../../contexts/CheckoutCurrencyContext";
import { isBillingProfileComplete } from "../../lib/billingProfile";
import { ProfileCompletionModal } from "./ProfileCompletionModal";

type PricingPageProps = {
  language: Language;
  accessToken: string;
  user: AuthUser;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthUser | null>;
  onBack: () => void;
  showToast: (type: "success" | "error" | "loading" | "info", title: string, detail: string) => void;
  onOpenTerms: () => void;
  onOpenKvkk: () => void;
};

export function PricingPage({
  language,
  accessToken,
  user,
  updateProfile,
  onBack,
  showToast,
  onOpenTerms,
  onOpenKvkk,
}: PricingPageProps) {
  const [busyTier, setBusyTier] = useState<PricingTierId | null>(null);
  const [pricingRows, setPricingRows] = useState<PublicTierPricingRow[] | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [billingTierPending, setBillingTierPending] = useState<PricingTierId | null>(null);
  const { currency: checkoutCurrency } = useCheckoutCurrency();

  useEffect(() => {
    let cancelled = false;
    setPricingLoading(true);
    fetchPaymentsPricing(checkoutCurrency)
      .then((r) => {
        if (!cancelled) {
          setPricingRows(r.tiers);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPricingRows(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPricingLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [checkoutCurrency]);

  const tierById = useMemo(() => new Map(pricingRows?.map((t) => [t.id, t]) ?? []), [pricingRows]);
  const tr = language === "tr";

  const productHint = useMemo(() => {
    if (!billingTierPending) {
      return undefined;
    }
    const card = PRICING_TIER_CARDS.find((c) => c.id === billingTierPending);
    if (!card) {
      return undefined;
    }
    return tr ? `${card.nameTr} — ${card.periodLabelTr}` : `${card.nameEn} — ${card.periodLabelEn}`;
  }, [billingTierPending, tr]);

  const runCheckoutInternal = useCallback(
    async (tier: PricingTierId) => {
      setBusyTier(tier);
      try {
        const session = await initializeTierPayment(accessToken, tier, checkoutCurrency);
        if (session.mode === "fake") {
          window.location.assign(resolveFakePaymentRedirect(session.redirectUrl));
          return;
        }
        launchIyzicoCheckout({
          checkoutFormContent: session.checkoutFormContent,
          paymentPageUrl: session.paymentPageUrl,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        showToast(
          "error",
          language === "tr" ? "Ödeme başlatılamadı" : "Payment could not start",
          msg || (language === "tr" ? "Lütfen tekrar deneyin." : "Please try again."),
        );
      } finally {
        setBusyTier(null);
      }
    },
    [accessToken, checkoutCurrency, language, showToast],
  );

  const onRequestTier = useCallback(
    async (tier: PricingTierId) => {
      if (!isBillingProfileComplete(user)) {
        setBillingTierPending(tier);
        return;
      }
      await runCheckoutInternal(tier);
    },
    [user, runCheckoutInternal],
  );

  const handleAfterBillingSave = useCallback(
    async (tier: PricingTierId) => {
      await runCheckoutInternal(tier);
    },
    [runCheckoutInternal],
  );

  return (
    <>
      <section className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-nb-bg-elevated/90 via-nb-panel/80 to-nb-bg/95 p-6 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.65)] md:p-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              NB PDF PLARTFORM
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-nb-text md:text-3xl">
              {tr ? "Planlar ve fiyatlandırma" : "Plans & pricing"}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-nb-muted">
              {tr
                ? "Bronz ve Altın tek seferlik kredi paketleri; Limitsiz Pro aylık abonelik. Fiyatlar sunucudan yüklenir."
                : "Bronze and Gold are one-time credit packs; Unlimited Pro is a monthly subscription. Prices load from the server."}
            </p>
            {pricingLoading ? (
              <p className="mt-2 text-[11px] font-medium text-cyan-200/75">{tr ? "Fiyatlar yükleniyor…" : "Loading prices…"}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="nb-transition shrink-0 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-nb-muted hover:border-white/[0.2] hover:text-nb-text"
          >
            {tr ? "← Geri" : "← Back"}
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {PRICING_TIER_CARDS.map((card) => {
            const canonical = tierById.get(card.id);
            const amountNum = canonical?.amount ?? card.fallbackPriceTry;
            const cur = (canonical?.currency as CheckoutCurrency | undefined) ?? "TRY";
            const subscription = card.id === "unlimited_pro";
            const formatted = formatCheckoutMoney(amountNum, cur, tr ? "tr" : "en");
            const priceFormatted = subscription
              ? `${formatted}${tr ? " / ay" : " / mo"}`
              : formatted;
            const name = tr ? card.nameTr : card.nameEn;
            const period = tr ? card.periodLabelTr : card.periodLabelEn;
            const content = tr ? card.contentTr : card.contentEn;
            const loading = busyTier === card.id;
            const isPopular = card.highlight === "popular";
            return (
              <article
                key={card.id}
                className={`flex flex-col rounded-2xl border border-white/[0.1] bg-gradient-to-b ${
                  isPopular
                    ? "from-indigo-500/20 via-nb-panel/70 to-transparent ring-2 ring-indigo-400/30"
                    : "from-white/[0.06] via-nb-panel/60 to-transparent"
                } p-5 shadow-inner`}
              >
                <div className="min-h-[1.25rem]">
                  {isPopular ? (
                    <span className="inline-block rounded-full border border-cyan-400/45 bg-cyan-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-50">
                      {tr ? "En Popüler" : "Most popular"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/85">{name}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-black tabular-nums text-nb-text">{priceFormatted}</span>
                </div>
                <p className="text-xs font-medium text-slate-400">
                  {subscription
                    ? tr
                      ? "Aylık abonelik"
                      : "Monthly subscription"
                    : tr
                      ? "Tek seferlik"
                      : "One-time"}
                </p>
                <p className="mt-1 text-xs text-slate-500">{period}</p>
                <p className="mt-4 flex flex-1 text-left text-base font-semibold leading-snug text-slate-100">{content}</p>
                <div className="mt-6 flex flex-1 flex-col justify-end">
                  <button
                    type="button"
                    disabled={loading || busyTier != null}
                    onClick={() => void onRequestTier(card.id)}
                    className="nb-transition w-full rounded-xl bg-gradient-to-r from-nb-primary to-indigo-600 px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-white shadow-[0_8px_28px_-8px_rgba(59,130,246,0.55)] hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {loading ? "…" : tr ? "Satın al" : "Checkout"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-slate-500">
          {tr
            ? "Ödeme İyzico güvenli ödeme sayfasında tamamlanır. E-posta doğrulanmış hesap gerekir."
            : "Payment completes on the iyzico hosted checkout. A verified email is required."}
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold tracking-tight text-slate-200/95">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400/90" aria-hidden />
          <span>{tr ? "Güvenli ödeme" : "Secure payment"}</span>
        </div>
      </section>

      {billingTierPending !== null ? (
        <ProfileCompletionModal
          open={billingTierPending !== null}
          onClose={() => setBillingTierPending(null)}
          user={user}
          language={language}
          tier={billingTierPending}
          productHint={productHint}
          updateProfile={updateProfile}
          onSavedAndContinue={handleAfterBillingSave}
          onOpenTerms={onOpenTerms}
          onOpenKvkk={onOpenKvkk}
        />
      ) : null}
    </>
  );
}
