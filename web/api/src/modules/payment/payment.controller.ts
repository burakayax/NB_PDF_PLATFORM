import type { Request, Response } from "express";
import express from "express";
import { HttpError } from "../../lib/http-error.js";
import { getClientIp } from "../../middleware/api-security.middleware.js";
import { createPaymentBodySchema } from "./payment.schema.js";
import {
  createPaymentCheckoutSession,
  paymentWorkspaceRedirectUrl,
  processPaymentCallback,
  processIyzicoRefundWebhook,
  PaymentFulfillmentDbError,
} from "./payment.service.js";

/** Süre dolunca bile tarayıcıyı SPA’ya gönderiz (iyi/başarısız URL ayrımı güvenilir olmayabilir; ödeme yine PSP tarafında tamamlanmış olabilir). */
const CALLBACK_MAX_MS = 28_000;

export async function createPaymentController(request: Request, response: Response) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }

  const parsed = createPaymentBodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request body.");
  }

  const session = await createPaymentCheckoutSession({
    userId,
    plan: parsed.data.plan,
    billing: parsed.data.billing ?? "monthly",
    clientIp: getClientIp(request),
  });

  response.status(200).json(session);
}

/** iyzico form POST (application/x-www-form-urlencoded); token ile ödeme sonucu alınır. */
export const paymentCallbackUrlencoded = express.urlencoded({ extended: true });

const IYZICO_CB_LOG = "[iyzico/callback]";

function summarizeCallbackBody(body: Record<string, unknown>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v !== "string" || !v.length) {
      continue;
    }
    if (k === "token") {
      out[k] = v.length <= 8 ? `${v.slice(0, 4)}…` : `${v.slice(0, 6)}…${v.slice(-4)} (${v.length} chars)`;
      continue;
    }
    if (k === "conversationData" || k.includes("data")) {
      out[k] = `${v.slice(0, 24)}… (${v.length} chars)`;
      continue;
    }
    out[k] = v.length > 160 ? `${v.slice(0, 160)}…` : v;
  }
  return out;
}

function pickFirstString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }
  return undefined;
}

export async function paymentCallbackController(request: Request, response: Response) {
  const raw = request.body as Record<string, unknown>;
  console.log(`${IYZICO_CB_LOG} POST received (keys=${Object.keys(raw).join(",")})`, summarizeCallbackBody(raw));

  const token =
    typeof raw.token === "string"
      ? raw.token
      : typeof raw.Token === "string"
        ? raw.Token
        : "";

  const conversationIdFromPost = pickFirstString(raw, [
    "conversationId",
    "ConversationId",
    "conversation_id",
    "paymentConversationId",
    "payment_conversation_id",
  ]);

  console.log(`${IYZICO_CB_LOG} extracted token=${token ? `"len=${token.length}"` : "MISSING"}, conversationIdFromPost=${conversationIdFromPost ?? "none"}`);

  // Wrap fulfillment so PaymentFulfillmentDbError propagates; other errors resolve to failed-URL.
  const fulfil = processPaymentCallback(token, {
    conversationIdFromRedirect: conversationIdFromPost,
    rawCallbackKeys: Object.keys(raw),
  }).then((url) => ({ url, timedOut: false as const, dbError: null as null | PaymentFulfillmentDbError }))
    .catch((err: unknown) => {
      if (err instanceof PaymentFulfillmentDbError) {
        return { url: null as null, timedOut: false as const, dbError: err };
      }
      // Non-DB errors: log and fall through to failed redirect.
      console.error(`${IYZICO_CB_LOG} processPaymentCallback rejected unexpectedly`, err);
      return { url: paymentWorkspaceRedirectUrl(false), timedOut: false as const, dbError: null as null };
    });

  const timedOutFallback = new Promise<{ url: string; timedOut: true; dbError: null }>((resolve) => {
    setTimeout(
      () => resolve({ url: paymentWorkspaceRedirectUrl(false), timedOut: true, dbError: null }),
      CALLBACK_MAX_MS,
    );
  });

  const result = await Promise.race([fulfil, timedOutFallback]);

  if (result.timedOut) {
    console.warn(`${IYZICO_CB_LOG} processing exceeded ${CALLBACK_MAX_MS}ms → 303 Location (fallback failed state; check logs above)`);
  }

  // DB write failed: return 500 so iyzico retries the webhook automatically.
  if (result.dbError) {
    console.error(
      `${IYZICO_CB_LOG} returning 500 — DB fulfillment error; iyzico will retry`,
      result.dbError.message,
    );
    response.status(500).end();
    return;
  }

  const redirectUrl = result.url!;
  console.log(`${IYZICO_CB_LOG} sending 303, empty body, Location=${redirectUrl}`);

  // `res.redirect()` Express bazen küçük bir HTML "Redirecting…" gövdesi ekler — tarayıcı ekranda kalıyormuş gibi görünür; yalnız Location başlığı.
  response.writeHead(303, { Location: redirectUrl });
  response.end();
}

const REFUND_WH_LOG = "[iyzico/refund-webhook]";

/**
 * POST /api/payments/refund-notify
 * iyzico iade bildirimi webhook'u.
 * iyzico'nun başarılı gönderim için 200 beklediği uç nokta — hata durumunda
 * 500 döndürerek otomatik yeniden deneme tetiklenir.
 */
export async function paymentRefundWebhookController(request: Request, response: Response) {
  const raw = request.body as Record<string, unknown>;
  console.log(`${REFUND_WH_LOG} received`, { keys: Object.keys(raw) });

  try {
    await processIyzicoRefundWebhook(raw);
    response.status(200).json({ received: true });
  } catch (err) {
    console.error(`${REFUND_WH_LOG} processing failed — iyzico will retry`, err instanceof Error ? err.message : err);
    response.status(500).end();
  }
}
