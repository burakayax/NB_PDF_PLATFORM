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

import { publishToTiktok, tiktokPollPauseMs, toTiktokTitle } from "../modules/social/platforms/tiktok.platform.js";

describe("TikTok video yayını", () => {
  const realFetch = globalThis.fetch;
  const VIDEO = "https://api.pdfplatform.app/api/public/tool-reels/compress-1.mp4";
  const secrets = { clientKey: "ck", clientSecret: "cs", accessToken: "old", refreshToken: "RT0" };
  const item = { guid: "tool-reel:compress", title: "PDF Sıkıştır" } as never;
  let initPrivacies: string[] = [];
  let publicRejected = false;
  let creatorOptions: string[] = ["PUBLIC_TO_EVERYONE", "SELF_ONLY"];
  let statuses: string[] = [];
  let uploadHeaders: Record<string, string> = {};

  beforeEach(() => {
    saved.length = 0;
    initPrivacies = [];
    publicRejected = true;
    creatorOptions = ["PUBLIC_TO_EVERYONE", "SELF_ONLY"];
    statuses = ["PROCESSING_UPLOAD", "PUBLISH_COMPLETE"];
    tiktokPollPauseMs.value = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
      if (url === VIDEO) return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
      if (url.endsWith("/oauth/token/")) {
        expect(String(init?.body)).toContain("grant_type=refresh_token");
        return json({ access_token: "NEW", refresh_token: "RT1", refresh_expires_in: 100 });
      }
      if (url.endsWith("/creator_info/query/")) return json({ data: { privacy_level_options: creatorOptions }, error: { code: "ok" } });
      if (url.endsWith("/video/init/")) {
        const body = JSON.parse(String(init?.body)) as { post_info: { privacy_level: string }; source_info: { video_size: number } };
        initPrivacies.push(body.post_info.privacy_level);
        expect(body.source_info.video_size).toBe(4);
        if (body.post_info.privacy_level === "PUBLIC_TO_EVERYONE" && publicRejected) {
          return json({ error: { code: "unaudited_client_can_only_post_to_private_accounts", message: "x" } }, 403);
        }
        return json({ data: { publish_id: "pub1", upload_url: "https://upload.tiktok.test/u" }, error: { code: "ok" } });
      }
      if (url === "https://upload.tiktok.test/u") {
        uploadHeaders = init?.headers as Record<string, string>;
        return new Response("", { status: 201 });
      }
      if (url.endsWith("/status/fetch/")) {
        const status = statuses.shift() ?? "PUBLISH_COMPLETE";
        return json({ data: { status, publicaly_available_post_id: status === "PUBLISH_COMPLETE" ? ["777"] : [] }, error: { code: "ok" } });
      }
      return realFetch(input, init);
    }) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  it("denetimsiz uygulamada herkese açık reddedilince 'yalnız ben' ile yeniden dener ve bunu uyarı olarak bildirir", async () => {
    const result = await publishToTiktok({ body: "Açıklama #pdf", imageUrl: VIDEO, item, secrets });
    expect(initPrivacies).toEqual(["PUBLIC_TO_EVERYONE", "SELF_ONLY"]);
    expect(result.externalId).toBe("777");
    expect(result.warning).toContain("yalnız ben");
    expect(uploadHeaders["content-range"]).toBe("bytes 0-3/4");
    // Yenilenen yenileme anahtarı saklanır (TikTok her yenilemede değiştirebilir).
    expect(saved[0]).toMatchObject({ platform: "TIKTOK", secrets: { accessToken: "NEW", refreshToken: "RT1" } });
  });

  it("denetimli hesapta herkese açık paylaşır, uyarı vermez", async () => {
    publicRejected = false;
    const result = await publishToTiktok({ body: "Açıklama", imageUrl: VIDEO, item, secrets });
    expect(initPrivacies).toEqual(["PUBLIC_TO_EVERYONE"]);
    expect(result.warning).toBeUndefined();
  });

  it("hesap yalnız 'yalnız ben' sunuyorsa doğrudan onu seçer", async () => {
    creatorOptions = ["SELF_ONLY"];
    await publishToTiktok({ body: "Açıklama", imageUrl: VIDEO, item, secrets });
    expect(initPrivacies).toEqual(["SELF_ONLY"]);
  });

  it("TikTok videoyu reddederse hata verir", async () => {
    publicRejected = false;
    statuses = ["FAILED"];
    const failing = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).endsWith("/status/fetch/")
        ? new Response(JSON.stringify({ data: { status: "FAILED", fail_reason: "duration_check_failed" }, error: { code: "ok" } }))
        : (failing as typeof fetch)(input, init),
    ) as typeof fetch;
    await expect(publishToTiktok({ body: "x", imageUrl: VIDEO, item, secrets })).rejects.toThrow(/duration_check_failed/);
  });

  it("video adresi yoksa paylaşmaz", async () => {
    await expect(publishToTiktok({ body: "x", imageUrl: null, item, secrets })).rejects.toThrow(/video/);
  });

  it("açıklamayı 2200 karakterde keser", () => {
    expect(toTiktokTitle("a".repeat(3000)).length).toBe(2200);
  });
});
