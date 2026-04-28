import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type { Language } from "../../i18n/landing";
import { postCreditCheckoutPreview, postCreditCheckoutStart, type CreditPreviewResponse } from "../../api/creditCheckout";
import type { CreditPackProduct } from "../../lib/creditPacks";
import { confirmFakeCheckout, resolveFakePaymentRedirect } from "../../api/fakePayment";
import { CREDIT_PACKS } from "../../lib/creditPacks";
import { initializeTierPayment } from "../../api/payments";
import { launchIyzicoCheckout } from "../../lib/iyzicoLaunch";
import { useCheckoutCurrency } from "../../contexts/CheckoutCurrencyContext";
import { formatCheckoutMoney, packAmount, type CheckoutCurrency } from "../../lib/pricingMatrix";
import { LegalDocumentBody } from "../legal/LegalPage";

type Props = {
  open: boolean;
  product: CreditPackProduct;
  accessToken: string;
  language: Language;
  onClose: () => void;
  onPurchaseSuccess: () => void;
  onChangeProduct?: (product: CreditPackProduct) => void;
};

function localFallbackPreview(p: CreditPackProduct, currency: CheckoutCurrency): CreditPreviewResponse {
  const row = CREDIT_PACKS.find((x) => x.product === p) ?? CREDIT_PACKS[0]!;
  const s = packAmount(p, currency).toFixed(2);
  if (p === "UNLIMITED_PRO") {
    return {
      product: "UNLIMITED_PRO",
      currency,
      baseAmount: s,
      finalAmount: s,
      credits: 0,
      couponId: null,
      exitIntentApplied: false,
      exitOfferEligible: false,
      discountPercent: null,
      pricingToken: "",
    };
  }
  return {
    product: p,
    currency,
    baseAmount: s,
    finalAmount: s,
    credits: row.credits ?? 0,
    couponId: null,
    exitIntentApplied: false,
    exitOfferEligible: false,
    discountPercent: null,
    pricingToken: "",
  };
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
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalOverlay, setLegalOverlay] = useState<null | "terms" | "kvkk">(null);
  const successCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pack = CREDIT_PACKS.find((p) => p.product === product);
  const tr = language === "tr";
  const isSubscription = product === "UNLIMITED_PRO";
  const { currency: checkoutCurrency } = useCheckoutCurrency();

  const loadPreview = useCallback(
    async (opts: { couponCode?: string | null; applyExitIntent?: boolean } = {}) => {
      if (product === "UNLIMITED_PRO") {
        setPreview(localFallbackPreview(product, checkoutCurrency));
        return;
      }
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
          currency: checkoutCurrency,
        });
        setPreview(r);
      } catch {
        if (isPromoRevalidate) {
          setPromoError(language === "tr" ? "Promosyon kodu geçersiz." : "Invalid promo code.");
        } else {
          setPreview(localFallbackPreview(product, checkoutCurrency));
        }
      } finally {
        setLoading(false);
      }
    },
    [accessToken, product, promoInput, language, checkoutCurrency],
  );

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setPromoInput("");
      setPromoError(null);
      setExitOfferShown(false);
      setSuccessCredits(null);
      setLegalAccepted(false);
      setLegalOverlay(null);
      if (successCloseTimer.current) {
        clearTimeout(successCloseTimer.current);
        successCloseTimer.current = null;
      }
      return;
    }
    setExitOfferShown(false);
    setSuccessCredits(null);
    setLegalAccepted(false);
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
    if (!legalAccepted) {
      setPromoError(tr ? "Devam etmek için onay kutusunu işaretleyin." : "Please accept the terms to continue.");
      return;
    }
    if (isSubscription) {
      setPaying(true);
      setPromoError(null);
      try {
        const session = await initializeTierPayment(accessToken, "unlimited_pro", checkoutCurrency);
        if (session.mode === "fake") {
          window.location.assign(resolveFakePaymentRedirect(session.redirectUrl));
          setPaying(false);
          return;
        }
        launchIyzicoCheckout({
          checkoutFormContent: session.checkoutFormContent,
          paymentPageUrl: session.paymentPageUrl,
        });
        setPaying(false);
      } catch {
        setPaying(false);
        setPromoError(payErrorMessage(language));
      }
      return;
    }

    if (!preview) {
      return;
    }
    setPaying(true);
    setPromoError(null);
    try {
      let workingPreview = preview;
      let pricingToken = preview.pricingToken?.trim() ?? "";
      if (!pricingToken) {
        try {
          const refreshed = await postCreditCheckoutPreview(accessToken, {
            product,
            couponCode: promoInput.trim() || null,
            applyExitIntent: Boolean(preview.exitIntentApplied),
            currency: checkoutCurrency,
          });
          workingPreview = refreshed;
          setPreview(refreshed);
          pricingToken = refreshed.pricingToken?.trim() ?? "";
        } catch {
          setPaying(false);
          setPromoError(payErrorMessage(language));
          return;
        }
      }
      if (!pricingToken) {
        setPaying(false);
        setPromoError(
          tr
            ? "Canlı ödeme oturumu başlatılamadı. Bağlantınızı kontrol edip tekrar deneyin."
            : "Could not start checkout. Check your connection and try again.",
        );
        return;
      }

      const start = await postCreditCheckoutStart(accessToken, pricingToken);
      if (start.mode === "fake") {
        const result = await confirmFakeCheckout(accessToken, start.sessionId);
        let granted = workingPreview.credits;
        if (result.ok) {
          if ("alreadyConfirmed" in result && result.alreadyConfirmed) {
            granted = workingPreview.credits;
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
  }, [
    legalAccepted,
    tr,
    isSubscription,
    accessToken,
    checkoutCurrency,
    preview,
    product,
    language,
    scheduleSuccessClose,
    promoInput,
  ]);

  const tryExitIntent = useCallback(() => {
    if (!preview?.exitOfferEligible || exitOfferShown || isSubscription) {
      onClose();
      return;
    }
    setExitOfferShown(true);
    void loadPreview({ applyExitIntent: true });
  }, [preview?.exitOfferEligible, exitOfferShown, onClose, loadPreview, isSubscription]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (preview?.exitOfferEligible && !exitOfferShown && !isSubscription) {
        tryExitIntent();
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, preview?.exitOfferEligible, exitOfferShown, tryExitIntent, onClose, isSubscription]);

  const handleBackdropMouseDown = useCallback(
    (event: MouseEvent) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (preview?.exitOfferEligible && !exitOfferShown && !isSubscription) {
        tryExitIntent();
        return;
      }
      onClose();
    },
    [preview?.exitOfferEligible, exitOfferShown, tryExitIntent, onClose, isSubscription],
  );

  if (!open || !pack) {
    return null;
  }

  const usingOfflinePricing = Boolean(preview && !preview.pricingToken?.trim() && !isSubscription);

  const displayCurrency = (preview?.currency as CheckoutCurrency | undefined) ?? checkoutCurrency;
  const formatMoneyDisplay = (s: string, c: CheckoutCurrency = displayCurrency) => {
    const n = Number.parseFloat(s);
    if (!Number.isFinite(n)) {
      return s;
    }
    return formatCheckoutMoney(n, c, tr ? "tr" : "en");
  };

  return (
    <>
      <div className="payment-summary-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <div className="payment-summary-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="payment-summary-modal__head">
          <h2 className="payment-summary-modal__title">{tr ? "Ödeme fişi" : "Payment receipt"}</h2>
          <button
            type="button"
            className="payment-summary-modal__close"
            aria-label="Close"
            onClick={() => {
              if (preview?.exitOfferEligible && !exitOfferShown && !isSubscription) {
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
                {pk.subscription
                  ? (tr ? "Limitsiz · " : "Unl. · ") +
                    formatCheckoutMoney(packAmount(pk.product, checkoutCurrency), checkoutCurrency, tr ? "tr" : "en") +
                    (tr ? "/ay" : "/mo")
                  : `${pk.credits} ${tr ? "kr" : "cr"} · ${formatCheckoutMoney(
                      packAmount(pk.product, checkoutCurrency),
                      checkoutCurrency,
                      tr ? "tr" : "en",
                    )}`}
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
          <strong>{tr ? pack.nameTr : pack.nameEn}</strong>
        </div>

        <div className="payment-summary-modal__row">
          <span className="text-nb-muted">{tr ? "İçerik" : "Contents"}</span>
          <strong>
            {pack.subscription
              ? tr
                ? "SINIRSIZ İŞLEM"
                : "Unlimited operations"
              : `${pack.credits} ${tr ? "kredi" : "credits"}`}
          </strong>
        </div>

        {usingOfflinePricing && preview ? (
          <p className="mt-2 text-[11px] leading-snug text-nb-muted">
            {tr
              ? "Canlı fiyat özeti şu an kullanılamıyor; yerel paket fiyatı gösteriliyor."
              : "Live pricing is unavailable; showing local pack price."}
          </p>
        ) : null}

        {successCredits != null && !isSubscription ? (
          <div
            className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-5 text-center"
            role="status"
          >
            <p className="text-lg font-semibold text-emerald-200">{tr ? "Ödeme başarılı" : "Payment successful"}</p>
            <p className="mt-2 text-sm text-emerald-100/90">
              {tr ? `+${successCredits} kredi hesabınıza eklendi.` : `+${successCredits} credits were added to your account.`}
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
              <span>{formatMoneyDisplay(preview.baseAmount, preview.currency as CheckoutCurrency)}</span>
            </div>
            {preview.baseAmount !== preview.finalAmount ? (
              <div className="payment-summary-modal__row payment-summary-modal__row--discount">
                <span className="text-nb-muted">{tr ? "İndirimli" : "You pay"}</span>
                <span className="font-semibold text-emerald-400">
                  {formatMoneyDisplay(preview.finalAmount, preview.currency as CheckoutCurrency)}
                </span>
              </div>
            ) : (
              <div className="payment-summary-modal__row">
                <span className="text-nb-muted">{tr ? "Tutar" : "Total"}</span>
                <span className="font-semibold">
                  {formatMoneyDisplay(preview.finalAmount, preview.currency as CheckoutCurrency)}
                </span>
              </div>
            )}

            {!isSubscription && !usingOfflinePricing ? (
              <>
                <label className="payment-summary-modal__promo-label">{tr ? "Promosyon kodunuz var mı?" : "Have a promo code?"}</label>
                <div className="payment-summary-modal__promo-row">
                  <input
                    type="text"
                    className="payment-summary-modal__input"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="CODE"
                    autoComplete="off"
                  />
                  <button type="button" className="payment-summary-modal__apply" disabled={loading} onClick={() => void handleApplyPromo()}>
                    {tr ? "Uygula" : "Apply"}
                  </button>
                </div>
              </>
            ) : null}
            {promoError ? <p className="payment-summary-modal__err">{promoError}</p> : null}

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-4 opacity-95">
              <span className="text-sm font-bold text-[#00A7E0]">iyzico</span>
              <span className="text-sm font-black italic tracking-tight text-[#1434CB]">VISA</span>
              <svg className="h-7 w-10 shrink-0" viewBox="0 0 32 20" aria-hidden>
                <circle cx="12" cy="10" r="8" fill="#EB001B" />
                <circle cx="20" cy="10" r="8" fill="#F79E1B" />
              </svg>
            </div>

            <label className="mt-4 flex cursor-pointer gap-3 rounded-xl border border-white/[0.08] bg-nb-bg-soft/40 p-3 text-sm leading-relaxed text-nb-muted">
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
              className="payment-summary-modal__pay primary-action mt-3 w-full"
              disabled={paying || loading || !legalAccepted}
              onClick={() => void handlePay()}
            >
              {paying ? (tr ? "İşleniyor…" : "Processing…") : tr ? "Öde" : "Pay"}
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

      {legalOverlay ? (
        <div
          className="payment-summary-legal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-legal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setLegalOverlay(null);
            }
          }}
        >
          <div className="payment-summary-legal-panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
              <h2 id="payment-legal-title" className="text-sm font-semibold text-nb-text">
                {legalOverlay === "terms"
                  ? tr
                    ? "Kullanım koşulları"
                    : "Terms of use"
                  : tr
                    ? "KVKK"
                    : "KVKK disclosure"}
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
