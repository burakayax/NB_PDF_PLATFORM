import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Yapay zekâ hakkı, pahalı sağlayıcı çağrısından ÖNCE ve TEK adımda düşülmelidir.
 *
 * Eski akış "önce bak → sonra çağır → en sonda düş" şeklindeydi; 1 hakkı kalan
 * bir kullanıcı aynı anda çok sayıda istek göndererek hepsini kontrolden
 * geçirebiliyor, tek hak için birden çok ücretli çağrı yaptırabiliyordu.
 * Buradaki testler o davranışın geri gelmemesini garanti eder.
 */

const usageUpdateMany = vi.fn();
const usageFindUnique = vi.fn();
const usageCreate = vi.fn();
const usageUpsert = vi.fn();
const userUpdateMany = vi.fn();

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    aiUsage: {
      updateMany: (...args: unknown[]) => usageUpdateMany(...args),
      findUnique: (...args: unknown[]) => usageFindUnique(...args),
      create: (...args: unknown[]) => usageCreate(...args),
      upsert: (...args: unknown[]) => usageUpsert(...args),
    },
    user: {
      updateMany: (...args: unknown[]) => userUpdateMany(...args),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../config/env.js", () => ({
  env: {
    AI_MONTHLY_LIMIT_PRO: 10,
    AI_MONTHLY_LIMIT_BUSINESS: 100,
    AI_MONTHLY_LIMIT_PLUS: 5,
    AI_MONTHLY_LIMIT_STARTER: 2,
  },
}));

const { reserveAiQuota, refundAiQuota } = await import("../modules/ai/ai.quota.js");

beforeEach(() => {
  usageUpdateMany.mockReset();
  usageFindUnique.mockReset();
  usageCreate.mockReset();
  usageUpsert.mockReset();
  userUpdateMany.mockReset();
  usageUpsert.mockResolvedValue({});
  usageFindUnique.mockResolvedValue({ count: 1, operationCounts: {} });
});

describe("reserveAiQuota", () => {
  it("aylık hak varken tek koşullu güncelleme ile düşer", async () => {
    usageUpdateMany.mockResolvedValue({ count: 1 });

    const ok = await reserveAiQuota("u1", "PRO", "USER", "summarize");

    expect(ok).toBe(true);
    // Kontrol ve düşüm aynı çağrıda: koşul, limitin altında olmayı zorunlu kılar.
    expect(usageUpdateMany).toHaveBeenCalledTimes(1);
    const arg = usageUpdateMany.mock.calls[0]?.[0] as {
      where: { count: { lt: number } };
      data: { count: { increment: number } };
    };
    expect(arg.where.count.lt).toBe(10);
    expect(arg.data.count.increment).toBe(1);
    // Sağlayıcı çağrısından önce düşüldüğü için ayrıca bir "tüket" adımı yok.
    expect(userUpdateMany).not.toHaveBeenCalled();
  });

  it("aylık hak bittiğinde satın alınmış krediden düşer", async () => {
    usageUpdateMany.mockResolvedValue({ count: 0 });
    usageFindUnique.mockResolvedValue({ count: 10, operationCounts: {} });
    userUpdateMany.mockResolvedValue({ count: 1 });

    const ok = await reserveAiQuota("u1", "PRO", "USER", "chat");

    expect(ok).toBe(true);
    const arg = userUpdateMany.mock.calls[0]?.[0] as {
      where: { bonusAiCredits: { gt: number } };
      data: { bonusAiCredits: { decrement: number } };
    };
    // Kredi yalnızca 0'dan büyükse düşer → eksiye inemez.
    expect(arg.where.bonusAiCredits.gt).toBe(0);
    expect(arg.data.bonusAiCredits.decrement).toBe(1);
  });

  it("ne aylık hak ne kredi kaldıysa reddeder", async () => {
    usageUpdateMany.mockResolvedValue({ count: 0 });
    usageFindUnique.mockResolvedValue({ count: 10, operationCounts: {} });
    userUpdateMany.mockResolvedValue({ count: 0 });

    await expect(reserveAiQuota("u1", "PRO", "USER", "chat")).resolves.toBe(false);
  });

  it("aylık hakkı olmayan plan doğrudan krediye düşer", async () => {
    userUpdateMany.mockResolvedValue({ count: 1 });

    const ok = await reserveAiQuota("u1", "FREE", "USER", "chat");

    expect(ok).toBe(true);
    expect(usageUpdateMany).not.toHaveBeenCalled();
    expect(userUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("aynı anda gelen isteklerden yalnızca hak kadarı geçer", async () => {
    // Veritabanı koşullu güncellemesi taklit edilir: limit dolunca 0 satır etkilenir.
    let used = 9; // limit 10 → tek hak kaldı
    usageUpdateMany.mockImplementation(async () => {
      if (used < 10) {
        used += 1;
        return { count: 1 };
      }
      return { count: 0 };
    });
    usageFindUnique.mockResolvedValue({ count: 10, operationCounts: {} });
    userUpdateMany.mockResolvedValue({ count: 0 }); // kredi yok

    const results = await Promise.all(
      Array.from({ length: 20 }, () => reserveAiQuota("u1", "PRO", "USER", "chat")),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((r) => !r)).toHaveLength(19);
  });
});

describe("refundAiQuota", () => {
  it("sağlayıcı hata verirse aylık hakkı geri verir", async () => {
    usageUpdateMany.mockResolvedValue({ count: 1 });

    await refundAiQuota("u1", "PRO", "USER");

    const arg = usageUpdateMany.mock.calls[0]?.[0] as {
      where: { count: { gt: number } };
      data: { count: { decrement: number } };
    };
    expect(arg.where.count.gt).toBe(0);
    expect(arg.data.count.decrement).toBe(1);
    expect(userUpdateMany).not.toHaveBeenCalled();
  });

  it("aylık sayaç zaten sıfırsa krediyi geri verir", async () => {
    usageUpdateMany.mockResolvedValue({ count: 0 });
    userUpdateMany.mockResolvedValue({ count: 1 });

    await refundAiQuota("u1", "PRO", "USER");

    const arg = userUpdateMany.mock.calls[0]?.[0] as {
      data: { bonusAiCredits: { increment: number } };
    };
    expect(arg.data.bonusAiCredits.increment).toBe(1);
  });
});
