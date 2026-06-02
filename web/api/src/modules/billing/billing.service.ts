import type { Plan, BillingCycle, Currency } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { applyPlanLimitsToOrg } from "../organization/organization.service.js";

// Stripe price IDs from environment
const STRIPE_PRICES: Record<string, Record<string, string>> = {
  PLUS: {
    MONTHLY_TRY: process.env.STRIPE_PRICE_PLUS_MONTHLY_TRY ?? "",
    MONTHLY_USD: process.env.STRIPE_PRICE_PLUS_MONTHLY_USD ?? "",
  },
  PRO: {
    YEARLY_TRY: process.env.STRIPE_PRICE_PRO_YEARLY_TRY ?? "",
    YEARLY_USD: process.env.STRIPE_PRICE_PRO_YEARLY_USD ?? "",
  },
  BUSINESS: {
    MONTHLY_TRY: process.env.STRIPE_PRICE_BUSINESS_MONTHLY_TRY ?? "",
    MONTHLY_USD: process.env.STRIPE_PRICE_BUSINESS_MONTHLY_USD ?? "",
    YEARLY_TRY: process.env.STRIPE_PRICE_BUSINESS_YEARLY_TRY ?? "",
    YEARLY_USD: process.env.STRIPE_PRICE_BUSINESS_YEARLY_USD ?? "",
  },
};

function getStripePrice(plan: Plan, cycle: BillingCycle, currency: Currency): string {
  const planPrices = STRIPE_PRICES[plan];
  if (!planPrices) throw new Error(`No Stripe prices for plan: ${plan}`);

  const key = `${cycle}_${currency}`;
  const priceId = planPrices[key];
  if (!priceId) throw new Error(`No Stripe price ID for ${plan}/${cycle}/${currency}`);
  return priceId;
}

export async function createStripeCheckoutSession(
  orgId: string,
  userId: string,
  plan: Plan,
  billingCycle: BillingCycle,
  currency: Currency,
  frontendOrigin: string,
) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }

  // Dynamic import to avoid hard dep when Stripe not configured
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" });

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organization not found");

  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const customer = await stripe.customers.create({
      email: user?.email,
      name: org.name,
      metadata: { organizationId: orgId, userId },
    });
    customerId = customer.id;
    await prisma.organization.update({
      where: { id: orgId },
      data: { stripeCustomerId: customerId },
    });
  }

  const priceId = getStripePrice(plan, billingCycle, currency);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${frontendOrigin}/dashboard?billing=success`,
    cancel_url: `${frontendOrigin}/pricing?billing=cancelled`,
    metadata: {
      organizationId: orgId,
      userId,
      plan,
      billingCycle,
      currency,
    },
    subscription_data: {
      metadata: { organizationId: orgId, plan, billingCycle },
    },
  });

  return session;
}

export async function createStripePortalSession(
  orgId: string,
  frontendOrigin: string,
) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) throw new Error("Stripe is not configured.");

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" });

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org?.stripeCustomerId) {
    throw new Error("No Stripe customer linked to this organization.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${frontendOrigin}/dashboard`,
  });

  return session;
}

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string,
) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecretKey || !webhookSecret) {
    throw new Error("Stripe not configured");
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" });

  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new Error("Invalid Stripe signature");
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as import("stripe").Stripe.Checkout.Session;
      const { organizationId, plan, billingCycle } = session.metadata ?? {};

      if (organizationId && plan) {
        await applyPlanLimitsToOrg(organizationId, plan as Plan);
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            stripeSubscriptionId: session.subscription as string,
            billingCycle: (billingCycle ?? "MONTHLY") as BillingCycle,
            subscriptionStatus: "active",
            subscriptionExpiry: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
          },
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as import("stripe").Stripe.Invoice;
      const subscription = await stripe.subscriptions.retrieve(
        invoice.subscription as string,
      );
      const orgId = subscription.metadata?.organizationId;
      if (orgId) {
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            subscriptionStatus: "active",
            currentMonthOperations: 0,
            lastMonthlyReset: new Date(),
            subscriptionExpiry: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as import("stripe").Stripe.Subscription;
      const orgId = sub.metadata?.organizationId;
      if (orgId) {
        await applyPlanLimitsToOrg(orgId, "FREE");
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            subscriptionStatus: "canceled",
            stripeSubscriptionId: null,
            subscriptionExpiry: null,
          },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as import("stripe").Stripe.Subscription;
      const orgId = sub.metadata?.organizationId;
      const newPlan = sub.metadata?.plan as Plan | undefined;
      if (orgId && newPlan) {
        await applyPlanLimitsToOrg(orgId, newPlan);
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            subscriptionStatus:
              sub.status === "active" ? "active" : "past_due",
          },
        });
      }
      break;
    }
  }

  return { received: true };
}
