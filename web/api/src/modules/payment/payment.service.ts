/**
 * @deprecated — feature-flagged via `PAYMENTS_PROVIDER=iyzico`; Stripe replaces this in Phase 3.
 * Do not add new features here. See `.cursor/plans/stripe-phase-1-systemmap_*.plan.md`.
 */
import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { logSuspiciousActivity } from "../../lib/app-logger.js";
import { prisma } from "../../lib/prisma.js";
import { hashToken } from "../../lib/token.js";
import {
  eqIyzicoMoney,
  normalizeIyzicoMoneyString,
} from "../credit-checkout/credit-pack-pricing.js";
import type { CheckoutCurrency } from "./pricing-matrix.js";
import { getPaymentPricesTry } from "./payment-pricing.js";
import { buildCheckoutPricing, resolveEffectiveCountry } from "../../lib/vat.js";
import { createTeamForOwner } from "../team/team.service.js";
import IyzipayImport from "iyzipay";
import iyziUtilsImport from "iyzipay/lib/utils.js";

/** iyzipay CommonJS; ESM’de default import (Node 24 + require() ile ESM karışımı ERR_AMBIGUOUS_MODULE_SYNTAX verir). */
type IyzipayCtor = {
  new (o: { apiKey: string; secretKey: string; uri: string }): {
    checkoutFormInitialize: {
      create: (
        req: Record<string, unknown>,
        cb: (err: Error | null, result: IyzicoInitResult) => void,
      ) => void;
    };
    checkoutForm: {
      retrieve: (
        req: Record<string, unknown>,
        cb: (err: Error | null, result: IyzicoRetrieveResult) => void,
      ) => void;
    };
    refund: {
      create: (
        req: Record<string, unknown>,
        cb: (err: Error | null, result: IyzicoOperationResult) => void,
      ) => void;
    };
    cancel: {
      create: (
        req: Record<string, unknown>,
        cb: (err: Error | null, result: IyzicoOperationResult) => void,
      ) => void;
    };
  };
  LOCALE: { TR: string; EN: string };
  CURRENCY: { TRY: string; USD: string; EUR: string };
  PAYMENT_GROUP: { PRODUCT: string };
  BASKET_ITEM_TYPE: { VIRTUAL: string };
};

const Iyzipay = IyzipayImport as unknown as IyzipayCtor;

const PLAN_ORG_LIMITS: Record<string, {
  dailyOperationLimit: number | null;
  monthlyOperationLimit: number;
  fileSizeLimitMB: number;
  batchLimit: number;
  watermarkEnabled: boolean;
  queuePriority: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
}> = {
  FREE:     { dailyOperationLimit: 3,    monthlyOperationLimit: 30,     fileSizeLimitMB: 25,     batchLimit: 0,   watermarkEnabled: true,  queuePriority: "LOW" },
  STARTER:  { dailyOperationLimit: 25,   monthlyOperationLimit: 250,    fileSizeLimitMB: 100,    batchLimit: 2,   watermarkEnabled: true,  queuePriority: "LOW" },
  PLUS:     { dailyOperationLimit: null, monthlyOperationLimit: 600,    fileSizeLimitMB: 250,    batchLimit: 5,   watermarkEnabled: false, queuePriority: "MEDIUM" },
  PRO:      { dailyOperationLimit: null, monthlyOperationLimit: 1000,   fileSizeLimitMB: 500,    batchLimit: 25,  watermarkEnabled: false, queuePriority: "HIGH" },
  BUSINESS: { dailyOperationLimit: null, monthlyOperationLimit: 999999, fileSizeLimitMB: 999999, batchLimit: 999, watermarkEnabled: false, queuePriority: "HIGHEST" },
};

async function resolvePlanLimits(plan: string) {
  try {
    const config = await prisma.planConfig.findUnique({ where: { plan: plan as never } });
    if (config) {
      return {
        dailyOperationLimit: config.dailyOperationLimit ?? undefined,
        monthlyOperationLimit: config.monthlyOperationLimit,
        fileSizeLimitMB: config.fileSizeLimitMB,
        batchLimit: config.batchLimit,
        watermarkEnabled: config.watermarkEnabled,
        queuePriority: config.queuePriority,
      };
    }
  } catch {
    // DB'de kayıt yoksa varsayılana dön
  }
  const def = PLAN_ORG_LIMITS[plan] ?? PLAN_ORG_LIMITS["FREE"];
  return {
    dailyOperationLimit: def.dailyOperationLimit ?? undefined,
    monthlyOperationLimit: def.monthlyOperationLimit,
    fileSizeLimitMB: def.fileSizeLimitMB,
    batchLimit: def.batchLimit,
    watermarkEnabled: def.watermarkEnabled,
    queuePriority: def.queuePriority,
  };
}

/** Sandbox-safe dummy postal addresses required by Checkout Form validator. */
const BUYER_DUMMY_STREET =
  "Çamlıca Mah. Teknokent Bulvarı No:42 Daire:7 Üsküdar İstanbul";

function getCheckoutFormCallbackUrl(): string {
  const base = env.PAYMENT_CALLBACK_BASE_URL.replace(/\/$/, "");
  return `${base}/api/payments/callback`;
}

function normalizeCheckoutPrice(raw: string | undefined): string {
  if (!raw?.trim()) {
    throw new HttpError(500, "Checkout price missing.");
  }
  try {
    return normalizeIyzicoMoneyString(raw.trim());
  } catch {
    throw new HttpError(500, "Checkout price normalization failed.");
  }
}
const iyziUtils = iyziUtilsImport as {
  calculateHmacSHA256Signature: (params: string[], secretKey: string) => string;
};

function getIyzipay() {
  if (!env.iyzicoEnabled) {
    throw new HttpError(503, "Payment service is not configured.");
  }
  return new Iyzipay({
    apiKey: env.IYZICO_API_KEY,
    secretKey: env.IYZICO_SECRET_KEY,
    uri: env.IYZICO_URI.trim(),
  });
}

function iyzicoFx(c: CheckoutCurrency): string {
  switch (c) {
    case "TRY":
      return Iyzipay.CURRENCY.TRY;
    case "USD":
      return Iyzipay.CURRENCY.USD;
    case "EUR":
      return Iyzipay.CURRENCY.EUR;
    default: {
      const _e: never = c;
      return _e;
    }
  }
}

type IyzicoInitResult = {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  errorGroup?: string;
  conversationId?: string;
  token?: string;
  signature?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
};

type IyzicoOperationResult = {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  errorGroup?: string;
  authCode?: string;
  hostReference?: string;
};

type IyzicoRetrieveResult = {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  paymentStatus?: string;
  paymentId?: string;
  currency?: string;
  basketId?: string;
  conversationId?: string;
  paidPrice?: string | number;
  price?: string | number;
  token?: string;
  signature?: string;
  fraudStatus?: number;
  binNumber?: string;
  cardAssociation?: string;
  cardType?: string;
  cardCountry?: string;
  cardFamily?: string;
  paymentItems?: Array<{
    paymentTransactionId?: string;
    itemId?: string;
    price?: string | number;
    paidPrice?: string | number;
  }>;
};

