import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const saved: unknown[] = [];
let storedSecrets: Record<string, string> | null = null;

vi.mock("../modules/social/social.service.js", () => ({
  readAccountSecrets: vi.fn(async () => storedSecrets),
  saveAccount: vi.fn(async (input: unknown) => {
    saved.push(input);
    return [];
  }),
}));

import {
  buildTiktokAuthorizeUrl,
  createTiktokState,
  tiktokRedirectUri,
  verifyTiktokState,
} from "../modules/social/platforms/tiktok.platform.js";
import { tiktokCallbackRouter } from "../modules/social/tiktok.routes.js";

describe("TikTok state", () => {
  it("üretilen state doğrulanır, bozulan ya da süresi dolan doğrulanmaz", () => {
    const state = createTiktokState();
    expect(verifyTiktokState(state)).toBe(true);
    expect(verifyTiktokState(`${state}x`)).toBe(false);
    expect(verifyTiktokState("a.b.c")).toBe(false);
    expect(verifyTiktokState(undefined)).toBe(false);
    expect(verifyTiktokState(state, Date.now() + 11 * 60_000)).toBe(false);
  });

  it("izin ekranı adresi geri dönüş adresini ve state'i taşır", () => {
    const url = new URL(buildTiktokAuthorizeUrl("ck123", "st"));
    expect(url.origin + url.pathname).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(url.searchParams.get("client_key")).toBe("ck123");
    expect(url.searchParams.get("redirect_uri")).toBe(tiktokRedirectUri());
    expect(url.searchParams.get("state")).toBe("st");
    expect(tiktokRedirectUri()).toMatch(/\/api\/auth\/tiktok\/callback$/);
  });
});

describe("TikTok geri dönüş adresi", () => {
  let server: Server;
  let base = "";
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    const app = express();
    app.use("/api/auth/tiktok", tiktokCallbackRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/tiktok/callback`;
  });
  afterAll(() => {
    server.close();
    globalThis.fetch = realFetch;
  });

  beforeEach(() => {
    saved.length = 0;
    storedSecrets = { clientKey: "ck", clientSecret: "cs" };
    // Yalnız TikTok adreslerini taklit eder; yerel sınama isteği gerçek fetch ile gider.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://open.tiktokapis.com/v2/oauth/token/")) {
        expect(String(init?.body)).toContain("grant_type=authorization_code");
        expect(String(init?.body)).toContain("code=abc");
        return new Response(
          JSON.stringify({ access_token: "AT", refresh_token: "RT", open_id: "oid", refresh_expires_in: 31536000 }),
          { status: 200 },
        );
      }
      if (url.startsWith("https://open.tiktokapis.com/v2/user/info/")) {
        return new Response(JSON.stringify({ data: { user: { display_name: "PDF Platform" } }, error: { code: "ok" } }), {
          status: 200,
        });
      }
      return realFetch(input, init);
    }) as typeof fetch;
  });

  it("geçerli state ve kodla anahtarları şifreli kayda yazar, anahtarı sayfada göstermez", async () => {
    const res = await fetch(`${base}?code=abc&state=${encodeURIComponent(createTiktokState())}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("TikTok bağlandı");
    expect(html).toContain("PDF Platform");
    expect(html).not.toContain("AT");
    expect(html).not.toContain("RT");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      platform: "TIKTOK",
      displayName: "PDF Platform",
      secrets: { accessToken: "AT", refreshToken: "RT" },
    });
  });

  it("state geçersizse reddeder ve hiçbir şey kaydetmez", async () => {
    const res = await fetch(`${base}?code=abc&state=sahte`);
    expect(res.status).toBe(400);
    expect(saved).toHaveLength(0);
  });

  it("kullanıcı izni reddederse bunu anlatır", async () => {
    const res = await fetch(`${base}?error=access_denied&error_description=reddetti&state=${encodeURIComponent(createTiktokState())}`);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("reddetti");
    expect(saved).toHaveLength(0);
  });

  it("Client Key kayıtlı değilse uyarır", async () => {
    storedSecrets = null;
    const res = await fetch(`${base}?code=abc&state=${encodeURIComponent(createTiktokState())}`);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Client Key");
  });

  it("TikTok kodu reddederse hata sayfası verir, kaydetmez", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes("tiktokapis.com")
        ? new Response(JSON.stringify({ error: "invalid_grant", error_description: "Authorization code expired" }), { status: 200 })
        : realFetch(input, init),
    ) as typeof fetch;
    const res = await fetch(`${base}?code=abc&state=${encodeURIComponent(createTiktokState())}`);
    expect(res.status).toBe(502);
    expect(await res.text()).toContain("invalid_grant");
    expect(saved).toHaveLength(0);
  });
});
