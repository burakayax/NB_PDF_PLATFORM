/**
 * PayTR entegrasyonu — imza biçimleri, sipariş numarası dönüşümü, bildirim güvenliği.
 *
 * Formüller dev.paytr.com belgelerinden alınmıştır; testler bağımsız olarak hesaplanan
 * değerle karşılaştırır, böylece imza alan sırası yanlışlıkla değişirse yakalanır.
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CREDS = { merchantId: "123456", merchantKey: "test-key-abcdefgh", merchantSalt: "test-salt-ijklmnop" };

const hoisted = vi.hoisted(() => ({
  env: {
    paytrEnabled: true,
    PAYTR_MERCHANT_ID: "123456",
    PAYTR_MERCHANT_KEY: "test-key-abcdefgh",
    PAYTR_MERCHANT_SALT: "test-salt-ijklmnop",
    PAYTR_TEST_MODE: "",
    PAYMENTS_PROVIDER: "paytr",
  },
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  fulfill: vi.fn(),
}));

vi.mock("../config/env.js", () => ({ env: hoisted.env }));
vi.mock("../lib/prisma.js", () => ({
  prisma: { paymentCheckout: { findUnique: hoisted.findUnique, updateMany: hoisted.updateMany } },
}));
vi.mock("../lib/file-log.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../lib/app-logger.js", () => ({ logSuspiciousActivity: vi.fn() }));
vi.mock("../modules/payment/payment.service.js", () => ({
  fulfillPaidCheckout: hoisted.fulfill,
  isSuccessRedirect: (u: string) => u.includes("payment=success"),
  PaymentFulfillmentDbError: class PaymentFulfillmentDbError extends Error {},
}));

import {
  asciiFold,
  buildTokenForm,
  conversationIdFromMerchantOid,
  fromKurus,
  merchantOidFromConversationId,
  paytrCurrency,
  paytrSign,
  toKurus,
  verifyNotificationHash,
} from "../modules/payment/paytr/paytr.client.js";
import { processPaytrNotification } from "../modules/payment/paytr/paytr.notify.js";

const hmac = (s: string) => createHmac("sha256", CREDS.merchantKey).update(s).digest("base64");

describe("PayTR yardımcıları", () => {
  it("kuruş dönüşümü kayıpsızdır", () => {
    expect(toKurus("34.56")).toBe(3456);
    expect(toKurus("399")).toBe(39900);
    expect(toKurus("0.1")).toBe(10);
    expect(toKurus("1.005".slice(0, 4))).toBe(100); // "1.00"
    expect(fromKurus(3456)).toBe("34.56");
    expect(fromKurus(5)).toBe("0.05");
    expect(() => toKurus("abc")).toThrow();
    expect(() => toKurus("-5")).toThrow();
  });

  it("merchant_oid yalnız harf/rakam ve geri çevrilebilir", () => {
    const id = "3f2b8c1e-9a47-4d6b-8e21-0c5f7a9d1b34";
    const oid = merchantOidFromConversationId(id);
    expect(oid).toMatch(/^[0-9a-f]{32}$/);
    expect(conversationIdFromMerchantOid(oid)).toBe(id);
  });

  it("geçersiz sipariş numarasını reddeder", () => {
    expect(conversationIdFromMerchantOid("abc")).toBeNull();
    expect(conversationIdFromMerchantOid("../../etc/passwd")).toBeNull();
    expect(() => merchantOidFromConversationId("not-a-uuid")).toThrow();
  });

  it("Türkçe karakterleri e-postadan temizler", () => {
    expect(asciiFold("çağrı.şİmşek@örnek.com")).toBe("cagri.sImsek@ornek.com");
  });

  it("para birimi eşlemesi", () => {
    expect(paytrCurrency("TRY")).toBe("TL");
    expect(paytrCurrency("USD")).toBe("USD");
  });
});

describe("get-token imzası", () => {
  it("alan sırası belgedeki gibidir", () => {
    const form = buildTokenForm(
      {
        merchantOid: "abc123",
        email: "musteri@ornek.com",
        paymentAmountKurus: 3456,
        currency: "TL",
        basketName: "Örnek ürün",
        basketUnitPrice: "34.56",
        userIp: "1.2.3.4",
        userName: "Ad Soyad",
        userAddress: "Adres",
        userPhone: "05550000000",
        okUrl: "https://x.test/ok",
        failUrl: "https://x.test/fail",
        testMode: true,
      },
      CREDS,
    );
    const basket = Buffer.from(JSON.stringify([["Örnek ürün", "34.56", 1]]), "utf8").toString("base64");
    expect(form.user_basket).toBe(basket);
    const expected = hmac(
      "123456" + "1.2.3.4" + "abc123" + "musteri@ornek.com" + "3456" + basket + "1" + "0" + "TL" + "1" + CREDS.merchantSalt,
    );
    expect(form.paytr_token).toBe(expected);
    expect(form.no_installment).toBe("1");
    expect(form.test_mode).toBe("1");
  });

  it("durum sorgu / iade imzaları", () => {
    expect(paytrSign(["123456", "oid1"], CREDS)).toBe(hmac("123456oid1" + CREDS.merchantSalt));
    expect(paytrSign(["123456", "oid1", "10.25"], CREDS)).toBe(hmac("123456oid110.25" + CREDS.merchantSalt));
  });
});

function signedNotification(over: Partial<Record<string, string>> = {}) {
  const base = {
    merchant_oid: merchantOidFromConversationId("3f2b8c1e-9a47-4d6b-8e21-0c5f7a9d1b34"),
    status: "success",
    total_amount: "39900",
    payment_amount: "39900",
    currency: "TL",
    payment_type: "card",
    ...over,
  };
  const hash = hmac(base.merchant_oid + CREDS.merchantSalt + base.status + base.total_amount);
  return { ...base, hash: over.hash ?? hash };
}

describe("bildirim hash doğrulaması", () => {
  it("doğru hash kabul, bozuk hash ret", () => {
    const n = signedNotification();
    expect(verifyNotificationHash(n, CREDS)).toBe(true);
    expect(verifyNotificationHash({ ...n, total_amount: "100" }, CREDS)).toBe(false);
    expect(verifyNotificationHash({ ...n, hash: "x" }, CREDS)).toBe(false);
  });
});

describe("processPaytrNotification", () => {
  const pending = {
    conversationId: "3f2b8c1e-9a47-4d6b-8e21-0c5f7a9d1b34",
    priceTry: "399.00",
    paymentCurrency: "TRY",
    status: "pending",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.env.PAYTR_TEST_MODE = "";
    hoisted.findUnique.mockResolvedValue(pending);
    hoisted.updateMany.mockResolvedValue({ count: 1 });
    hoisted.fulfill.mockResolvedValue("https://app.test/workspace?payment=success&plan=PRO");
  });

  it("sahte hash → OK dönmez, plan verilmez", async () => {
    const out = await processPaytrNotification(signedNotification({ hash: "sahte" }));
    expect(out).toEqual({ kind: "reject", httpStatus: 400 });
    expect(hoisted.fulfill).not.toHaveBeenCalled();
  });

  it("başarılı ödeme → teslimat + OK", async () => {
    const out = await processPaytrNotification(signedNotification());
    expect(out).toEqual({ kind: "ok" });
    expect(hoisted.fulfill).toHaveBeenCalledTimes(1);
    const [convId, arg] = hoisted.fulfill.mock.calls[0]!;
    expect(convId).toBe(pending.conversationId);
    expect(arg.paymentId).toMatch(/^paytr:[0-9a-f]{32}$/);
    expect(arg.paidPrice).toBe("399.00");
  });

  it("tutar uyuşmazsa plan verilmez (ucuz ödeme ile pahalı plan)", async () => {
    const out = await processPaytrNotification(signedNotification({ total_amount: "100", payment_amount: "100" }));
    expect(out).toEqual({ kind: "ok" });
    expect(hoisted.fulfill).not.toHaveBeenCalled();
  });

  it("para birimi uyuşmazsa plan verilmez", async () => {
    const out = await processPaytrNotification(signedNotification({ currency: "USD" }));
    expect(out).toEqual({ kind: "ok" });
    expect(hoisted.fulfill).not.toHaveBeenCalled();
  });

  it("başarısız ödeme → kayıt failed, teslimat yok, OK", async () => {
    const out = await processPaytrNotification(signedNotification({ status: "failed" }));
    expect(out).toEqual({ kind: "ok" });
    expect(hoisted.updateMany).toHaveBeenCalledWith({
      where: { conversationId: pending.conversationId, status: "pending" },
      data: { status: "failed" },
    });
    expect(hoisted.fulfill).not.toHaveBeenCalled();
  });

  it("bilinmeyen sipariş → OK (yeniden denemesin), teslimat yok", async () => {
    hoisted.findUnique.mockResolvedValue(null);
    const out = await processPaytrNotification(signedNotification());
    expect(out).toEqual({ kind: "ok" });
    expect(hoisted.fulfill).not.toHaveBeenCalled();
  });

  it("DB teslimatı başarısızsa OK dönmez (PayTR yeniden dener)", async () => {
    hoisted.fulfill.mockResolvedValue("https://app.test/workspace?payment=failed");
    const out = await processPaytrNotification(signedNotification());
    expect(out).toEqual({ kind: "reject", httpStatus: 500 });
  });

  it("anahtarlar yoksa işlem yapılmaz", async () => {
    hoisted.env.paytrEnabled = false;
    const out = await processPaytrNotification(signedNotification());
    expect(out).toEqual({ kind: "reject", httpStatus: 503 });
    hoisted.env.paytrEnabled = true;
  });

  it("eksik gövde → 400", async () => {
    expect(await processPaytrNotification({})).toEqual({ kind: "reject", httpStatus: 400 });
    expect(await processPaytrNotification(null)).toEqual({ kind: "reject", httpStatus: 400 });
  });
});