/** SDK / API may return camelCase or snake_case; normalized before signature + DB lookups. */
function extractConversationIdFromRetrieve(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const candidates = [
    o.conversationId,
    o.conversation_id,
    o.ConversationId,
    (o as { rawResult?: unknown }).rawResult,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c.trim();
    }
  }
  const nested = (o.rawResult ?? o.RawResult) as
    | Record<string, unknown>
    | undefined;
  if (nested && typeof nested === "object") {
    const n = nested.conversationId ?? nested.conversation_id;
    if (typeof n === "string" && n.trim()) {
      return n.trim();
    }
  }
  return undefined;
}

function verifyInitSignature(
  conversationId: string,
  token: string,
  signature: string | undefined,
  secretKey: string,
) {
  if (!signature) {
    throw new HttpError(502, "Missing payment provider signature.");
  }
  const calculated = iyziUtils.calculateHmacSHA256Signature(
    [conversationId, token],
    secretKey,
  );
  if (calculated !== signature) {
    logSuspiciousActivity({
      type: "iyzico_signature_mismatch",
      detail: "checkoutFormInitialize",
    });
    throw new HttpError(502, "Payment response could not be verified.");
  }
}

/**
 * CF retrieve response signature uses `paidPrice` / `price` with iyzico "trailing zero" canonicalization
 * (see Response Signature Validation — same numeric form as Number.parseFloat).
 */
function normalizeMoneyFieldForRetrieveSignature(raw: unknown): string {
  if (raw === undefined || raw === null) {
    return "";
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }
  const s = String(raw).trim().replace(",", ".");
  if (!s) {
    return "";
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? String(n) : s;
}

function verifyRetrieveSignature(
  result: IyzicoRetrieveResult,
  secretKey: string,
) {
  const {
    paymentStatus,
    paymentId,
    currency,
    basketId,
    conversationId,
    paidPrice,
    price,
    token,
    signature,
  } = result;
  const paymentStatusStr = String(paymentStatus ?? "");
  const paymentIdStr = String(paymentId ?? "");
  const currencyStr = String(currency ?? "");
  const basketIdStr = String(basketId ?? "");
  const conversationIdStr = String(conversationId ?? "");
  const paidPriceStr = normalizeMoneyFieldForRetrieveSignature(paidPrice);
  const priceStr = normalizeMoneyFieldForRetrieveSignature(price);
  const tokenStr = String(token ?? "");
  if (!signature) {
    throw new HttpError(502, "Missing payment provider signature.");
  }
  const calculated = iyziUtils.calculateHmacSHA256Signature(
    [
      paymentStatusStr,
      paymentIdStr,
      currencyStr,
      basketIdStr,
      conversationIdStr,
      paidPriceStr,
      priceStr,
      tokenStr,
    ],
    secretKey,
  );
  if (calculated !== signature) {
    logSuspiciousActivity({
      type: "iyzico_signature_mismatch",
      detail: "checkoutForm.retrieve",
    });
    throw new HttpError(502, "Payment result could not be verified.");
  }
}

function splitBuyerName(user: User): { name: string; surname: string } {
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  if (first && last) {
    return { name: first, surname: last };
  }
  const full = user.name?.trim() || user.email.split("@")[0] || "User";
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { name: parts[0]!, surname: parts.slice(1).join(" ") };
  }
  return { name: full, surname: "User" };
}

function gsmNumberForCheckout(user: User): string {
  const raw = user.phone?.trim();
  if (!raw) {
    return env.IYZICO_BUYER_GSM;
  }
  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/\D/g, "");
    return digits.length >= 10 ? `+${digits}` : env.IYZICO_BUYER_GSM;
  }
  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    return `+90${digitsOnly.slice(1)}`;
  }
  if (digitsOnly.length === 10) {
    return `+90${digitsOnly}`;
  }
  return digitsOnly.length >= 10 ? `+${digitsOnly}` : env.IYZICO_BUYER_GSM;
}

/** Prefer verified billing/profile rows when initializing Checkout Form (sandbox-safe placeholders fallback). */
function buyerVenueFromUser(user: User): {
  street: string;
  city: string;
  country: string;
  zipCode: string;
  gsmNumber: string;
} {
  const street = user.billingAddressLine?.trim() || BUYER_DUMMY_STREET;
  const city = user.city?.trim() || "Istanbul";
  const country = user.country?.trim() || "Turkey";
  const zipCode = user.billingPostalCode?.trim() || "34696";
  return {
    street,
    city,
    country,
    zipCode,
    gsmNumber: gsmNumberForCheckout(user),
  };
}

function promisifyInit(
  iyzipay: ReturnType<typeof getIyzipay>,
  request: Record<string, unknown>,
): Promise<IyzicoInitResult> {
  return new Promise((resolve, reject) => {
    iyzipay.checkoutFormInitialize.create(
      request,
      (err: Error | null, result: IyzicoInitResult) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      },
    );
  });
}

function promisifyRetrieve(
  iyzipay: ReturnType<typeof getIyzipay>,
  request: Record<string, unknown>,
): Promise<IyzicoRetrieveResult> {
  return new Promise((resolve, reject) => {
    iyzipay.checkoutForm.retrieve(
      request,
      (err: Error | null, result: IyzicoRetrieveResult) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      },
    );
  });
}

function promisifyRefund(
  iyzipay: ReturnType<typeof getIyzipay>,
  request: Record<string, unknown>,
): Promise<IyzicoOperationResult> {
  return new Promise((resolve, reject) => {
    iyzipay.refund.create(request, (err, result) => {
      if (err) { reject(err); return; }
      resolve(result);
    });
  });
}

function promisifyCancel(
  iyzipay: ReturnType<typeof getIyzipay>,
  request: Record<string, unknown>,
): Promise<IyzicoOperationResult> {
  return new Promise((resolve, reject) => {
    iyzipay.cancel.create(request, (err, result) => {
      if (err) { reject(err); return; }
      resolve(result);
    });
  });
}

