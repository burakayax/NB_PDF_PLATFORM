/**
 * Instagram Reels yayını: çağrı sırası, yedek yola düşme ve çift paylaşımı önleme.
 *
 * Ağ çağrıları sahte `fetch` ile yakalanır — gerçek Instagram'a istek gitmez.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "../modules/social/social.types.js";

const ORIGIN = "https://example.test";
const POST_URL = `${ORIGIN}/blog/yazi`;
const VIDEO = `${ORIGIN}/social/reels/tr/yazi/reel.mp4`;
const SLIDES = [1, 2, 3].map((n) => `${ORIGIN}/social/carousel/tr/yazi/${n}.jpg`);

const ITEM: FeedItem = {
  guid: POST_URL,
  lang: "tr",
  title: "Deneme yazısı",
  summary: "Özet",
  link: POST_URL,
  publishedAt: Date.now(),
  categories: [],
  images: { square: `${ORIGIN}/covers/square/yazi.png` },
};

type Call = { method: string; url: string; body: URLSearchParams | null };

function installFetch(opts: {
  carousel?: boolean;
  reels?: boolean;
  failOn?: (c: Call) => boolean;
}): Call[] {
  const calls: Call[] = [];
  let seq = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const body = typeof init?.body === "string" ? new URLSearchParams(init.body) : null;
      const call: Call = { method, url, body };
      calls.push(call);

      if (url.endsWith("/social/carousel/manifest.json")) {
        const data = opts.carousel ? { [POST_URL]: { count: 3, urls: SLIDES } } : {};
        return new Response(JSON.stringify(data), { status: 200 });
      }
      if (url.endsWith("/social/reels/manifest.json")) {
        const data = opts.reels ? { [POST_URL]: { url: VIDEO } } : {};
        return new Response(JSON.stringify(data), { status: 200 });
      }
      if (opts.failOn?.(call)) return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 400 });
      if (method === "GET" && url.includes("fields=status_code")) {
        return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 });
      }
      if (url.endsWith("/media_publish")) return new Response(JSON.stringify({ id: "PUB1" }), { status: 200 });
      return new Response(JSON.stringify({ id: `C${++seq}` }), { status: 200 });
    }),
  );
  return calls;
}

const SECRETS = { igUserId: "IG1", pageAccessToken: "TOKEN" };
const reelInput = () => ({ body: "metin #PDF", imageUrl: VIDEO, item: ITEM, secrets: SECRETS });

beforeEach(() => {
  vi.resetModules();
  process.env.FRONTEND_ORIGIN = ORIGIN;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const mediaPosts = (calls: Call[]) => calls.filter((c) => c.method === "POST" && c.url.endsWith("/IG1/media"));
const publishes = (calls: Call[]) => calls.filter((c) => c.url.endsWith("/media_publish"));

describe("Instagram Reels yayını", () => {
  it("kayıtta video adresi varsa: REELS kabı, bekleme, yayın", async () => {
    const calls = installFetch({ carousel: true });
    const { publishToInstagram } = await import("../modules/social/platforms/meta.platform.js");

    const res = await publishToInstagram(reelInput());

    const posts = mediaPosts(calls);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body?.get("media_type")).toBe("REELS");
    expect(posts[0]?.body?.get("video_url")).toBe(VIDEO);
    expect(posts[0]?.body?.get("caption")).toBe("metin #PDF");
    expect(publishes(calls)).toHaveLength(1);
    expect(res.externalId).toBe("PUB1");
  });

  it("Reels kabı yayın öncesi reddedilirse: carousel'e düşer, video adresi görsel diye gönderilmez", async () => {
    const calls = installFetch({
      carousel: true,
      failOn: (c) => c.method === "POST" && c.url.endsWith("/IG1/media") && c.body?.get("media_type") === "REELS",
    });
    const { publishToInstagram } = await import("../modules/social/platforms/meta.platform.js");

    await publishToInstagram(reelInput());

    const images = mediaPosts(calls)
      .map((c) => c.body?.get("image_url"))
      .filter(Boolean);
    expect(images).toEqual(SLIDES);
    expect(images).not.toContain(VIDEO);
    expect(publishes(calls)).toHaveLength(1);
  });

  it("carousel de yoksa: kapak slaytı olmadığı için net hata verir, video adresini görsel diye yollamaz", async () => {
    const calls = installFetch({
      failOn: (c) => c.method === "POST" && c.url.endsWith("/IG1/media") && c.body?.get("media_type") === "REELS",
    });
    const { publishToInstagram } = await import("../modules/social/platforms/meta.platform.js");

    await expect(publishToInstagram(reelInput())).rejects.toThrow(/görselsiz/);
    expect(mediaPosts(calls).some((c) => c.body?.get("image_url") === VIDEO)).toBe(false);
    expect(publishes(calls)).toHaveLength(0);
  });

  it("media_publish başladıktan sonra hata olursa: yedek yola DÜŞMEZ (çift paylaşım olmasın)", async () => {
    const calls = installFetch({
      carousel: true,
      failOn: (c) => c.url.endsWith("/media_publish"),
    });
    const { publishToInstagram } = await import("../modules/social/platforms/meta.platform.js");

    await expect(publishToInstagram(reelInput())).rejects.toThrow();

    expect(mediaPosts(calls)).toHaveLength(1); // yalnız Reels kabı; carousel denenmedi
    expect(publishes(calls)).toHaveLength(1);
  });

  it("video adresi yoksa: davranış eskisi gibi (Reels kabı açılmaz)", async () => {
    const calls = installFetch({ carousel: true });
    const { publishToInstagram } = await import("../modules/social/platforms/meta.platform.js");

    await publishToInstagram({ ...reelInput(), imageUrl: ITEM.images.square ?? null });

    expect(mediaPosts(calls).some((c) => c.body?.get("media_type") === "REELS")).toBe(false);
  });
});

describe("Reels adres yardımcıları", () => {
  it("yalnızca .mp4 adreslerini video sayar", async () => {
    const { isReelUrl } = await import("../modules/social/reels.service.js");
    expect(isReelUrl(VIDEO)).toBe(true);
    expect(isReelUrl(`${VIDEO}?v=2`)).toBe(true);
    expect(isReelUrl(SLIDES[0])).toBe(false);
    expect(isReelUrl(null)).toBe(false);
  });

  it("manifestte varsa yazının videosunu, yoksa null döner", async () => {
    installFetch({ reels: true });
    const { reelFor } = await import("../modules/social/reels.service.js");
    expect(await reelFor(ITEM)).toBe(VIDEO);
    expect(await reelFor({ guid: "yok", link: "https://example.test/yok" })).toBeNull();
  });

  it("manifest okunamazsa null döner (otomasyon durmaz)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    const { reelFor } = await import("../modules/social/reels.service.js");
    expect(await reelFor(ITEM)).toBeNull();
  });
});
