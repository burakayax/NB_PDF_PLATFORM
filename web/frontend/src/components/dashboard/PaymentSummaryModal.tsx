import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type { Language } from "../../i18n/landing";
import { postCreditCheckoutPreview, postCreditCheckoutStart, type CreditPreviewResponse } from "../../api/creditCheckout";
import type { CreditPackProduct } from "../../lib/creditPacks";
import { confirmFakeCheckout } from "../../api/fakePayment";
import { CREDIT_PACKS } from "../../lib/creditPacks";

type Props = {
  open: boolean;
  product: CreditPackProduct;
  accessToken: string;
  language: Language;
  onClose: () => void;
  onPurchaseSuccess: () => void;
};

function launchIyzicoCheckout(r: {
  checkoutFormContent: string;
  paymentPageUrl?: string;
}): void {
  if (r.paymentPageUrl) {
    window.location.href = r.paymentPageUrl;
    return;
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = r.checkoutFormContent;
  document.body.appendChild(wrap);
  const form = wrap.querySelector("form");
  if (form instanceof HTMLFormElement) {
    form.submit();
    return;
  }
  const scripts = wrap.querySelectorAll("script");
  scripts.forEach((s) => {
    const clone = document.createElement("script");
    clone.textContent = s.textContent;
    document.body.appendChild(clone);
  });
}

export function PaymentSummaryModal({
  open,
  product,
  accessToken,
  language,
  onClose,
  onPurchaseSuccess,
}: Props) {
  const [preview, setPreview] = useState<CreditPreviewResponse | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [exitOfferShown, setExitOfferShown] = useState(false);
  const [successCredits, setSuccessCredits] = useState<number | null>(null);
  const successCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pack = CREDIT_PACKS.find((p) => p.product === product);

  const loadPreview = useCallback(
    async (opts: { couponCode?: string | null; applyExitIntent?: boolean } = {}) => {
      setLoading(true);
      setPromoError(null);
      setLoadError(null);
      const couponCode = Object.prototype.hasOwnProperty.call(opts, "couponCode")
        ? opts.couponCode
        : (promoInput.trim() || null);
      const applyExitIntent = opts.applyExitIntent === true;
      const isPromoRevalidate = Object.prototype.hasOwnProperty.call(opts, "couponCode");
      try {
        const r = await postCreditCheckoutPreview(accessToken, {
          product,
          couponCode,
          applyExitIntent,
        });
        setPreview(r);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Preview failed.";
        if (isPromoRevalidate) {
          setPromoError(msg);
        } else {
          setPreview(null);
          setLoadError(msg);
          setPromoError(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    [accessToken, product, promoInput],
  );

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setPromoInput("");
      setPromoError(null);
      setLoadError(null);
      setExitOfferShown(false);
      setSuccessCredits(null);
      if (successCloseTimer.current) {
        clearTimeout(successCloseTimer.current);
        successCloseTimer.current = null;
      }
      return;
    }
    setExitOfferShown(false);
    setSuccessCredits(null);
    void loadPreview({ couponCode: null, applyExitIntent: false });
  }, [open, product, loadPreview]);

  useEffect(() => {
    if (!open) {
      return;
    }
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

  const tr = language === "tr";
  const isViteDev = import.meta.env.DEV;

  const handleApplyPromo = useCallback(() => {
    void loadPreview({ couponCode: promoInput.trim() || null, applyExitIntent: Boolean(preview?.exitIntentApplied) });
  }, [loadPreview, promoInput, preview?.exitIntentApplied]);

  const handlePay = useCallback(async () => {
    if (!preview) {
      return;
    }
    setPaying(true);
    setPromoError(null);
    try {
      const start = await postCreditCheckoutStart(accessToken, preview.pricingToken);
      if (start.mode === "fake") {
        const result = await confirmFakeCheckout(accessToken, start.sessionId);
        let granted = preview.credits;
        if (result.ok) {
          if ("alreadyConfirmed" in result && result.alreadyConfirmed) {
            granted = preview.credits;
          } else if ("creditsGranted" in result) {
            granted = result.creditsGranted;
          }
        }
        setSuccessCredits(granted);
        setPaying(false);
        if (successCloseTimer.current) {
          clearTimeout(successCloseTimer.current);
        }
        successCloseTimer.current = setTimeout(() => {
          successCloseTimer.current = null;
          onPurchaseSuccess();
        }, 2200);
        return;
      }
      launchIyzicoCheckout(start);
      setPaying(false);
    } catch (e) {
      setPaying(false);
      setPromoError(e instanceof Error ? e.message : "Payment could not start.");
    }
  }, [accessToken, preview, onPurchaseSuccess]);

  const tryExitIntent = useCallback(() => {
    if (!preview?.exitOfferEligible || exitOfferShown) {
      onClose();
      return;
    }
    setExitOfferShown(true);
    void loadPreview({ applyExitIntent: true });
  }, [preview?.exitOfferEligible, exitOfferShown, onClose, loadPreview]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (preview?.exitOfferEligible && !exitOfferShown) {
        tryExitIntent();
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, preview?.exitOfferEligible, exitOfferShown, tryExitIntent, onClose]);

  const handleBackdropMouseDown = useCallback(
    (event: MouseEvent) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (preview?.exitOfferEligible && !exitOfferShown) {
        tryExitIntent();
        return;
      }
      onClose();
    },
    [preview?.exitOfferEligible, exitOfferShown, tryExitIntent, onClose],
  );

  if (!open || !pack) {
    return null;
  }

  return (
    <div
      className="payment-summary-backdrop"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className="payment-summary-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="payment-summary-modal__head">
          <h2 className="payment-summary-modal__title">
            {tr ? "Ödeme fişi" : "Payment receipt"}
          </h2>
          <button
            type="button"
            className="payment-summary-modal__close"
            aria-label="Close"
            onClick={() => {
              if (preview?.exitOfferEligible && !exitOfferShown) {
                tryExitIntent();
                return;
              }
              onClose();
            }}
          >
            ×
          </button>
        </div>

        {exitOfferShown && preview?.exitIntentApplied ? (
          <div className="payment-summary-modal__exit-offer" role="status">
            {tr
              ? "Bekleyin! Tek seferlik %10 indirim uygulandı — aşağıdaki fiyatı kontrol edin."
              : "Wait! A one-time 10% discount was applied — check the price below."}
          </div>
        ) : null}

        <div className="payment-summary-modal__row">
          <span className="text-nb-muted">{tr ? "Paket" : "Pack"}</span>
          <strong>
            {pack.credits} {tr ? "kredi" : "credits"}
          </strong>
        </div>

        {successCredits != null ? (
          <div
            className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-5 text-center"
            role="status"
          >
            <p className="text-lg font-semibold text-emerald-200">
              {tr ? "Ödeme başarılı" : "Payment successful"}
            </p>
            <p className="mt-2 text-sm text-emerald-100/90">
              {tr
                ? `+${successCredits} kredi hesabınıza eklendi.`
                : `+${successCredits} credits were added to your account.`}
            </p>
            <p className="mt-2 text-xs text-emerald-200/80">{tr ? "Pencere kapanıyor…" : "Closing…"}</p>
          </div>
        ) : loading ? (
          <p className="payment-summary-modal__loading">{tr ? "Yükleniyor…" : "Loading…"}</p>
        ) : !preview ? (
          <div className="mt-2 space-y-3">
            <p className="payment-summary-modal__err">
              {loadError ?? (tr ? "Özet yüklenemedi." : "Could not load summary.")}
            </p>
            <button
              type="button"
              className="payment-summary-modal__pay primary-action w-full"
              onClick={() => void loadPreview({ couponCode: promoInput.trim() || null, applyExitIntent: false })}
            >
              {tr ? "Yeniden dene" : "Try again"}
            </button>
          </div>
        ) : (
          <>
            <div className="payment-summary-modal__row">
              <span className="text-nb-muted">{tr ? "Liste fiyatı" : "List price"}</span>
              <span>{preview.basePriceTry} ₺</span>
            </div>
            {preview.basePriceTry !== preview.finalPriceTry ? (
              <div className="payment-summary-modal__row payment-summary-modal__row--discount">
                <span className="text-nb-muted">{tr ? "İndirimli" : "You pay"}</span>
                <span className="text-emerald-400 font-semibold">{preview.finalPriceTry} ₺</span>
              </div>
            ) : (
              <div className="payment-summary-modal__row">
                <span className="text-nb-muted">{tr ? "Tutar" : "Total"}</span>
                <span className="font-semibold">{preview.finalPriceTry} ₺</span>
              </div>
            )}

            <label className="payment-summary-modal__promo-label">
              {tr ? "Promosyon kodunuz var mı?" : "Have a promo code?"}
            </label>
            <div className="payment-summary-modal__promo-row">
              <input
                type="text"
                className="payment-summary-modal__input"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="CODE"
                autoComplete="off"
              />
              <button
                type="button"
                className="payment-summary-modal__apply"
                disabled={loading}
                onClick={() => void handleApplyPromo()}
              >
                {tr ? "Uygula" : "Apply"}
              </button>
            </div>
            {promoError && preview ? <p className="payment-summary-modal__err">{promoError}</p> : null}

            <button
              type="button"
              className="payment-summary-modal__pay primary-action w-full"
              disabled={paying || loading}
              onClick={() => void handlePay()}
            >
              {paying
                ? tr
                  ? "İşleniyor…"
                  : "Processing…"
                : tr
                  ? "Öde"
                  : "Pay"}
            </button>
            {isViteDev ? (
              <p className="mt-2 text-center text-[11px] text-nb-muted">
                {tr
                  ? "Geliştirme: iyzico kapalıyken veya anında onay modunda sahte ödeme kullanılır."
                  : "Dev build: when the PSP is off or mock checkout is on, purchase completes instantly."}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
