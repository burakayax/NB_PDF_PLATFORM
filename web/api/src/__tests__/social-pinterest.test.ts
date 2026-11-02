import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let stored: Record<string, string> = {};
let sandbox = true;
let tokenInfo: { env: "sandbox" | "production"; accessExpiresAt: number | null; refreshExpiresAt: number | null } | null = null;
const saved: Array<{ secrets: Record<string, string> }> = [];
const configWrites: unknown[] = [];

vi.mock("../modules/social/social.service.js", () => ({
  readAccountSecrets: vi.fn(async () => stored),
  readSocialConfig: vi.fn(async () => ({ pinterestSandbox: sandbox, pinterestToken: tokenInfo })),
  writeSocialConfig: vi.fn(async (patch: { pinterestToken?: typeof tokenInfo }) => {
    configWrites.push(patch);
    if (patch.pinterestToken) tokenInfo = patch.pinterestToken;
    return {};
  }),
  saveAccount: vi.fn(async (input: { secrets: Record<string, string> }) => {
    saved.push(input);
    return [];
  }),
}));

import { isPublicApiPath } from "../middleware/api-security.middleware.js";
import {
  buildPinterestAuthorizeUrl,
  createPinterestPin,
  createPinterestState,
  describePinterestError,
  exchangePinterestCode,
  listPinterestBoards,
  parsePinterestTokenResponse,
  pinterestRedirectUri,
  renewPinterestIfDue,
  verifyPinterestState,
} from "../modules/social/platforms/pinterest.platform.js";
import { PlatformError } from "../modules/social/platforms/common.js";

const fetchMock = vi.fn();

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  saved.length = 0;
  configWrites.length = 0;
  sandbox = true;
  tokenInfo = { env: "sandbox", accessExpiresAt: Date.now() + 25 * 86_400_000, refreshExpiresAt: Date.now() + 55 * 86_400_000 };
  stored = { appId: "app1", appSecret: "sec1", accessToken: "old", refreshToken: "ref", boardId: "b1" };
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("Pinterest state ve izin adresi", () => {
  it("state doğrulanır, bozulan ya da süresi dolan doğrulanmaz", () => {
    const state = createPinterestState();
    expect(verifyPinterestState(state)).toBe(true);
    expect(verifyPinterestState(`${state}x`)).toBe(false);
    expect(verifyPinterestState(undefined)).toBe(false);
    expect(verifyPinterestState(state, Date.now() + 11 * 60_000)).toBe(false);
  });

  it("izin ekranı adresi doğru parametreleri taşır", () => {
    const url = new URL(buildPinterestAuthorizeUrl("app1", "st"));
    expect(url.origin + url.pathname).toBe("https://www.pinterest.com/oauth/");
    expect(url.searchParams.get("client_id")).toBe("app1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("redirect_uri")).toBe(pinterestRedirectUri());
    expect(url.searchParams.get("scope")).toBe("boards:read,boards:write,pins:read,pins:write,user_accounts:read");
    expect(pinterestRedirectUri()).toMatch(/\/api\/auth\/pinterest\/callback$/);
  });

  it("geri dönüş adresi girişsiz açık, komşuları kapalı", () => {
    expect(isPublicApiPath("GET", "/auth/pinterest/callback")).toBe(true);
    expect(isPublicApiPath("POST", "/auth/pinterest/callback")).toBe(false);
    expect(isPublicApiPath("GET", "/admin/social/pinterest/connect")).toBe(false);
  });
});

describe("Pinterest hata açıklamaları", () => {
  it("kimlik doğrulama hatası Türkçe ve yeniden bağlanmayı söyler", () => {
    const msg = describePinterestError(new PlatformError("Pinterest", 401, '{"code":2,"message":"Authentication failed."}'));
    expect(msg).toContain("Panelde “Pinterest ile bağlan”ı yeniden yapın");
    expect(msg).toContain("HTTP 401");
  });
  it("bilinmeyen durum genel bir cümleye düşer", () => {
    expect(describePinterestError(new PlatformError("Pinterest", 418, "x"))).toContain("Pinterest isteği reddetti");
  });
});

describe("Pinterest istekleri", () => {
  it("kum havuzu açıkken sandbox adresine gider, kapalıyken gerçeğine", async () => {
    fetchMock.mockImplementation(async () => reply(200, { items: [{ id: "b1", name: "PDF" }] }));
    await listPinterestBoards(stored);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api-sandbox.pinterest.com/v5/boards?page_size=100");
    sandbox = false;
    tokenInfo = { env: "production", accessExpiresAt: null, refreshExpiresAt: null };
    await listPinterestBoards(stored);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://api.pinterest.com/v5/boards?page_size=100");
  });

  it("erişim anahtarı 401 verirse yenileyip yeni anahtarı kaydeder ve tekrar dener", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401, { code: 2, message: "Authentication failed." }))
      .mockResolvedValueOnce(reply(200, { access_token: "new", refresh_token: "ref2", refresh_token_expires_in: 3600 }))
      .mockResolvedValueOnce(reply(200, { items: [] }));
    await listPinterestBoards(stored);
    const refreshCall = fetchMock.mock.calls[1]!;
    // Kum havuzu açıkken yenileme de sandbox adresinden yapılır.
    expect(String(refreshCall[0])).toBe("https://api-sandbox.pinterest.com/v5/oauth/token");
    expect((refreshCall[1] as RequestInit).headers).toMatchObject({
      authorization: `Basic ${Buffer.from("app1:sec1").toString("base64")}`,
    });
    expect(String((refreshCall[1] as RequestInit).body)).toContain("grant_type=refresh_token");
    expect(saved[0]?.secrets).toEqual({ accessToken: "new", refreshToken: "ref2" });
    expect((fetchMock.mock.calls[2]![1] as RequestInit).headers).toMatchObject({ authorization: "Bearer new" });
  });

  it("yenileme de başarısızsa yeniden bağlanmayı söyler", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401, { code: 2, message: "x" }))
      .mockResolvedValueOnce(reply(400, { code: 1, message: "bad refresh" }));
    await expect(listPinterestBoards(stored)).rejects.toThrow(/yeniden yapın/);
  });

  it("pin istek gövdesi doğru alanları taşır", async () => {
    fetchMock.mockResolvedValueOnce(reply(201, { id: "123" }));
    const pin = await createPinterestPin(stored, {
      boardId: "b1",
      title: "Başlık",
      description: "Açıklama",
      link: "https://pdfplatform.app/tools/merge",
      imageUrl: "https://pdfplatform.app/reel-covers/merge.jpg",
    });
    const call = fetchMock.mock.calls[0]!;
    expect(String(call[0])).toBe("https://api-sandbox.pinterest.com/v5/pins");
    const sent = JSON.parse(String((call[1] as RequestInit).body));
    expect(sent).toMatchObject({
      board_id: "b1",
      title: "Başlık",
      link: "https://pdfplatform.app/tools/merge",
      media_source: { source_type: "image_url", url: "https://pdfplatform.app/reel-covers/merge.jpg" },
    });
    expect(pin).toEqual({ id: "123", url: "https://www.pinterest.com/pin/123/", sandbox: true });
  });
});

