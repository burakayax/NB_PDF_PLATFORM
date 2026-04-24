import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import {
  fakePaymentCheckoutController,
  fakePaymentConfirmController,
} from "./fake-payment.controller.js";

/**
 * Mounted at `/api/fake-payment` in `src/app.ts` (`requireAuth` + API rate
 * limits). Both handlers read identity from `request.authUser` only.
 *
 * This router is deliberately independent of `/api/payment/*` (which is
 * wired to the disabled-payments 503 stub). The fake flow is a developer
 * affordance, not a shipping feature.
 */
export const fakePaymentRouter = Router();

fakePaymentRouter.post("/checkout", asyncHandler(fakePaymentCheckoutController));
fakePaymentRouter.post("/confirm", asyncHandler(fakePaymentConfirmController));
