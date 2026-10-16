import { afterEach, describe, expect, it, vi } from "vitest";
import { availableReelCover, toolIdFromGuid } from "../modules/social/platforms/reel-cover.js";
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
});
