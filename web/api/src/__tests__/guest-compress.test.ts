import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MİSAFİR PDF SIKIŞTIR — panelden ayarlanan değerler ve veritabanı sayacı.
 *  1. Ayar güvenli: bozuk/eksik kayıt "açık, varsayılan"; sınırlar aşılamaz; 0 = KAPALI (sınırsız DEĞİL).
 *  2. Dahili uçlar yalnızca sırla çalışır; limit istemciden DEĞİL ayardan türer.
 *  3. Ana anahtar kapalıyken hiçbir hak verilmez.
 *  4. Sayaç tek atomik koşullu artırımla çalışır; kapalı limitte veritabanına yazılmaz.
 */

const m = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  hasSecret: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
}));

vi.mock("../lib/site-config.service.js", () => ({
  getSettingWithFallback: m.getSetting,
  setSetting: m.setSetting,
}));
vi.mock("../middleware/api-security.middleware.js", () => ({ requestHasInternalServiceSecret: m.hasSecret }));
vi.mock("../lib/prisma.js", () => {
  const usage = { upsert: m.upsert, updateMany: m.updateMany, findUnique: m.findUnique, count: m.count };
  return {
    prisma: {
      editorDownloadUsage: usage,
      $transaction: async (fn: (tx: { editorDownloadUsage: typeof usage }) => unknown) => fn({ editorDownloadUsage: usage }),
    },
  };
});

import {
  GUEST_COMPRESS_DEFAULTS,
  isGuestCompressClosed,
  normalizeGuestCompressConfig,
  writeGuestCompressConfig,
} from "../modules/guest-compress/guest-compress.config.js";
import {
  guestCompressConfigController,
  guestCompressUsageController,
} from "../modules/guest-compress/guest-compress.internal.js";
import {
  consumeGuestCompress,
  personIdKey,
  refundGuestCompress,
} from "../modules/guest-compress/guest-compress.usage.js";

const HASH = "g:" + "a".repeat(32);

function res() {
  const out: { status?: number; body?: unknown } = {};
  const r = {
    status(code: number) {
      out.status = code;
      return r;
    },
    json(b: unknown) {
      out.body = b;
      return r;
    },
  };
  return { r, out };
}
const req = (body?: unknown) => ({ body }) as never;

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  process.env.INTERNAL_SERVICE_SECRET = "test-secret";
  m.hasSecret.mockReturnValue(true);
  m.getSetting.mockResolvedValue({});
  m.upsert.mockResolvedValue({});
  m.updateMany.mockResolvedValue({ count: 1 });
  m.findUnique.mockResolvedValue({ count: 1 });
});

describe("ayar güvenliği", () => {
  it("kayıt yoksa/bozuksa açık ve varsayılan limitlerle çalışır", () => {
    expect(normalizeGuestCompressConfig(undefined)).toEqual(GUEST_COMPRESS_DEFAULTS);
    expect(normalizeGuestCompressConfig({ dailyLimit: "abc", maxMB: null, globalDailyLimit: NaN })).toEqual(GUEST_COMPRESS_DEFAULTS);
  });

  it("yalnızca açıkça false olan ana anahtar kapatır", () => {
    expect(normalizeGuestCompressConfig({ enabled: false }).enabled).toBe(false);
    expect(normalizeGuestCompressConfig({ enabled: "false" }).enabled).toBe(true);
    expect(normalizeGuestCompressConfig({ enabled: 0 }).enabled).toBe(true);
  });

  it("sınırlar aşılamaz: 9999 hak ya da 0 MB girilse bile güvenli aralığa çekilir", () => {
    const c = normalizeGuestCompressConfig({ dailyLimit: 9999, globalDailyLimit: 10_000_000, maxMB: 0 });
    expect(c.dailyLimit).toBe(20);
    expect(c.globalDailyLimit).toBe(100_000);
    expect(c.maxMB).toBe(1);
  });

  it("0 = KAPALI: sınırsız anlamına gelmez", () => {
    expect(isGuestCompressClosed(normalizeGuestCompressConfig({ dailyLimit: 0 }))).toBe(true);
    expect(isGuestCompressClosed(normalizeGuestCompressConfig({ globalDailyLimit: 0 }))).toBe(true);
    expect(isGuestCompressClosed(normalizeGuestCompressConfig({ enabled: false }))).toBe(true);
    expect(isGuestCompressClosed(normalizeGuestCompressConfig({}))).toBe(false);
  });

  it("yazarken mevcut değerlerle birleştirir ve sınırlar", async () => {
    m.getSetting.mockResolvedValue({ dailyLimit: 2, maxMB: 30 });
    const next = await writeGuestCompressConfig({ globalDailyLimit: 50, dailyLimit: 500 });
    expect(next).toEqual({ enabled: true, dailyLimit: 20, globalDailyLimit: 50, maxMB: 30 });
    expect(m.setSetting).toHaveBeenCalledWith("guest.compress", next);
  });
});