export async function createPaymentCheckoutSession(params: {
  userId: string;
  plan: "STARTER" | "PLUS" | "PRO" | "BUSINESS";
  billing: "monthly" | "annual";
  clientIp: string;
  /**
   * Yalnızca dahili (server-side) çağrılar için. Asla istemciden gelen değer geçirilmemeli.
   * İstemci tarafından gelen ödeme isteği `createPaymentBodySchema` ile doğrulanır
   * ve bu parametre hiçbir zaman istek gövdesinden alınmaz.
   */
  priceTryOverride?: string;
  /** Dahili çağrılar için para birimi; varsayılan TRY. */
  checkoutCurrency?: CheckoutCurrency;
  subscriptionDaysOverride?: number;
  /** Cart line label on iyzico basket. */
  basketItemName?: string;
  /** Kupon bilgisi — fatura iskonto ve kullanım kaydı için */
  couponId?: string | null;
  discountPercent?: number | null;
  /** İskonto öncesi KDV hariç net fiyat (fatura iskonto satırı için) */
  originalNetAmount?: string | null;
  /** Business plan için ek koltuk sayısı */
  extraSeats?: number;
  /** True: mevcut Business sahibi sadece koltuk genişletiyor — plan aboneliği değişmiyor */
  seatsOnly?: boolean;
}): Promise<{
  token: string;
  checkoutFormContent: string;
  paymentPageUrl?: string;
  conversationId: string;
}> {
  const prices = await getPaymentPricesTry();
  const isAnnualPro = params.plan === "PRO" && params.billing === "annual";
  const subscriptionDays =
    params.subscriptionDaysOverride ?? (isAnnualPro ? 365 : 30);
  const rawFromCatalog =
    params.priceTryOverride ??
    (params.plan === "BUSINESS"
      ? prices.BUSINESS
      : params.plan === "PLUS"
        ? prices.PRO
        : isAnnualPro
          ? prices.PRO_ANNUAL
          : prices.PRO);
  // netPrice = katalog fiyati (KDV haric)
  const netPrice = normalizeCheckoutPrice(rawFromCatalog);
  const settlementCurrency: CheckoutCurrency =
    params.priceTryOverride != null ? (params.checkoutCurrency ?? "TRY") : "TRY";
  const iyziCurrency = iyzicoFx(settlementCurrency);

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
  });

  if (!user) {
    throw new HttpError(404, "User account could not be found.");
  }

  if (!user.isVerified) {
    throw new HttpError(
      403,
      "Please verify your email before purchasing a subscription.",
    );
  }

  // KDV hesabı — çok-sinyal güvenli taraf kuralı:
  //   TRY ödemesi → daima TR, USD + boş/TR adres → TR (safe harbor)
  const customerCountry = resolveEffectiveCountry(
    settlementCurrency,
    user.billingCountryCode,
  );
  const vatPricing = buildCheckoutPricing(netPrice, customerCountry, settlementCurrency);
  // iyzico'ya KDV-dahil gross gonderilir
  const grossPrice = normalizeCheckoutPrice(vatPricing.grossAmount);

  const conversationId = randomUUID();
  const basketId = `nbpdf-${params.plan.toLowerCase()}-${conversationId.slice(0, 8)}`;
  const { name, surname } = splitBuyerName(user);
  const venue = buyerVenueFromUser(user);
  const fmtIyziDate = (d: Date) =>
    d.toISOString().slice(0, 19).replace("T", " ");
  const callbackUrl = getCheckoutFormCallbackUrl();

  await prisma.paymentCheckout.create({
    data: {
      conversationId,
      userId: user.id,
      plan: params.plan,
      status: "pending",
      priceTry: grossPrice,
      netAmount: vatPricing.netAmount,
      kdvRate: vatPricing.kdvRate,
      kdvAmount: vatPricing.kdvAmount,
      customerCountry,
      paymentCurrency: settlementCurrency,
      subscriptionDays,
      couponId: params.couponId ?? null,
      discountPercent: params.discountPercent ?? null,
      originalNetAmount: params.originalNetAmount ?? null,
      extraSeats: params.extraSeats ?? 0,
      seatsOnly: params.seatsOnly ?? false,
    },
  });

  const iyzipay = getIyzipay();
  const buyerId = user.id.slice(0, 20);

  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId,
    price: grossPrice,
    paidPrice: grossPrice,
    currency: iyziCurrency,
    basketId,
    paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
    callbackUrl,
    enabledInstallments: [1],
    buyer: {
      id: buyerId,
      name,
      surname,
      gsmNumber: venue.gsmNumber,
      email: user.email,
      identityNumber: env.IYZICO_BUYER_IDENTITY_NUMBER,
      lastLoginDate: fmtIyziDate(new Date()),
      registrationDate: fmtIyziDate(user.createdAt),
      registrationAddress: venue.street,
      ip: params.clientIp || "127.0.0.1",
      city: venue.city,
      country: venue.country,
      zipCode: venue.zipCode,
    },
    shippingAddress: {
      contactName: `${name} ${surname}`,
      city: venue.city,
      country: venue.country,
      address: venue.street,
      zipCode: venue.zipCode,
    },
    billingAddress: {
      contactName: `${name} ${surname}`,
      city: venue.city,
      country: venue.country,
      address: venue.street,
      zipCode: venue.zipCode,
    },
    basketItems: [
      {
        id: params.plan,
        name: (() => {
          if (params.basketItemName) return params.basketItemName;
          if (params.seatsOnly && (params.extraSeats ?? 0) > 0) {
            const seats = params.extraSeats!;
            const period = params.billing === "annual" ? "1 yıl" : "1 ay";
            return `PDF PLATFORM ${seats} Ekstra Koltuk (${period})`;
          }
          return params.plan === "BUSINESS"
            ? "PDF PLATFORM Business (1 ay)"
            : params.plan === "PLUS"
              ? "PDF PLATFORM Plus (1 ay)"
              : isAnnualPro
                ? "PDF PLATFORM PRO (1 yıl)"
                : "PDF PLATFORM PRO (1 ay)";
        })(),
        category1: "Subscription",
        category2: "Software",
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price: grossPrice,
      },
    ],
  };

  let result: IyzicoInitResult;
  try {
    result = await promisifyInit(iyzipay, request);
  } catch (e) {
    await prisma.paymentCheckout.updateMany({
      where: { conversationId, status: "pending" },
      data: { status: "failed" },
    });
    throw e instanceof HttpError
      ? e
      : new HttpError(502, "Payment provider request failed.");
  }

  if (result.status !== "success" || !result.token || !result.conversationId) {
    await prisma.paymentCheckout.updateMany({
      where: { conversationId, status: "pending" },
      data: { status: "failed" },
    });
    throw new HttpError(
      502,
      result.errorMessage ?? "Could not start payment session.",
    );
  }

  verifyInitSignature(
    result.conversationId,
    result.token,
    result.signature,
    env.IYZICO_SECRET_KEY,
  );

  await prisma.paymentCheckout.update({
    where: { conversationId },
    data: { iyzicoTokenHash: hashToken(result.token) },
  });

  return {
    token: result.token,
    checkoutFormContent: result.checkoutFormContent ?? "",
    paymentPageUrl: result.paymentPageUrl,
    conversationId: result.conversationId,
  };
}

export type PricingTierId = "starter" | "professional" | "unlimited_pro";

const ONE_TIME_TIER_SKU: Record<
  "starter" | "professional",
  "TIER_STARTER" | "TIER_PROFESSIONAL"
> = {
  starter: "TIER_STARTER",
  professional: "TIER_PROFESSIONAL",
};

export type TierCheckoutInitResult =
  | {
      mode: "iyzico";
      token: string;
      checkoutFormContent: string;
      paymentPageUrl?: string;
      conversationId: string;
    }
  | {
      mode: "fake";
      sessionId: string;
      amount: number;
      credits: number;
      redirectUrl: string;
    };

/** @deprecated Kredi paketi sistemi kaldırıldı. */
export async function initializeTierCheckout(_params: {
  userId: string;
  tier: PricingTierId;
  clientIp: string;
  currency: CheckoutCurrency;
}): Promise<TierCheckoutInitResult> {
  throw new HttpError(410, "Credit pack checkout is no longer available.");
}

/** @deprecated Kredi paketi sistemi kaldırıldı. */
export async function createCreditPackIyzicoSession(_params: {
  userId: string;
  clientIp: string;
}): Promise<never> {
  throw new HttpError(410, "Credit pack checkout is no longer available.");
}

