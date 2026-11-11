import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

// Ziyaretçi Türkiye'den bağlanıyor (konum = TRY); para birimini fatura ülkesi belirlemeli.
vi.mock("../contexts/CheckoutCurrencyContext", async (orig) => {
  const real = await orig<typeof import("../contexts/CheckoutCurrencyContext")>();
  return { ...real, useCheckoutCurrency: () => ({ currency: "TRY" as const, loading: false }) };
});

const settingsFlags = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock("../contexts/SettingsContext", async (orig) => {
  const real = await orig<typeof import("../contexts/SettingsContext")>();
  return { ...real, useSettings: () => ({ pricing: undefined, cards: undefined, flags: settingsFlags.value }) as never };
});

import { PaymentSummaryModal } from "../components/dashboard/PaymentSummaryModal";

function mockBillingInfo(countryCode: string | null, ok = true) {
  globalThis.fetch = vi.fn(async () =>
    ok
      ? new Response(JSON.stringify({ billingCountryCode: countryCode }), { status: 200, headers: { "Content-Type": "application/json" } })
      : new Response("{}", { status: 500 }),
  ) as unknown as typeof fetch;
}

function renderModal() {
  return render(
    <PaymentSummaryModal open planId="PRO" accessToken="t" language="tr" onClose={() => {}} onPurchaseSuccess={() => {}} />,
  );
}

describe("PaymentSummaryModal — para birimi fatura ülkesine göre", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    cleanup();
    settingsFlags.value = undefined;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("istisna anahtarı AÇIKKEN (=false) fatura ülkesi ABD ise dolar ve istisna metni gösterir", async () => {
    settingsFlags.value = { featureFlags: { exportExemptionDisabled: false } };
    mockBillingInfo("US");
    renderModal();
    await waitFor(() => expect(document.body.textContent).toMatch(/\$/));
    expect(document.body.textContent).toMatch(/İhracat İstisnası/);
    expect(document.body.textContent).not.toMatch(/KDV \(%20\)/);
  });

  it("istisna KAPALIYKEN (varsayılan) ABD adresine de dolar + %20 KDV satırı gösterir, istisna demez", async () => {
    mockBillingInfo("US");
    renderModal();
    await waitFor(() => expect(document.body.textContent).toMatch(/\$/));
    expect(document.body.textContent).toMatch(/KDV \(%20\)/);
    expect(document.body.textContent).not.toMatch(/İhracat İstisnası/);
  });

  it("fatura ülkesi Türkiye ise TL gösterir", async () => {
    mockBillingInfo("TR");
    renderModal();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(document.body.textContent).toMatch(/₺/);
    expect(document.body.textContent).not.toMatch(/\$\s?\d/);
  });

  it("kayıtlı ülke yoksa (sorgu hatası) konum tahminine (TRY) döner", async () => {
    mockBillingInfo(null, false);
    renderModal();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(document.body.textContent).toMatch(/₺/);
  });
});
