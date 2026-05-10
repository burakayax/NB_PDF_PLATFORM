import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import type { AuthUser, UpdateProfileInput } from "../../api/auth";
import type { PlanId } from "../../lib/planConfig";
import { isBillingProfileComplete } from "../../lib/billingProfile";
import { ProfileCompletionModal } from "../pricing/ProfileCompletionModal";
import { PaymentSummaryModal } from "./PaymentSummaryModal";
import PricingSection from "../ui/pricing-section";

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
  updateProfile,
  showToast,
  onOpenTerms,
  onOpenKvkk,
  onBeforeExternalCheckout,
}: PlanUpgradeModalProps) {
  const tr = language === "tr";
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId | null>(null);
  const [billingPlanPending, setBillingPlanPending] = useState<PlanId | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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
    (planId: "STARTER" | "PLUS" | "PRO" | "BUSINESS") => {
      if (!accessToken || !user) return;
      if (!isBillingProfileComplete(user)) {
        setBillingPlanPending(planId);
        return;
      }
      setSelectedPlanId(planId);
      setSummaryOpen(true);
    },
    [accessToken, user],
  );

  const handleAfterBillingSave = useCallback((planId: PlanId) => {
    setSelectedPlanId(planId);
    setSummaryOpen(true);
    return Promise.resolve();
  }, []);

  const noop = () => {};

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

      {billingPlanPending !== null && user && updateProfile ? (
        <ProfileCompletionModal
          open={billingPlanPending !== null}
          onClose={() => setBillingPlanPending(null)}
          user={user}
          language={language}
          tier={billingPlanPending}
          updateProfile={updateProfile}
          onSavedAndContinue={handleAfterBillingSave}
          onOpenTerms={onOpenTerms ?? noop}
          onOpenKvkk={onOpenKvkk ?? noop}
        />
      ) : null}

      {selectedPlanId && accessToken ? (
        <PaymentSummaryModal
          open={summaryOpen}
          planId={selectedPlanId}
          accessToken={accessToken}
          language={language}
          onClose={() => { setSummaryOpen(false); setSelectedPlanId(null); }}
          onPurchaseSuccess={() => {
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
