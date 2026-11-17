import { softenGiftLines, useAiNotOpen } from "../../lib/aiAvailability";
import { ArrowRight, Check, Lock, ReceiptText, RotateCcw, ShieldCheck, Tag } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { Language } from "../../i18n/landing";
import type { PlanId } from "../../lib/planConfig";
import { PLANS } from "../../lib/planConfig";
import { applyPriceBook, applyTryPriceOverrides, buildCheckoutQuote, seatUnitFrom } from "../../lib/checkoutQuote";
import { useSettings } from "../../contexts/SettingsContext";
import { fillEditorTokens, useEditorLimits } from "../../lib/editorLimits";
import { confirmFakeCheckout, resolveFakePaymentRedirect } from "../../api/fakePayment";
import { launchIyzicoCheckout } from "../../lib/iyzicoLaunch";
import { defaultCurrencyFromCountryCode, useCheckoutCurrency, type CheckoutCurrency } from "../../contexts/CheckoutCurrencyContext";
import { getSaasApiBase } from "../../api/saasBase";
import { trackFunnelEvent } from "../../lib/analytics";
import { saasAuthorizedFetch } from "../../api/subscription";
import { AUTH_ACCESS_TOKEN_STORAGE_KEY } from "../../api/auth";
import { LegalDocumentBody } from "../legal/LegalPage";
import { readAccessToken } from "../../lib/accessTokenStore";
import { PaytrBadge } from "../common/PaytrBadge";

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
  return readAccessToken() ?? fallback;
}

async function initializePlanPayment(
  accessToken: string,
  planId: PlanId,
  currency: string,
  billingCycle: "MONTHLY" | "YEARLY",
  couponCode?: string | null,
  _extraSeats = 0,
  _seatsOnly = false,
  applyExitIntentDiscount = false,
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
      body: JSON.stringify({ planId, currency, billingCycle, couponCode: couponCode || undefined, extraSeats: _extraSeats, seatsOnly: _seatsOnly, applyExitIntentDiscount }),
    }),
  );
  if (!response.ok) {
    const text = await response.text();
    // Sunucu {"message": "..."} döner; kullanıcıya ham JSON değil yalnız mesaj gösterilir.
    let msg = "";
    try {
      const j = JSON.parse(text) as { message?: unknown; error?: unknown };
      msg = typeof j.message === "string" ? j.message : typeof j.error === "string" ? j.error : "";
    } catch {
      msg = text;
    }
    throw new Error(msg || `Payment init failed (${response.status}).`);
  }
  return response.json() as Promise<PlanCheckoutResponse>;
}

