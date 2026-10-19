import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  REFRESH_PER_MINUTE,
  apiRateLimitForRequest,
  isSessionRefreshRequest,
  rateLimitCountsTowardAbuseBlock,
  rateLimitTierForRequest,
} from "../lib/api-security-settings.js";

/**
 * Oturum yenileme, genel istek kovasına ve IP blok sayacına girmemeli: her sayfa
 * yüklemesinde bir kez çağrılır; kova dolunca 429 alıp kullanıcıyı sessizce oturumdan
 * düşürüyor, kötüye kullanım sayacı da ortak IP'yi bloklayıp herkesi düşürüyordu.
 */
const istek = (method: string, path: string) =>
  ({ method, baseUrl: "/api", path }) as unknown as Request;

describe("oturum yenileme hız sınırı", () => {
  it("kendi kovasında ve genel limitten geniştir", () => {
    const cfg = { defaultPerMinute: 60 } as never;
    const r = istek("POST", "/auth/refresh");
    expect(rateLimitTierForRequest(r)).toBe("auth-refresh");
    expect(apiRateLimitForRequest(r, cfg)).toBe(REFRESH_PER_MINUTE);
    expect(REFRESH_PER_MINUTE).toBeGreaterThan(60);
  });

  it("IP blok sayacına katılmaz ve bloktan muaftır", () => {
    const r = istek("POST", "/auth/refresh");
    expect(rateLimitCountsTowardAbuseBlock(r)).toBe(false);
    expect(isSessionRefreshRequest(r)).toBe(true);
  });

  it("diğer uçlar etkilenmez", () => {
    const cfg = { defaultPerMinute: 60 } as never;
    const d = istek("POST", "/auth/logout");
    expect(apiRateLimitForRequest(d, cfg)).toBe(60);
    expect(rateLimitCountsTowardAbuseBlock(d)).toBe(true);
    expect(isSessionRefreshRequest(istek("GET", "/auth/refresh"))).toBe(false);
  });
});
