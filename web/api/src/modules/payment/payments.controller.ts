import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { getClientIp } from "../../middleware/api-security.middleware.js";
import { createPaymentCheckoutSession } from "./payment.service.js";
import { getPublicTierPricingRows } from "./payment-pricing-tiers.js";
import { isCheckoutCurrency, type CheckoutCurrency } from "./pricing-matrix.js";
import { prisma } from "../../lib/prisma.js";
import { validateCouponForUser } from "../coupon/coupon.service.js";

const planPaymentBodySchema = z.object({
  planId: z.enum(["STARTER", "PLUS", "PRO", "BUSINESS"]),
  currency: z.enum(["TRY", "USD", "EUR"]).optional().default("TRY"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional().default("MONTHLY"),
  couponCode: z.string().optional().nullable(),
  extraSeats: z.number().int().min(0).max(95).optional().default(0),
  seatsOnly: z.boolean().optional().default(false),
});

/** Extra seat monthly prices (net, excluding VAT) */
const EXTRA_SEAT_PRICE_TRY = 199; // ₺199/kişi/ay
const EXTRA_SEAT_PRICE_USD = 5.99; // $5.99/kişi/ay

/** TRY prices — decimal format ("799.00" = 799 TL). iyzico requires two-decimal strings. */
const PLAN_PRICES_TRY: Record<"STARTER" | "PLUS" | "PRO" | "BUSINESS", { monthly: string; yearly: string }> = {
  STARTER: { monthly: "49.00", yearly: "490.00" },
  PLUS: { monthly: "149.00", yearly: "1490.00" },
  PRO: { monthly: "299.00", yearly: "2990.00" },
  BUSINESS: { monthly: "799.00", yearly: "7990.00" },
};

/** USD prices — decimal format ("250.00" = $250). */
const PLAN_PRICES_USD: Record<"STARTER" | "PLUS" | "PRO" | "BUSINESS", { monthly: string; yearly: string }> = {
  STARTER: { monthly: "15.99", yearly: "159.00" },
  PLUS: { monthly: "47.99", yearly: "479.90" },
  PRO: { monthly: "97.99", yearly: "979.90" },
  BUSINESS: { monthly: "250.00", yearly: "2500.00" },
};

const BASKET_NAMES_TR: Record<"STARTER" | "PLUS" | "PRO" | "BUSINESS", string> = {
  STARTER: "PDF PLATFORM Başlangıç",
  PLUS: "PDF PLATFORM Plus",
  PRO: "PDF PLATFORM Pro",
  BUSINESS: "PDF PLATFORM Business",
};

/** TC Kimlik No algoritması — 11 hane checksum doğrulaması */
function isValidTckn(tckn: string): boolean {
  if (!tckn || tckn.length !== 11 || !/^\d{11}$/.test(tckn) || tckn[0] === "0") return false;
  const d = tckn.split("").map(Number);
  const d10 = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
  return d10 === d[9] && (d[0]+d[1]+d[2]+d[3]+d[4]+d[5]+d[6]+d[7]+d[8]+d[9]) % 10 === d[10];
}

export async function initializePaymentsController(request: Request, response: Response): Promise<void> {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }

  const parsed = planPaymentBodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request body.");
  }

  const { planId, billingCycle, couponCode, extraSeats, seatsOnly } = parsed.data;
  const rawCurrency = parsed.data.currency;
  // EUR: iyzico USD fiyat bandıyla işler; kullanıcıya fiyat ekranda EUR olarak gösterilir
  // ama ödeme teknik olarak USD üzerinden gerçekleşir. Bu durum checkout sayfasında
  // ve fatura üzerinde açıkça belirtilir.
  const checkoutCurrency: CheckoutCurrency = rawCurrency === "EUR" ? "USD" : (rawCurrency as CheckoutCurrency);
  const displayCurrency = rawCurrency; // Kullanıcıya gösterim için orijinal para birimi

  // Güvenlik: USD ödeme + TR fatura adresi → bloke et.
  // TR fatura adresli kullanıcılar TRY kanalını kullanmalıdır.
  if (checkoutCurrency !== "TRY") {
    const userId = request.authUser?.id;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { billingCountryCode: true },
      });
      const billingCountry = (user?.billingCountryCode ?? "").toUpperCase().trim();
      if (!billingCountry || billingCountry === "TR") {
        throw new HttpError(
          400,
          "Türkiye fatura adresli hesaplar TRY ödeme kanalını kullanmalıdır. " +
          "Lütfen TRY seçeneğiyle devam edin veya yurt dışı fatura adresinizi güncelleyin.",
        );
      }
    }
  }

  const isYearly = billingCycle === "YEARLY";
  const priceObj = checkoutCurrency === "USD" ? PLAN_PRICES_USD[planId] : PLAN_PRICES_TRY[planId];
  const seatUnitPrice = checkoutCurrency === "USD" ? EXTRA_SEAT_PRICE_USD : EXTRA_SEAT_PRICE_TRY;
  const seatMonthlyTotal = (extraSeats ?? 0) * seatUnitPrice;
  // Yıllık koltuklarda %17 indirim (10 ay fiyatına 12 ay = aylık * 12 * 0.83)
  const YEARLY_SEAT_DISCOUNT = 0.83;
  const seatTotal = isYearly
    ? Math.round(seatMonthlyTotal * 12 * YEARLY_SEAT_DISCOUNT * 100) / 100
    : seatMonthlyTotal;
  // seatsOnly=true: mevcut Business sahibi sadece ek koltuk satın alıyor
  const basePriceNum = seatsOnly
    ? seatTotal
    : parseFloat(isYearly ? priceObj.yearly : priceObj.monthly) + seatTotal;
  const originalBasePrice = basePriceNum.toFixed(2);
  let basePrice = originalBasePrice;

  let appliedCouponId: string | null = null;
  let appliedDiscountPercent: number | null = null;

  // Kupon varsa doğrula ve KDV matrahına (net fiyat) uygula.
  // PLAN_PRICES_* değerleri KDV hariç (net) fiyatlardır.
  // KDV Kanunu Md.25: iskonto faturada gösterilmeli ve matrahtan düşülür.
  if (couponCode?.trim()) {
    const v = await validateCouponForUser(couponCode, userId);
    if (!v.ok) {
      throw new HttpError(
        400,
        v.reason === "limit" ? "Bu promosyon kodunun kullanım limitine ulaştınız." : "Geçersiz veya pasif promosyon kodu.",
      );
    }
    appliedCouponId = v.coupon.id;
    appliedDiscountPercent = v.coupon.discountPercent;
    const netPrice = parseFloat(basePrice);
    const discountedNet = Math.round(netPrice * (1 - v.coupon.discountPercent / 100) * 100) / 100;
    basePrice = Math.max(discountedNet, 0.01).toFixed(2);
  }

  // TC Kimlik No validasyonu — geçersiz TC ile ödeme başlatılamaz
  if (checkoutCurrency === "TRY") {
    const invoiceUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { tcKimlikNo: true, invoiceType: true },
    });
    const isIndividual = (invoiceUser?.invoiceType ?? "individual") !== "corporate";
    if (isIndividual && invoiceUser?.tcKimlikNo) {
      try {
        const { decryptField } = await import("../../lib/encryption.js");
        const tc = decryptField(invoiceUser.tcKimlikNo);
        if (!isValidTckn(tc)) {
          throw new HttpError(
            400,
            "Kayıtlı TC Kimlik Numaranız geçersiz. Lütfen profil sayfanızdan fatura bilgilerinizi güncelleyin.",
          );
        }
      } catch (err) {
        if (err instanceof HttpError) throw err;
        // Decrypt hatası — TC doğrulanamadı, geçişe izin ver
      }
    }
  }

  // basePrice KDV hariç (net) fiyattır; createPaymentCheckoutSession içinde
  // buildCheckoutPricing KDV'yi ekler ve iyzico'ya gross gönderir.
  const priceTryOverride = basePrice;
  const billing = isYearly ? "annual" : "monthly";
  const subscriptionDaysOverride = isYearly ? 365 : 30;

  const session = await createPaymentCheckoutSession({
    userId,
    plan: planId,
    billing,
    clientIp: getClientIp(request),
    priceTryOverride,
    checkoutCurrency,
    subscriptionDaysOverride,
    basketItemName: seatsOnly ? undefined : `${BASKET_NAMES_TR[planId]} (${isYearly ? "1 yıl" : "1 ay"})`, // seatsOnly: basket adı payment.service içinde otomatik üretilir
    couponId: appliedCouponId,
    discountPercent: appliedDiscountPercent,
    originalNetAmount: appliedCouponId ? originalBasePrice : null,
    extraSeats: extraSeats ?? 0,
    seatsOnly: seatsOnly ?? false,
  });

  response.status(200).json({
    mode: "iyzico",
    token: session.token,
    checkoutFormContent: session.checkoutFormContent,
    paymentPageUrl: session.paymentPageUrl,
    conversationId: session.conversationId,
  });
}

export async function getPaymentsPricingPublicController(request: Request, response: Response): Promise<void> {
  const raw = request.query.currency;
  let c: CheckoutCurrency = "TRY";
  if (typeof raw === "string" && isCheckoutCurrency(raw)) {
    c = raw;
  }
  response.status(200).json({
    currency: c,
    tiers: getPublicTierPricingRows(c),
  });
}