/** SPA dönüş adresi (iyzico callback sonrası `303` ile gider; inline script kullanmıyoruz — üretimde Helmet CSP `script-src 'none'`.) */
export function paymentWorkspaceRedirectUrl(success: boolean, plan?: string, extraSeats?: number, seatsOnly?: boolean): string {
  const origin = env.FRONTEND_ORIGIN.replace(/\/+$/, "");
  const params = new URLSearchParams({ payment: success ? "success" : "failed" });
  if (success) {
    if (seatsOnly && extraSeats && extraSeats > 0) {
      params.set("seats", String(extraSeats));
    } else if (plan) {
      params.set("plan", plan);
    }
  }
  return `${origin}/workspace?${params.toString()}`;
}

export type ProcessPaymentCallbackOpts = {
  /** Some iyzico redirects include this; optional second field for `checkoutForm.retrieve` alongside `token`. */
  conversationIdFromRedirect?: string;
  /** Posted form field names (for diagnostics). */
  rawCallbackKeys?: string[];
};

const PC_LOG = "[iyzico/processPaymentCallback]";

/**
 * Thrown when the payment was verified by iyzico but our DB write failed.
 * The controller must return HTTP 500 so iyzico retries the webhook.
 */
export class PaymentFulfillmentDbError extends Error {
  constructor(cause: unknown) {
    super("Payment verified but DB fulfillment failed — webhook must be retried");
    this.name = "PaymentFulfillmentDbError";
    this.cause = cause;
  }
}

async function resolveConversationIdFromToken(
  token: string,
  result: IyzicoRetrieveResult,
): Promise<string | undefined> {
  const fromApi =
    extractConversationIdFromRetrieve(result)?.trim() ??
    String(result.conversationId ?? "").trim();
  const h = hashToken(token.trim());
  const paymentRow = await prisma.paymentCheckout.findFirst({
    where: { iyzicoTokenHash: h },
  });

  if (paymentRow) {
    const fromDb = paymentRow.conversationId;
    if (fromApi && fromApi !== fromDb) {
      console.warn(
        `${PC_LOG} conversationId from retrieve differs from DB row for this token — using DB`,
        { fromApi, fromDb },
      );
    }
    return fromDb;
  }

  return fromApi || undefined;
}

// ---------------------------------------------------------------------------
// Dahili fatura tetikleyici — abonelik aktivasyonunu asla engellemez
// ---------------------------------------------------------------------------

