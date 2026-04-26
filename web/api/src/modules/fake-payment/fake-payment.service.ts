import { randomBytes } from "node:crypto";

import { logFakePaymentEvent } from "../../lib/app-logger.js";
import { prisma } from "../../lib/prisma.js";
import { recordCreditPackPurchaseMeta } from "../credit-checkout/credit-checkout.post-purchase.js";
import { CREDIT_PACK_CATALOG, isCreditPackSku } from "../credit-checkout/credit-pack-pricing.js";
import type { CreditPricingPayload } from "../credit-checkout/pricing-token.js";
import { grantCredits } from "../subscription/entitlement.engine.js";
import type { FakePaymentProduct } from "./fake-payment.schema.js";

/**
 * Fake payment — in-memory sessions only; confirm drives the real economy
 * through `grantCredits` and optional `User.plan` / subscription updates.
 */

const PLAN_CATALOG: Record<
  FakePaymentProduct,
  {
    amountTry: number;
    credits: number;
    subscriptionDays: number;
    updatesSubscription: boolean;
  }
> = {
  PRO: { amountTry: 99, credits: 100, subscriptionDays: 30, updatesSubscription: true },
  BUSINESS: { amountTry: 299, credits: 500, subscriptionDays: 30, updatesSubscription: true },
  CREDITS_50: { amountTry: 29, credits: 50, subscriptionDays: 0, updatesSubscription: false },
  CREDITS_100: { amountTry: 49, credits: 100, subscriptionDays: 0, updatesSubscription: false },
  CREDITS_120: { amountTry: 59, credits: 120, subscriptionDays: 0, updatesSubscription: false },
  CREDITS_300: { amountTry: 129, credits: 300, subscriptionDays: 0, updatesSubscription: false },
};

const SESSION_TTL_MS = 30 * 60 * 1000;

type FakePaymentSession = {
  sessionId: string;
  userId: string;
  product: FakePaymentProduct;
  amountTry: number;
  credits: number;
  subscriptionDays: number;
  updatesSubscription: boolean;
  createdAt: number;
  confirmedAt: number | null;
  /** Fiyat + kupon doğrulaması imzalı akışta dolar. */
  creditPackMeta?: { couponId: string | null; exitIntentApplied: boolean };
};

const sessions = new Map<string, FakePaymentSession>();

