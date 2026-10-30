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

    expect(out).toMatchObject({ externalId: "vid123", externalUrl: "https://www.youtube.com/shorts/vid123" });
    const start = calls.find((c) => c.url.includes("uploadType=resumable"));
    const meta = JSON.parse(String(start?.init?.body));
    expect(meta.snippet.title).toBe("PDF Sıkıştır");
    expect(meta.snippet.description).toContain("#Shorts");
    // Zengin açıklama: iki dilde araç bağlantısı, konu satırları, en fazla 10 etiket, 5.000 sınırının altında.
    const desc: string = meta.snippet.description;
    expect(desc).toContain("https://www.pdfplatform.app/tools/compress");
    expect(desc).toContain("https://www.pdfplatform.app/en/tools/compress");
    expect(desc).toContain("Konular: pdf sıkıştırma");
    expect(desc).toContain("Topics: compress pdf");
    expect(desc.length).toBeLessThan(5000);
    expect((desc.match(/#\p{L}[\p{L}\p{N}]*/gu) ?? []).length).toBeLessThanOrEqual(10);
    expect(desc).not.toMatch(/[<>]/);
    expect(meta.status).toMatchObject({ privacyStatus: "public", selfDeclaredMadeForKids: false });
    expect((start?.init?.headers as Record<string, string>).authorization).toBe("Bearer AT");
  });

  it("etiket, dil, yapay zekâ işareti, kayıt tarihi ve markalı küçük resmi gönderir; küçük resim hatası paylaşımı bozmaz", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("oauth2.googleapis.com")) return json({ access_token: "AT" });
      if (url === VIDEO) return new Response(new Uint8Array([1, 2, 3]));
      if (url.includes("uploadType=resumable")) return new Response("", { status: 200, headers: { location: "https://upload.test/s1" } });
      if (url === "https://upload.test/s1") return json({ id: "vid9", status: { privacyStatus: "public" } });
      if (url.endsWith("/reel-covers/compress.jpg")) {
        return init?.method === "HEAD"
          ? new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } })
          : new Response(new Uint8Array([9, 9]), { status: 200, headers: { "content-type": "image/jpeg" } });
      }
      if (url.includes("thumbnails/set")) return new Response("forbidden", { status: 403 });
      throw new Error(`beklenmeyen: ${url}`);
    });

    const out = await publishToYouTube({ body: "x", imageUrl: VIDEO, item: ITEM, secrets: SECRETS });

    expect(out.externalId).toBe("vid9");
    const start = calls.find((c) => c.url.includes("uploadType=resumable"));
    expect(start?.url).toContain("part=snippet,status,recordingDetails");
    const meta = JSON.parse(String(start?.init?.body));
    expect(meta.snippet.tags).toContain("pdf sıkıştırma");
    expect(meta.snippet.tags.join("").length).toBeLessThan(500);
    expect(meta.snippet.defaultLanguage).toBe("tr");
    expect(meta.status.containsSyntheticMedia).toBe(false);
    expect(Number.isNaN(Date.parse(meta.recordingDetails.recordingDate))).toBe(false);
    const thumb = calls.find((c) => c.url.includes("thumbnails/set?videoId=vid9"));
    expect(thumb).toBeTruthy();
    expect((thumb?.init?.headers as Record<string, string>)["content-type"]).toBe("image/jpeg");
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

  it("küçük resim yüklenemezse paylaşım sürer ve nedeni uyarı olarak döner (403 tekrar denenmez)", async () => {
    let thumbCalls = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("oauth2.googleapis.com")) return json({ access_token: "AT" });
      if (url === VIDEO) return new Response(new Uint8Array([1, 2, 3]));
      if (url.includes("uploadType=resumable")) return new Response("", { status: 200, headers: { location: "https://upload.test/s1" } });
      if (url === "https://upload.test/s1") return json({ id: "vid7", status: { privacyStatus: "public" } });
      if (url.endsWith("/reel-covers/compress.jpg")) return new Response(new Uint8Array([9, 9]), { status: 200, headers: { "content-type": "image/jpeg" } });
      if (url.includes("thumbnails/set")) {
        thumbCalls++;
        return new Response("forbidden", { status: 403 });
      }
      throw new Error(`beklenmeyen: ${url}`);
    });
    const out = await publishToYouTube({ body: "x", imageUrl: VIDEO, item: ITEM, secrets: SECRETS });
    expect(out.externalId).toBe("vid7");
    expect(out.warning).toContain("403");
    expect(thumbCalls).toBe(1);
  });

  it("kapak görseli indirilemezse nedeni uyarı olarak döner", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("oauth2.googleapis.com")) return json({ access_token: "AT" });
      if (url === VIDEO) return new Response(new Uint8Array([1, 2, 3]));
      if (url.includes("uploadType=resumable")) return new Response("", { status: 200, headers: { location: "https://upload.test/s1" } });
      if (url === "https://upload.test/s1") return json({ id: "vid8", status: { privacyStatus: "public" } });
      if (url.endsWith("/reel-covers/compress.jpg")) return new Response("yok", { status: 404 });
      throw new Error(`beklenmeyen: ${url}`);
    });
    const out = await publishToYouTube({ body: "x", imageUrl: VIDEO, item: ITEM, secrets: SECRETS });
    expect(out.warning).toContain("HTTP 404");
  });
});
