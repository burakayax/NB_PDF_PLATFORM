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
  };
  LOCALE: { TR: string; EN: string };
  CURRENCY: { TRY: string; USD: string; EUR: string };
  PAYMENT_GROUP: { PRODUCT: string };
  BASKET_ITEM_TYPE: { VIRTUAL: string };
};

const Iyzipay = IyzipayImport as unknown as IyzipayCtor;

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

export async function createPaymentCheckoutSession(params: {
  userId: string;
  plan: "STARTER" | "PLUS" | "PRO" | "BUSINESS";
  billing: "monthly" | "annual";
  clientIp: string;
  /** Override list + paid price string (two decimals) in `checkoutCurrency` when tier pricing applies. */
  priceTryOverride?: string;
  /** When `priceTryOverride` is set (matrix / tier); admin DB prices remain TRY. */
  checkoutCurrency?: CheckoutCurrency;
  subscriptionDaysOverride?: number;
  /** Cart line label on iyzico basket. */
  basketItemName?: string;
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
  const price = normalizeCheckoutPrice(rawFromCatalog);
  const settlementCurrency: CheckoutCurrency =
    params.priceTryOverride != null
      ? (params.checkoutCurrency ?? "TRY")
      : "TRY";
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
      priceTry: price,
      paymentCurrency: settlementCurrency,
      subscriptionDays,
    },
  });

  const iyzipay = getIyzipay();
  const buyerId = user.id.slice(0, 20);

  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId,
    price,
    paidPrice: price,
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
        name:
          params.basketItemName ??
          (params.plan === "BUSINESS"
            ? "PDF PLATFORM Bas (1 ay)"
            : params.plan === "PLUS"
              ? "PDF PLATFORM Plus (1 ay)"
              : isAnnualPro
                ? "PDF PLATFORM PRO (1 yıl)"
                : "PDF PLATFORM PRO (1 ay)"),
        category1: "Subscription",
        category2: "Software",
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price,
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
export function paymentWorkspaceRedirectUrl(success: boolean, plan?: string): string {
  const origin = env.FRONTEND_ORIGIN.replace(/\/+$/, "");
  const params = new URLSearchParams({ payment: success ? "success" : "failed" });
  if (success && plan) {
    params.set("plan", plan);
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

    try {
      console.log(
        "[DEBUG] Full Iyzico Retrieve Response:",
        JSON.stringify(result),
      );
    } catch {
      console.log(
        "[DEBUG] Full Iyzico Retrieve Response: (stringify failed)",
        result,
      );
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
    });

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
      return paymentWorkspaceRedirectUrl(true, pending.plan);
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

    await prisma.$transaction(async (tx) => {
      const current = await tx.paymentCheckout.findUnique({
        where: { conversationId },
      });
      if (!current || current.status === "completed") {
        return;
      }

      await tx.user.update({
        where: { id: current.userId },
        data: { plan: current.plan },
      });
      if (current.organizationId) {
        await tx.organization.update({
          where: { id: current.organizationId },
          data: {
            plan: current.plan,
            subscriptionStatus: "active",
            subscriptionExpiry: expiry,
          },
        });
      }

      await tx.paymentCheckout.update({
        where: { conversationId },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      });
    });

    console.log(`${PC_LOG} subscription updated; done`);
    return paymentWorkspaceRedirectUrl(true, pending.plan);
  } catch (unexpected) {
    console.error(
      `${PC_LOG} unexpected error`,
      unexpected instanceof Error
        ? (unexpected.stack ?? unexpected.message)
        : unexpected,
    );
    return paymentWorkspaceRedirectUrl(false);
  }
}
