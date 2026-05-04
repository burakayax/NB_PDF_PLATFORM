import { useEffect } from "react";
import { X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import type { AuthUser, UpdateProfileInput } from "../../api/auth";
import { PricingPage } from "../pricing/PricingPage";

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

  if (!open) return null;

  const noop = () => {};

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/75 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative mx-auto w-full max-w-[96rem] px-4 py-10 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          aria-label={language === "tr" ? "Kapat" : "Close"}
          className="absolute right-6 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.1] bg-nb-panel/80 text-nb-muted transition hover:border-white/20 hover:text-nb-text"
        >
          <X className="h-4 w-4" />
        </button>

        {accessToken && user && updateProfile && showToast ? (
          <PricingPage
            language={language}
            accessToken={accessToken}
            user={user}
            updateProfile={updateProfile}
            onBack={onClose}
            showToast={showToast}
            onOpenTerms={onOpenTerms ?? noop}
            onOpenKvkk={onOpenKvkk ?? noop}
            onBeforeExternalCheckout={onBeforeExternalCheckout}
          />
        ) : (
          <div className="flex min-h-[300px] items-center justify-center">
            <p className="text-sm text-nb-muted">
              {language === "tr" ? "Giriş yapmanız gerekiyor." : "Please sign in to view plans."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
