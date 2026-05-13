import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type { Language } from "../../i18n/landing";
import type { PlanId } from "../../lib/planConfig";
import { PLANS, formatPrice } from "../../lib/planConfig";
import { confirmFakeCheckout, resolveFakePaymentRedirect } from "../../api/fakePayment";
import { launchIyzicoCheckout } from "../../lib/iyzicoLaunch";
import { useCheckoutCurrency } from "../../contexts/CheckoutCurrencyContext";
import { getSaasApiBase } from "../../api/saasBase";
import { saasAuthorizedFetch } from "../../api/subscription";
import { AUTH_ACCESS_TOKEN_STORAGE_KEY } from "../../api/auth";
import { LegalDocumentBody } from "../legal/LegalPage";

type IyzicoCheckoutResponse = {
  mode: "iyzico";
  token: string;
  checkoutFormContent: string;
  paymentPageUrl?: string;
  conversationId: string;
};

type FakeCheckoutResponse = {
  mode: "fake";
  sessionId: string;
  amount: number;
  credits: number;
  redirectUrl: string;
};

type PlanCheckoutResponse = IyzicoCheckoutResponse | FakeCheckoutResponse;

function readToken(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY) ?? fallback;
}

async function initializePlanPayment(
  accessToken: string,
  planId: PlanId,
  currency: string,
): Promise<PlanCheckoutResponse> {
  const token = readToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/payments/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ planId, currency }),
    }),
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Payment init failed (${response.status}).`);
  }
  return response.json() as Promise<PlanCheckoutResponse>;
}

async function validateCouponCode(
  accessToken: string,
  code: string,
): Promise<{ valid: boolean; discountPercent?: number; message?: string }> {
  const token = readToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/credit-checkout/validate-coupon`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      credentials: "include",
      body: JSON.stringify({ code }),
    }),
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Validation failed.");
  }
  return response.json() as Promise<{ valid: boolean; discountPercent?: number; message?: string }>;
}

type Props = {
  open: boolean;
  planId: PlanId;
  accessToken: string;
  language: Language;
  onClose: () => void;
  onPurchaseSuccess: () => void;
  onBeforeExternalCheckout?: () => void;
};

