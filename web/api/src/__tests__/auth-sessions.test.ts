import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * AÇIK OTURUM YÖNETİMİ.
 *
 * Eski kural "her yeni giriş öncekini kapatır" idi: hesap paylaşımını
 * engellemiyordu (paylaşanlar sırayla giriyor) ama dürüst kullanıcının telefonu
 * ile bilgisayarı birbirini dışarı atıyordu. Yeni kural: sınırlı sayıda oturum,
 * kullanıcıya görünür liste, uzaktan kapatma ve çalınmış oturum tespiti.
 *
 * Buradaki testler o davranışları sabitler.
 */

const refreshFindMany = vi.fn();
const refreshUpdateMany = vi.fn();

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    refreshToken: {
      findMany: (...a: unknown[]) => refreshFindMany(...a),
      updateMany: (...a: unknown[]) => refreshUpdateMany(...a),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

const { cihazAdiCikar, listeleAcikOturumlar, kapatDigerOturumlar, kapatOturum } =
  await import("../modules/auth/auth.service.js");

beforeEach(() => {
  refreshFindMany.mockReset();
  refreshUpdateMany.mockReset();
});

describe("cihaz adı", () => {
  it("telefonu ve tarayıcıyı kullanıcının anlayacağı dilde yazar", () => {
    expect(
      cihazAdiCikar(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("iPhone · Safari");
    expect(cihazAdiCikar("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36")).toBe(
      "Windows bilgisayar · Chrome",
    );
  });

  it("masaüstü uygulamasını ayrı gösterir", () => {
    expect(cihazAdiCikar("herhangi", true)).toBe("Masaüstü uygulaması");
  });

  it("bilgi yoksa uydurmaz", () => {
    expect(cihazAdiCikar(null)).toBe("Bilinmeyen cihaz");
  });
});

describe("açık oturum listesi", () => {
  it("kullanıcının kendi cihazını işaretler", async () => {
    const { createHash } = await import("node:crypto");
    // Servis, çerezdeki anahtarın ÖZETİNİ karşılaştırır.
    const anahtar = "gecerli-anahtar";
    const ozet = createHash("sha256").update(anahtar).digest("hex");
    refreshFindMany.mockResolvedValue([
      {
        id: "1",
        tokenHash: ozet,
        userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0",
        isDesktop: false,
        lastUsedAt: new Date("2026-09-18T10:00:00Z"),
        createdAt: new Date("2026-09-18T09:00:00Z"),
      },
      {
        id: "2",
        tokenHash: "baska",
        userAgent: "Mozilla/5.0 (iPhone) Safari/604.1",
        isDesktop: false,
        lastUsedAt: new Date("2026-09-17T10:00:00Z"),
        createdAt: new Date("2026-09-17T09:00:00Z"),
      },
    ]);
    const liste = await listeleAcikOturumlar("kullanici-1", anahtar);
    expect(liste.map((o) => o.suAnki)).toEqual([true, false]);
    expect(liste[1]!.cihaz).toBe("iPhone · Safari");
  });

  it("yalnız iptal edilmemiş ve süresi geçmemiş oturumları sorar", async () => {
    refreshFindMany.mockResolvedValue([]);
    await listeleAcikOturumlar("kullanici-1");
    const where = refreshFindMany.mock.calls[0]![0].where;
    expect(where.userId).toBe("kullanici-1");
    expect(where.revokedAt).toBeNull();
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });
});

describe("uzaktan kapatma", () => {
  it("diğer cihazları kapatırken KENDİ oturumuna dokunmaz", async () => {
    refreshUpdateMany.mockResolvedValue({ count: 2 });
    const sayi = await kapatDigerOturumlar("kullanici-1", "gecerli-anahtar");
    expect(sayi).toBe(2);
    const where = refreshUpdateMany.mock.calls[0]![0].where;
    expect(where.userId).toBe("kullanici-1");
    expect(where.tokenHash.not).toEqual(expect.any(String));
  });

  it("başka kullanıcının oturumunu kapatamaz", async () => {
    // Sorgu her zaman userId ile sınırlandığından eşleşme olmaz → 404.
    refreshUpdateMany.mockResolvedValue({ count: 0 });
    await expect(kapatOturum("kullanici-1", "baskasinin-oturumu")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(refreshUpdateMany.mock.calls[0]![0].where.userId).toBe("kullanici-1");
  });
});
