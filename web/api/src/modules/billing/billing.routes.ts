import { Router } from "express";
import express from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../lib/rbac.js";
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  handleStripeWebhook,
} from "./billing.service.js";

const router = Router();

// POST /api/billing/checkout
router.post("/checkout", requireAuth(), requirePermission("manage_billing"), async (req, res) => {
  try {
    const user = (req as any).authUser;
    const { plan, billingCycle = "MONTHLY", currency = "TRY" } = req.body;

    if (!plan) {
      res.status(400).json({ error: "plan required" });
      return;
    }

    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

    const session = await createStripeCheckoutSession(
      user.organizationId,
      user.id,
      plan,
      billingCycle,
      currency,
      frontendOrigin,
    );

    res.json({ url: session.url, sessionId: session.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/billing/portal
router.post("/portal", requireAuth(), requirePermission("manage_billing"), async (req, res) => {
  try {
    const user = (req as any).authUser;
    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
    const session = await createStripePortalSession(user.organizationId, frontendOrigin);
    res.json({ url: session.url });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/billing/webhook — raw body required for Stripe signature verification
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"] as string;
      const result = await handleStripeWebhook(req.body as Buffer, sig);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },
);

// GET /api/billing/info — kayıtlı fatura bilgilerini getir
router.get("/info", requireAuth(), async (req, res) => {
  try {
    const user = (req as any).authUser;
    const { getBillingInfo } = await import("./billing-info.service.js");
    const info = await getBillingInfo(user.id);
    res.json(info);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/billing/info — fatura bilgilerini kaydet
router.post("/info", requireAuth(), async (req, res) => {
  try {
    const user = (req as any).authUser;
    const { saveBillingInfo } = await import("./billing-info.service.js");
    await saveBillingInfo(user.id, req.body);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
