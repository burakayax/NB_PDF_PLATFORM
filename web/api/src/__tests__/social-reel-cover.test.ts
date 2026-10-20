import { afterEach, describe, expect, it, vi } from "vitest";
import { availableReelCover, reelCoverUrl, toolIdFromGuid } from "../modules/social/platforms/reel-cover.js";
import { publishFacebookReel } from "../modules/social/platforms/facebook-reels.js";
import { env } from "../config/env.js";
import { publishInstagramReel } from "../modules/social/platforms/instagram-reels.js";

afterEach(() => vi.unstubAllGlobals());

const ITEM = { guid: "tool-reel:merge", lang: "tr" as const, title: "PDF Birleştirme", summary: "", link: "x", publishedAt: 0, categories: [], images: {} };
const SECRETS = { igUserId: "1", pageAccessToken: "T" };

describe("Reels kapağı", () => {
  it("araç kimliğini gönderi kimliğinden çıkarır; blog yazısında null", () => {
    expect(toolIdFromGuid("tool-reel:merge")).toBe("merge");
    expect(toolIdFromGuid("https://x/blog/yazi")).toBeNull();
  });

  it("kapak erişilebilir değilse null döner (paylaşım kapaksız gider)", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));
    expect(await availableReelCover("tool-reel:merge")).toBeNull();
  });

  it("Instagram: kapak erişilebilirse cover_url gönderilir, değilse alan hiç yoktur", async () => {
    for (const reachable of [true, false]) {
      const bodies: string[] = [];
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        if (url.includes("/reel-covers/")) {
          return reachable ? new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } }) : new Response(null, { status: 404 });
        }
        if (init?.method === "POST") bodies.push(String(init.body));
        if (url.includes("/media_publish")) return new Response(JSON.stringify({ id: "m1" }));
        if (url.includes("status_code")) return new Response(JSON.stringify({ status_code: "FINISHED" }));
        return new Response(JSON.stringify({ id: "c1" }));
      });
      await publishInstagramReel({ body: "b", item: ITEM, secrets: SECRETS }, "https://x.test/v.mp4");
      const create = bodies[0] ?? "";
      expect(create.includes("cover_url=")).toBe(reachable);
    }
  });

  it("kapak adresi SİTE alan adından kurulur (API'den değil): kapaklar sitenin statik dosyasıdır", () => {
    expect(reelCoverUrl("merge")).toBe(`${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/reel-covers/merge.jpg`);
    expect(reelCoverUrl("merge").startsWith(env.APP_BASE_URL)).toBe(env.APP_BASE_URL === env.FRONTEND_ORIGIN);
  });

  it("yönlendirilen kapak adresinde NİHAİ adres döner", async () => {
    vi.stubGlobal("fetch", async () => {
      const res = new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } });
      Object.defineProperty(res, "url", { value: "https://www.site.test/reel-covers/merge.jpg" });
      return res;
    });
    expect(await availableReelCover("tool-reel:merge")).toBe("https://www.site.test/reel-covers/merge.jpg");
  });

  it("Facebook Reels: yayından sonra kapak yüklenir; yükleme hatası paylaşımı bozmaz", async () => {
    for (const thumbOk of [true, false]) {
      const calls: string[] = [];
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url.includes("/reel-covers/")) return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
        if (url.includes("/thumbnails")) return thumbOk ? new Response(JSON.stringify({ success: true })) : new Response("izin yok", { status: 403 });
        if (url.includes("upload_phase") || init?.body?.toString().includes("upload_phase=start")) return new Response(JSON.stringify({ video_id: "v1", upload_url: "https://up.test/x" }));
        if (url.startsWith("https://up.test")) return new Response(JSON.stringify({ success: true }));
        if (url.includes("fields=status")) return new Response(JSON.stringify({ status: { video_status: "ready" } }));
        return new Response(JSON.stringify({ success: true }));
      });
      const out = await publishFacebookReel(
        { body: "b", item: ITEM, secrets: { pageId: "P", pageAccessToken: "T" } },
        "https://x.test/v.mp4",
      );
      expect(out.externalId).toBe("v1");
      expect(calls.some((c) => c.startsWith("POST") && c.includes("/v1/thumbnails"))).toBe(true);
    }
  });
});
