import { useCallback, useEffect, useState } from "react";
import { X, Lock, ShieldCheck, Zap, RotateCcw } from "lucide-react";
import type { Language } from "../../i18n/landing";
import type { AuthUser, UpdateProfileInput } from "../../api/auth";
import type { PlanId } from "../../lib/planConfig";
import { BillingInfoModal } from "../pricing/BillingInfoModal";
import { PaymentSummaryModal } from "./PaymentSummaryModal";
import PricingSection from "../ui/pricing-section";
import { trackGAEvent } from "../../lib/analytics";

/**
 * Server-gated araçların insan-okur adları (TR/EN) — modal açıldığında kullanıcının
 * TAM OLARAK hangi aracı kullanmak istediğini soğuk fiyat tablosunun üstünde hatırlatmak
 * için. Böylece yükseltme kararı "planınızı yükseltin" soyutluğu değil, kişinin az önce
 * yapmak istediği somut işe bağlanır → dönüşüm artar. Anahtarlar workspaceFeatures REGISTRY
 * FeatureKey id'leriyle birebir.
 */
const GATED_TOOL_LABELS: Record<string, { tr: string; en: string }> = {
  compress: { tr: "PDF Sıkıştır", en: "Compress PDF" },
  "pdf-to-word": { tr: "PDF'i Word'e Çevir", en: "PDF to Word" },
  "word-to-pdf": { tr: "Word'ü PDF'e Çevir", en: "Word to PDF" },
  "excel-to-pdf": { tr: "Excel'i PDF'e Çevir", en: "Excel to PDF" },
  "pdf-to-excel": { tr: "PDF'i Excel'e Çevir", en: "PDF to Excel" },
  "pdf-to-ppt": { tr: "PDF'i PowerPoint'e Çevir", en: "PDF to PowerPoint" },
  "ppt-to-pdf": { tr: "PowerPoint'i PDF'e Çevir", en: "PowerPoint to PDF" },
  "pdf-to-image": { tr: "PDF'i JPG'ye Çevir", en: "PDF to JPG" },
  "html-to-pdf": { tr: "Web Sayfasını PDF Yap", en: "HTML to PDF" },
  "unlock-pdf": { tr: "PDF Kilidini Aç", en: "Unlock PDF" },
  watermark: { tr: "Filigran Ekle", en: "Add Watermark" },
  "page-numbers": { tr: "Sayfa Numarası Ekle", en: "Add Page Numbers" },
  "repair-pdf": { tr: "PDF Onar", en: "Repair PDF" },
  encrypt: { tr: "PDF Şifrele", en: "Encrypt PDF" },
  "pdf-to-text": { tr: "PDF'i Metne Çevir", en: "PDF to Text" },
  "flatten-pdf": { tr: "PDF Düzleştir", en: "Flatten PDF" },
};

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
  /** Modalı açan araç (payment_required ile duvara toslanan). Bilinirse fiyat tablosunun
   *  üstünde o araca özgü bağlam banner'ı gösterilir. */
  reasonToolId?: string | null;
}

export function PlanUpgradeModal({
  open,
  onClose,
  language = "tr",
  accessToken,
  user,
  showToast,
  onBeforeExternalCheckout,
  reasonToolId,
}: PlanUpgradeModalProps) {
  const tr = language === "tr";
  const reasonLabel = reasonToolId ? GATED_TOOL_LABELS[reasonToolId] : undefined;
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
    // Huni 1. adım: kullanıcı paketleri/fiyatları görüntüledi. Hangi araçtan geldiğini de
    // iliştir → hangi araçların yükseltmeye ittiğini GA'da ölç.
    trackGAEvent("view_pricing", reasonToolId ? { reason_tool: reasonToolId } : undefined);
    return () => { document.body.style.overflow = prev; };
  }, [open, reasonToolId]);

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

          {reasonLabel && (
            <div className="mx-auto mt-16 mb-2 w-full max-w-2xl px-4 sm:mt-20">
              <div className="overflow-hidden rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/[0.14] via-violet-500/[0.08] to-fuchsia-500/[0.12] p-5 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30">
                  <Lock className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-lg font-bold text-white sm:text-xl">
                  {tr
                    ? <>«{reasonLabel.tr}» için bir adım kaldı</>
                    : <>One step away from «{reasonLabel.en}»</>}
                </h3>
                <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-snug text-slate-300">
                  {tr
                    ? "Bu araç ücretli planlarda. Yükselt, kilidi anında açılsın ve kaldığın yerden devam et — dosyan hazır bekliyor."
                    : "This tool is on the paid plans. Upgrade to unlock it instantly and pick up right where you left off — your file is ready."}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-fuchsia-300" />{tr ? "Anında erişim" : "Instant access"}</span>
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />{tr ? "Güvenli ödeme (iyzico)" : "Secure payment (iyzico)"}</span>
                  <span className="inline-flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5 text-sky-300" />{tr ? "İstediğin an iptal" : "Cancel anytime"}</span>
                </div>
              </div>
            </div>
          )}

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
