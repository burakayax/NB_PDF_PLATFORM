import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import type { Language } from "../../i18n/landing";
import type { AuthUser, UpdateProfileInput } from "../../api/auth";
import {
  fetchPaymentsPricing,
  initializeTierPayment,
  type PublicTierPricingRow,
} from "../../api/payments";
import { launchIyzicoCheckout } from "../../lib/iyzicoLaunch";
import { resolveFakePaymentRedirect } from "../../api/fakePayment";
import { PRICING_TIER_CARDS, type PricingTierId } from "../../lib/pricingTiers";
import {
  formatCheckoutMoney,
  type CheckoutCurrency,
} from "../../lib/pricingMatrix";
import { useCheckoutCurrency } from "../../contexts/CheckoutCurrencyContext";
import { isBillingProfileComplete } from "../../lib/billingProfile";
import { ProfileCompletionModal } from "./ProfileCompletionModal";

type PricingPageProps = {
  language: Language;
  accessToken: string;
  user: AuthUser;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthUser | null>;
  onBack: () => void;
  showToast: (
    type: "success" | "error" | "loading" | "info",
    title: string,
    detail: string,
  ) => void;
  onOpenTerms: () => void;
  onOpenKvkk: () => void;
  /** PSP / fake redirect öncesi — araç çıktısı localStorage’a yazılır (`NB_RESUME_PROCESS`). */
  onBeforeExternalCheckout?: () => void;
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
  onBeforeExternalCheckout,
}: PricingPageProps) {
  const [busyTier, setBusyTier] = useState<PricingTierId | null>(null);
  const [pricingRows, setPricingRows] = useState<PublicTierPricingRow[] | null>(
    null,
  );
  const [pricingLoading, setPricingLoading] = useState(true);
  const [billingTierPending, setBillingTierPending] =
    useState<PricingTierId | null>(null);
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

  const tierById = useMemo(
    () => new Map(pricingRows?.map((t) => [t.id, t]) ?? []),
    [pricingRows],
  );
  const tr = language === "tr";

  const productHint = useMemo(() => {
    if (!billingTierPending) {
      return undefined;
    }
    const card = PRICING_TIER_CARDS.find((c) => c.id === billingTierPending);
    if (!card) {
      return undefined;
    }
    return tr
      ? `${card.nameTr} — ${card.periodLabelTr}`
      : `${card.nameEn} — ${card.periodLabelEn}`;
  }, [billingTierPending, tr]);

  const runCheckoutInternal = useCallback(
    async (tier: PricingTierId) => {
      setBusyTier(tier);
      try {
        const session = await initializeTierPayment(
          accessToken,
          tier,
          checkoutCurrency,
        );
        if (session.mode === "fake") {
          onBeforeExternalCheckout?.();
          window.location.assign(
            resolveFakePaymentRedirect(session.redirectUrl),
          );
          return;
        }
        onBeforeExternalCheckout?.();
        launchIyzicoCheckout({
          checkoutFormContent: session.checkoutFormContent,
          paymentPageUrl: session.paymentPageUrl,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        showToast(
          "error",
          language === "tr" ? "Ödeme başlatılamadı" : "Payment could not start",
          msg ||
            (language === "tr"
              ? "Lütfen tekrar deneyin."
              : "Please try again."),
        );
      } finally {
        setBusyTier(null);
      }
    },
    [accessToken, checkoutCurrency, language, showToast, onBeforeExternalCheckout],
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
      <section className="mx-auto w-full max-w-[92rem] rounded-3xl border border-white/[0.06] bg-gradient-to-br from-nb-bg-elevated/90 via-nb-panel/75 to-nb-bg/95 p-6 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.65)] md:p-10 lg:p-12">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              NB PDF PLATFORM
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-nb-text md:text-3xl">
              {tr ? "Planlar ve fiyatlandırma" : "Plans & pricing"}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-nb-muted">
              {tr
                ? "Bronz ve Altın tek seferlik kredi paketleri; Limitsiz Pro aylık abonelik. Fiyatlar konumunuza göre otomatik para biriminde sunulur."
                : "Bronze and Gold are one-time credit packs; Unlimited Pro is a monthly subscription. Prices are shown in your region’s currency."}
            </p>
            {pricingLoading ? (
              <p className="mt-2 text-[11px] font-medium text-cyan-200/75">
                {tr ? "Fiyatlar yükleniyor…" : "Loading prices…"}
              </p>
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

        <div className="mx-auto grid max-w-[88rem] gap-10 md:grid-cols-3 md:gap-8 xl:gap-10">
          {PRICING_TIER_CARDS.map((card) => {
            const canonical = tierById.get(card.id);
            const creditHero = canonical?.credits ?? card.fallbackCredits;
            const amountNum = canonical?.amount ?? card.fallbackPriceTry;
            const cur =
              (canonical?.currency as CheckoutCurrency | undefined) ?? "TRY";
            const subscription = card.id === "unlimited_pro";
            const formatted = formatCheckoutMoney(
              amountNum,
              cur,
              tr ? "tr" : "en",
            );
            const priceFormatted = subscription
              ? `${formatted}${tr ? " / ay" : " / mo"}`
              : formatted;
            const name = tr ? card.nameTr : card.nameEn;
            const period = tr ? card.periodLabelTr : card.periodLabelEn;
            const features = tr ? card.featuresTr : card.featuresEn;
            const loading = busyTier === card.id;
            const isPopular = card.highlight === "popular";
            return (
              <article
                key={card.id}
                style={{ contain: "layout style" }}
                className={`group relative flex min-h-[480px] flex-col overflow-hidden rounded-2xl border-2 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none motion-reduce:transition-none transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out ${
                  isPopular
                    ? "border-indigo-500/35 bg-gradient-to-b from-indigo-950/50 via-slate-950/80 to-black shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_36px_80px_-40px_rgba(99,102,241,0.55)] backdrop-blur-xl hover:z-10 hover:-translate-y-1 hover:shadow-[0_42px_90px_-40px_rgba(129,140,248,0.45)]"
                    : "border-slate-800 bg-slate-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-[0_28px_56px_-36px_rgba(15,23,42,0.75)]"
                }`}
              >
                {isPopular ? (
                  <div
                    className="relative flex shrink-0 items-center justify-center bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-4 py-2.5 text-center shadow-[0_14px_40px_-12px_rgba(99,102,241,0.55)]"
                    aria-hidden
                  >
                    <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white drop-shadow">
                      {tr ? "En çok seçilen" : "Most popular"}
                    </span>
                  </div>
                ) : (
                  <div className="h-[43px] shrink-0" aria-hidden />
                )}
                <div className="flex flex-1 flex-col px-7 pb-9 pt-8 md:px-8">
                  <p
                    className={`text-[11px] font-bold uppercase tracking-[0.28em] ${isPopular ? "text-indigo-200/90" : "text-slate-500"}`}
                  >
                    {name}
                  </p>
                  {subscription ? (
                    <>
                      <p className="mt-8 bg-gradient-to-br from-white to-slate-400 bg-clip-text text-[2.875rem] font-black leading-none tabular-nums text-transparent md:text-[3.125rem]">
                        ∞
                      </p>
                      <p className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-cyan-200/90">
                        {tr ? "Limitsiz kullanım" : "Unlimited use"}
                      </p>
                    </>
                  ) : typeof creditHero === "number" ? (
                    <>
                      <p className="mt-8 bg-gradient-to-br from-white to-slate-400 bg-clip-text text-[2.875rem] font-black leading-none tabular-nums text-transparent md:text-[3.125rem]">
                        {creditHero.toLocaleString(tr ? "tr-TR" : "en-US")}
                      </p>
                      <p className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">
                        {tr ? "Ön ödemeli kredi" : "Prepaid credits"}
                      </p>
                    </>
                  ) : null}
                  <div className="mt-10 border-t border-white/[0.07] pt-10">
                    <p className="text-[13px] font-medium uppercase tracking-wide text-slate-500">
                      {subscription
                        ? tr
                          ? "Aylık abonelik"
                          : "Monthly subscription"
                        : tr
                          ? "Tek seferlik ödeme"
                          : "One-time payment"}
                    </p>
                    <p
                      className={`mt-6 text-[2.375rem] font-black tabular-nums leading-none tracking-tight md:text-[2.625rem] ${
                        isPopular ? "text-white" : "text-slate-50"
                      }`}
                    >
                      {priceFormatted}
                    </p>
                    <p className="mt-4 text-xs font-medium tracking-wide text-slate-500">
                      {period}
                    </p>
                  </div>
                  <ul
                    className="mt-9 flex flex-1 flex-col gap-3.5 text-left"
                    role="list"
                  >
                    {features.map((line) => (
                      <li
                        key={line}
                        className={`flex gap-3 text-[14px] leading-snug md:text-[15px] ${isPopular ? "text-slate-100" : "text-slate-300"}`}
                      >
                        <Check
                          className={`mt-0.5 h-5 w-5 shrink-0 ${isPopular ? "text-indigo-300" : "text-emerald-400"}`}
                          strokeWidth={2.75}
                          aria-hidden
                        />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={loading || busyTier != null}
                    onClick={() => void onRequestTier(card.id)}
                    className={`nb-transition mt-10 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl px-5 py-4 text-[14px] font-bold uppercase tracking-[0.14em] transition disabled:pointer-events-none disabled:opacity-45 ${
                      isPopular
                        ? "border border-white/20 bg-white text-slate-950 shadow-[0_20px_50px_-20px_rgba(255,255,255,0.45)] hover:bg-slate-100"
                        : "border border-slate-600/70 bg-slate-900/85 text-white hover:bg-slate-800"
                    }`}
                  >
                    {loading ? "…" : tr ? "Devam et" : "Continue"}
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
          <ShieldCheck
            className="h-5 w-5 shrink-0 text-emerald-400/90"
            aria-hidden
          />
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
