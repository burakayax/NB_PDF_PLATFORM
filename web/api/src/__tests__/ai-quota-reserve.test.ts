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
      where: { count: { lte: number } };
      data: { count: { increment: number } };
    };
    // 1 hak için: sayaç en fazla (limit - 1) olabilir.
    expect(arg.where.count.lte).toBe(9);
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
      where: { bonusAiCredits: { gte: number } };
      data: { bonusAiCredits: { decrement: number } };
    };
    // Kredi yalnızca TAMAMI varsa düşer → eksiye inemez.
    expect(arg.where.bonusAiCredits.gte).toBe(1);
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
      where: { count: { gte: number } };
      data: { count: { decrement: number } };
    };
    expect(arg.where.count.gte).toBe(1);
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

/**
 * ÇEVİRİ MALİYET AÇIĞI (regresyon koruması).
 *
 * Çeviri belgeyi parçalara bölüp her parça için ayrı model çağrısı yapar. Tek
 * hak düşülürse uzun bir belge aylık abonelik ücretinin katlarına mal olur.
 * Hak, belge boyutuyla orantılı düşmeli ve yetmiyorsa HİÇ düşmemeli.
 */
describe("çok birimli hak rezervasyonu (çeviri)", () => {
  it("istenen birimin tamamını tek adımda düşer", async () => {
    usageUpdateMany.mockResolvedValue({ count: 1 });

    const ok = await reserveAiQuota("u1", "PRO", "USER", "translate", 6);

    expect(ok).toBe(true);
    const arg = usageUpdateMany.mock.calls[0]?.[0] as {
      where: { count: { lte: number } };
      data: { count: { increment: number } };
    };
    // 10 limit, 6 birim → sayaç en fazla 4 olabilir.
    expect(arg.where.count.lte).toBe(4);
    expect(arg.data.count.increment).toBe(6);
  });

  it("kalan hak yetmiyorsa kısmi düşüm YAPMAZ", async () => {
    usageUpdateMany.mockResolvedValue({ count: 0 });
    usageFindUnique.mockResolvedValue({ count: 8, operationCounts: {} });
    userUpdateMany.mockResolvedValue({ count: 0 }); // bonus da yok

    const ok = await reserveAiQuota("u1", "PRO", "USER", "translate", 6);

    expect(ok).toBe(false);
    // Bonus da tamamı istenerek sorulmalı — 6 birimin 2'si düşürülüp kalınmamalı.
    const arg = userUpdateMany.mock.calls[0]?.[0] as {
      where: { bonusAiCredits: { gte: number } };
    };
    expect(arg.where.bonusAiCredits.gte).toBe(6);
  });

  it("iş hata verirse düşülen birimin tamamını iade eder", async () => {
    usageUpdateMany.mockResolvedValue({ count: 1 });

    await refundAiQuota("u1", "PRO", "USER", 6);

    const arg = usageUpdateMany.mock.calls[0]?.[0] as {
      where: { count: { gte: number } };
      data: { count: { decrement: number } };
    };
    expect(arg.where.count.gte).toBe(6);
    expect(arg.data.count.decrement).toBe(6);
  });
});

describe("translationCreditCost", () => {
  it("belge boyutuyla orantılı hak hesaplar", async () => {
    const { translationCreditCost, totalSegmentChars } = await import("../modules/ai/ai.service.js");

    // Kısa belge → en az 1 hak.
    expect(translationCreditCost(["kısa metin"])).toBe(1);
    // Tam bir kova sınırı → hâlâ 1 hak.
    expect(translationCreditCost(["x".repeat(20_000)])).toBe(1);
    // Bir karakter fazlası → 2 hak (yukarı yuvarlar).
    expect(translationCreditCost(["x".repeat(20_001)])).toBe(2);
    // Parçalar toplanarak sayılır — tek tek değil.
    expect(translationCreditCost(["x".repeat(15_000), "y".repeat(15_000)])).toBe(2);
    // 200 sayfalık bir belge tek hakla geçemez.
    expect(translationCreditCost(["x".repeat(250_000)])).toBe(13);

    expect(totalSegmentChars(["abc", "de"])).toBe(5);
  });
});
