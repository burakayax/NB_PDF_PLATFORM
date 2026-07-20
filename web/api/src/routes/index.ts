import { Router } from "express";
import { accessRouter } from "../modules/access/access.routes.js";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { analyticsRouter } from "../modules/analytics/analytics.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { contactRouter } from "../modules/contact/contact.routes.js";
import { deviceRouter } from "../modules/device/device.routes.js";
import { entitlementRouter } from "../modules/entitlement/entitlement.routes.js";
import { licenseRouter } from "../modules/license/license.routes.js";
import { monitoringRouter } from "../modules/monitoring/monitoring.routes.js";
import { env } from "../config/env.js";
import { paymentsDisabledRouter } from "../modules/payment/no-op.routes.js";
import { paymentRouter } from "../modules/payment/payment.routes.js";
import { paymentsRouter } from "../modules/payment/payments.routes.js";
import { publicRouter } from "../modules/public/public.routes.js";
import { subscriptionRouter } from "../modules/subscription/subscription.routes.js";
import { userRouter } from "../modules/user/user.routes.js";
import orgRouter from "../modules/organization/organization.routes.js";
import billingRouter from "../modules/billing/billing.routes.js";
import teamRouter from "../modules/team/team.controller.js";
import { creditCheckoutRouter } from "../modules/credit-checkout/credit-checkout.routes.js";
import { aiRouter } from "../modules/ai/ai.routes.js";
import { apiKeysRouter } from "../modules/api-keys/api-keys.routes.js";
import { emailRouter } from "../modules/email/email.routes.js";
import { prisma } from "../lib/prisma.js";
import {
  abuseBlockMiddleware,
  globalApiLimiter,
  requireJwtUnlessPublic,
} from "../middleware/api-security.middleware.js";

export const apiRouter = Router();

// Sıra: kötüye kullanım bloku → dakikalık sınır → JWT (public istisnaları hariç).
apiRouter.use(abuseBlockMiddleware);
apiRouter.use(globalApiLimiter);
apiRouter.use(requireJwtUnlessPublic);

// Kimlik doğrulama ve ödeme endpoint'lerinin tarayıcı tarafından cache'lenmesini engelle.
apiRouter.use((req, res, next) => {
  const p = req.path;
  if (p.startsWith("/auth") || p.startsWith("/payment") || p.startsWith("/user") || p.startsWith("/admin")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
  }
  next();
});

// Liveness — DB'ye DOKUNMAZ. Render'ın deploy health check'i (healthCheckPath)
// bunu kullanır; DB anlık yavaşlasa bile deploy'lar/uygulama canlılığı etkilenmez.
apiRouter.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "nb-pdf-TOOLS-auth-api",
  });
});

// Readiness — DB'ye hafif `SELECT 1` atar. DB koparsa 503 döner ki dış izleme
// (UptimeRobot) DB kesintisini de yakalasın. Express GET rotası HEAD'e de yanıt
// verir → ücretsiz HEAD monitörü çalışır. Timeout ile hızlı 503 (asla asılı kalmaz).
apiRouter.get("/health/db", async (_request, response) => {
  const DB_PING_TIMEOUT_MS = 5000;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("db_ping_timeout")), DB_PING_TIMEOUT_MS),
      ),
    ]);
    response.json({ status: "ok", service: "nb-pdf-TOOLS-auth-api", db: "up" });
  } catch {
    response.status(503).json({ status: "error", service: "nb-pdf-TOOLS-auth-api", db: "down" });
  }
});

// ⚠️ GEÇİCİ — Sentry doğrulama ucu. Sadece dogru anahtarla kasitli hata firlatir
// (Sentry.setupExpressErrorHandler bunu yakalayip Sentry'ye gonderir). Bot gurultusunu
// onlemek icin anahtar sart. DOGRULAMADAN SONRA BU BLOK SILINECEK.
apiRouter.get("/health/sentry-test", (request, response) => {
  if (request.query.key === "nb-sentry-check-2607") {
    throw new Error(`Sentry dogrulama testi (gecici uc) — ${new Date().toISOString()}`);
  }
  response.json({ status: "ok", note: "sentry-test gecici uc; anahtar gerekli" });
});

apiRouter.use("/public", publicRouter);
apiRouter.use("/access", accessRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/contact", contactRouter);
apiRouter.use("/email", emailRouter);
apiRouter.use("/device", deviceRouter);
apiRouter.use("/entitlement", entitlementRouter);
apiRouter.use("/errors", monitoringRouter);
// Payments: iyzico rotaları her zaman mount edilir.
// Anahtarlar eksikse 503, service katmanında (payment.service.ts) döner — route
// varlığını key availability'den ayırıyoruz ki webhook endpoint'leri de erişilebilir kalsın.
apiRouter.use("/payment", paymentRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/license", licenseRouter);
apiRouter.use("/subscription", subscriptionRouter);
apiRouter.use("/user", userRouter);
apiRouter.use("/org", orgRouter);
apiRouter.use("/billing", billingRouter);
apiRouter.use("/team", teamRouter);
apiRouter.use("/credit-checkout", creditCheckoutRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/api-keys", apiKeysRouter);