function pruneExpired(now: number): void {
  for (const [id, session] of sessions) {
    if (session.confirmedAt !== null) {
      continue;
    }
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

function newSessionId(): string {
  return `cs_fake_${randomBytes(12).toString("hex")}`;
}

export type FakeCheckoutResult = {
  sessionId: string;
  amount: number;
  credits: number;
  redirectUrl: string;
};

export function createFakeCheckoutSession(params: {
  userId: string;
  product: FakePaymentProduct;
}): FakeCheckoutResult {
  const now = Date.now();
  pruneExpired(now);

  const catalog = PLAN_CATALOG[params.product];
  const sessionId = newSessionId();
  const session: FakePaymentSession = {
    sessionId,
    userId: params.userId,
    product: params.product,
    amountTry: catalog.amountTry,
    credits: catalog.credits,
    subscriptionDays: catalog.subscriptionDays,
    updatesSubscription: catalog.updatesSubscription,
    createdAt: now,
    confirmedAt: null,
  };
  sessions.set(sessionId, session);

  const redirectUrl = `/fake-payment/success?sessionId=${encodeURIComponent(sessionId)}`;

  logFakePaymentEvent({
    event: "checkout_created",
    sessionId,
    userId: params.userId,
    product: params.product,
    amount: catalog.amountTry,
    credits: catalog.credits,
  });

  return {
    sessionId,
    amount: catalog.amountTry,
    credits: catalog.credits,
    redirectUrl,
  };
}

/**
 * Kredi paketi: imzalı fiyat; kupon/çıkış niyeti onayda `recordCreditPackPurchaseMeta` ile kapanır.
 */
export function createPricedCreditPackFakeSession(params: {
  userId: string;
  payload: CreditPricingPayload;
}): FakeCheckoutResult {
  const p = params.payload;
  if (!isCreditPackSku(p.product)) {
    throw new Error("createPricedCreditPackFakeSession: invalid product");
  }
  const cat = CREDIT_PACK_CATALOG[p.product];
  if (cat.credits !== p.credits || p.basePrice !== cat.amountTry.toFixed(2)) {
    throw new Error("createPricedCreditPackFakeSession: price/credits mismatch");
  }
  const now = Date.now();
  pruneExpired(now);
  const sessionId = newSessionId();
  const amountTry = Number.parseFloat(p.finalPrice);
  const session: FakePaymentSession = {
    sessionId,
    userId: params.userId,
    product: p.product,
    amountTry,
    credits: p.credits,
    subscriptionDays: 0,
    updatesSubscription: false,
    createdAt: now,
    confirmedAt: null,
    creditPackMeta: { couponId: p.couponId, exitIntentApplied: p.exitIntent },
  };
  sessions.set(sessionId, session);
  const redirectUrl = `/fake-payment/success?sessionId=${encodeURIComponent(sessionId)}`;
  logFakePaymentEvent({
    event: "checkout_created",
    sessionId,
    userId: params.userId,
    product: p.product,
    amount: amountTry,
    credits: p.credits,
  });
  return { sessionId, amount: amountTry, credits: p.credits, redirectUrl };
}

export type FakeConfirmResult =
  | {
      status: "confirmed";
      sessionId: string;
      product: FakePaymentProduct;
      creditsGranted: number;
      creditsBefore: number;
      creditsAfter: number;
      transactionId: string;
      subscriptionExpiry: string | null;
    }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "forbidden" }
  | { status: "already_confirmed"; sessionId: string; product: FakePaymentProduct };

export async function confirmFakePayment(params: {
  userId: string;
  sessionId: string;
}): Promise<FakeConfirmResult> {
  const now = Date.now();
  pruneExpired(now);

  const session = sessions.get(params.sessionId);
  if (!session) {
    return { status: "not_found" };
  }
  if (session.userId !== params.userId) {
    return { status: "forbidden" };
  }
  if (session.confirmedAt !== null) {
    return {
      status: "already_confirmed",
      sessionId: session.sessionId,
      product: session.product,
    };
  }
  if (now - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(session.sessionId);
    return { status: "expired" };
  }

  const grant = await grantCredits(session.userId, session.credits, "bonus");

  let subscriptionExpiryIso: string | null = null;

  if (session.updatesSubscription) {
    const expiry = new Date(now + session.subscriptionDays * 24 * 60 * 60 * 1000);
    subscriptionExpiryIso = expiry.toISOString();
    const dbPlan = session.product === "PRO" ? "PRO" : "BUSINESS";
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        plan: dbPlan,
        subscription_status: "active",
        subscriptionExpiry: expiry,
      },
    });
  }

  if (session.creditPackMeta) {
    await recordCreditPackPurchaseMeta({
      userId: session.userId,
      couponId: session.creditPackMeta.couponId,
      exitIntentApplied: session.creditPackMeta.exitIntentApplied,
    });
  }

  session.confirmedAt = now;

  logFakePaymentEvent({
    event: "payment_confirmed",
    sessionId: session.sessionId,
    userId: session.userId,
    product: session.product,
    creditsGranted: session.credits,
    transactionId: grant.transactionId,
  });

  return {
    status: "confirmed",
    sessionId: session.sessionId,
    product: session.product,
    creditsGranted: session.credits,
    creditsBefore: grant.creditsBefore,
    creditsAfter: grant.creditsAfter,
    transactionId: grant.transactionId,
    subscriptionExpiry: subscriptionExpiryIso,
  };
}
