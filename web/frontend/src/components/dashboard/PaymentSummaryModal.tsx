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

  return (
    <>
      <div className="payment-summary-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
        <div
          className="payment-summary-modal payment-summary-modal--wide mx-auto flex h-[min(90dvh,700px)] max-h-[90dvh] w-full max-w-[min(600px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/98 to-[#070b14] px-5 pb-0 pt-8 text-center shadow-[0_40px_100px_-40px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.07] sm:px-8 sm:pt-10"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="relative shrink-0 pb-2">
            <h2 className="payment-summary-modal__title pr-12 text-center text-[1.375rem] font-semibold tracking-tight">
              {tr ? "Ödeme özeti" : "Checkout"}
            </h2>
            <button
              type="button"
              className="payment-summary-modal__close absolute right-0 top-0"
              aria-label={tr ? "Kapat" : "Close"}
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <div className="payment-summary-modal__scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-0 pb-3 [-webkit-overflow-scrolling:touch]">
            <div className="mx-auto max-w-md text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{tr ? "Plan" : "Plan"}</p>
              <p className="mt-1 text-[15px] font-semibold text-slate-100">{planName}</p>
              <p className="mt-2 text-[13px] text-slate-400">{planPrice} / {tr ? "ay" : "month"}</p>
            </div>

            {successMessage ? (
              <div className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-5 text-center" role="status">
                <p className="text-lg font-semibold text-emerald-200">{successMessage}</p>
                <p className="mt-2 text-xs text-emerald-200/80">{tr ? "Pencere kapanıyor…" : "Closing…"}</p>
              </div>
            ) : (
              <>
                <div className="mx-auto mt-8 max-w-sm text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{tr ? "Ödenecek" : "Total due"}</p>
                  <p className="mt-2 text-[2.5rem] font-black tabular-nums leading-none tracking-tighter text-white sm:text-[2.85rem]">
                    {promoApplied
                      ? `${planPrice} (-%${promoApplied.discountPercent})`
                      : planPrice}
                  </p>
                </div>

                <label className="payment-summary-modal__promo-label mt-6">{tr ? "Promosyon kodunuz var mı?" : "Have a promo code?"}</label>
                <div className="payment-summary-modal__promo-row">
                  <input
                    type="text"
                    className="payment-summary-modal__input"
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoApplied(null); }}
                    placeholder="CODE"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="payment-summary-modal__apply"
                    disabled={applyingPromo || !promoInput.trim()}
                    onClick={() => void handleApplyPromo()}
                  >
                    {applyingPromo ? "…" : tr ? "Uygula" : "Apply"}
                  </button>
                </div>
                {promoApplied ? (
                  <p className="mt-1 text-center text-[12px] text-emerald-400">
                    {tr ? `%${promoApplied.discountPercent} indirim uygulandı` : `${promoApplied.discountPercent}% discount applied`}
                  </p>
                ) : null}
                {promoError ? <p className="payment-summary-modal__err">{promoError}</p> : null}

                <p className="mx-auto mt-3 max-w-[20rem] pb-1 text-center text-[12px] text-slate-500">
                  iyzico · Visa · Mastercard
                </p>
              </>
            )}
          </div>

          {!successMessage ? (
            <div className="shrink-0 border-t border-white/[0.09] bg-gradient-to-t from-[#070b14] via-[#070b14]/98 to-slate-900/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.45)] sm:px-8">
              <label className="mx-auto flex max-w-lg cursor-pointer gap-3 rounded-2xl border border-white/[0.07] bg-slate-900/35 p-4 text-left text-sm leading-snug text-slate-400">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-nb-bg-soft accent-nb-primary"
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
                      okudum.
                    </>
                  ) : (
                    <>
                      I have read the{" "}
                      <button type="button" className="text-nb-accent underline underline-offset-2" onClick={() => setLegalOverlay("terms")}>
                        Terms of Use
                      </button>{" "}
                      and the{" "}
                      <button type="button" className="text-nb-accent underline underline-offset-2" onClick={() => setLegalOverlay("kvkk")}>
                        KVKK disclosure
                      </button>
                      .
                    </>
                  )}
                </span>
              </label>

              <button
                type="button"
                className="payment-summary-modal__pay-stripe mx-auto mt-4 flex w-full max-w-[28rem] items-center justify-center rounded-xl bg-[#635bff] px-6 py-[1.1rem] text-[17px] font-semibold leading-tight tracking-tight text-white shadow-[0_18px_45px_-12px_rgba(99,91,255,0.65),0_2px_0_rgba(255,255,255,0.12)_inset] ring-1 ring-white/10 transition hover:bg-[#5a52e5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635bff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b14] disabled:pointer-events-none disabled:opacity-40 sm:py-[1.2rem]"
                disabled={paying || !legalAccepted}
                onClick={() => void handlePay()}
              >
                {paying ? (tr ? "İşleniyor…" : "Processing…") : tr ? "Güvenli ödemeye geç" : "Continue to secure payment"}
              </button>
              {isViteDev ? (
                <p className="mt-2 text-center text-[11px] text-nb-muted">
                  {tr
                    ? "Geliştirme: iyzico kapalıyken sahte ödeme kullanılır."
                    : "Dev build: fake payment used when PSP is off."}
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
