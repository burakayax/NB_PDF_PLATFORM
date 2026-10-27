import { describe, expect, it, vi } from "vitest";

/**
 * "BENİ HATIRLA" oturum politikası.
 *
 * Kural: işaretli oturum giriş anından en çok REMEMBER_ME_TTL_DAYS (30) gün yaşar ve
 * yenilemeyle UZAMAZ; işaretsiz oturum tarayıcı kapanınca biter, boşta
 * SESSION_IDLE_HOURS sonra kapanır ve en çok REFRESH_TOKEN_TTL_DAYS yaşar; eski
 * davranış (Google/masaüstü) her yenilemede uzar. Burada yalnız süre hesabı sabitlenir.
 */

vi.mock("../lib/prisma.js", () => ({ prisma: {} }));
vi.mock("../config/env.js", () => ({
  env: {
    REFRESH_TOKEN_TTL_DAYS: 7,
    REMEMBER_ME_TTL_DAYS: 30,
    SESSION_IDLE_HOURS: 24,
    JWT_ACCESS_SECRET: "x".repeat(40),
    JWT_REFRESH_SECRET: "y".repeat(40),
    NODE_ENV: "test",
  },
}));

const { oturumBitisi } = await import("../modules/auth/auth.service.js");

const GUN = 24 * 60 * 60 * 1000;
const t0 = new Date("2026-11-01T10:00:00Z");

describe("oturumBitisi", () => {
  it("eski davranış: her yenilemede 7 gün uzar", () => {
    const p = { persistent: true, absoluteExpiresAt: null };
    expect(oturumBitisi(p, t0).getTime()).toBe(t0.getTime() + 7 * GUN);
    const sonra = new Date(t0.getTime() + 5 * GUN);
    expect(oturumBitisi(p, sonra).getTime()).toBe(sonra.getTime() + 7 * GUN);
  });

  it("hatırla: bitiş mutlak sondur, yenileme uzatmaz", () => {
    const mutlak = new Date(t0.getTime() + 30 * GUN);
    const p = { persistent: true, absoluteExpiresAt: mutlak };
    expect(oturumBitisi(p, t0).getTime()).toBe(mutlak.getTime());
    const yirmiGunSonra = new Date(t0.getTime() + 20 * GUN);
    expect(oturumBitisi(p, yirmiGunSonra).getTime()).toBe(mutlak.getTime());
  });

  it("hatırlama: boşta 24 saat, ama mutlak 7 günü aşamaz", () => {
    const mutlak = new Date(t0.getTime() + 7 * GUN);
    const p = { persistent: false, absoluteExpiresAt: mutlak };
    expect(oturumBitisi(p, t0).getTime()).toBe(t0.getTime() + GUN);
    const altinciGun = new Date(t0.getTime() + 6.5 * GUN);
    expect(oturumBitisi(p, altinciGun).getTime()).toBe(mutlak.getTime());
  });
});
