import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import type { AuthUser, UpdateProfileInput } from "../../api/auth";
import type { PlanId } from "../../lib/planConfig";
import { BillingInfoModal } from "../pricing/BillingInfoModal";
import { PaymentSummaryModal } from "./PaymentSummaryModal";
import PricingSection from "../ui/pricing-section";
import { trackGAEvent } from "../../lib/analytics";

interface PlanUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  language?: Language;
  accessToken?: string;
  user?: AuthUser | null;
  updateProfile?: (input: UpdateProfileInput) => Promise<AuthUser | null>;
  showToast?: (type: "success" | "error" | "loading" | "info", title: string, detail: string) => void;
  onOpenTerms?: () => void;
  onOpenKvkk?: () => void;
  onBeforeExternalCheckout?: () => void;
}

export function PlanUpgradeModal({
  open,
  onClose,
  language = "tr",
  accessToken,
  user,
  showToast,
  onBeforeExternalCheckout,
}: PlanUpgradeModalProps) {
  const tr = language === "tr";
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId | null>(null);
  const [billingInfoOpen, setBillingInfoOpen] = useState(false);
  const [billingInfoPlanId, setBillingInfoPlanId] = useState<PlanId | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [selectedExtraSeats, setSelectedExtraSeats] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Huni 1. adım: kullanıcı paketleri/fiyatları görüntüledi.
    trackGAEvent("view_pricing");
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSelectPlan = useCallback(
    (planId: "STARTER" | "PLUS" | "PRO" | "BUSINESS", billingCycle: "MONTHLY" | "YEARLY" = "MONTHLY", extraSeats = 0) => {
      if (!accessToken || !user) return;
      // Huni 2. adım: kullanıcı bir plan seçti (fatura adımına geçiyor).
      trackGAEvent("select_plan", { plan: planId, billing_cycle: billingCycle });
      setBillingInfoPlanId(planId);
      setSelectedBillingCycle(billingCycle);
      setSelectedExtraSeats(extraSeats);
      setBillingInfoOpen(true);
    },
    [accessToken, user],
  );

  const handleBillingInfoComplete = useCallback(() => {
    setBillingInfoOpen(false);
    if (billingInfoPlanId) {
      // Huni 3. adım: fatura bilgileri tamamlandı, ödeme özeti açılıyor.
      trackGAEvent("add_payment_info", { plan: billingInfoPlanId });
      setSelectedPlanId(billingInfoPlanId);
      setSummaryOpen(true);
    }
  }, [billingInfoPlanId]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] overflow-y-auto bg-black/85 backdrop-blur-sm"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label={tr ? "Kapat" : "Close"}
            className="fixed right-4 top-4 z-[70] flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.1] bg-nb-panel/80 text-nb-muted transition hover:border-white/20 hover:text-nb-text"
          >
            <X className="h-4 w-4" />
          </button>

          <PricingSection
            language={language}
            onUseWebApp={onClose}
            onSelectPlan={accessToken && user ? handleSelectPlan : undefined}
          />
        </div>
      </div>

      {billingInfoOpen && billingInfoPlanId && accessToken ? (
        <BillingInfoModal
          open={billingInfoOpen}
          accessToken={accessToken}
          language={language}
          onClose={() => {
            // Fatura adımında vazgeçti (onComplete'i tetiklemeden kapattı).
            trackGAEvent("checkout_abandoned", { step: "billing_info", plan: billingInfoPlanId });
            setBillingInfoOpen(false);
            setBillingInfoPlanId(null);
          }}
          onComplete={handleBillingInfoComplete}
        />
      ) : null}

      {selectedPlanId && accessToken ? (
        <PaymentSummaryModal
          open={summaryOpen}
          planId={selectedPlanId}
          billingCycle={selectedBillingCycle}
          extraSeats={selectedExtraSeats}
          accessToken={accessToken}
          language={language}
          onClose={() => {
            // Ödeme özeti adımında vazgeçti (ödemeyi tamamlamadan kapattı).
            trackGAEvent("checkout_abandoned", { step: "payment_summary", plan: selectedPlanId });
            setSummaryOpen(false);
            setSelectedPlanId(null);
          }}
          onPurchaseSuccess={() => {
            // Modal-içi (fake) ödeme başarısı. Gerçek iyzico başarısı App.tsx'te izlenir.
            trackGAEvent("purchase", { plan: selectedPlanId, billing_cycle: selectedBillingCycle });
            setSummaryOpen(false);
            setSelectedPlanId(null);
            onClose();
            showToast?.("success", tr ? "Plan güncellendi" : "Plan updated", "");
          }}
          onBeforeExternalCheckout={onBeforeExternalCheckout}
        />
      ) : null}
    </>
  );
}
