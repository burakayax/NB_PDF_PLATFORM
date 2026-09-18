import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * HESAP PAYLAŞIMI SİNYALİ.
 *
 * Bu ölçüm yöneticiye yalnız GÖRÜNÜRLÜK verir; hiçbir hesabı kendiliğinden
 * kısıtlamaz. Testler iki şeyi korur: (1) sayım aynı cihazın tekrar tekrar
 * yenilenen oturumlarını ŞİŞİRMEZ, (2) eşikler sessizce kaymaz.
 */

const findMany = vi.fn();
vi.mock("../lib/prisma.js", () => ({
  prisma: { refreshToken: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

const { hesapPaylasimSinyali } = await import("../modules/auth/session-insight.service.js");

const gelecek = new Date(Date.now() + 86_400_000);
const gecmis = new Date(Date.now() - 86_400_000);

function kayit(deviceKey: string | null, ipHash: string | null, acik = true) {
  return {
    deviceKey,
    ipHash,
    revokedAt: acik ? null : new Date(),
    expiresAt: acik ? gelecek : gecmis,
  };
}

beforeEach(() => findMany.mockReset());

describe("paylaşım sinyali", () => {
  it("aynı cihazın defalarca yenilenen oturumunu tek cihaz sayar", async () => {
    // Oturum anahtarı her yenilemede değişir; tek kullanıcı günde onlarca kayıt üretir.
    findMany.mockResolvedValue(
      Array.from({ length: 40 }, () => kayit("cihaz-a", "ag-1", false)).concat([
        kayit("cihaz-a", "ag-1"),
      ]),
    );
    const s = await hesapPaylasimSinyali("k1");
    expect(s.cihazSayisi).toBe(1);
    expect(s.acikOturum).toBe(1);
    expect(s.risk).toBe("normal");
  });

  it("birkaç cihaz olağan sayılır (telefon + bilgisayar + tablet)", async () => {
    findMany.mockResolvedValue([
      kayit("a", "ag-1"),
      kayit("b", "ag-1"),
      kayit("c", "ag-2"),
    ]);
    expect((await hesapPaylasimSinyali("k1")).risk).toBe("normal");
  });

  it("beş farklı cihaz 'izlenmeli' der ama paylaşım ilan etmez", async () => {
    findMany.mockResolvedValue(
      ["a", "b", "c", "d", "e"].map((d) => kayit(d, "ag-1")),
    );
    const s = await hesapPaylasimSinyali("k1");
    expect(s.risk).toBe("izlenmeli");
    expect(s.aciklama).toContain("tek başına paylaşım kanıtı değil");
  });

  it("sekiz farklı cihaz olağandışı sayılır", async () => {
    findMany.mockResolvedValue(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((d) => kayit(d, "ag-1")),
    );
    expect((await hesapPaylasimSinyali("k1")).risk).toBe("yuksek");
  });

  it("çok sayıda farklı ağ da tek başına işaret verir", async () => {
    findMany.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => kayit("a", `ag-${i}`)),
    );
    const s = await hesapPaylasimSinyali("k1");
    expect(s.agSayisi).toBe(12);
    expect(s.risk).toBe("yuksek");
  });

  it("yalnız verilen pencereye bakar", async () => {
    findMany.mockResolvedValue([]);
    await hesapPaylasimSinyali("k1", 7);
    const where = findMany.mock.calls[0]![0].where;
    expect(where.userId).toBe("k1");
    const fark = Date.now() - where.createdAt.gte.getTime();
    expect(Math.round(fark / 86_400_000)).toBe(7);
  });

  it("cihaz bilgisi olmayan eski kayıtlar sayımı bozmaz", async () => {
    findMany.mockResolvedValue([kayit(null, null), kayit(null, null), kayit("a", "ag-1")]);
    const s = await hesapPaylasimSinyali("k1");
    expect(s.cihazSayisi).toBe(1);
  });
});
