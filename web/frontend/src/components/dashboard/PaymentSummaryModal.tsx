import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type { Language } from "../../i18n/landing";
import { postCreditCheckoutPreview, postCreditCheckoutStart, type CreditPreviewResponse } from "../../api/creditCheckout";
import type { CreditPackProduct } from "../../lib/creditPacks";
import { buyCreditsInstant, confirmFakeCheckout } from "../../api/fakePayment";
import { CREDIT_PACKS } from "../../lib/creditPacks";

type Props = {
  open: boolean;
  product: CreditPackProduct;
  accessToken: string;
  language: Language;
  onClose: () => void;
  onPurchaseSuccess: () => void;
  onChangeProduct?: (product: CreditPackProduct) => void;
};

function localFallbackPreview(p: CreditPackProduct): CreditPreviewResponse {
  const row = CREDIT_PACKS.find((x) => x.product === p) ?? CREDIT_PACKS[0]!;
  const s = row.priceTry.toFixed(2);
  return {
    product: row.product,
    basePriceTry: s,
    finalPriceTry: s,
    credits: row.credits,
    couponId: null,
    exitIntentApplied: false,
    exitOfferEligible: false,
    discountPercent: null,
    pricingToken: "",
  };
}

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

function payErrorMessage(language: Language): string {
  return language === "tr"
    ? "Ödeme başlatılamadı. Daha sonra tekrar deneyin."
    : "Payment could not start. Please try again later.";
}

export function PaymentSummaryModal({
  open,
  product,
  accessToken,
  language,
  onClose,
  onPurchaseSuccess,
  onChangeProduct,
}: Props) {
  const [preview, setPreview] = useState<CreditPreviewResponse | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
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
      } catch {
        if (isPromoRevalidate) {
          setPromoError(language === "tr" ? "Promosyon kodu geçersiz." : "Invalid promo code.");
        } else {
          setPreview(localFallbackPreview(product));
        }
      } finally {
        setLoading(false);
      }
    },
    [accessToken, product, promoInput, language],
  );

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setPromoInput("");
      setPromoError(null);
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

  const scheduleSuccessClose = useCallback(() => {
    if (successCloseTimer.current) {
      clearTimeout(successCloseTimer.current);
    }
    successCloseTimer.current = setTimeout(() => {
      successCloseTimer.current = null;
      onPurchaseSuccess();
    }, 2200);
  }, [onPurchaseSuccess]);

  const handlePay = useCallback(async () => {
    if (!preview) {
      return;
    }
    setPaying(true);
    setPromoError(null);
    try {
      if (!preview.pricingToken?.trim()) {
        const result = await buyCreditsInstant(accessToken, product);
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
        scheduleSuccessClose();
        return;
      }

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
        scheduleSuccessClose();
        return;
      }
      launchIyzicoCheckout(start);
      setPaying(false);
    } catch {
      setPaying(false);
      setPromoError(payErrorMessage(language));
    }
  }, [accessToken, preview, product, language, scheduleSuccessClose]);

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

  const usingOfflinePricing = Boolean(preview && !preview.pricingToken?.trim());

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

        {onChangeProduct ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {CREDIT_PACKS.map((pk) => (
              <button
                key={pk.product}
                type="button"
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  pk.product === product
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                    : "border-white/10 bg-white/[0.04] text-nb-muted hover:border-white/20"
                }`}
                onClick={() => onChangeProduct(pk.product)}
              >
                {pk.credits} {tr ? "kr" : "cr"} · ₺{pk.priceTry}
              </button>
            ))}
          </div>
        ) : null}

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

        {usingOfflinePricing && preview ? (
          <p className="mt-2 text-[11px] leading-snug text-nb-muted">
            {tr
              ? "Canlı fiyat özeti şu an kullanılamıyor; yerel paket fiyatı gösteriliyor."
              : "Live pricing is unavailable; showing local pack price."}
          </p>
        ) : null}

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
          <p className="payment-summary-modal__loading">{tr ? "Yükleniyor…" : "Loading…"}</p>
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

            {!usingOfflinePricing ? (
              <>
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
              </>
            ) : null}
            {promoError ? <p className="payment-summary-modal__err">{promoError}</p> : null}

            <button
              type="button"
              className="payment-summary-modal__pay primary-action mt-3 w-full"
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