/** Çıkış-niyeti indirimi uygunluğunu sunucudan sorgular (sunucu otoritedir). */
async function fetchExitIntentOffer(
  accessToken: string,
): Promise<{ eligible: boolean; discountPercent: number }> {
  const token = readToken(accessToken);
  const response = await saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/payments/exit-intent-offer`, {
      method: "GET",
      headers: { Authorization: `Bearer ${t}` },
      credentials: "include",
    }),
  );
  if (!response.ok) {
    return { eligible: false, discountPercent: 0 };
  }
  return response.json() as Promise<{ eligible: boolean; discountPercent: number }>;
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
  billingCycle?: "MONTHLY" | "YEARLY";
  extraSeats?: number;
  /** Sadece ek koltuk satın alımı — mevcut Business sahipleri için. Plan fiyatı eklenmez. */
  seatsOnly?: boolean;
  accessToken: string;
  language: Language;
  onClose: () => void;
  onPurchaseSuccess: () => void;
  onBeforeExternalCheckout?: () => void;
  /** Verilirse üstte "Fatura bilgilerini düzenle" düğmesi çıkar (ödemeden önce geri dönüp bilgi değiştirmek için). */
  onEditBilling?: () => void;
  /** E-posta CTA'sından gelen kupon kodu (?coupon=…) — modal açılınca otomatik doğrulanıp
   *  uygulanır; kullanıcı elle yazmak zorunda kalmaz. */
  initialCoupon?: string | null;
};

export function PaymentSummaryModal({
  open,
  planId,
  billingCycle = "MONTHLY",
  extraSeats = 0,
  seatsOnly = false,
  accessToken,
  language,
  onClose,
  onPurchaseSuccess,
  onBeforeExternalCheckout,
  onEditBilling,
  initialCoupon,
}: Props) {
  const aiNotOpen = useAiNotOpen();
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoApplied, setPromoApplied] = useState<{ discountPercent: number } | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [paying, setPaying] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalOverlay, setLegalOverlay] = useState<null | "terms" | "kvkk">(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // E-posta kuponunu (initialCoupon) modal başına yalnız bir kez otomatik uygula.
  const autoAppliedCouponRef = useRef(false);
  // Exit-intent: kullanıcı kapatmaya çalıştığında bir kez indirim teklifi gösterilir.
  const [exitOfferShown, setExitOfferShown] = useState(false);
  const [showExitOffer, setShowExitOffer] = useState(false);
  // Exit-intent indirimi aktif mi (kupon DEĞİL — ayrı, sabit sistem indirimi).
  const [exitIntentActive, setExitIntentActive] = useState(false);

  const tr = language === "tr";
  const { currency: geoCurrency } = useCheckoutCurrency();
  // Para birimi (ve dolayısıyla KDV/istisna) ziyaretçinin konumuna değil, ödeme ekranında SEÇİLEN
  // fatura ülkesine göre belirlenir. Kayıtlı ülke yoksa konum tahmini kullanılır.
  const [billingCountry, setBillingCountry] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const token = readAccessToken() ?? accessToken;
    void fetch(`${getSaasApiBase()}/api/billing/info`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ billingCountryCode?: string | null }>) : null))
      .then((info) => {
        if (!cancelled) setBillingCountry(info?.billingCountryCode?.trim().toUpperCase() || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, accessToken]);
  const checkoutCurrency: CheckoutCurrency = billingCountry
    ? defaultCurrencyFromCountryCode(billingCountry)
    : geoCurrency;

  // Ana sayfa kartıyla AYNI fiyat: yönetim panelinde girilen TL tutarları uygulanır.
  const { pricing, flags } = useSettings();
  // İhracat istisnası yalnız admin anahtarı AÇIKÇA kapatılınca (=false) açıktır; varsayılan: herkese KDV'li.
  const exportExemption = flags?.featureFlags?.exportExemptionDisabled === false;
  // Yurt dışı (dolar) ödemesi yalnız anahtar AÇIKÇA false ise açık; aksi halde kapalı (sunucuyla aynı kural).
  const foreignOpen = flags?.featureFlags?.foreignPaymentsDisabled === false;
  const editorLimits = useEditorLimits();
  const plan = useMemo(() => {
    const base = PLANS.find((p) => p.id === planId);
    if (!base) return undefined;
    // Tam fiyat defteri varsa (TL + USD, tüm planlar) onu, yoksa eski Pro/Business TL bilgisini uygula.
    return pricing?.planPrices ? applyPriceBook([base], pricing)[0] : applyTryPriceOverrides([base], pricing?.tryPrices)[0];
  }, [planId, pricing]);
  const isTry = checkoutCurrency === "TRY";

  const seatUnits = seatUnitFrom(pricing);
  const seatUnit = isTry ? seatUnits.TRY : seatUnits.USD;
  const seatSym = isTry ? "₺" : "$";

  const planName = seatsOnly
    ? (tr ? `${extraSeats} Ekstra Koltuk` : `${extraSeats} Extra Seat${extraSeats !== 1 ? "s" : ""}`)
    : (plan ? (tr ? plan.nameTr : plan.nameEn) : planId);

  // ÖDENECEK TUTAR — sunucudaki hesabın birebir aynısı (lib/checkoutQuote.ts). TL fiyatlar
  // KDV DAHİLDİR: net = fiyat / 1,20; iskonto netten düşer; KDV indirimli net üzerine eklenir.
  // Ek koltuklar (Business) ve yıllık koltuk indirimi de dahildir.
  const quote = buildCheckoutQuote({
    plan,
    planId,
    cycle: billingCycle,
    currency: isTry ? "TRY" : "USD",
    extraSeats,
    seatsOnly,
    discountPercent: promoApplied?.discountPercent ?? null,
    exportExemption,
    seatUnit: seatUnits,
  });
  const fmtMoney = (n: number) =>
    n.toLocaleString(isTry ? "tr-TR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const vatBreakdown =
    quote && (isTry || !exportExemption)
      ? {
          net: quote.listNet,
          discountAmount: quote.discountAmount,
          discountedNet: quote.net,
          discountedVat: quote.vat,
          discountedGross: quote.total,
          fmt: (n: number) => (isTry ? `${fmtMoney(n)} ₺` : `$${fmtMoney(n)}`),
        }
      : null;
  const planPrice = quote ? `${seatSym}${fmtMoney(quote.total)}` : "";
  const planListPrice = quote ? `${seatSym}${fmtMoney(quote.listTotal)}` : "";

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
      setExitOfferShown(false);
      setShowExitOffer(false);
      setExitIntentActive(false);
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

  /**
   * Çıkış-niyeti (exit-intent): kullanıcı kapatmaya çalıştığında, sunucu
   * uygunluğu onaylarsa (FREE plan + ilk satış), kapatmak yerine tek seferlik
   * sabit indirim teklifi gösterir. Bu indirim admin kuponlarından bağımsızdır;
   * gerçek indirim sunucuda /payments/initialize sırasında uygulanır.
   */
  const attemptClose = useCallback(() => {
    if (!promoApplied && !exitOfferShown && !successMessage && !seatsOnly) {
      setExitOfferShown(true);
      void (async () => {
        try {
          const offer = await fetchExitIntentOffer(accessToken);
          if (offer.eligible && offer.discountPercent > 0) {
            setExitIntentActive(true);
            setPromoApplied({ discountPercent: offer.discountPercent });
            setShowExitOffer(true);
            return;
          }
        } catch {
          /* uygunluk alınamadı → normal kapat */
        }
        onClose();
      })();
      return;
    }
    onClose();
  }, [promoApplied, exitOfferShown, successMessage, seatsOnly, accessToken, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") attemptClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, attemptClose]);

  const handleApplyPromo = useCallback(async (codeArg?: string) => {
    const code = (codeArg ?? promoInput).trim();
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

  // E-posta CTA'sından gelen kupon: modal açılınca alanı doldur + otomatik doğrula/uygula.
  useEffect(() => {
    if (!open) {
      autoAppliedCouponRef.current = false;
      return;
    }
    const code = (initialCoupon ?? "").trim();
    if (!code || autoAppliedCouponRef.current) return;
    autoAppliedCouponRef.current = true;
    setPromoInput(code);
    void handleApplyPromo(code);
  }, [open, initialCoupon, handleApplyPromo]);

  const handlePay = useCallback(async () => {
    if (!legalAccepted) {
      setPromoError(tr ? "Devam etmek için onay kutusunu işaretleyin." : "Please accept the terms to continue.");
      return;
    }
    setPaying(true);
    setPromoError(null);
    // Huni 4. adım: kullanıcı "Güvenli ödemeye geç"e bastı (iyzico/ödeme başlatılıyor).
    trackFunnelEvent("payment_started", { plan: planId, billing_cycle: billingCycle });
    try {
      // Exit-intent indirimi yalnızca manuel kupon girilmediyse uygulanır (stacking yok).
      const useExitIntent = exitIntentActive && !promoInput.trim();
      const couponToSend = useExitIntent ? null : (promoApplied ? promoInput.trim() : null);
      const session = await initializePlanPayment(accessToken, planId, checkoutCurrency, billingCycle, couponToSend, extraSeats, seatsOnly, useExitIntent);
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
  }, [legalAccepted, tr, accessToken, planId, checkoutCurrency, billingCycle, promoApplied, promoInput, exitIntentActive, extraSeats, seatsOnly, onBeforeExternalCheckout, onPurchaseSuccess]);

  const handleBackdropMouseDown = useCallback(
    (event: MouseEvent) => {
      if (event.target === event.currentTarget) attemptClose();
    },
    [attemptClose],
  );

  if (!open || (!plan && !seatsOnly)) return null;

  const isViteDev = import.meta.env.DEV;

  const planAccent: Record<string, { ring: string; glow: string; badge: string; dot: string }> = {
    STARTER: { ring: "ring-emerald-500/25 border-emerald-500/20", glow: "shadow-[0_0_60px_-20px_rgba(16,185,129,0.3)]", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25", dot: "bg-emerald-400" },
    PLUS:    { ring: "ring-blue-500/25 border-blue-500/20",    glow: "shadow-[0_0_60px_-20px_rgba(59,130,246,0.35)]",  badge: "bg-blue-500/15 text-blue-300 border-blue-500/25",    dot: "bg-blue-400" },
    PRO:     { ring: "ring-amber-500/25 border-amber-500/20",  glow: "shadow-[0_0_60px_-20px_rgba(245,158,11,0.3)]",   badge: "bg-amber-500/15 text-amber-300 border-amber-500/25",  dot: "bg-amber-400" },
    BUSINESS:{ ring: "ring-violet-500/25 border-violet-500/20",glow: "shadow-[0_0_60px_-20px_rgba(139,92,246,0.35)]",  badge: "bg-violet-500/15 text-violet-300 border-violet-500/25",dot: "bg-violet-400" },
  };
  const accent = planAccent[planId] ?? planAccent["PLUS"]!;
  const features = seatsOnly
    ? (tr
        ? [`${extraSeats} ekstra koltuk`, "Business planı kapsamında", "Hemen aktif", `Koltuk başı ${seatSym}${isTry ? Math.round(seatUnit) : seatUnit}/ay`]
        : [`${extraSeats} extra seat${extraSeats !== 1 ? "s" : ""}`, "Within Business plan", "Active immediately", `${seatSym}${isTry ? Math.round(seatUnit) : seatUnit}/seat/mo`])
    : (plan ? softenGiftLines((tr ? plan.featuresTr : plan.featuresEn).map((f) => fillEditorTokens(f, editorLimits)), tr, aiNotOpen).slice(0, 5) : []);

  const inp =
    "min-w-0 flex-1 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-2.5 text-[14px] font-semibold tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder-slate-600 outline-none transition duration-150 hover:border-white/[0.16] hover:bg-white/[0.05] focus:border-indigo-400/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-indigo-500/10";
  const sec = (icon: ReactNode, text: string) => (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/25 to-blue-500/10 text-indigo-200 ring-1 ring-indigo-400/20">
        {icon}
      </span>
      <h3 className="text-[13px] font-bold tracking-wide text-slate-100">{text}</h3>
      <span className="h-px flex-1 bg-gradient-to-r from-white/[0.12] to-transparent" aria-hidden />
    </div>
  );
  const row = "flex items-baseline justify-between gap-4 text-[14px]";

  return (
    <>
      <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-4" role="presentation" onMouseDown={handleBackdropMouseDown}>
        <div
          className="relative flex h-[min(94dvh,860px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/[0.09] bg-gradient-to-b from-[#0e1326] via-[#0a0e1d] to-[#060910] shadow-[0_60px_140px_-40px_rgba(0,0,0,0.9),0_0_0_1px_rgba(99,102,241,0.08)]"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative shrink-0 overflow-hidden border-b border-white/[0.07] px-6 pb-4 pt-5 sm:px-9">
            <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -left-20 top-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" aria-hidden />
            <button
              type="button"
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-lg text-slate-400 transition hover:bg-white/[0.12] hover:text-white"
              aria-label={tr ? "Kapat" : "Close"}
              onClick={attemptClose}
            >
              ×
            </button>
            <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pr-12">
            <h2 className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-[22px] font-extrabold tracking-tight text-transparent sm:text-2xl">
              {tr ? "Ödeme Özeti" : "Payment Summary"}
            </h2>
            <ol className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]" aria-label={tr ? "Adımlar" : "Steps"}>
              <li className="flex items-center gap-2 text-emerald-300">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/30"><Check className="h-3.5 w-3.5" aria-hidden /></span>
                {tr ? "Fatura bilgileri" : "Billing details"}
              </li>
              <span className="h-px w-8 bg-white/15 sm:w-14" aria-hidden />
              <li className="flex items-center gap-2 text-white" aria-current="step">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-[11px] shadow-[0_6px_16px_-4px_rgba(79,70,229,0.7)]">2</span>
                {tr ? "Ödeme" : "Payment"}
              </li>
            </ol>
            </div>
            <div className="relative mt-1.5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="edit-billing"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[11.5px] font-semibold text-slate-200 transition hover:bg-white/[0.1]"
                onClick={onEditBilling}
              >
                <span aria-hidden>←</span>
                {tr ? "Fatura bilgilerini düzenle" : "Edit billing details"}
              </button>
              <p className="text-[12.5px] text-slate-400">{tr ? "Siparişinizi kontrol edin, ardından güvenli ödemeye geçin." : "Review your order, then continue to secure payment."}</p>
            </div>
          </div>

          {/* Body */}
          <div className="payment-summary-modal__scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 py-6 text-left [-webkit-overflow-scrolling:touch] sm:px-9">
            {successMessage ? (
              <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-6 text-center" role="status">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-2xl">✓</div>
                <p className="text-lg font-bold text-emerald-200">{successMessage}</p>
                <p className="mt-1.5 text-xs text-emerald-200/90">{tr ? "Pencere kapanıyor…" : "Closing…"}</p>
              </div>
            ) : (
              <>
                {showExitOffer && promoApplied ? (
                  <div className="mb-5 rounded-2xl border border-emerald-500/45 bg-gradient-to-b from-emerald-500/15 to-emerald-500/[0.06] px-4 py-3.5 text-center" role="status">
                    <p className="text-sm font-extrabold text-emerald-100">
                      🎁 {tr
                        ? `Bekleyin! Size özel %${promoApplied.discountPercent} indirim uyguladık.`
                        : `Wait! We applied a special ${promoApplied.discountPercent}% discount for you.`}
                    </p>
                    <p className="mt-1 text-[12px] text-emerald-200/75">
                      {tr
                        ? "İndirimli fiyatınız aşağıda hazır — bu fırsatı kaçırmayın."
                        : "Your discounted price is ready below — don't miss this offer."}
                    </p>
                    <button
                      type="button"
                      className="mt-2 text-[12px] font-medium text-emerald-200/90 underline underline-offset-2 transition hover:text-emerald-100"
                      onClick={onClose}
                    >
                      {tr ? "Yine de çık" : "Leave anyway"}
                    </button>
                  </div>
                ) : null}

                <div className="grid items-start gap-x-12 gap-y-6 lg:grid-cols-2">
                  {/* SOL: plan + promosyon */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      {sec(<ReceiptText className="h-3.5 w-3.5" aria-hidden />, tr ? "Seçtiğiniz plan" : "Your plan")}
                      <div className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5">
                        {seatsOnly ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest ${accent.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                            {tr ? "Ekip Genişletme" : "Team Expansion"}
                          </span>
                        ) : plan?.badge ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest ${accent.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                            {tr ? plan.badge.textTr : plan.badge.textEn}
                          </span>
                        ) : null}
                        <h4 className="mt-2 text-2xl font-black tracking-tight text-white">{planName}</h4>
                        <p className="mt-1 text-[13px] text-slate-400">
                          {billingCycle === "YEARLY"
                            ? (tr ? "Yıllık abonelik — istediğiniz zaman iptal" : "Yearly subscription — cancel anytime")
                            : (tr ? "Aylık abonelik — istediğiniz zaman iptal" : "Monthly subscription — cancel anytime")}
                        </p>
                        <ul className="mt-4 space-y-2">
                          {features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-[13px] text-slate-200">
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                  </div>

                  {/* SAĞ: sipariş özeti */}
                  <div className="space-y-4">
                    {sec(<ShieldCheck className="h-3.5 w-3.5" aria-hidden />, tr ? "Sipariş özeti" : "Order summary")}
                    <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_24px_60px_-30px_rgba(79,70,229,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className="space-y-2.5 border-b border-white/[0.07] px-5 py-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400"><Tag className="h-3 w-3" aria-hidden />{tr ? "Promosyon kodu" : "Promo code"}</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className={inp}
                          value={promoInput}
                          onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoApplied(null); }}
                          placeholder="CODE"
                          autoComplete="off"
                          aria-label={tr ? "Promosyon kodu" : "Promo code"}
                        />
                        <button
                          type="button"
                          className="rounded-xl border border-indigo-400/30 bg-indigo-500/15 px-5 py-2.5 text-sm font-bold text-indigo-100 transition hover:bg-indigo-500/25 disabled:border-white/[0.08] disabled:bg-white/[0.04] disabled:text-slate-500"
                          disabled={applyingPromo || !promoInput.trim()}
                          onClick={() => void handleApplyPromo()}
                        >
                          {applyingPromo ? "…" : tr ? "Uygula" : "Apply"}
                        </button>
                      </div>
                      {promoApplied ? (
                        <p className="text-[12.5px] font-medium text-emerald-400">
                          ✓ {tr ? `%${promoApplied.discountPercent} indirim uygulandı` : `${promoApplied.discountPercent}% discount applied`}
                        </p>
                      ) : null}
                      {promoError ? (
                        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2.5 text-[12.5px] font-medium text-red-300">{promoError}</p>
                      ) : null}
                    </div>
                      {vatBreakdown ? (
                        <div className="space-y-3.5 px-5 py-5">
                          <div className={row}>
                            <span className="text-slate-400">{tr ? "Hizmet Bedeli (KDV hariç)" : "Service Fee (excl. VAT)"}</span>
                            <span className="tabular-nums text-slate-200">{vatBreakdown.fmt(vatBreakdown.net)}</span>
                          </div>
                          {promoApplied && vatBreakdown.discountAmount > 0 && (
                            <div className={`${row} text-emerald-400`}>
                              <span>{tr ? `İskonto (−%${promoApplied.discountPercent})` : `Discount (−${promoApplied.discountPercent}%)`}</span>
                              <span className="tabular-nums">−{vatBreakdown.fmt(vatBreakdown.discountAmount)}</span>
                            </div>
                          )}
                          {promoApplied && (
                            <div className={row}>
                              <span className="text-slate-400">{tr ? "Matrah (KDV hariç)" : "Taxable Amount (excl. VAT)"}</span>
                              <span className="tabular-nums text-slate-200">{vatBreakdown.fmt(vatBreakdown.discountedNet)}</span>
                            </div>
                          )}
                          <div className={row}>
                            <span className="text-slate-400">{tr ? "KDV (%20)" : "VAT (20%)"}</span>
                            <span className="tabular-nums text-slate-300">{vatBreakdown.fmt(vatBreakdown.discountedVat)}</span>
                          </div>
                          <div className="border-t border-dashed border-white/[0.14] pt-4">
                            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-300">{tr ? "Ödenecek Tutar" : "Total Due"}</span>
                              <span className="bg-gradient-to-b from-white to-slate-300 bg-clip-text whitespace-nowrap text-[1.9rem] font-black tabular-nums leading-none text-transparent">
                                {vatBreakdown.fmt(vatBreakdown.discountedGross)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="px-5 py-6 text-center">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                            {tr ? "Ödenecek tutar" : "Total due today"}
                          </p>
                          <p className="mt-2 text-[2.8rem] font-black tabular-nums leading-none tracking-tighter text-white">
                            {promoApplied ? (
                              <><span className="mr-2 text-[1.8rem] line-through text-slate-400">{planListPrice}</span>
                              <span>{planPrice} <span className="text-xl text-emerald-400">−{promoApplied.discountPercent}%</span></span></>
                            ) : planPrice}
                          </p>
                          {!isTry && exportExemption && (
                            <p className="mt-2 text-[12px] text-slate-400">
                              {tr ? "KDV Muafiyeti: İhracat İstisnası" : "VAT Exemption: Export Exception"}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="border-t border-white/[0.07] bg-black/20 px-5 py-3 text-center text-[12px] text-slate-400">
                        {billingCycle === "YEARLY"
                          ? (tr ? "1 yıllık üyelik için tek seferlik ödeme. Süre sonunda otomatik yenilenmez." : "One payment for a 1-year membership. It does not renew automatically.")
                          : (tr ? "1 aylık üyelik için tek seferlik ödeme. Süre sonunda otomatik yenilenmez." : "One payment for a 1-month membership. It does not renew automatically.")}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11.5px] text-slate-300">
                      <div className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.025] px-2 py-2.5">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                        {tr ? "Güvenli (SSL) ödeme" : "Secure (SSL) payment"}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.025] px-2 py-2.5">
                        <RotateCcw className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                        {tr ? "Kendiliğinden yenilenmez" : "No auto-renewal"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-center text-[12px] text-slate-400">
                      <PaytrBadge height={16} tr={tr} className="mr-2 align-middle" />
                      {tr
                        ? "güvenceli ödeme — kart bilgileriniz sitemizde saklanmaz"
                        : "secured payment — your card details are never stored on our servers"}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!successMessage ? (
            <div className="shrink-0 border-t border-white/[0.08] bg-gradient-to-t from-[#05070d] to-[#0b0f1f]/95 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-9">
              <label className="mb-3 flex cursor-pointer gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-left text-[12px] leading-relaxed text-slate-400 transition duration-150 hover:border-white/[0.16] has-[:checked]:border-indigo-400/40 has-[:checked]:bg-indigo-500/[0.07]">
                <input
                  type="checkbox"
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded-md border-white/20 bg-nb-bg-soft accent-indigo-500"
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
                      okudum, kabul ediyorum.
                      <span className="mt-1.5 block text-[11px] text-slate-400">
                        Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi ve cayma hakkı beyanınız bir önceki adımda kaydedilmiştir.
                      </span>
                    </>
                  ) : (
                    <>
                      I have read and accept the{" "}
                      <button type="button" className="text-nb-accent underline underline-offset-2" onClick={() => setLegalOverlay("terms")}>
                        Terms of Use
                      </button>.
                      <span className="mt-1.5 block text-[11px] text-slate-400">
                        Your Pre-Purchase Information Form, Distance Sales Agreement and withdrawal waiver were recorded in the previous step.
                      </span>
                    </>
                  )}
                </span>
              </label>

              {!isTry && !foreignOpen ? (
                <p className="rounded-xl border border-amber-400/30 bg-amber-500/[0.08] px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-200" role="status">
                  {tr
                    ? "Şimdilik yalnızca Türkiye'den ödeme alıyoruz. Yurt dışı ödemeleri yakında açılacak; ücretsiz araçları kullanmaya devam edebilirsiniz."
                    : "We currently accept payments from Turkey only. International payments will open soon; you can keep using the free tools meanwhile."}
                </p>
              ) : null}

              <button
                type="button"
                className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-[1.05rem] text-[16px] font-bold tracking-tight text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-white/10 transition duration-200 hover:-translate-y-px hover:shadow-[0_22px_52px_-12px_rgba(99,102,241,0.9),inset_0_1px_0_rgba(255,255,255,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 active:translate-y-0 disabled:pointer-events-none disabled:opacity-40"
                disabled={paying || !legalAccepted || (!isTry && !foreignOpen)}
                onClick={() => void handlePay()}
              >
                <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition duration-700 group-hover:left-full group-hover:opacity-100" aria-hidden />
                {paying ? (
                  <>{tr ? "İşleniyor…" : "Processing…"}</>
                ) : (
                  <>
                    <Lock className="h-[18px] w-[18px]" aria-hidden />
                    {tr ? "Güvenli ödemeye geç" : "Continue to secure payment"}
                    <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
                  </>
                )}
              </button>
              {isViteDev ? (
                <p className="mt-2 text-center text-[11px] text-nb-muted">
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
                  ? (tr ? "Kullanım koşulları" : "Terms of use")
                  : (tr ? "KVKK" : "KVKK disclosure")}
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
