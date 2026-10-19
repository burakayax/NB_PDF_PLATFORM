import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  READ_PER_MINUTE,
  apiRateLimitForRequest,
  rateLimitCountsTowardAbuseBlock,
  rateLimitTierForRequest,
} from "../lib/api-security-settings.js";

/**
 * Sayfa başına tekrar çağrılan okuma uçları (kota, plan, bakiye, oturumlar, puan) ortak
 * kovaya girince ~18. sayfada 429 alınıyor, plan bilgisi kayboluyordu.
 */
const istek = (method: string, path: string) =>
  ({ method, baseUrl: "/api", path }) as unknown as Request;
const cfg = { defaultPerMinute: 60 } as never;

describe("okuma uçları hız sınırı", () => {
  const okumalar = [
    "/ai/quota",
    "/auth/sessions",
    "/tool-rating/watermark",
    "/entitlement/balance",
    "/subscription/current",
    "/subscription/status",
  ];

  it.each(okumalar)("%s GET kendi geniş kovasındadır", (yol) => {
    const r = istek("GET", yol);
    expect(rateLimitTierForRequest(r)).toBe("read");
    expect(apiRateLimitForRequest(r, cfg)).toBe(READ_PER_MINUTE);
    expect(rateLimitCountsTowardAbuseBlock(r)).toBe(false);
  });

  it("yazan istekler (oturum kapatma, oy verme) genel kovada kalır", () => {
    for (const [m, y] of [["DELETE", "/auth/sessions/abc"], ["POST", "/tool-rating/watermark"], ["POST", "/auth/sessions/revoke-others"]]) {
      const r = istek(m, y);
      expect(rateLimitTierForRequest(r)).toBe("default");
      expect(apiRateLimitForRequest(r, cfg)).toBe(60);
    }
  });

  it("dakikada ~10 sayfa gezen tek kullanıcı hiçbir kovayı doldurmaz", () => {
    const sayfaBasinaIstek = ["/ai/quota", "/auth/sessions", "/tool-rating/x", "/entitlement/balance", "/subscription/current", "/subscription/status"];
    const sayac = new Map<string, number>();
    for (let sayfa = 0; sayfa < 25; sayfa++) {
      // 3 sn arayla 25 sayfa ≈ 75 sn; en kötü pencere 60 sn → 20 sayfa
      if (sayfa >= 20) break;
      for (const y of sayfaBasinaIstek) {
        const r = istek("GET", y);
        const k = rateLimitTierForRequest(r);
        sayac.set(k, (sayac.get(k) ?? 0) + 1);
      }
    }
    expect((sayac.get("read") ?? 0)).toBeLessThan(READ_PER_MINUTE);
  });
});
