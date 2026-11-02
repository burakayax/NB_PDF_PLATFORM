import { beforeEach, describe, expect, it, vi } from "vitest";

const saved: Array<{ secrets: Record<string, string> }> = [];
let stored: Record<string, string> = {};

vi.mock("../modules/social/social.service.js", () => ({
  readAccountSecrets: vi.fn(async () => stored),
  readSocialConfig: vi.fn(async () => ({ tiktokPublic: false, tiktokBrandOrganic: true })),
  saveAccount: vi.fn(async (input: { secrets: Record<string, string> }) => {
    saved.push(input);
    // Kayıt gerçekte olduğu gibi güncellenir: sonraki okuma en yeni yenileme anahtarını görür.
    stored = { ...stored, ...input.secrets };
    return [];
  }),
}));

import { loadTiktokCreator } from "../modules/social/platforms/tiktok.platform.js";

/**
 * TikTok 1 Aralık 2026'dan itibaren her yenilemede yeni yenileme anahtarı verir ve eskisini geçersiz kılar.
 * Aynı anda iki yenileme yapılırsa ikincisi patlar; bu yüzden tek sıra + bellek önbelleği şart.
 */
describe("TikTok yenileme anahtarı dönüşü", () => {
  beforeEach(() => {
    saved.length = 0;
    stored = { clientKey: "ck", clientSecret: "cs", accessToken: "a0", refreshToken: "r0" };
  });

  it("eşzamanlı çağrılar tek yenileme yapar, yeni yenileme anahtarını kaydeder ve eskisini bir daha kullanmaz", async () => {
    const refreshBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/oauth/token/")) {
          const body = String(init?.body);
          refreshBodies.push(body);
          // Eski anahtarla ikinci kez gelirse TikTok reddeder.
          if (!body.includes("refresh_token=r0") || refreshBodies.length > 1) {
            return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 200 });
          }
          return new Response(
            JSON.stringify({ access_token: "a1", refresh_token: "r1", refresh_expires_in: 15552000, open_id: "o" }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            data: { creator_nickname: "Ben", creator_avatar_url: "x", privacy_level_options: ["SELF_ONLY"] },
            error: { code: "ok" },
          }),
          { status: 200 },
        );
      }),
    );

    const [a, b] = await Promise.all([loadTiktokCreator(stored), loadTiktokCreator(stored)]);
    expect(a.nickname).toBe("Ben");
    expect(b.nickname).toBe("Ben");
    expect(refreshBodies).toHaveLength(1);
    expect(saved[0]?.secrets).toEqual({ accessToken: "a1", refreshToken: "r1" });
    vi.unstubAllGlobals();
  });
});
