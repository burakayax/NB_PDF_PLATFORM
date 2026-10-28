/**
 * PayTR iFrame API istemcisi — SAF fonksiyonlar (veritabanı yok, yan etki yok; test edilebilir).
 *
 * Belgeler: https://dev.paytr.com/iframe-api (1. adım: token, 2. adım: bildirim),
 *           https://dev.paytr.com/durum-sorgu, https://dev.paytr.com/iade-api
 *
 * Tüm isteklerin imzası aynı mantıktır: alanlar birleştirilir → sonuna merchant_salt eklenir →
 * merchant_key ile HMAC-SHA256 → Base64.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const PAYTR_GET_TOKEN_URL = "https://www.paytr.com/odeme/api/get-token";
export const PAYTR_STATUS_URL = "https://www.paytr.com/odeme/durum-sorgu";
export const PAYTR_REFUND_URL = "https://www.paytr.com/odeme/iade";
export const PAYTR_IFRAME_URL = "https://www.paytr.com/odeme/guvenli/";

export type PaytrCredentials = {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
};

/** HMAC-SHA256(parts.join("") + salt, key) → Base64. */
export function paytrSign(parts: string[], creds: Pick<PaytrCredentials, "merchantKey" | "merchantSalt">): string {
  return createHmac("sha256", creds.merchantKey)
    .update(parts.join("") + creds.merchantSalt)
    .digest("base64");
}

// ─── Sipariş numarası ────────────────────────────────────────────────────────
// PayTR merchant_oid: en fazla 64 karakter, YALNIZ harf/rakam (tire kabul edilmez).
// conversationId bir UUID olduğundan tireleri atıp geri koymak kayıpsızdır; böylece
// veritabanına ek sütun gerekmeden bildirimdeki sipariş numarasından kayda ulaşılır.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OID_RE = /^[0-9a-f]{32}$/i;

export function merchantOidFromConversationId(conversationId: string): string {
  if (!UUID_RE.test(conversationId)) {
    throw new Error("conversationId UUID değil — PayTR merchant_oid üretilemez.");
  }
  return conversationId.replace(/-/g, "").toLowerCase();
}

/** Geçersiz biçimde null döner (bildirim sahte/bozuk sipariş numarası taşıyabilir). */
export function conversationIdFromMerchantOid(merchantOid: string): string | null {
  if (!OID_RE.test(merchantOid)) return null;
  const h = merchantOid.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ─── Tutar ───────────────────────────────────────────────────────────────────

/** "34.56" → 3456 (kuruş). Yuvarlama hatasına karşı string üzerinden. */
export function toKurus(amount: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!m) throw new Error(`Geçersiz tutar: ${amount}`);
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
}

/** 3456 → "34.56" */
export function fromKurus(kurus: number): string {
  const k = Math.round(kurus);
  return `${Math.floor(k / 100)}.${String(k % 100).padStart(2, "0")}`;
}

/** Sistem para birimi → PayTR kodu. */
export function paytrCurrency(c: string): "TL" | "USD" | "EUR" {
  const u = c.toUpperCase();
  if (u === "USD") return "USD";
  if (u === "EUR") return "EUR";
  return "TL";
}

// ─── Metin temizleme ─────────────────────────────────────────────────────────

const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U",
};

/** PayTR e-posta alanı Türkçe karakter kabul etmez. */
export function asciiFold(s: string): string {
  return s
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_MAP[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "");
}

/** İstemci IP'si: ::ffff: önekini at, 39 karaktere kırp. */
export function normalizeUserIp(ip: string | undefined | null): string {
  const v = (ip ?? "").trim().replace(/^::ffff:/i, "");
  return (v || "127.0.0.1").slice(0, 39);
}

// ─── 1. Adım: token ──────────────────────────────────────────────────────────

export type PaytrTokenInput = {
  merchantOid: string;
  email: string;
  /** Kuruş cinsinden. */
  paymentAmountKurus: number;
  currency: "TL" | "USD" | "EUR";
  basketName: string;
  /** Sepet satırı birim fiyatı, "34.56" biçiminde (KDV dahil, payment_amount ile aynı). */
  basketUnitPrice: string;
  userIp: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  okUrl: string;
  failUrl: string;
  testMode: boolean;
  lang?: "tr" | "en";
  /** Dakika; PayTR varsayılanı 30. */
  timeoutMinutes?: number;
};

export function buildTokenForm(input: PaytrTokenInput, creds: PaytrCredentials): Record<string, string> {
  const userBasket = Buffer.from(
    JSON.stringify([[input.basketName.slice(0, 200), input.basketUnitPrice, 1]]),
    "utf8",
  ).toString("base64");

  const fields = {
    merchant_id: creds.merchantId,
    user_ip: input.userIp,
    merchant_oid: input.merchantOid,
    email: asciiFold(input.email).slice(0, 100),
    payment_amount: String(input.paymentAmountKurus),
    user_basket: userBasket,
    // Abonelik tutarı sabit; taksit gösterilmez (iyzico akışındaki enabledInstallments:[1] ile aynı).
    no_installment: "1",
    max_installment: "0",
    currency: input.currency,
    test_mode: input.testMode ? "1" : "0",
  };

  const paytrToken = paytrSign(
    [
      fields.merchant_id, fields.user_ip, fields.merchant_oid, fields.email, fields.payment_amount,
      fields.user_basket, fields.no_installment, fields.max_installment, fields.currency, fields.test_mode,
    ],
    creds,
  );

  return {
    ...fields,
    paytr_token: paytrToken,
    user_name: input.userName.slice(0, 60),
    user_address: input.userAddress.slice(0, 400),
    user_phone: input.userPhone.slice(0, 20),
    merchant_ok_url: input.okUrl.slice(0, 400),
    merchant_fail_url: input.failUrl.slice(0, 400),
    timeout_limit: String(input.timeoutMinutes ?? 30),
    debug_on: "0",
    lang: input.lang ?? "tr",
  };
}

