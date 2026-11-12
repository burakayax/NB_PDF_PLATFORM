import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({ prisma: {} }));

import { isValidTckn, isValidVkn, validateCorporateTaxId } from "../lib/tax-id.js";
import { invoicePaymentId, subscriptionInvoiceName } from "../modules/payment/invoice-labels.js";
import { buildSummary, periodKey, trDayStart } from "../modules/admin/payments-summary.admin.js";

describe("vergi numarası doğrulama", () => {
  it("geçerli 10 haneli VKN ve 11 haneli T.C. Kimlik No kabul edilir", () => {
    expect(isValidVkn("5300847203")).toBe(true); // işletme sahibinin kendi numarası (yasal metinlerde yazılı)
    expect(isValidTckn("10000000146")).toBe(true);
    expect(validateCorporateTaxId("5300847203")).toBeNull();
    expect(validateCorporateTaxId("10000000146")).toBeNull();
  });
  it("yanlış sağlama hanesi, 9/12 hane ve harf reddedilir", () => {
    expect(validateCorporateTaxId("5300847204")).toMatch(/geçersiz/i);
    expect(validateCorporateTaxId("10000000147")).toMatch(/geçersiz/i);
    expect(validateCorporateTaxId("530084720")).toMatch(/10 haneli/);
    expect(validateCorporateTaxId("530084720312")).toMatch(/10 haneli/);
    expect(validateCorporateTaxId("53008472ab")).toMatch(/10 haneli/);
  });
});

describe("fatura kalem adı ve ödeme sağlayıcısı", () => {
  it("marka tekrarlanmaz, plan ve dönem yazılır", () => {
    expect(subscriptionInvoiceName({ plan: "PLUS", billingCycle: "MONTHLY", subscriptionDays: 30 })).toBe("Plus Abonelik (1 Aylık)");
    expect(subscriptionInvoiceName({ plan: "PRO", billingCycle: "YEARLY", subscriptionDays: 365 })).toBe("Pro Abonelik (1 Yıllık)");
    expect(subscriptionInvoiceName({ plan: "PRO", billingCycle: "MONTHLY", subscriptionDays: 365 })).toBe("Pro Abonelik (1 Yıllık)");
    expect(subscriptionInvoiceName({ plan: "PLUS" })).not.toMatch(/PDF PLATFORM/i);
  });
  it("PayTR ödemesi 'paytr:' ön ekiyle gider; iyzico'ya düşmez", () => {
    expect(invoicePaymentId({ iyzicoPaymentId: "paytr:ORD123", conversationId: "ORD123" }, "ORD123")).toBe("paytr:ORD123");
    expect(invoicePaymentId({ iyzicoPaymentId: "9988", conversationId: "c1" }, "9988")).toBe("9988");
    expect(invoicePaymentId({ iyzicoPaymentId: null, conversationId: "c1" })).toBe("c1");
  });
});

describe("ödeme / iade / KDV özeti", () => {
  const d = (s: string) => new Date(s);
  it("Türkiye saatine göre gün ve ay anahtarı verir (gece yarısından sonra ertesi gün)", () => {
    expect(periodKey(d("2026-11-11T22:30:00Z"), "day")).toBe("2026-11-12");
    expect(periodKey(d("2026-11-30T21:30:00Z"), "month")).toBe("2026-12");
    expect(trDayStart("2026-11-12").toISOString()).toBe("2026-11-11T21:00:00.000Z");
  });
  it("kesilen faturaların KDV'sinden iade faturası KDV'si düşer; döviz ödemeler TL'ye karışmaz", () => {
    const { rows, totals } = buildSummary(
      {
        paid: [
          { at: d("2026-11-05T10:00:00Z"), amount: 399, currency: "TRY", invoiced: true, scheduled: false },
          { at: d("2026-11-06T10:00:00Z"), amount: 120, currency: "TRY", invoiced: false, scheduled: true },
          { at: d("2026-11-07T10:00:00Z"), amount: 10, currency: "USD", invoiced: false, scheduled: true },
        ],
        refunds: [{ at: d("2026-11-09T10:00:00Z"), amount: 399, currency: "TRY" }],
        invoices: [{ at: d("2026-11-12T10:00:00Z"), kdv: 66.5, currency: "TRY" }],
        creditNotes: [{ at: d("2026-11-13T10:00:00Z"), kdv: 20, currency: "TRY" }],
      },
      "month",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      period: "2026-11",
      paidCount: 2,
      paidTotal: 519,
      refundedCount: 1,
      refundedTotal: 399,
      netTotal: 120,
      kdvIssued: 66.5,
      kdvCredited: 20,
      kdvNet: 46.5,
      foreignCount: 1,
      pendingKdvEstimate: 20,
    });
    expect(totals.kdvNet).toBe(46.5);
  });
  it("günlük gruplamada her gün ayrı satır, yeni tarih üstte", () => {
    const { rows } = buildSummary(
      {
        paid: [
          { at: d("2026-11-05T10:00:00Z"), amount: 100, currency: "TRY", invoiced: true, scheduled: false },
          { at: d("2026-11-06T10:00:00Z"), amount: 100, currency: "TRY", invoiced: true, scheduled: false },
        ],
        refunds: [],
        invoices: [],
        creditNotes: [],
      },
      "day",
    );
    expect(rows.map((r) => r.period)).toEqual(["2026-11-06", "2026-11-05"]);
  });
});
