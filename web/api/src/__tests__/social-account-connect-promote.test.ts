import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hesap bağlanmadan önce “elle paylaşılacak” diye açılmış araç videosu gönderileri, hesap
 * yayına hazır olunca taslağa çevrilir; böylece “Şimdi paylaş” / Otomatik mod onlar için de çalışır.
 */
const updateMany = vi.fn(async (_args: unknown) => ({ count: 1 }));
let stored: { secretsJson: string; displayName: string; enabled: boolean } | null = null;

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    socialAccount: {
      findUnique: vi.fn(async () => stored),
      findMany: vi.fn(async () => []),
      upsert: vi.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        stored = { ...(create as never), ...(update as never) };
        return stored;
      }),
    },
    socialPost: { updateMany },
  },
}));
vi.mock("../lib/site-config.service.js", () => ({ getSettingWithFallback: vi.fn(async () => ({})), setSetting: vi.fn() }));
vi.mock("../lib/encryption.js", () => ({
  encryptField: (s: string) => s,
  decryptField: (s: string) => s,
}));

describe("hesap bağlanınca elle paylaşılacak araç videoları taslağa döner", () => {
  beforeEach(() => {
    updateMany.mockClear();
    stored = null;
  });

  it("tüm anahtarlar doluysa MANUAL araç videosu gönderileri DRAFT olur", async () => {
    const { saveAccount } = await import("../modules/social/social.service.js");
    await saveAccount({
      platform: "TIKTOK",
      secrets: { clientKey: "a", clientSecret: "b", accessToken: "c", refreshToken: "d" },
    });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { platform: "TIKTOK", status: "MANUAL" },
      data: { status: "DRAFT" },
    });
  });

  it("anahtarlar eksikse dokunmaz (hesap henüz hazır değil)", async () => {
    const { saveAccount } = await import("../modules/social/social.service.js");
    await saveAccount({ platform: "TIKTOK", secrets: { clientKey: "a", clientSecret: "b" } });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
