import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CV GEÇİŞİ — tek seferlik, yenilenmeyen, süreli ürün.
 *
 * İki şey bozulursa para ya da güven kaybedilir:
 *  1) Fiyat: ekranda gösterilen KDV dahil tutar ile iyzico'nun tahsil ettiği tutar aynı olmalı.
 *  2) İade: CV Geçişi iade edilince kullanıcının PLANI düşmemeli (plan hiç değişmemişti);
 *     yalnızca geçiş iptal olmalı.
 */

describe("CV Geçişi fiyatı", () => {
  it("TL: ödeme akışının KDV ekledikten sonraki tutarı gösterilen fiyatla AYNI", async () => {
    const { buildCheckoutPricing } = await import("../lib/vat.js");
    const { CV_PASSES, cvPassCheckoutAmount } = await import("../lib/plan-catalogue.js");
    for (const p of CV_PASSES) {
      const { currency, amount } = cvPassCheckoutAmount(p, false);
      expect(currency).toBe("TRY");
      expect(buildCheckoutPricing(amount, "TR", "TRY").grossAmount).toBe(p.priceTRY.toFixed(2));
    }
  });

  it("yurt dışı: USD, KDV'siz", async () => {
    const { buildCheckoutPricing } = await import("../lib/vat.js");
    const { CV_PASSES, cvPassCheckoutAmount } = await import("../lib/plan-catalogue.js");
    for (const p of CV_PASSES) {
      const { currency, amount } = cvPassCheckoutAmount(p, true);
      expect(currency).toBe("USD");
      expect(buildCheckoutPricing(amount, "DE", "USD").grossAmount).toBe(p.priceUSD.toFixed(2));
    }
  });

  it("uzun geçiş saat başına daha ucuz; kimlikler benzersiz", async () => {
    const { CV_PASSES, cvPassById } = await import("../lib/plan-catalogue.js");
    expect(new Set(CV_PASSES.map((p) => p.id)).size).toBe(CV_PASSES.length);
    const short = CV_PASSES[0];
    const long = CV_PASSES[CV_PASSES.length - 1];
    expect(long.priceTRY / long.hours).toBeLessThan(short.priceTRY / short.hours);
    expect(cvPassById("yok")).toBeNull();
    expect(cvPassById(short.id)?.hours).toBe(short.hours);
  });
});

describe("CV Geçişi süresi", () => {
  it("yeni satın alma şimdiden başlar", async () => {
    const { cvPassNewExpiry } = await import("../lib/plan-catalogue.js");
    expect(cvPassNewExpiry(null, 24, 1_000_000).getTime()).toBe(1_000_000 + 24 * 3_600_000);
    expect(cvPassNewExpiry(new Date(500), 24, 1_000_000).getTime()).toBe(1_000_000 + 24 * 3_600_000);
  });
  it("geçerli geçişin üstüne eklenir (süre kaybolmaz)", async () => {
    const { cvPassNewExpiry } = await import("../lib/plan-catalogue.js");
    const until = new Date(1_000_000 + 10 * 3_600_000);
    expect(cvPassNewExpiry(until, 24, 1_000_000).getTime()).toBe(until.getTime() + 24 * 3_600_000);
  });
});

const checkoutFindUnique = vi.fn();
const checkoutUpdate = vi.fn();
const userUpdate = vi.fn();
const orgUpdate = vi.fn();

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    paymentCheckout: {
      findUnique: (...a: unknown[]) => checkoutFindUnique(...a),
      update: (...a: unknown[]) => checkoutUpdate(...a),
    },
    user: { update: (...a: unknown[]) => userUpdate(...a), findUnique: vi.fn().mockResolvedValue(null) },
    organization: { update: (...a: unknown[]) => orgUpdate(...a) },
    invoice: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        paymentCheckout: { update: (...a: unknown[]) => checkoutUpdate(...a) },
        user: { update: (...a: unknown[]) => userUpdate(...a) },
        organization: { update: (...a: unknown[]) => orgUpdate(...a) },
      }),
  },
}));
vi.mock("../config/env.js", () => ({ env: { FRONTEND_ORIGIN: "https://x.test", NODE_ENV: "test" } }));
vi.mock("../lib/file-log.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

describe("CV Geçişi iadesi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const base = {
    id: "c1",
    userId: "u1",
    plan: "PRO",
    organizationId: null,
    status: "completed",
    refundedAt: null,
    completedAt: new Date(),
    createdAt: new Date(),
    bonusAiCredits: null,
  };

  it("planı FREE'ye düşürmez; yalnızca geçişi iptal eder", async () => {
    checkoutFindUnique.mockResolvedValue({ ...base, cvPassHours: 24 });
    const { processRefund } = await import("../modules/payment/payment.service.js");
    const r = await processRefund("conv-1", "test");
    expect(r.ok).toBe(true);
    const data = userUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.plan).toBeUndefined();
    expect(data.cvPassUntil).toBeInstanceOf(Date);
  });

  it("normal abonelik iadesi eskisi gibi planı FREE'ye düşürür", async () => {
    checkoutFindUnique.mockResolvedValue({ ...base, cvPassHours: null });
    const { processRefund } = await import("../modules/payment/payment.service.js");
    await processRefund("conv-2", "test");
    const data = userUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.plan).toBe("FREE");
    expect(data.cvPassUntil).toBeUndefined();
  });
});
