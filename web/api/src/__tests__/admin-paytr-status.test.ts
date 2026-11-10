/**
 * Admin: PayTR durum sorgusu — salt okunur; yalnız PayTR ödemelerinde; hassas alan sızdırmaz.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ findUnique: vi.fn(), query: vi.fn() }));

vi.mock("../lib/prisma.js", () => ({ prisma: { paymentCheckout: { findUnique: h.findUnique } } }));
vi.mock("../modules/payment/paytr/paytr.service.js", () => ({ getPaytrCredentials: () => ({ merchantId: "1" }) }));
vi.mock("../modules/payment/paytr/paytr.client.js", () => ({ queryPaytrStatus: h.query }));

const { adminPaytrStatusController } = await import("../modules/admin/payment-paytr-status.admin.js");

async function call(conversationId = "oid-1") {
  let body: any;
  await adminPaytrStatusController({ params: { conversationId } } as any, { json: (b: unknown) => (body = b) } as any);
  return body;
}

describe("adminPaytrStatusController", () => {
  beforeEach(() => {
    h.findUnique.mockReset();
    h.query.mockReset();
  });

  it("PayTR'nin bulduğu siparişi izinli alanlarla döndürür (kart bilgisi yok)", async () => {
    h.findUnique.mockResolvedValue({ conversationId: "oid-1", iyzicoPaymentId: "paytr:abc123" });
    h.query.mockResolvedValue({
      ok: true,
      paymentAmount: "129.00",
      currency: "TL",
      testMode: true,
      raw: { payment_amount: "129.00", test_mode: "1", masked_pan: "4553****6747", auth_code: "123456", returns: [] },
    });
    const r = await call();
    expect(h.query).toHaveBeenCalledWith("abc123", expect.anything());
    expect(r).toMatchObject({ ok: true, merchantOid: "abc123", testMode: true });
    expect(r.fields).toMatchObject({ payment_amount: "129.00", test_mode: "1" });
    expect(r.fields.masked_pan).toBeUndefined();
    expect(r.fields.auth_code).toBeUndefined();
  });

  it("PayTR bulamazsa hata kodunu olduğu gibi gösterir", async () => {
    h.findUnique.mockResolvedValue({ conversationId: "oid-1", iyzicoPaymentId: "paytr:abc123" });
    h.query.mockResolvedValue({ ok: false, errNo: "004", errMsg: "merchant_oid ile islem bulunamadi" });
    expect(await call()).toEqual({ ok: false, merchantOid: "abc123", errNo: "004", errMsg: "merchant_oid ile islem bulunamadi" });
  });

  it("PayTR ödemesi olmayanı reddeder, olmayan kaydı 404 verir", async () => {
    h.findUnique.mockResolvedValue({ conversationId: "oid-2", iyzicoPaymentId: "98765" });
    await expect(call("oid-2")).rejects.toMatchObject({ statusCode: 400 });
    h.findUnique.mockResolvedValue(null);
    await expect(call("yok")).rejects.toMatchObject({ statusCode: 404 });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("ağ hatasında 502 verir", async () => {
    h.findUnique.mockResolvedValue({ conversationId: "oid-1", iyzicoPaymentId: "paytr:abc123" });
    h.query.mockRejectedValue(new Error("timeout"));
    await expect(call()).rejects.toMatchObject({ statusCode: 502 });
  });
});
