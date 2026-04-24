import { Router } from "express";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { analyticsRouter } from "../modules/analytics/analytics.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { contactRouter } from "../modules/contact/contact.routes.js";
import { deviceRouter } from "../modules/device/device.routes.js";
import { licenseRouter } from "../modules/license/license.routes.js";
import { monitoringRouter } from "../modules/monitoring/monitoring.routes.js";
import { paymentsDisabledRouter } from "../modules/payment/no-op.routes.js";
import { publicRouter } from "../modules/public/public.routes.js";
import { subscriptionRouter } from "../modules/subscription/subscription.routes.js";
import { userRouter } from "../modules/user/user.routes.js";
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

apiRouter.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "nb-pdf-TOOLS-auth-api",
  });
});

apiRouter.use("/public", publicRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/contact", contactRouter);
apiRouter.use("/device", deviceRouter);
apiRouter.use("/errors", monitoringRouter);
// Payments are globally DISABLED. Hiçbir sağlayıcı (iyzico / stripe) mount edilmez;
// `/api/payment/*` altındaki tüm istekler `paymentsDisabledRouter` tarafından 503 +
// JSON ile yanıtlanır. `PAYMENTS_PROVIDER` env flag'i env.ts'te dormant kalıyor
// ve Phase 3'te provider seçimi için yeniden kullanılacak.
apiRouter.use("/payment", paymentsDisabledRouter);
apiRouter.use("/license", licenseRouter);
apiRouter.use("/subscription", subscriptionRouter);
apiRouter.use("/user", userRouter);
