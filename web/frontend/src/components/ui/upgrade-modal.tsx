import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import type { AuthUser, UpdateProfileInput } from "../../api/auth";
import { LandingPricingSection } from "../landing/LandingPricingSection";
import { ProfileCompletionModal } from "../pricing/ProfileCompletionModal";
import { initializeTierPayment } from "../../api/payments";
import { launchIyzicoCheckout } from "../../lib/iyzicoLaunch";
import { resolveFakePaymentRedirect } from "../../api/fakePayment";
import { useCheckoutCurrency } from "../../contexts/CheckoutCurrencyContext";
import { isBillingProfileComplete } from "../../lib/billingProfile";
import { PRICING_TIER_CARDS, type PricingTierId } from "../../lib/pricingTiers";
import type { CreditPackProduct } from "../../lib/creditPacks";

const PACK_TO_TIER: Record<CreditPackProduct, PricingTierId> = {
  TIER_STARTER: "starter",
  TIER_PROFESSIONAL: "professional",
  UNLIMITED_PRO: "unlimited_pro",
};

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  language?: Language;
  currentPlan?: string;
  accessToken?: string;
  user?: AuthUser | null;
  updateProfile?: (input: UpdateProfileInput) => Promise<AuthUser | null>;
  showToast?: (type: "success" | "error" | "loading" | "info", title: string, detail: string) => void;
  onOpenTerms?: () => void;
  onOpenKvkk?: () => void;
  onBeforeExternalCheckout?: () => void;
}

export function UpgradeModal({
  open,
  onClose,
  language = "tr",
  accessToken,
  user,
  updateProfile,
  showToast,
  onOpenTerms,
  onOpenKvkk,
  onBeforeExternalCheckout,
}: UpgradeModalProps) {
  const [billingTierPending, setBillingTierPending] = useState<PricingTierId | null>(null);
  const { currency: checkoutCurrency } = useCheckoutCurrency();
  const tr = language === "tr";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const productHint = useMemo(() => {
    if (!billingTierPending) return undefined;
    const card = PRICING_TIER_CARDS.find((c) => c.id === billingTierPending);
    if (!card) return undefined;
    return tr
      ? `${card.nameTr} — ${card.periodLabelTr}`
      : `${card.nameEn} — ${card.periodLabelEn}`;
  }, [billingTierPending, tr]);

  const runCheckoutInternal = useCallback(
    async (tier: PricingTierId) => {
      if (!accessToken || !showToast) return;
      try {
        const session = await initializeTierPayment(accessToken, tier, checkoutCurrency);
        if (session.mode === "fake") {
          onBeforeExternalCheckout?.();
          window.location.assign(resolveFakePaymentRedirect(session.redirectUrl));
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
          tr ? "Ödeme başlatılamadı" : "Payment could not start",
          msg || (tr ? "Lütfen tekrar deneyin." : "Please try again."),
        );
      }
    },
    [accessToken, checkoutCurrency, tr, showToast, onBeforeExternalCheckout],
  );

  const handleBuyPack = useCallback(
    async (product: CreditPackProduct) => {
      if (!accessToken || !user) return;
      const tier = PACK_TO_TIER[product];
      if (!isBillingProfileComplete(user)) {
        setBillingTierPending(tier);
        return;
      }
      await runCheckoutInternal(tier);
    },
    [accessToken, user, runCheckoutInternal],
  );

  const handleAfterBillingSave = useCallback(
    async (tier: PricingTierId) => {
      await runCheckoutInternal(tier);
    },
    [runCheckoutInternal],
  );

  const noop = () => {};

  const kicker = tr ? "Kredi Paketleri" : "Credit Packs";
  const title = tr ? "Plan seçin" : "Choose a plan";
  const description = tr
    ? "Bronz ve Altın tek seferlik kredi paketleri; Limitsiz Pro aylık abonelik. Ödeme iyzico güvenli ödeme sayfasında tamamlanır."
    : "Bronze and Gold are one-time credit packs; Unlimited Pro is a monthly subscription. Payment completes on the iyzico hosted checkout.";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/75 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          aria-label={tr ? "Kapat" : "Close"}
          className="absolute right-6 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.1] bg-nb-panel/80 text-nb-muted transition hover:border-white/20 hover:text-nb-text"
        >
          <X className="h-4 w-4" />
        </button>

        {accessToken && user && updateProfile && showToast ? (
          <>
            <LandingPricingSection
              language={language}
              kicker={kicker}
              title={title}
              description={description}
              onUseWebApp={onClose}
              onBuyPack={(product) => void handleBuyPack(product)}
            />
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
                onOpenTerms={onOpenTerms ?? noop}
                onOpenKvkk={onOpenKvkk ?? noop}
              />
            ) : null}
          </>
        ) : (
          <div className="flex min-h-[300px] items-center justify-center">
            <p className="text-sm text-nb-muted">
              {tr ? "Giriş yapmanız gerekiyor." : "Please sign in to view plans."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