async function triggerInvoiceGeneration(
  checkout: {
    id: string;
    userId: string;
    plan: string;
    priceTry: string;
    conversationId: string;
    kdvRate?: number | null;
    kdvAmount?: string | null;
    netAmount?: string | null;
    customerCountry?: string | null;
    paymentCurrency?: string | null;
    couponId?: string | null;
    discountPercent?: number | null;
    originalNetAmount?: string | null;
  },
  retrieveResult: IyzicoRetrieveResult,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: checkout.userId },
      select: {
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        phone: true,
        billingAddressLine: true,
        city: true,
        billingCountryCode: true,
        tcKimlikNo: true,
        taxId: true,
        taxOffice: true,
        companyName: true,
        invoiceType: true,
      },
    });
    if (!user) return;

    // Çok-sinyal güvenli taraf: iyzico kart ülkesi + ödeme para birimi + beyan edilen ülke
    const cardCountryFromIyzico = (
      (retrieveResult as Record<string, unknown>).cardCountry as string | undefined ?? ""
    ).toUpperCase().trim();
    const isTRCard = cardCountryFromIyzico === "TURKEY" || cardCountryFromIyzico === "TR";
    const paymentCurr = (checkout.paymentCurrency ?? "TRY").toUpperCase();

    let countryCode: string;
    if (paymentCurr === "TRY") {
      // TRY ödemesi → daima Türkiye
      countryCode = "TR";
    } else if (isTRCard) {
      // Yabancı para birimi ama TR kart → KDV uygula (compliance güvenliği)
      countryCode = "TR";
      console.warn(`${PC_LOG} invoice: TR card on foreign currency — overriding to TR for KDV`, {
        conversationId: checkout.conversationId, cardCountry: cardCountryFromIyzico,
      });
    } else {
      // Kart ülkesi yabancı ya da bilinmiyor → beyan edilen ülkeyi kullan
      countryCode = resolveEffectiveCountry(
        paymentCurr,
        checkout.customerCountry ?? user.billingCountryCode,
      );
    }
    const { name, surname } = splitBuyerName(user as Parameters<typeof splitBuyerName>[0]);
    const fullName = user.companyName
      ? user.companyName
      : `${name} ${surname}`.trim();

    // TC No şifresini çöz — ASLA loglanmaz
    let nationalId: string | null = null;
    if (user.tcKimlikNo) {
      try {
        const { decryptField } = await import("../../lib/encryption.js");
        nationalId = decryptField(user.tcKimlikNo);
      } catch {
        console.warn(`${PC_LOG} TC No decrypt başarısız — fallback kullanılacak`);
        nationalId = null;
      }
    }

    const pdfBackendBase =
      process.env.PDF_BACKEND_URL ?? "http://127.0.0.1:8000";
    const grossPrice = checkout.priceTry;

    // iyzico retrieve sonucundan gerçek ödenen tutarı al;
    // yoksa DB'deki kayıtlı fiyatı kullan.
    const actualPaidPrice =
      retrieveResult.paidPrice != null
        ? parseFloat(String(retrieveResult.paidPrice))
        : parseFloat(grossPrice);

    // Ödemenin gerçek para birimini kullan (USD, EUR, TRY).
    // retrieveResult.currency iyzico'dan gelir (USD, TRY vb.);
    // checkout.paymentCurrency DB'ye yazılan değerdir — ikisi de geçerli.
    const actualCurrency =
      (retrieveResult.currency?.trim().toUpperCase()) ||
      (checkout.paymentCurrency?.trim().toUpperCase()) ||
      "TRY";

    const invoicePayload = {
      paymentId: String(
        (retrieveResult as Record<string, unknown>).paymentId ??
          checkout.conversationId,
      ),
      status: "SUCCESS",
      customerCountry: countryCode,
      // Kart ülkesini de gönder — Python webhook_handler çok-sinyal denetimi için
      cardCountry: (retrieveResult as Record<string, unknown>).cardCountry ?? null,
      currency: actualCurrency,
      paidPrice: actualPaidPrice,
      price: actualPaidPrice,
      buyer: {
        name,
        surname,
        email: user.email,
        gsmNumber: user.phone ?? "",
        identityNumber: nationalId ?? "",
        registrationAddress: user.billingAddressLine ?? "",
        city: user.city ?? "",
        country: countryCode === "TR" ? "Turkey" : countryCode,
        invoiceType: user.invoiceType ?? "individual",
        taxId: user.taxId ?? "",
        taxOffice: user.taxOffice ?? "",
      },
      basketItems: [
        {
          id: checkout.plan,
          name: `PDF PLATFORM ${checkout.plan} Abonelik`,
          category1: "Subscription",
          itemType: "VIRTUAL",
          price: actualPaidPrice,
        },
      ],
      // Kupon / iskonto bilgisi — webhook_handler.py faturada iskonto satırı için kullanır
      discountPercent: checkout.discountPercent ?? 0,
      originalNetAmount: checkout.originalNetAmount ?? null,
    };

    const resp = await fetch(`${pdfBackendBase}/api/internal/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoicePayload),
      signal: AbortSignal.timeout(90_000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.warn(
        `${PC_LOG} invoice API returned ${resp.status}: ${text.slice(0, 200)}`,
      );
    } else {
      const data = (await resp.json()) as Record<string, unknown>;

      if (data["success"]) {
        console.log(`${PC_LOG} invoice generated`, {
          invoiceId: data["invoice_id"],
          invoiceNumber: data["invoice_number"],
          emailSent: data["email_sent"],
        });
      } else {
        console.warn(`${PC_LOG} invoice generation FAILED`, {
          success: data["success"],
          error: data["error"],
        });
      }

      if (data["success"] && data["invoice_id"]) {
        const kdvR = checkout.kdvRate ?? 20;
        const grossAmt = String(actualPaidPrice);
        const netAmt = checkout.netAmount ?? String(round2(actualPaidPrice / (1 + kdvR / 100)));
        const kdvAmt = checkout.kdvAmount ?? String(round2(actualPaidPrice - parseFloat(netAmt)));
        try {
          await prisma.invoice.upsert({
            where: { checkoutId: checkout.id },
            create: {
              checkoutId: checkout.id,
              userId: checkout.userId,
              externalId: String(data["invoice_id"]),
              invoiceNo: data["invoice_number"] ? String(data["invoice_number"]) : null,
              type: String(data["e_document_type"] ?? "e-arsiv"),
              status: "issued",
              pdfUrl: data["pdf_url"] ? String(data["pdf_url"]) : null,
              netAmount: netAmt,
              kdvRate: kdvR,
              kdvAmount: kdvAmt,
              grossAmount: grossAmt,
              currency: actualCurrency,
              customerName: fullName,
              customerEmail: user.email,
              customerCountry: countryCode,
              customerTaxId: user.taxId ?? null,
              isExport: countryCode !== "TR",
              sentAt: new Date(),
            },
            update: {
              externalId: String(data["invoice_id"]),
              invoiceNo: data["invoice_number"] ? String(data["invoice_number"]) : null,
              status: "issued",
              pdfUrl: data["pdf_url"] ? String(data["pdf_url"]) : null,
              sentAt: new Date(),
            },
          });
          console.log(`${PC_LOG} invoice record saved checkoutId=${checkout.id}`);
        } catch (dbErr) {
          console.error(`${PC_LOG} invoice DB kayıt hatası`, dbErr instanceof Error ? dbErr.message : dbErr);
        }
      }
    }
  } catch (err) {
    console.error(
      `${PC_LOG} triggerInvoiceGeneration error`,
      err instanceof Error ? err.message : err,
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * iyzico Checkout Form callback — posted `token`, then server calls `checkoutForm.retrieve` (NOT `threedsPayment.create`,
 * which is for direct `/payment/3dsecure/*` APIs). On success we grant credits or extend subscription.
 */
export async function processPaymentCallback(
  token: string,
  opts?: ProcessPaymentCallbackOpts,
): Promise<string> {
  console.log(`${PC_LOG} start`, {
    tokenPresent: Boolean(token?.trim()),
    tokenLen: token?.trim()?.length ?? 0,
    keys: opts?.rawCallbackKeys,
    conversationIdFromRedirect: opts?.conversationIdFromRedirect ?? null,
  });

  try {
    if (opts?.rawCallbackKeys?.some((k) => /conversationData/i.test(k))) {
      console.warn(
        `${PC_LOG} body contains conversationData-like field — typical of non–Checkout Form 3DS redirect; CF finalize uses POST token + checkoutForm.retrieve only.`,
      );
    }

    if (!token?.trim()) {
      console.warn(`${PC_LOG} abort: empty token`);
      return paymentWorkspaceRedirectUrl(false);
    }

    if (!env.iyzicoEnabled) {
      console.warn(`${PC_LOG} abort: iyzico not configured`);
      return paymentWorkspaceRedirectUrl(false);
    }

    const iyzipay = getIyzipay();
    const retrieveRequest: Record<string, unknown> = {
      locale: Iyzipay.LOCALE.TR,
      token: token.trim(),
    };
    if (opts?.conversationIdFromRedirect?.trim()) {
      retrieveRequest.conversationId = opts.conversationIdFromRedirect.trim();
    }

    console.log(`${PC_LOG} calling checkoutForm.retrieve`, {
      hasConversationIdInRequest: Boolean(retrieveRequest.conversationId),
    });

    let result: IyzicoRetrieveResult;
    try {
      result = await promisifyRetrieve(iyzipay, retrieveRequest);
    } catch (e) {
      console.error(
        `${PC_LOG} checkoutForm.retrieve threw`,
        e instanceof Error ? e.message : e,
      );
      return paymentWorkspaceRedirectUrl(false);
    }

    const extractedConv = extractConversationIdFromRetrieve(result);
    if (extractedConv) {
      result = { ...result, conversationId: extractedConv };
    }

    console.log(`${PC_LOG} retrieve raw`, {
      status: result.status,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      paymentStatus: result.paymentStatus,
      paymentId: result.paymentId,
      conversationId: result.conversationId,
      fraudStatus: result.fraudStatus,
      paidPrice: result.paidPrice,
      price: result.price,
      currency: result.currency,
      basketId: result.basketId,
      hasSignature: Boolean(result.signature),
      cardCountry: result.cardCountry,
      binNumber: result.binNumber ? `${result.binNumber.slice(0, 3)}***` : undefined,
    });

    // KDV uyum denetimi: TR kart + KDV'siz fatura → compliance uyarısı
    const cardCountryRaw = (result.cardCountry ?? "").toUpperCase().trim();
    const isTurkishCard = cardCountryRaw === "TURKEY" || cardCountryRaw === "TR";
    // (Bu noktada pending henüz yüklenmemiş; loglama callback doğrulandıktan sonra yapılır)

    if (result.status !== "success") {
      console.warn(`${PC_LOG} retrieve status !== success`);
      return paymentWorkspaceRedirectUrl(false);
    }

    try {
      verifyRetrieveSignature(result, env.IYZICO_SECRET_KEY);
      console.log(`${PC_LOG} retrieve signature OK`);
    } catch (verifyErr) {
      console.error(
        `${PC_LOG} retrieve signature verification failed`,
        verifyErr instanceof Error ? verifyErr.message : verifyErr,
      );
      return paymentWorkspaceRedirectUrl(false);
    }

    if (result.paymentStatus !== "SUCCESS") {
      console.warn(
        `${PC_LOG} payment not SUCCESS; paymentStatus=${String(result.paymentStatus)}`,
      );
      return paymentWorkspaceRedirectUrl(false);
    }

    const conversationId = await resolveConversationIdFromToken(token, result);
    if (!conversationId) {
      console.warn(
        `${PC_LOG} missing conversationId on retrieve result (and no DB row matched token hash)`,
      );
      return paymentWorkspaceRedirectUrl(false);
    }
    console.log(`${PC_LOG} conversationId resolved for fulfillment`, {
      conversationId,
    });

    const pending = await prisma.paymentCheckout.findUnique({
      where: { conversationId: String(conversationId) },
    });

    if (!pending) {
      logSuspiciousActivity({
        type: "iyzico_unknown_conversation",
        detail: conversationId,
      });
      console.warn(
        `${PC_LOG} no paymentCheckout for conversationId`,
        conversationId,
      );
      return paymentWorkspaceRedirectUrl(false);
    }

    console.log(`${PC_LOG} matched paymentCheckout (subscription)`, {
      conversationId: pending.conversationId,
      status: pending.status,
      plan: pending.plan,
      userId: pending.userId,
    });

    if (pending.status === "completed") {
      console.log(
        `${PC_LOG} subscription checkout already completed — idempotent success`,
      );
      return paymentWorkspaceRedirectUrl(true, pending.plan, pending.extraSeats, pending.seatsOnly);
    }

    const expectedPrice = pending.priceTry;
    if (
      result.paidPrice != null &&
      !eqIyzicoMoney(result.paidPrice, expectedPrice)
    ) {
      logSuspiciousActivity({
        type: "iyzico_price_mismatch",
        detail: `expected=${expectedPrice} got=${String(result.paidPrice)}`,
      });
      console.warn(`${PC_LOG} subscription price mismatch`);
      return paymentWorkspaceRedirectUrl(false);
    }

    const subscriptionDays = pending.subscriptionDays ?? 30;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + subscriptionDays);

    // Plan limitlerini DB'den veya varsayılanlardan al
    const planLimits = await resolvePlanLimits(pending.plan);

    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.paymentCheckout.findUnique({
          where: { conversationId },
        });
        if (!current || current.status === "completed") {
          return;
        }

        // seatsOnly: sadece koltuk ekleme — kullanıcı planı değişmez, sadece ekip koltuğu güncellenir
        const updatedUser = await tx.user.update({
          where: { id: current.userId },
          data: current.seatsOnly ? {} : { plan: current.plan },
          select: { organizationId: true },
        });

        // Kullanıcının organizasyonunu güncelle (getQuotaSummary org.plan okur)
        const orgId = current.organizationId ?? updatedUser.organizationId;
        if (orgId && !current.seatsOnly) {
          await tx.organization.update({
            where: { id: orgId },
            data: {
              plan: current.plan,
              subscriptionStatus: "active",
              subscriptionExpiry: expiry,
              ...planLimits,
            },
          });
        }

        await tx.paymentCheckout.update({
          where: { conversationId },
          data: {
            status: "completed",
            completedAt: new Date(),
            cardCountry: result.cardCountry ?? null,
            cardBin: result.binNumber ? result.binNumber.slice(0, 6) : null,
            iyzicoPaymentId: result.paymentId ?? null,
            iyzicoPaymentTransactionId: result.paymentItems?.[0]?.paymentTransactionId ?? null,
          },
        });

        // Kupon kullanım kaydı — admin panelinde kullanım sayısını günceller
        if (current.couponId) {
          await tx.couponUse.create({
            data: {
              userId: current.userId,
              couponId: current.couponId,
            },
          });
          // Toplam kullanım sayısı usageLimitPerUser'a ulaştıysa kuponu pasif yap
          const coupon = await tx.coupon.findUnique({
            where: { id: current.couponId },
            select: { usageLimitPerUser: true },
          });
          if (coupon) {
            const totalUses = await tx.couponUse.count({ where: { couponId: current.couponId } });
            if (totalUses >= coupon.usageLimitPerUser) {
              await tx.coupon.update({
                where: { id: current.couponId },
                data: { isActive: false },
              });
              console.log(`${PC_LOG} coupon auto-deactivated couponId=${current.couponId} totalUses=${totalUses}`);
            }
          }
          console.log(`${PC_LOG} coupon use recorded couponId=${current.couponId} userId=${current.userId}`);
        }
      });

      // Auto-create team for new BUSINESS subscribers (idempotent — returns existing if already created).
      if (pending.plan === "BUSINESS") {
        try {
          const owner = await prisma.user.findUnique({
            where: { id: pending.userId },
            select: { firstName: true, lastName: true, email: true },
          });
          const ownerName =
            [owner?.firstName, owner?.lastName].filter(Boolean).join(" ") ||
            owner?.email?.split("@")[0] ||
            "Business";
          const team = await createTeamForOwner(pending.userId, ownerName);
          // Update extraSeats if purchaser requested additional seats
          if ((pending.extraSeats ?? 0) > 0) {
            // seatsOnly: kümülatif güncelleme — yeni toplam = mevcut + satın alınan
            if (pending.seatsOnly) {
              await prisma.team.update({
                where: { id: team.id },
                data: { extraSeats: { increment: pending.extraSeats } },
              });
            } else {
              await prisma.team.update({
                where: { id: team.id },
                data: { extraSeats: pending.extraSeats },
              });
            }
          }
        } catch (teamErr) {
          // Non-fatal: payment succeeded; team creation failure is recoverable.
          console.error(`${PC_LOG} team auto-create failed (non-fatal)`, teamErr instanceof Error ? teamErr.message : teamErr);
        }
      }
    } catch (dbErr) {
      // Payment was verified by iyzico but our DB write failed. Throw so the
      // controller returns HTTP 500 — iyzico will retry the webhook automatically.
      console.error(
        `${PC_LOG} DB fulfillment FAILED for conversationId=${conversationId}; will throw so caller returns 500 for iyzico retry`,
        dbErr instanceof Error ? (dbErr.stack ?? dbErr.message) : dbErr,
      );
      throw new PaymentFulfillmentDbError(dbErr);
    }

    console.log(`${PC_LOG} subscription updated successfully`, { conversationId, plan: pending.plan });

    // KDV uyum denetimi: TR kart + KDV'siz fatura → compliance uyarısı logla
    if (isTurkishCard && (pending.kdvRate === 0 || pending.paymentCurrency !== "TRY")) {
      logSuspiciousActivity({
        type: "vat_compliance_warning",
        detail: JSON.stringify({
          conversationId,
          paymentCurrency: pending.paymentCurrency,
          kdvRate: pending.kdvRate,
          customerCountry: pending.customerCountry,
          cardCountry: result.cardCountry,
          binPrefix: result.binNumber?.slice(0, 6),
          note: "TR kart + KDV muaf fatura — manuel inceleme gerekebilir",
        }),
      });
      console.warn(
        `${PC_LOG} VAT COMPLIANCE WARNING: Turkish card used on non-KDV invoice`,
        { conversationId, cardCountry: result.cardCountry },
      );
    }

    // Fire-and-forget fatura üretimi — abonelik aktivasyonunu asla engellemez
    void triggerInvoiceGeneration(pending, result).catch((err) => {
      console.error(
        `${PC_LOG} invoice trigger başarısız (kritik değil)`,
        err instanceof Error ? err.message : err,
      );
    });

    return paymentWorkspaceRedirectUrl(true, pending.plan, pending.extraSeats, pending.seatsOnly);
  } catch (unexpected) {
    // Re-throw DB fulfillment errors — the controller must return 500 for these.
    if (unexpected instanceof PaymentFulfillmentDbError) {
      throw unexpected;
    }
    console.error(
      `${PC_LOG} unexpected error`,
      unexpected instanceof Error
        ? (unexpected.stack ?? unexpected.message)
        : unexpected,
    );
    return paymentWorkspaceRedirectUrl(false);
  }
}