export type PaytrTokenResult = { ok: true; token: string } | { ok: false; reason: string };

export async function requestPaytrToken(
  form: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<PaytrTokenResult> {
  const res = await fetchImpl(PAYTR_GET_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => null)) as { status?: string; token?: string; reason?: string } | null;
  if (data?.status === "success" && typeof data.token === "string" && data.token) {
    return { ok: true, token: data.token };
  }
  return { ok: false, reason: String(data?.reason ?? `http_${res.status}`) };
}

export function paytrPaymentPageUrl(token: string): string {
  return `${PAYTR_IFRAME_URL}${encodeURIComponent(token)}`;
}

// ─── 2. Adım: bildirim doğrulama ─────────────────────────────────────────────

export type PaytrNotification = {
  merchant_oid: string;
  status: string;
  total_amount: string;
  hash: string;
  failed_reason_code?: string;
  failed_reason_msg?: string;
  test_mode?: string;
  payment_type?: string;
  currency?: string;
  payment_amount?: string;
};

/** Gövdeden bildirim alanlarını güvenle çıkarır; zorunlu alan yoksa null. */
export function parseNotification(body: unknown): PaytrNotification | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const str = (k: string): string | undefined => (typeof b[k] === "string" ? (b[k] as string) : undefined);
  const merchant_oid = str("merchant_oid");
  const status = str("status");
  const total_amount = str("total_amount");
  const hash = str("hash");
  if (!merchant_oid || !status || total_amount === undefined || !hash) return null;
  return {
    merchant_oid,
    status,
    total_amount,
    hash,
    failed_reason_code: str("failed_reason_code"),
    failed_reason_msg: str("failed_reason_msg"),
    test_mode: str("test_mode"),
    payment_type: str("payment_type"),
    currency: str("currency"),
    payment_amount: str("payment_amount"),
  };
}

/** hash = base64(HMAC(merchant_oid + salt + status + total_amount, key)) — sabit zamanlı karşılaştırma. */
export function verifyNotificationHash(n: PaytrNotification, creds: PaytrCredentials): boolean {
  const expected = createHmac("sha256", creds.merchantKey)
    .update(n.merchant_oid + creds.merchantSalt + n.status + n.total_amount)
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(n.hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Durum sorgu ─────────────────────────────────────────────────────────────

export type PaytrStatusResult =
  | { ok: true; paymentAmount: string; currency: string; testMode: boolean; raw: Record<string, unknown> }
  | { ok: false; errNo: string; errMsg: string };

export async function queryPaytrStatus(
  merchantOid: string,
  creds: PaytrCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<PaytrStatusResult> {
  const form = {
    merchant_id: creds.merchantId,
    merchant_oid: merchantOid,
    paytr_token: paytrSign([creds.merchantId, merchantOid], creds),
  };
  const res = await fetchImpl(PAYTR_STATUS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (data?.status === "success") {
    return {
      ok: true,
      paymentAmount: String(data.payment_amount ?? ""),
      currency: String(data.currency ?? ""),
      testMode: String(data.test_mode ?? "0") === "1",
      raw: data,
    };
  }
  return { ok: false, errNo: String(data?.err_no ?? "?"), errMsg: String(data?.err_msg ?? `http_${res.status}`) };
}

// ─── İade ────────────────────────────────────────────────────────────────────

export type PaytrRefundResult =
  | { ok: true; isTest: boolean }
  | { ok: false; errNo: string; errMsg: string };

/** returnAmount: "10.25" biçimi (yalnız nokta ayırıcı). */
export async function requestPaytrRefund(
  merchantOid: string,
  returnAmount: string,
  creds: PaytrCredentials,
  referenceNo?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PaytrRefundResult> {
  const form: Record<string, string> = {
    merchant_id: creds.merchantId,
    merchant_oid: merchantOid,
    return_amount: returnAmount,
    paytr_token: paytrSign([creds.merchantId, merchantOid, returnAmount], creds),
  };
  if (referenceNo) form.reference_no = referenceNo.replace(/[^A-Za-z0-9]/g, "").slice(0, 64);
  const res = await fetchImpl(PAYTR_REFUND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (data?.status === "success") {
    return { ok: true, isTest: String(data.is_test ?? "0") === "1" };
  }
  return { ok: false, errNo: String(data?.err_no ?? "?"), errMsg: String(data?.err_msg ?? `http_${res.status}`) };
}