describe("dahili uçlar", () => {
  it("sır yoksa yapılandırma okunamaz", async () => {
    m.hasSecret.mockReturnValue(false);
    await expect(guestCompressConfigController(req(), res().r as never)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("sunucuda sır tanımlı değilse 503 verir", async () => {
    delete process.env.INTERNAL_SERVICE_SECRET;
    await expect(guestCompressConfigController(req(), res().r as never)).rejects.toMatchObject({ statusCode: 503 });
  });

  it("ayarı kapalı bilgisiyle döndürür", async () => {
    m.getSetting.mockResolvedValue({ enabled: false });
    const { r, out } = res();
    await guestCompressConfigController(req(), r as never);
    expect(out.body).toMatchObject({ enabled: false, closed: true, dailyLimit: 1, globalDailyLimit: 400, maxMB: 20 });
  });

  it("limit istemciden DEĞİL ayardan alınır (istemci 999 yollasa da)", async () => {
    m.getSetting.mockResolvedValue({ dailyLimit: 2 });
    const { r, out } = res();
    await guestCompressUsageController(req({ action: "consume", scope: "person", key: HASH, limit: 999 }), r as never);
    expect(out.body).toMatchObject({ allowed: true, limit: 2 });
    expect(m.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ idKey: `gc:${HASH}`, count: { lt: 2 } }) }),
    );
  });

  it("toplam kapasite ayrı anahtarla ve toplam limitle sayılır", async () => {
    m.getSetting.mockResolvedValue({ globalDailyLimit: 7 });
    const { r } = res();
    await guestCompressUsageController(req({ action: "consume", scope: "global" }), r as never);
    expect(m.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ idKey: "gc:global", count: { lt: 7 } }) }),
    );
  });

  it("ana anahtar kapalıyken hak verilmez ve veritabanına yazılmaz", async () => {
    m.getSetting.mockResolvedValue({ enabled: false, dailyLimit: 5 });
    const { r, out } = res();
    await guestCompressUsageController(req({ action: "consume", scope: "person", key: HASH }), r as never);
    expect(out.body).toMatchObject({ allowed: false, limit: 0 });
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("geçersiz kişi anahtarını (düz IP gibi) reddeder", async () => {
    for (const key of ["203.0.113.7", "g:xyz", "u:123", "", undefined]) {
      await expect(
        guestCompressUsageController(req({ action: "peek", scope: "person", key }), res().r as never),
      ).rejects.toMatchObject({ statusCode: 400 });
    }
  });

  it("iade ve okuma çalışır", async () => {
    const a = res();
    await guestCompressUsageController(req({ action: "refund", scope: "person", key: HASH }), a.r as never);
    expect(a.out.body).toEqual({ ok: true });
    expect(m.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { count: { decrement: 1 } }, where: expect.objectContaining({ count: { gt: 0 } }) }),
    );
    const b = res();
    m.findUnique.mockResolvedValue({ count: 1 });
    await guestCompressUsageController(req({ action: "peek", scope: "person", key: HASH }), b.r as never);
    expect(b.out.body).toMatchObject({ used: 1, limit: 1 });
  });
});

describe("sayaç", () => {
  it("kişi anahtarı yalnızca 'g:<32 hex>' biçimini kabul eder ve gc: önekiyle saklar", () => {
    expect(personIdKey(HASH)).toBe(`gc:${HASH}`);
    expect(personIdKey("g:" + "A".repeat(32))).toBeNull(); // yalnız küçük harf hex
    expect(personIdKey("203.0.113.7")).toBeNull();
  });

  it("limit doluysa izin vermez (sayaç artmaz)", async () => {
    m.updateMany.mockResolvedValue({ count: 0 });
    m.findUnique.mockResolvedValue({ count: 1 });
    const d = await consumeGuestCompress("gc:x", 1);
    expect(d).toMatchObject({ allowed: false, used: 1, limit: 1 });
  });

  it("limit 0 iken veritabanına hiç yazmaz ve izin vermez", async () => {
    const d = await consumeGuestCompress("gc:x", 0);
    expect(d.allowed).toBe(false);
    expect(m.upsert).not.toHaveBeenCalled();
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("iade yalnızca bugünkü, sıfırdan büyük sayacı düşürür", async () => {
    await refundGuestCompress("gc:x");
    expect(m.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ idKey: "gc:x", count: { gt: 0 } }) }),
    );
  });
});