// ─── Refund ───────────────────────────────────────────────────────────────────

const REFUND_LOG = "[iyzico/refund]";
const IYZICO_REFUND_LOG = "[iyzico/issueRefund]";

const REFUND_COOLING_DAYS = 30;
const REFUND_MAX_PER_YEAR = 2;

export type RefundAbuseCheck =
  | { allowed: true; requiresAdminReview: boolean }
  | { allowed: false; reason: "cooling_period" | "refund_limit_exceeded" };

export async function checkRefundAbuse(userId: string): Promise<RefundAbuseCheck> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalRefunds: true, lastRefundedAt: true },
  });
  if (!user) return { allowed: false, reason: "refund_limit_exceeded" };

  // İlk iade her zaman onaylanır
  if (user.totalRefunds === 0) {
    return { allowed: true, requiresAdminReview: false };
  }

  // 30 günlük soğuma süresi (2. iade ve sonrası)
  if (user.lastRefundedAt) {
    const coolMs = REFUND_COOLING_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - user.lastRefundedAt.getTime() < coolMs) {
      return { allowed: false, reason: "cooling_period" };
    }
  }

  // 12 ay içindeki iade sayısı
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const refundCount12m = await prisma.paymentCheckout.count({
    where: { userId, status: "refunded", refundedAt: { gte: oneYearAgo } },
  });

  if (refundCount12m >= REFUND_MAX_PER_YEAR) {
    return { allowed: false, reason: "refund_limit_exceeded" };
  }

  return { allowed: true, requiresAdminReview: refundCount12m >= 1 };
}

