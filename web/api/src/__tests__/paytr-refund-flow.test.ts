/**
 * PayTR iade akışı: para kaybı riskine karşı sıra ve doğrulama kuralları.
 *  - Sağlayıcı iadesi başarısızsa kayıt/plan DEĞİŞMEZ.
 *  - Cevap alınamazsa / 009 gelirse Durum Sorgu ile doğrulanır; okunamazsa "başarı" sayılmaz.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  env: {
    paytrEnabled: true,
    PAYTR_MERCHANT_ID: "123456",
    PAYTR_MERCHANT_KEY: "k",
    PAYTR_MERCHANT_SALT: "s",
    PAYTR_TEST_MODE: "",
    PAYMENTS_PROVIDER: "paytr",
  },
  findUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../config/env.js", () => ({ env: h.env }));
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    paymentCheckout: { findUnique: h.findUnique },
    invoice: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: h.transaction,
  },
}));
vi.mock("../lib/file-log.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const svc = await import("../modules/payment/payment.service.js");

const OID = "3f2b8c1e9a474d6b8e210c5f7a9d1b34";
const checkout = {
  id: "c1",
  conversationId: "3f2b8c1e-9a47-4d6b-8e21-0c5f7a9d1b34",
  iyzicoPaymentId: `paytr:${OID}`,
  priceTry: "399.00",
  status: "completed",
  refundedAt: null,
  completedAt: new Date(),
  createdAt: new Date(),
  userId: "u1",
  plan: "PRO",
  organizationId: null,
  cvPassHours: null,
  bonusAiCredits: null,
};

/** URL'ye göre sıralı sahte PayTR cevapları. */
function stubFetch(handlers: { iade?: () => unknown; durum?: () => unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const which = String(url).includes("/iade") ? handlers.iade : handlers.durum;
      const out = which ? which() : { status: "error", err_no: "x" };
      if (out instanceof Error) throw out;
      return { status: 200, json: async () => out } as unknown as Response;
    }),
  );
}

describe("refundPaytrCheckoutIfApplicable", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("PayTR ödemesi değilse null (eski akış)", async () => {
    expect(await svc.refundPaytrCheckoutIfApplicable({ ...checkout, iyzicoPaymentId: "123" })).toBeNull();
    expect(await svc.refundPaytrCheckoutIfApplicable({ ...checkout, iyzicoPaymentId: null })).toBeNull();
  });

  it("PayTR success → ok", async () => {
    stubFetch({ iade: () => ({ status: "success" }) });
    expect(await svc.refundPaytrCheckoutIfApplicable(checkout)).toEqual({ ok: true });
  });

  it("reddedilirse (örn. bakiye yetersiz 010) → başarısız, durum sorgusuna gitmez", async () => {
    const durum = vi.fn();
    stubFetch({ iade: () => ({ status: "error", err_no: "010", err_msg: "Net bakiyeniz yetersiz" }), durum });
    const r = await svc.refundPaytrCheckoutIfApplicable(checkout);
    expect(r?.ok).toBe(false);
    expect(durum).not.toHaveBeenCalled();
  });

  it("cevap alınamadı + durum sorguda iade görünüyor → ok", async () => {
    stubFetch({
      iade: () => new Error("timeout"),
      durum: () => ({ status: "success", returns: [{ return_amount: "399.00" }] }),
    });
    expect((await svc.refundPaytrCheckoutIfApplicable(checkout))?.ok).toBe(true);
  });

  it("cevap alınamadı + durum sorguda iade yok → başarısız (tekrar denenebilir)", async () => {
    stubFetch({ iade: () => new Error("timeout"), durum: () => ({ status: "success", returns: [] }) });
    const r = await svc.refundPaytrCheckoutIfApplicable(checkout);
    expect(r?.ok).toBe(false);
    expect(r?.error).toContain("paytr_refund_not_done");
  });

  it("cevap alınamadı + iade tutarı okunamıyor → BAŞARI SAYILMAZ, elle kontrol uyarısı", async () => {
    stubFetch({ iade: () => new Error("timeout"), durum: () => ({ status: "success", returns: [{ x: 1 }] }) });
    const r = await svc.refundPaytrCheckoutIfApplicable(checkout);
    expect(r?.ok).toBe(false);
    expect(r?.error).toContain("check_panel");
  });

  it("009 + durum sorguda tam iade görünüyor → ok (çift tık / önceki deneme)", async () => {
    stubFetch({
      iade: () => ({ status: "error", err_no: "009", err_msg: "Toplam iade tutari odeme tutarindan fazla olamaz" }),
      durum: () => ({ status: "success", returns: [{ return_amount: "399.00" }] }),
    });
    expect((await svc.refundPaytrCheckoutIfApplicable(checkout))?.ok).toBe(true);
  });

  it("iade yarım (100 TL) ise tam iade sayılmaz", async () => {
    stubFetch({
      iade: () => new Error("timeout"),
      durum: () => ({ status: "success", returns: [{ return_amount: "100.00" }] }),
    });
    expect((await svc.refundPaytrCheckoutIfApplicable(checkout))?.ok).toBe(false);
  });
});

describe("processRefund sağlayıcı kancası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.findUnique.mockResolvedValue(checkout);
  });

  it("sağlayıcı iadesi başarısızsa veritabanı DEĞİŞMEZ", async () => {
    const r = await svc.processRefund(checkout.conversationId, "admin: x", async () => ({ ok: false, error: "boom" }));
    expect(r).toEqual({ ok: false, reason: "provider_failed", detail: "boom" });
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("pencere dışıysa sağlayıcıya HİÇ gidilmez (para çıkmaz)", async () => {
    h.findUnique.mockResolvedValue({ ...checkout, completedAt: new Date(Date.now() - 10 * 86400_000) });
    const hook = vi.fn();
    const r = await svc.processRefund(checkout.conversationId, "admin: x", hook);
    expect(r).toEqual({ ok: false, reason: "window_expired" });
    expect(hook).not.toHaveBeenCalled();
  });

  it("zaten iade edilmişse sağlayıcıya HİÇ gidilmez", async () => {
    h.findUnique.mockResolvedValue({ ...checkout, status: "refunded", refundedAt: new Date() });
    const hook = vi.fn();
    const r = await svc.processRefund(checkout.conversationId, "admin: x", hook);
    expect(r).toEqual({ ok: false, reason: "already_refunded" });
    expect(hook).not.toHaveBeenCalled();
  });

  it("sağlayıcı iadesi başarılıysa kayıt güncellenir", async () => {
    h.transaction.mockResolvedValue(undefined);
    const r = await svc.processRefund(checkout.conversationId, "admin: x", async () => ({ ok: true }));
    expect(r.ok).toBe(true);
    expect(h.transaction).toHaveBeenCalledTimes(1);
  });
});
