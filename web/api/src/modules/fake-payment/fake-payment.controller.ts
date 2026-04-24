import type { Request, Response } from "express";

import { HttpError } from "../../lib/http-error.js";
import {
  fakePaymentCheckoutBodySchema,
  fakePaymentConfirmBodySchema,
} from "./fake-payment.schema.js";
import {
  confirmFakePayment,
  createFakeCheckoutSession,
} from "./fake-payment.service.js";

/**
 * `POST /api/fake-payment/checkout`
 *
 * Creates an in-memory session. Response matches the product contract:
 * `sessionId`, `amount`, `credits`, `redirectUrl` (SPA path + query).
 */
export async function fakePaymentCheckoutController(
  request: Request,
  response: Response,
) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }

  const parsed = fakePaymentCheckoutBodySchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid body.");
  }

  const result = createFakeCheckoutSession({
    userId,
    product: parsed.data.plan,
  });

  response.status(200).json(result);
}

/**
 * `POST /api/fake-payment/confirm`
 *
 * Validates the session, grants credits via the entitlement engine, and
 * updates `User.plan` + subscription fields only for PRO/BUSINESS.
 */
export async function fakePaymentConfirmController(
  request: Request,
  response: Response,
) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }

  const parsed = fakePaymentConfirmBodySchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid body.");
  }

  const result = await confirmFakePayment({
    userId,
    sessionId: parsed.data.sessionId,
  });

  switch (result.status) {
    case "confirmed":
      response.status(200).json({
        ok: true,
        sessionId: result.sessionId,
        product: result.product,
        creditsGranted: result.creditsGranted,
        creditsBefore: result.creditsBefore,
        creditsAfter: result.creditsAfter,
        transactionId: result.transactionId,
        subscriptionExpiry: result.subscriptionExpiry,
      });
      return;
    case "already_confirmed":
      response.status(200).json({
        ok: true,
        alreadyConfirmed: true,
        sessionId: result.sessionId,
        product: result.product,
      });
      return;
    case "not_found":
      throw new HttpError(404, "Checkout session not found.");
    case "forbidden":
      throw new HttpError(403, "This checkout session belongs to a different user.");
    case "expired":
      throw new HttpError(410, "Checkout session has expired.");
  }
}