export async function issueIyzicoRefund(
  checkout: {
    conversationId: string;
    iyzicoPaymentId?: string | null;
    iyzicoPaymentTransactionId?: string | null;
    priceTry: string;
    completedAt?: Date | null;
    createdAt: Date;
  },
  clientIp = "127.0.0.1",
): Promise<{ ok: boolean; requiresManualReview?: boolean; error?: string }> {
  // Legacy ödeme: iyzicoPaymentId kaydedilmemiş → iyzico çağrısı yapılamaz
  if (!checkout.iyzicoPaymentId) {
    console.warn(
      `${IYZICO_REFUND_LOG} iyzicoPaymentId eksik — manüel iade gerekiyor conversationId=${checkout.conversationId}`,
    );
    return { ok: true, requiresManualReview: true };
  }

  if (!env.iyzicoEnabled) {
    return { ok: false, error: "iyzico_not_configured" };
  }

  const iyzipay = getIyzipay();
  const refundConversationId = randomUUID();
  const safeIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(clientIp ?? "") ? clientIp : "127.0.0.1";

  // Aynı takvim günü → cancel (anlık), farklı gün → refund
  const completedAt = checkout.completedAt ?? checkout.createdAt;
  const now = new Date();
  const isToday =
    completedAt.getFullYear() === now.getFullYear() &&
    completedAt.getMonth() === now.getMonth() &&
    completedAt.getDate() === now.getDate();

  if (isToday) {
    try {
      const cancelResult = await promisifyCancel(iyzipay, {
        locale: Iyzipay.LOCALE.TR,
        conversationId: refundConversationId,
        paymentId: checkout.iyzicoPaymentId,
        ip: safeIp,
      });
      console.log(`${IYZICO_REFUND_LOG} cancel sonucu`, {
        status: cancelResult.status,
        errorCode: cancelResult.errorCode,
        errorMessage: cancelResult.errorMessage,
      });
      if (cancelResult.status === "success") return { ok: true };
      console.warn(`${IYZICO_REFUND_LOG} cancel başarısız, refund deneniyor`, { errorCode: cancelResult.errorCode });
    } catch (cancelErr) {
      console.warn(`${IYZICO_REFUND_LOG} cancel hata fırlattı, refund deneniyor`, cancelErr instanceof Error ? cancelErr.message : String(cancelErr));
    }
  }

  if (!checkout.iyzicoPaymentTransactionId) {
    console.warn(
      `${IYZICO_REFUND_LOG} iyzicoPaymentTransactionId eksik — manüel iade gerekiyor conversationId=${checkout.conversationId}`,
    );
    return { ok: true, requiresManualReview: true };
  }

  try {
    const refundResult = await promisifyRefund(iyzipay, {
      locale: Iyzipay.LOCALE.TR,
      conversationId: refundConversationId,
      paymentTransactionId: checkout.iyzicoPaymentTransactionId,
      price: checkout.priceTry,
      currency: Iyzipay.CURRENCY.TRY,
      ip: safeIp,
    });
    console.log(`${IYZICO_REFUND_LOG} refund sonucu`, {
      status: refundResult.status,
      errorCode: refundResult.errorCode,
      errorMessage: refundResult.errorMessage,
    });
    if (refundResult.status === "success") return { ok: true };
    return { ok: false, error: refundResult.errorMessage ?? refundResult.errorCode ?? "iyzico_refund_failed" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${IYZICO_REFUND_LOG} refund hata fırlattı`, msg);
    return { ok: false, error: msg };
  }
}

/** Satın alımdan itibaren kaç gün içinde tam iade hakkı vardır. */
export const REFUND_WINDOW_DAYS = 7;

export type RefundResult =
  | { ok: true; conversationId: string; userId: string; planBefore: string }
  | { ok: false; reason: "not_found" | "already_refunded" | "window_expired" | "not_completed" };

/**
 * Hem admin manuel iadesi hem de iyzico webhook bildirimi için ortak iade mantığı.
 * - 7 günlük pencere kontrolü yapar.
 * - Kullanıcı planını FREE'ye düşürür.
 * - PaymentCheckout.status'u "refunded" yapar.
 * - subscriptionExpiry'yi null'a çeker (org varsa da).
 */
export async function processRefund(
  conversationId: string,
  reason: string,
): Promise<RefundResult> {
  const checkout = await prisma.paymentCheckout.findUnique({
    where: { conversationId },
  });

  if (!checkout) {
    console.warn(`${REFUND_LOG} conversationId not found`, { conversationId });
    return { ok: false, reason: "not_found" };
  }

  if (checkout.status === "refunded" || checkout.refundedAt) {
    console.log(`${REFUND_LOG} already refunded — idempotent skip`, { conversationId });
    return { ok: false, reason: "already_refunded" };
  }

  if (checkout.status !== "completed") {
    console.warn(`${REFUND_LOG} checkout not completed, status=${checkout.status}`, { conversationId });
    return { ok: false, reason: "not_completed" };
  }

  // 7 günlük iade penceresi kontrolü
  const completedAt = checkout.completedAt ?? checkout.createdAt;
  const windowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const ageMs = Date.now() - completedAt.getTime();
  if (ageMs > windowMs) {
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    console.warn(`${REFUND_LOG} refund window expired`, { conversationId, ageDays, windowDays: REFUND_WINDOW_DAYS });
    return { ok: false, reason: "window_expired" };
  }

  const planBefore = checkout.plan;

  await prisma.$transaction(async (tx) => {
    // Checkout kaydını güncelle
    await tx.paymentCheckout.update({
      where: { conversationId },
      data: {
        status: "refunded",
        refundedAt: new Date(),
        refundReason: reason.slice(0, 500),
      },
    });

    // Kullanıcı planını FREE'ye düşür; iade sayacını güncelle
    await tx.user.update({
      where: { id: checkout.userId },
      data: {
        plan: "FREE",
        totalRefunds: { increment: 1 },
        lastRefundedAt: new Date(),
      },
    });

    // Organizasyon varsa org planını da düşür ve subscription'ı sona erdir
    if (checkout.organizationId) {
      await tx.organization.update({
        where: { id: checkout.organizationId },
        data: {
          plan: "FREE",
          subscriptionStatus: "canceled",
          subscriptionExpiry: null,
        },
      });
    }
  });

  console.log(`${REFUND_LOG} refund processed`, {
    conversationId,
    userId: checkout.userId,
    planBefore,
    reason,
  });

  // İade faturası — arka planda tetikle, abonelik akışını bloke etme
  void triggerCreditNote(checkout.id, checkout.userId, reason).catch((err) => {
    console.error(`${REFUND_LOG} triggerCreditNote error`, err instanceof Error ? err.message : err);
  });

  return { ok: true, conversationId, userId: checkout.userId, planBefore };
}

// ---------------------------------------------------------------------------
// triggerCreditNote — iade faturası oluşturur (Paraşüt)
// ---------------------------------------------------------------------------

async function triggerCreditNote(
  checkoutId: string,
  userId: string,
  reason: string,
): Promise<void> {
  // Orijinal fatura kaydını çek
  const invoice = await prisma.invoice.findUnique({
    where: { checkoutId },
  });

  if (!invoice?.externalId) {
    console.warn(`${REFUND_LOG} credit-note: orijinal fatura bulunamadı checkoutId=${checkoutId}`);
    return;
  }

  // Kullanıcı + fatura bilgilerini çek
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true, lastName: true, name: true, email: true, phone: true,
      billingAddressLine: true, city: true, billingCountryCode: true,
      tcKimlikNo: true, taxId: true, taxOffice: true,
      companyName: true, invoiceType: true,
    },
  });

  if (!user) return;

  const { name, surname } = splitBuyerName(user as Parameters<typeof splitBuyerName>[0]);
  const fullName = user.companyName ? user.companyName : `${name} ${surname}`.trim();

  let nationalId: string | null = null;
  if (user.tcKimlikNo) {
    try {
      const { decryptField } = await import("../../lib/encryption.js");
      nationalId = decryptField(user.tcKimlikNo);
    } catch {
      nationalId = null;
    }
  }

  const isCorprate = user.invoiceType === "corporate";

  // Checkout'tan plan adı ve iskonto bilgisini al
  const checkout = await prisma.paymentCheckout.findUnique({
    where: { id: checkoutId },
    select: { plan: true, discountPercent: true, originalNetAmount: true, billingCycle: true },
  });

  const planLabel = checkout?.plan ?? "PRO";
  const billingLabel = checkout?.billingCycle === "YEARLY" ? "(1 yıl)" : "(1 ay)";
  const productName = `PDF Platform ${planLabel} Abonelik ${billingLabel} İadesi`;

  const paidPrice  = parseFloat(invoice.grossAmount);
  // kdvRate: eski kayıtlarda sütun migration ile 0.0 set edilmiş olabilir.
  // ?? operatörü 0'ı geçmez — yurt içi faturada 0 gelirse 20 kullan.
  const kdvRate = invoice.kdvRate > 0
    ? invoice.kdvRate
    : (invoice.isExport ? 0 : 20);
  const netAmount  = parseFloat(invoice.netAmount) || round2(paidPrice / (1 + kdvRate / 100));
  const kdvAmount  = parseFloat(invoice.kdvAmount) || round2(paidPrice - netAmount);

  const creditNotePayload = {
    originalInvoiceId: invoice.externalId,
    originalInvoiceEttn: invoice.externalId,    // BillingReference UUID
    originalInvoiceNo: invoice.invoiceNo ?? "",
    originalInvoiceDate: invoice.sentAt
      ? invoice.sentAt.toISOString().split("T")[0]
      : invoice.createdAt.toISOString().split("T")[0],
    paymentId: checkoutId,
    reason,
    buyer: {
      name,
      surname,
      email: user.email,
      gsmNumber: user.phone ?? "",
      identityNumber: nationalId ?? "",
      registrationAddress: user.billingAddressLine ?? "",
      city: user.city ?? "",
      country: invoice.customerCountry === "TR" ? "Turkey" : (invoice.customerCountry ?? "Turkey"),
      invoiceType: user.invoiceType ?? "individual",
      taxId: user.taxId ?? "",
      taxOffice: user.taxOffice ?? "",
    },
    basketItems: [
      {
        name: productName,
        netAmount,           // KDV hariç net tutar (iskonto sonrası)
        kdvAmount,           // KDV tutarı
        grossAmount: paidPrice,
      },
    ],
    paidPrice,
    currency: invoice.currency ?? "TRY",
    kdvRate,
    discountPercent: checkout?.discountPercent ?? 0,
    originalNetAmount: checkout?.originalNetAmount ?? null,
  };

  const pdfBackendBase = process.env.PDF_BACKEND_URL ?? "http://127.0.0.1:8000";

  try {
    const resp = await fetch(`${pdfBackendBase}/api/internal/credit-note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creditNotePayload),
      signal: AbortSignal.timeout(60_000),
    });

    const data = (await resp.json()) as Record<string, unknown>;
    console.log(`${REFUND_LOG} credit-note result`, {
      success: data["success"],
      creditNoteId: data["creditNoteId"],
      creditNoteNo: data["creditNoteNo"],
    });

    if (data["success"]) {
      await prisma.invoice.update({
        where: { checkoutId },
        data: {
          creditNoteId: String(data["creditNoteId"] ?? ""),
          creditNoteStatus: "issued",
          creditNoteIssuedAt: new Date(),
        },
      });
    } else {
      await prisma.invoice.update({
        where: { checkoutId },
        data: { creditNoteStatus: "failed" },
      });
    }
  } catch (err) {
    console.error(`${REFUND_LOG} credit-note fetch error`, err instanceof Error ? err.message : err);
    await prisma.invoice.update({
      where: { checkoutId },
      data: { creditNoteStatus: "failed" },
    }).catch(() => {});
  }
}

