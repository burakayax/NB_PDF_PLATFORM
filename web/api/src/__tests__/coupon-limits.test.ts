import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kupon limitleri iki AYRI kavramdır ve karıştırılırsa kampanya kırılır:
 *   • kişi başı hak  → aynı kişi kaç kez kullanabilir
 *   • toplam kontenjan → kupondan toplam kaç kullanım çıkabilir (boş = sınırsız)
 *
 * Eski kodda satın alma sonrası, kuponun TOPLAM kullanımı KİŞİ BAŞI limitle
 * kıyaslanıp kupon kapatılıyordu; varsayılan kişi başı hak 1 olduğu için her
 * kampanya kuponu ilk müşteriden sonra herkese kapanıyordu. Bu testler iki
 * limitin ayrı ayrı uygulandığını sabitler.
 */

const couponFindFirst = vi.fn();
const couponUseCount = vi.fn();

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    coupon: { findFirst: (...a: unknown[]) => couponFindFirst(...a) },
    couponUse: { count: (...a: unknown[]) => couponUseCount(...a) },
  },
}));

const { validateCouponForUser, normalizeCouponCode } = await import(
  "../modules/coupon/coupon.service.js"
);

type CountArgs = { where: { couponId: string; userId?: string } };

/** Kullanıcı bazlı ve toplam sayımları ayrı ayrı taklit eder. */
function mockUses(perUser: number, total: number) {
  couponUseCount.mockImplementation(async (args: CountArgs) =>
    args.where.userId === undefined ? total : perUser,
  );
}

beforeEach(() => {
  couponFindFirst.mockReset();
  couponUseCount.mockReset();
  couponFindFirst.mockResolvedValue({
    id: "c1",
    code: "KAMPANYA",
    discountPercent: 20,
    isActive: true,
    usageLimitPerUser: 1,
    usageLimitTotal: null,
    expiresAt: null,
  });
});

describe("kupon limitleri", () => {
  it("kodu büyük harfe ve boşluksuz hale getirir", () => {
    expect(normalizeCouponCode("  kampanya  ")).toBe("KAMPANYA");
  });

  it("başka biri kullandı diye kupon kapanmaz", async () => {
    // Kuponu 250 kişi kullanmış; bu kullanıcı hiç kullanmamış.
    mockUses(0, 250);

    const result = await validateCouponForUser("KAMPANYA", "yeni-kullanici");

    expect(result.ok).toBe(true);
  });

  it("aynı kişi kişi başı hakkını aşamaz", async () => {
    mockUses(1, 1);

    const result = await validateCouponForUser("KAMPANYA", "ayni-kullanici");

    expect(result).toEqual({ ok: false, reason: "limit" });
  });

  it("toplam kontenjan dolduğunda yeni kullanım kabul edilmez", async () => {
    couponFindFirst.mockResolvedValue({
      id: "c1",
      code: "KAMPANYA",
      discountPercent: 20,
      isActive: true,
      usageLimitPerUser: 1,
      usageLimitTotal: 100,
      expiresAt: null,
    });
    mockUses(0, 100);

    const result = await validateCouponForUser("KAMPANYA", "yeni-kullanici");

    expect(result).toEqual({ ok: false, reason: "limit" });
  });

  it("toplam kontenjan dolmadıysa kabul eder", async () => {
    couponFindFirst.mockResolvedValue({
      id: "c1",
      code: "KAMPANYA",
      discountPercent: 20,
      isActive: true,
      usageLimitPerUser: 1,
      usageLimitTotal: 100,
      expiresAt: null,
    });
    mockUses(0, 99);

    const result = await validateCouponForUser("KAMPANYA", "yeni-kullanici");

    expect(result.ok).toBe(true);
  });

  it("kontenjan boş bırakıldıysa sınırsızdır", async () => {
    mockUses(0, 10_000);

    const result = await validateCouponForUser("KAMPANYA", "yeni-kullanici");

    expect(result.ok).toBe(true);
  });

  it("süresi geçmiş kupon geçersizdir", async () => {
    couponFindFirst.mockResolvedValue({
      id: "c1",
      code: "KAMPANYA",
      discountPercent: 20,
      isActive: true,
      usageLimitPerUser: 1,
      usageLimitTotal: null,
      expiresAt: new Date(Date.now() - 86_400_000),
    });
    mockUses(0, 0);

    const result = await validateCouponForUser("KAMPANYA", "kullanici");

    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("bilinmeyen kod geçersizdir", async () => {
    couponFindFirst.mockResolvedValue(null);

    const result = await validateCouponForUser("YOK", "kullanici");

    expect(result).toEqual({ ok: false, reason: "invalid" });
  });
});