describe("Pinterest anahtar alma ve süreler", () => {
  it("kod değişimi: Basic auth, form gövdesi, continuous_refresh ve ortama göre adres", async () => {
    fetchMock.mockImplementation(async () => reply(200, { access_token: "pina_x", refresh_token: "pinr_y", expires_in: 2592000, refresh_token_expires_in: 5184000 }));
    await exchangePinterestCode(true, "app1", "sec1", "kod");
    await exchangePinterestCode(false, "app1", "sec1", "kod");
    const [sb, prod] = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(sb[0]).toBe("https://api-sandbox.pinterest.com/v5/oauth/token");
    expect(prod[0]).toBe("https://api.pinterest.com/v5/oauth/token");
    expect(sb[1].headers).toMatchObject({
      authorization: `Basic ${Buffer.from("app1:sec1").toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    });
    const body = new URLSearchParams(String(sb[1].body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("kod");
    expect(body.get("continuous_refresh")).toBe("true");
    expect(body.get("redirect_uri")).toBe(pinterestRedirectUri());
  });

  it("süreler yanıttaki değerlerden hesaplanır", () => {
    const now = 1_000_000;
    const a = parsePinterestTokenResponse({ access_token: "a", refresh_token: "r", expires_in: 100, refresh_token_expires_in: 200 }, now);
    expect(a.accessExpiresAt).toBe(now + 100_000);
    expect(a.refreshExpiresAt).toBe(now + 200_000);
    // Yenileme yanıtı bitişi Unix saniyesi olarak verir.
    const b = parsePinterestTokenResponse({ access_token: "a", refresh_token: "r", expires_in: 50, refresh_token_expires_at: 5000 }, now);
    expect(b.refreshExpiresAt).toBe(5_000_000);
    const c = parsePinterestTokenResponse({ access_token: "a", refresh_token: "r" }, now);
    expect(c.accessExpiresAt).toBeNull();
  });
});

describe("Kum havuzu kutusu değişince", () => {
  it("anahtar başka ortamda alındıysa istek atmadan 'yeniden bağlan' der", async () => {
    sandbox = false; // anahtar sandbox'ta alınmıştı
    await expect(listPinterestBoards(stored)).rejects.toThrow(/yeniden yap/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("ortam bilgisi olmayan eski kayıt da yeniden bağlanma ister", async () => {
    tokenInfo = null;
    await expect(listPinterestBoards(stored)).rejects.toThrow(/yeniden yap/);
  });
});

describe("Günlük Pinterest anahtar kontrolü", () => {
  it("süresi uzaksa dokunmaz", async () => {
    expect(await renewPinterestIfDue()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("erişim anahtarı 10 günden az kaldıysa pin atılmasa da yeniler ve süreleri kaydeder", async () => {
    tokenInfo = { env: "sandbox", accessExpiresAt: Date.now() + 3 * 86_400_000, refreshExpiresAt: Date.now() + 55 * 86_400_000 };
    fetchMock.mockResolvedValueOnce(reply(200, { access_token: "n", refresh_token: "r9", expires_in: 2592000, refresh_token_expires_in: 5184000 }));
    expect(await renewPinterestIfDue()).toBe(true);
    expect(saved[0]?.secrets).toEqual({ accessToken: "n", refreshToken: "r9" });
    expect(tokenInfo?.accessExpiresAt).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  });
  it("ortam uyumsuzsa yenilemeye çalışmaz", async () => {
    sandbox = false;
    expect(await renewPinterestIfDue()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