/**
 * iyzico'dan gelen iade webhook bildirimi.
 * iyzico, iade onayı geldiğinde conversationId + paymentId içeren POST gönderir.
 */
export async function processIyzicoRefundWebhook(body: Record<string, unknown>): Promise<void> {
  const conversationId =
    (typeof body.conversationId === "string" ? body.conversationId : null) ??
    (typeof body.paymentConversationId === "string" ? body.paymentConversationId : null) ??
    (typeof body.refundConversationId === "string" ? body.refundConversationId : null);

  const paymentId = typeof body.paymentId === "string" ? body.paymentId : null;

  console.log(`${REFUND_LOG} webhook received`, { conversationId, paymentId, bodyKeys: Object.keys(body) });

  if (!conversationId) {
    // conversationId yoksa paymentId ile arama yap
    if (paymentId) {
      console.warn(`${REFUND_LOG} no conversationId in webhook; paymentId lookup not implemented — manual review needed`, { paymentId });
    } else {
      console.warn(`${REFUND_LOG} webhook missing conversationId and paymentId — ignoring`);
    }
    return;
  }

  const result = await processRefund(conversationId, "iyzico_refund_webhook");
  if (!result.ok) {
    console.warn(`${REFUND_LOG} webhook refund skipped`, { conversationId, reason: result.reason });
  }
}
