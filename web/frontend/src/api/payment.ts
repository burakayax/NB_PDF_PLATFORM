import { getSaasApiBase } from "./saasBase";

async function ensureOk(response: Response, defaultMessage: string) {
  if (response.ok) {
    return;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { message?: string };
    throw new Error(payload.message || defaultMessage);
  }
  const text = await response.text();
  throw new Error(text || defaultMessage);
}

export type PaidPlan = "PRO" | "BUSINESS";

export type PaymentBilling = "monthly" | "annual";

export type CreatePaymentResponse = {
  token: string;
  checkoutFormContent: string;
  paymentPageUrl?: string;
  conversationId: string;
};

/** iyzico ödeme oturumu başlatır (JWT gerekli). */
export async function createPaymentCheckout(
  accessToken: string,
  plan: PaidPlan,
  billing: PaymentBilling = "monthly",
): Promise<CreatePaymentResponse> {
  const body: { plan: PaidPlan; billing?: PaymentBilling } = { plan };
  if (plan === "PRO") {
    body.billing = billing;
  }
  const response = await fetch(`${getSaasApiBase()}/api/payment/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  await ensureOk(response, "Payment could not be started.");
  return response.json() as Promise<CreatePaymentResponse>;
}

export type CvPass = { id: string; hours: number; priceUSD: number; priceTRY: number; popular?: boolean };

/** CV Geçişi seçenekleri (fiyatın tek kaynağı sunucudur; /api/payment altı oturum ister). Hata olursa boş liste. */
export async function fetchCvPasses(accessToken: string | null): Promise<CvPass[]> {
  try {
    const res = await fetch(`${getSaasApiBase()}/api/payment/cv-passes`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      credentials: "include",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { passes?: CvPass[] };
    return data.passes ?? [];
  } catch {
    return [];
  }
}

/** CV Geçişi satın alma oturumu başlatır (tek seferlik, yenilenmez). Ödeme açık olmalı (aksi 403). */
export async function createCvPassCheckout(accessToken: string, passId: string): Promise<CreatePaymentResponse> {
  const response = await fetch(`${getSaasApiBase()}/api/payment/cv-pass`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ passId }),
  });
  await ensureOk(response, "Payment could not be started.");
  return response.json() as Promise<CreatePaymentResponse>;
}

/** Ek AI kredisi (top-up) satın alma oturumu başlatır. Ödeme açık olmalı (aksi 403). */
export async function createTopupCheckout(
  accessToken: string,
  packId: string,
): Promise<CreatePaymentResponse> {
  const response = await fetch(`${getSaasApiBase()}/api/payment/topup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ packId }),
  });
  await ensureOk(response, "Payment could not be started.");
  return response.json() as Promise<CreatePaymentResponse>;
}
