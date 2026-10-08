import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ayar okuma (getSetting): aynı anda istenen anahtarlar TEK sorguda okunur
 * (Sentry "N+1 sorgu" uyarısı — /api/subscription/current).
 */
const m = vi.hoisted(() => ({ findMany: vi.fn(), findUnique: vi.fn() }));

vi.mock("../lib/prisma.js", () => ({
  prisma: { siteSetting: { findMany: m.findMany, findUnique: m.findUnique, upsert: vi.fn() } },
}));

import { clearAllSettingCache, getSetting, getSettingWithFallback } from "../lib/site-config.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  clearAllSettingCache();
  m.findMany.mockImplementation(async (arg: { where: { key: { in: string[] } } }) =>
    arg.where.key.in
      .filter((k) => k !== "olmayan")
      .map((k) => ({ key: k, value: k === "duz-metin" ? "merhaba" : JSON.stringify({ ad: k }) })),
  );
});

describe("getSetting — toplu okuma", () => {
  it("aynı anda istenen 10 ayarı tek sorguda okur", async () => {
    const anahtarlar = Array.from({ length: 10 }, (_, i) => `ayar-${i}`);
    const sonuc = await Promise.all(anahtarlar.map((k) => getSetting(k)));
    expect(m.findMany).toHaveBeenCalledTimes(1);
    expect(m.findMany.mock.calls[0][0].where.key.in.sort()).toEqual([...anahtarlar].sort());
    expect(m.findUnique).not.toHaveBeenCalled();
    expect(sonuc[3]).toEqual({ ad: "ayar-3" });
  });

  it("ikinci okuma bellekten gelir (yeni sorgu yok)", async () => {
    await Promise.all([getSetting("a"), getSetting("b")]);
    await Promise.all([getSetting("a"), getSetting("b")]);
    expect(m.findMany).toHaveBeenCalledTimes(1);
  });

  it("aynı anahtar birden çok kez istenirse sorguda bir kez geçer, hepsine aynı değer döner", async () => {
    const [x, y, z] = await Promise.all([getSetting("a"), getSetting("a"), getSetting("a")]);
    expect(m.findMany).toHaveBeenCalledTimes(1);
    expect(m.findMany.mock.calls[0][0].where.key.in).toEqual(["a"]);
    expect(x).toEqual(y);
    expect(y).toEqual(z);
  });

  it("olmayan anahtar null döner ve onun da sonucu bellekte tutulur", async () => {
    expect(await getSetting("olmayan")).toBeNull();
    expect(await getSetting("olmayan")).toBeNull();
    expect(m.findMany).toHaveBeenCalledTimes(1);
  });

  it("JSON olmayan değer metin olarak döner; yedek değer yalnızca eksikse kullanılır", async () => {
    expect(await getSetting("duz-metin")).toBe("merhaba");
    expect(await getSettingWithFallback("olmayan", 42)).toBe(42);
    expect(await getSettingWithFallback("a", 42)).toEqual({ ad: "a" });
  });

  it("veritabanı hatası bekleyen herkese iletilir ve bellek zehirlenmez", async () => {
    m.findMany.mockRejectedValueOnce(new Error("bağlantı koptu"));
    const sonuclar = await Promise.allSettled([getSetting("a"), getSetting("b")]);
    expect(sonuclar.every((r) => r.status === "rejected")).toBe(true);
    // Sonraki deneme yeniden sorgular ve başarılı olur.
    expect(await getSetting("a")).toEqual({ ad: "a" });
  });
});