export function PaymentSummaryModal({
  open,
  planId,
  accessToken,
  language,
  onClose,
  onPurchaseSuccess,
  onBeforeExternalCheckout,
}: Props) {
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoApplied, setPromoApplied] = useState<{ discountPercent: number } | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [paying, setPaying] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalOverlay, setLegalOverlay] = useState<null | "terms" | "kvkk">(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tr = language === "tr";
  const { currency: checkoutCurrency } = useCheckoutCurrency();

  const plan = PLANS.find((p) => p.id === planId);
  const planName = plan ? (tr ? plan.nameTr : plan.nameEn) : planId;
  const planPrice = plan ? formatPrice(plan, checkoutCurrency === "TRY" ? "TRY" : "USD", "MONTHLY") : "";

  useEffect(() => {
    if (!open) {
      setPromoInput("");
      setPromoError(null);
      setPromoApplied(null);
      setApplyingPromo(false);
      setPaying(false);
      setLegalAccepted(false);
      setLegalOverlay(null);
      setSuccessMessage(null);
      if (successCloseTimer.current) {
        clearTimeout(successCloseTimer.current);
        successCloseTimer.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(
    () => () => {
      if (successCloseTimer.current) {
        clearTimeout(successCloseTimer.current);
        successCloseTimer.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleApplyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code) return;
    setApplyingPromo(true);
    setPromoError(null);
    try {
      const result = await validateCouponCode(accessToken, code);
      if (result.valid && result.discountPercent) {
        setPromoApplied({ discountPercent: result.discountPercent });
        setPromoError(null);
      } else {
        setPromoApplied(null);
        setPromoError(tr ? "Promosyon kodu geçersiz." : "Invalid promo code.");
      }
    } catch {
      setPromoApplied(null);
      setPromoError(tr ? "Promosyon kodu geçersiz." : "Invalid promo code.");
    } finally {
      setApplyingPromo(false);
    }
  }, [accessToken, promoInput, tr]);

  const handlePay = useCallback(async () => {
    if (!legalAccepted) {
      setPromoError(tr ? "Devam etmek için onay kutusunu işaretleyin." : "Please accept the terms to continue.");
      return;
    }
    setPaying(true);
    setPromoError(null);
    try {
      const session = await initializePlanPayment(accessToken, planId, checkoutCurrency);
      if (session.mode === "fake") {
        onBeforeExternalCheckout?.();
        const result = await confirmFakeCheckout(accessToken, session.sessionId);
        if (result.ok) {
          setSuccessMessage(
            tr ? "Ödeme başarılı! Planınız güncellendi." : "Payment successful! Your plan has been updated.",
          );
          successCloseTimer.current = setTimeout(() => {
            successCloseTimer.current = null;
            onPurchaseSuccess();
          }, 2200);
        }
        setPaying(false);
        return;
      }
      onBeforeExternalCheckout?.();
      launchIyzicoCheckout({
        checkoutFormContent: session.checkoutFormContent,
        paymentPageUrl: session.paymentPageUrl,
      });
      setPaying(false);
    } catch (e) {
      setPaying(false);
      const msg = e instanceof Error ? e.message : "";
      setPromoError(
        msg || (tr ? "Ödeme başlatılamadı. Daha sonra tekrar deneyin." : "Payment could not start. Please try again later."),
      );
    }
  }, [legalAccepted, tr, accessToken, planId, checkoutCurrency, onBeforeExternalCheckout, onPurchaseSuccess]);

  const handleBackdropMouseDown = useCallback(
    (event: MouseEvent) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open || !plan) return null;

  const isViteDev = import.meta.env.DEV;

  const planAccent: Record<string, { ring: string; glow: string; badge: string; dot: string }> = {
    STARTER: { ring: "ring-emerald-500/25 border-emerald-500/20", glow: "shadow-[0_0_60px_-20px_rgba(16,185,129,0.3)]", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25", dot: "bg-emerald-400" },
    PLUS:    { ring: "ring-blue-500/25 border-blue-500/20",    glow: "shadow-[0_0_60px_-20px_rgba(59,130,246,0.35)]",  badge: "bg-blue-500/15 text-blue-300 border-blue-500/25",    dot: "bg-blue-400" },
    PRO:     { ring: "ring-amber-500/25 border-amber-500/20",  glow: "shadow-[0_0_60px_-20px_rgba(245,158,11,0.3)]",   badge: "bg-amber-500/15 text-amber-300 border-amber-500/25",  dot: "bg-amber-400" },
    BUSINESS:{ ring: "ring-violet-500/25 border-violet-500/20",glow: "shadow-[0_0_60px_-20px_rgba(139,92,246,0.35)]",  badge: "bg-violet-500/15 text-violet-300 border-violet-500/25",dot: "bg-violet-400" },
  };
  const accent = planAccent[planId] ?? planAccent["PLUS"];
  const features = (tr ? plan.featuresTr : plan.featuresEn).slice(0, 5);

  return (
    <>
      <div className="payment-summary-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
        <div
          className={`payment-summary-modal payment-summary-modal--wide mx-auto flex h-[min(92dvh,760px)] max-h-[92dvh] w-full max-w-[min(520px,calc(100vw-20px))] flex-col overflow-hidden rounded-3xl border bg-gradient-to-b from-[#0d1120] to-[#060910] pb-0 text-center ring-1 ${accent.ring} ${accent.glow} shadow-[0_48px_120px_-40px_rgba(0,0,0,0.85)]`}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Plan header */}
          <div className="relative shrink-0 px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
            <button
              type="button"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-lg text-slate-400 transition hover:bg-white/[0.1] hover:text-slate-200"
              aria-label={tr ? "Kapat" : "Close"}
              onClick={onClose}
            >
              ×
            </button>
            {plan.badge && (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${accent.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                {tr ? plan.badge.textTr : plan.badge.textEn}
              </span>
            )}
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {planName}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {tr ? "Aylık abonelik — istediğiniz zaman iptal" : "Monthly subscription — cancel anytime"}
            </p>
            {/* Feature list */}
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-[12px] text-slate-300">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent.dot}`} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Divider */}
          <div className="mx-6 shrink-0 border-t border-white/[0.07] sm:mx-8" />

          {/* Scrollable body */}
          <div className="payment-summary-modal__scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-6 pb-4 pt-5 [-webkit-overflow-scrolling:touch] sm:px-8">
            {successMessage ? (
              <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-6 text-center" role="status">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-2xl">✓</div>
                <p className="text-lg font-bold text-emerald-200">{successMessage}</p>
                <p className="mt-1.5 text-xs text-emerald-200/70">{tr ? "Pencere kapanıyor…" : "Closing…"}</p>
              </div>
            ) : (
              <>
                {/* Price block */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {tr ? "Ödenecek tutar" : "Total due today"}
                  </p>
                  <p className="mt-2 text-[3rem] font-black tabular-nums leading-none tracking-tighter text-white sm:text-[3.4rem]">
                    {promoApplied
                      ? <span className="line-through text-slate-500 text-[2rem] mr-2">{planPrice}</span>
                      : null}
                    {promoApplied
                      ? <span>{planPrice} <span className="text-emerald-400 text-xl">−{promoApplied.discountPercent}%</span></span>
                      : planPrice}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500">
                    / {tr ? "ay · Otomatik yenilenir" : "mo · Auto-renews monthly"}
                  </p>
                </div>

                {/* Promo code */}
                <div className="mt-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    {tr ? "Promosyon kodu" : "Promo code"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm font-semibold tracking-wider text-white placeholder-slate-600 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/15"
                      value={promoInput}
                      onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoApplied(null); }}
                      placeholder="CODE"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.1] disabled:opacity-40"
                      disabled={applyingPromo || !promoInput.trim()}
                      onClick={() => void handleApplyPromo()}
                    >
                      {applyingPromo ? "…" : tr ? "Uygula" : "Apply"}
                    </button>
                  </div>
                  {promoApplied ? (
                    <p className="mt-1.5 text-[12px] text-emerald-400">
                      ✓ {tr ? `%${promoApplied.discountPercent} indirim uygulandı` : `${promoApplied.discountPercent}% discount applied`}
                    </p>
                  ) : null}
                  {promoError ? (
                    <p className="mt-1.5 text-[12px] text-red-400">{promoError}</p>
                  ) : null}
                </div>

                {/* Trust row */}
                <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-slate-600">
                  <span>🔒 {tr ? "SSL Güvenli" : "SSL Secured"}</span>
                  <span>·</span>
                  <span>iyzico</span>
                  <span>·</span>
                  <span>Visa / Mastercard</span>
                </div>
              </>
            )}
          </div>

          {/* Footer CTA */}
          {!successMessage ? (
            <div className="shrink-0 border-t border-white/[0.07] bg-gradient-to-t from-[#060910]/95 to-[#0d1120]/90 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-8">
              <label className="mx-auto flex max-w-lg cursor-pointer gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left text-[12px] leading-relaxed text-slate-400">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-nb-bg-soft accent-nb-primary"
                  checked={legalAccepted}
                  onChange={(e) => setLegalAccepted(e.target.checked)}
                  disabled={paying}
                />
                <span>
                  {tr ? (
                    <>
                      <button type="button" className="text-nb-accent underline underline-offset-2" onClick={() => setLegalOverlay("terms")}>
                        Kullanım Koşullarını
                      </button>{" "}
                      ve{" "}
                      <button type="button" className="text-nb-accent underline underline-offset-2" onClick={() => setLegalOverlay("kvkk")}>
                        KVKK metnini
                      </button>{" "}
                      okudum, kabul ediyorum.
                    </>
                  ) : (
                    <>
                      I have read and accept the{" "}
                      <button type="button" className="text-nb-accent underline underline-offset-2" onClick={() => setLegalOverlay("terms")}>
                        Terms of Use
                      </button>{" "}
                      and{" "}
                      <button type="button" className="text-nb-accent underline underline-offset-2" onClick={() => setLegalOverlay("kvkk")}>
                        KVKK disclosure
                      </button>.
                    </>
                  )}
                </span>
              </label>

              <button
                type="button"
                className="mx-auto mt-3 flex w-full max-w-[28rem] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-[1.05rem] text-[16px] font-bold leading-tight tracking-tight text-white shadow-[0_16px_40px_-10px_rgba(79,70,229,0.6),0_2px_0_rgba(255,255,255,0.1)_inset] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060910] disabled:pointer-events-none disabled:opacity-40 sm:py-[1.15rem]"
                disabled={paying || !legalAccepted}
                onClick={() => void handlePay()}
              >
                {paying ? (
                  <>{tr ? "İşleniyor…" : "Processing…"}</>
                ) : (
                  <>{tr ? "🔒 Güvenli ödemeye geç" : "🔒 Continue to secure payment"}</>
                )}
              </button>
              {isViteDev ? (
                <p className="mt-2 text-center text-[10px] text-nb-muted">
                  {tr ? "Dev: iyzico kapalıyken sahte ödeme" : "Dev build: fake payment when PSP off"}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {legalOverlay ? (
        <div
          className="payment-summary-legal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLegalOverlay(null);
          }}
        >
          <div className="payment-summary-legal-panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
              <h2 className="text-sm font-semibold text-nb-text">
                {legalOverlay === "terms"
                  ? tr ? "Kullanım koşulları" : "Terms of use"
                  : tr ? "KVKK" : "KVKK disclosure"}
              </h2>
              <button
                type="button"
                className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-semibold text-nb-muted hover:bg-white/[0.1]"
                onClick={() => setLegalOverlay(null)}
              >
                {tr ? "Kapat" : "Close"}
              </button>
            </div>
            <div className="max-h-[min(72vh,640px)] overflow-y-auto pr-1 text-left">
              <LegalDocumentBody language={language} documentKey={legalOverlay} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
