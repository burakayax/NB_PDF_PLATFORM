import { afterEach, describe, expect, it, vi } from "vitest";
import { publishToYouTube, verifyYouTube } from "../modules/social/platforms/youtube.platform.js";

const SECRETS = { clientId: "cid", clientSecret: "csec", refreshToken: "rtok" };
const ITEM = { guid: "tool-reel:compress", lang: "tr" as const, title: "PDF Sıkıştır", summary: "", link: "https://x.test", publishedAt: 0, categories: [], images: {} };
const VIDEO = "https://x.test/api/public/tool-reels/compress-1.mp4";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

afterEach(() => vi.unstubAllGlobals());

describe("YouTube Shorts yayıncısı", () => {
  it("video değilse reddeder", async () => {
    await expect(publishToYouTube({ body: "x", imageUrl: "https://x.test/a.png", item: ITEM, secrets: SECRETS })).rejects.toThrow(/video/);
  });

  it("yenileme anahtarını çevirir, oturum açar, yükler ve #Shorts ekler", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("oauth2.googleapis.com")) return json({ access_token: "AT" });
      if (url === VIDEO) return new Response(new Uint8Array([1, 2, 3]));
      if (url.includes("uploadType=resumable")) return new Response("", { status: 200, headers: { location: "https://upload.test/s1" } });
      if (url === "https://upload.test/s1") return json({ id: "vid123", status: { privacyStatus: "public" } });
      throw new Error(`beklenmeyen: ${url}`);
    });

    const out = await publishToYouTube({ body: "Açıklama metni", imageUrl: VIDEO, item: ITEM, secrets: SECRETS });

    expect(out).toEqual({ externalId: "vid123", externalUrl: "https://www.youtube.com/shorts/vid123" });
    const start = calls.find((c) => c.url.includes("uploadType=resumable"));
    const meta = JSON.parse(String(start?.init?.body));
    expect(meta.snippet.title).toBe("PDF Sıkıştır");
    expect(meta.snippet.description).toContain("#Shorts");
    expect(meta.status).toMatchObject({ privacyStatus: "public", selfDeclaredMadeForKids: false });
    expect((start?.init?.headers as Record<string, string>).authorization).toBe("Bearer AT");
  });

  it("süresi dolmuş yenileme anahtarında anlaşılır hata verir", async () => {
    vi.stubGlobal("fetch", async () => new Response('{"error":"invalid_grant"}', { status: 400 }));
    await expect(verifyYouTube(SECRETS)).rejects.toThrow(/invalid_grant|Üretimde/);
  });

  it("sınama kanal adını döndürür", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url.includes("oauth2") ? json({ access_token: "AT" }) : json({ items: [{ snippet: { title: "PDF Platform" } }] }),
    );
    expect(await verifyYouTube(SECRETS)).toBe("PDF Platform");
  });
});
