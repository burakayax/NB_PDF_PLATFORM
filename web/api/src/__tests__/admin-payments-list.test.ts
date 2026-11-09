/**
 * Admin ödeme listesi: iade edilecek kişiyi bulma filtreleri.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("../lib/prisma.js", () => ({ prisma: { paymentCheckout: { findMany: h.findMany } } }));
vi.mock("../modules/payment/payment.service.js", () => ({ REFUND_WINDOW_DAYS: 7 }));

const { adminListPaymentsController } = await import("../modules/admin/payments-list.admin.js");

const day = 24 * 60 * 60 * 1000;
function row(over: Record<string, unknown> = {}) {
  return {
    conversationId: "oid-1",
    createdAt: new Date(Date.now() - 1 * day),
    completedAt: new Date(Date.now() - 1 * day),
    refundedAt: null,
    refundReason: null,
    status: "completed",
    plan: "STARTER",
    billingCycle: "MONTHLY",
    priceTry: "129.00",
    paymentCurrency: "TRY",
    netAmount: "107.50",
    kdvAmount: "21.50",
    kdvRate: 20,
    discountPercent: null,
    iyzicoPaymentId: "paytr:abc",
    invoiceStatus: null,
    bonusAiCredits: null,
    cvPassHours: null,
    seatsOnly: false,
    user: { id: "u1", email: "ayse@ornek.com", firstName: "Ayşe", lastName: "Yılmaz", name: null },
    invoice: null,
    ...over,
  };
}

async function call(query: Record<string, string> = {}) {
  let body: any;
  await adminListPaymentsController({ query } as any, { json: (b: unknown) => (body = b) } as any);
  return body;
}

describe("adminListPaymentsController", () => {
  beforeEach(() => {
    h.findMany.mockReset();
    h.findMany.mockResolvedValue([
      row(),
      row({
        conversationId: "oid-2",
        priceTry: "399.00",
        plan: "PRO",
        user: { id: "u2", email: "mehmet@firma.com", firstName: "Mehmet", lastName: "Kaya", name: null },
        completedAt: new Date(Date.now() - 20 * day),
        createdAt: new Date(Date.now() - 20 * day),
        iyzicoPaymentId: "123",
      }),
      row({ conversationId: "oid-3", status: "refunded", priceTry: "129.00", user: { id: "u3", email: "z@x.com", firstName: null, lastName: null, name: "Zeynep" } }),
    ]);
  });

  it("e-posta, ad ve sipariş no ile arar (büyük/küçük harf fark etmez, Türkçe karakter dahil)", async () => {
    expect((await call({ q: "MEHMET@" })).rows.map((r: any) => r.conversationId)).toEqual(["oid-2"]);
    expect((await call({ q: "ayşe" })).rows.map((r: any) => r.conversationId)).toEqual(["oid-1"]);
    expect((await call({ q: "oid-3" })).rows[0].user.name).toBe("Zeynep");
  });

  it("tutar aralığı ve ödeme türü süzer", async () => {
    const r = await call({ minAmount: "200" } as any);
    expect(r.rows.map((x: any) => x.conversationId)).toEqual(["oid-2"]);
    expect((await call({ maxAmount: "130" } as any)).total).toBe(2);
    expect((await call({ kind: "topup" })).total).toBe(0);
  });

  it("iade penceresi ve sağlayıcıyı doğru işaretler", async () => {
    const r = await call();
    const byId = Object.fromEntries(r.rows.map((x: any) => [x.conversationId, x]));
    expect(byId["oid-1"].withinRefundWindow).toBe(true);
    expect(byId["oid-2"].withinRefundWindow).toBe(false);
    expect(byId["oid-1"].provider).toBe("paytr");
    expect(byId["oid-2"].provider).toBe("diger");
    expect(byId["oid-1"].refundable).toBe(true);
    expect(byId["oid-3"].refundable).toBe(false);
  });

  it("toplamları hesaplar ve sayfalar", async () => {
    const r = await call({ limit: "1", offset: "1" } as any);
    expect(r.total).toBe(3);
    expect(r.rows).toHaveLength(1);
    expect(r.totals).toMatchObject({ completedCount: 2, completedAmount: 528, refundedCount: 1, refundedAmount: 129 });
  });

  it("tarih ve durum filtrelerini veritabanına iletir", async () => {
    await call({ status: "completed", from: "2026-11-01", to: "2026-11-09" });
    const where = h.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("completed");
    expect(where.createdAt.gte.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(where.createdAt.lt.toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });

  it("geçersiz sorguyu 400 ile reddeder", async () => {
    await expect(call({ from: "yarın" })).rejects.toMatchObject({ statusCode: 400 });
  });
});
