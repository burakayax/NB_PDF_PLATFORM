import type { Request, Response } from "express";

/**
 * Stripe controller — LIBRARY-ONLY MODE.
 *
 * Bu dosyadaki handler'lar `stripe.routes.ts` içinde router'a bağlanmaz ve
 * `routes/index.ts` içinde `/api/payment` altına mount EDİLMEZ. Fonksiyonlar
 * Phase 3'te doldurulacak Express-uyumlu imzalarla hazır tutulur.
 *
 * Kasıtlı olarak HTTP 501 dönülmez. Sebep: 501 yanıtları "production flow"
 * içinde hiç yer almasın istiyoruz. Biri bu handler'ları yanlışlıkla doğrudan
 * çağırırsa, sessiz 501 yerine yüksek sesli bir `Error` atılır; Express'in
 * default error middleware'i bunu 500'e çevirir ve logger'a düşer. Böylece
 * yanlış bir wiring CI veya canlı trafikte dikkat çekici şekilde patlar.
 *
 * Phase 3'te yapılacaklar:
 *  - `stripe` SDK ile `checkout.sessions.create` çağrısı
 *  - `PRICE_CONFIG` üzerinden price_id doğrulaması
 *  - `PaymentCheckout` satırı (provider="stripe", stripeSessionId) INSERT
 *  - `client_reference_id` ile misafir → kullanıcı birleştirme köprüsü
 *  - Yanıt: `{ url: session.url }` (frontend doğrudan redirect eder)
 */
const LIBRARY_ONLY_MESSAGE =
  "Stripe integration is in library-only mode. Do not mount stripePaymentRouter or call this handler until Phase 3 implementation lands.";

export async function createStripeCheckout(_request: Request, _response: Response): Promise<void> {
  throw new Error(`createStripeCheckout: ${LIBRARY_ONLY_MESSAGE}`);
}

/**
 * Phase 3 webhook iskeleti — imza doğrulama ve idempotency kaydı olmadan
 * ASLA üretimde kullanılmamalı. Aşağıdaki gereklilikler Phase 3'te
 * karşılanmadan bu handler bağlanamaz:
 *  - `Stripe.webhooks.constructEvent` ile imza doğrulama (raw body şart!)
 *  - `ProcessedStripeEvent` tablosunda event_id unique-insert ile idempotency
 *  - `checkout.session.completed` → PRICE_CONFIG lookup → User güncelleme
 *  - `invoice.payment_failed` / `customer.subscription.deleted` akışları
 *  - Raw body middleware'i JSON parser'dan ÖNCE bağlı olmalı.
 */
export async function handleStripeWebhook(_request: Request, _response: Response): Promise<void> {
  throw new Error(`handleStripeWebhook: ${LIBRARY_ONLY_MESSAGE}`);
}
