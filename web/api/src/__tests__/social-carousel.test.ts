/**
 * Instagram carousel yayını: çağrı sırası, yedek yola düşme ve çift paylaşımı önleme.
 *
 * Ağ çağrıları sahte `fetch` ile yakalanır — gerçek Instagram'a istek gitmez.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "../modules/social/social.types.js";

const ORIGIN = "https://example.test";
const POST_URL = `${ORIGIN}/blog/yazi`;
const SLIDES = [1, 2, 3, 4].map((n) => `${ORIGIN}/social/carousel/tr/yazi/${n}.jpg`);

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

/** fetch'i kurar: manifest ve Graph API yanıtlarını verir, çağrıları kaydeder. */
function installFetch(opts: {
  manifest?: unknown;
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
        return new Response(JSON.stringify(opts.manifest ?? {}), { status: 200 });
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
const input = () => ({ body: "metin #PDF", imageUrl: ITEM.images.square ?? null, item: ITEM, secrets: SECRETS });

beforeEach(() => {
  vi.resetModules();
  process.env.FRONTEND_ORIGIN = ORIGIN;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const mediaPosts = (calls: Call[]) => calls.filter((c) => c.method === "POST" && c.url.endsWith("/IG1/media"));

describe("Instagram carousel yayını", () => {
  it("slayt varsa: her slayt için alt kap, sonra ana kap, sonra yayın", async () => {
    const calls = installFetch({ manifest: { [POST_URL]: { count: 4, urls: SLIDES } } });
    const { publishToInstagram } = await import("../modules/social/platforms/meta.platform.js");

    const res = await publishToInstagram(input());

    const posts = mediaPosts(calls);
    expect(posts).toHaveLength(5); // 4 alt kap + 1 ana kap
    posts.slice(0, 4).forEach((p, i) => {
      expect(p.body?.get("image_url")).toBe(SLIDES[i]);
      expect(p.body?.get("is_carousel_item")).toBe("true");
    });
    const parent = posts[4]!;
    expect(parent.body?.get("media_type")).toBe("CAROUSEL");
    expect(parent.body?.get("children")).toBe("C1,C2,C3,C4");
    expect(parent.body?.get("caption")).toBe("metin #PDF");
    expect(calls.filter((c) => c.url.endsWith("/media_publish"))).toHaveLength(1);
    expect(res.externalId).toBe("PUB1");
  });

  it("manifestte yazı yoksa eski tek görsel yolu çalışır", async () => {
    const calls = installFetch({ manifest: {} });
    const { publishToInstagram } = await import("../modules/social/platforms/meta.platform.js");

    await publishToInstagram(input());

    const posts = mediaPosts(calls);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body?.get("image_url")).toBe(ITEM.images.square);
    expect(posts[0]!.body?.get("media_type")).toBeNull();
    expect(calls.filter((c) => c.url.endsWith("/media_publish"))).toHaveLength(1);
  });

  it("manifest okunamazsa yayın durmaz: tek görselle çıkar", async () => {
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ method: (init?.method ?? "GET").toUpperCase(), url, body: null });
        if (url.endsWith("/manifest.json")) return new Response("yok", { status: 404 });
        if (url.includes("fields=status_code")) return new Response(JSON.stringify({ status_code: "FINISHED" }));
        if (url.endsWith("/media_publish")) return new Response(JSON.stringify({ id: "PUB2" }));
        return new Response(JSON.stringify({ id: "C1" }));
      }),
    );
    const { publishToInstagram } = await import("../modules/social/platforms/meta.platform.js");

    const res = await publishToInstagram(input());
    expect(res.externalId).toBe("PUB2");
  });

  it("alt kap oluşturulamazsa (yayın öncesi) tek görsele düşer — gönderi yine çıkar", async () => {
    const calls = installFetch({
      manifest: { [POST_URL]: { count: 4, urls: SLIDES } },
      failOn: (c) => c.body?.get("is_carousel_item") === "true",
    });
    const { publishToInstagram } = await import("../modules/social/platforms/meta.platform.js");

    const res = await publishToInstagram(input());

    expect(res.externalId).toBe("PUB1");
    const single = mediaPosts(calls).find((p) => p.body?.get("image_url") === ITEM.images.square);
    expect(single).toBeTruthy();
    expect(calls.filter((c) => c.url.endsWith("/media_publish"))).toHaveLength(1);
  });

  it("media_publish hata verirse tek görsele DÜŞMEZ (çift paylaşım olmasın)", async () => {
    const calls = installFetch({
      manifest: { [POST_URL]: { count: 4, urls: SLIDES } },
      failOn: (c) => c.url.endsWith("/media_publish"),
    });
    const { publishToInstagram } = await import("../modules/social/platforms/meta.platform.js");

    await expect(publishToInstagram(input())).rejects.toThrow();

    // Yalnızca carousel'in kapları oluştu; tek görsel kabı hiç açılmadı.
    expect(mediaPosts(calls)).toHaveLength(5);
    expect(calls.filter((c) => c.url.endsWith("/media_publish"))).toHaveLength(1);
  });

  it("10'dan fazla slayt 10'a kırpılır", async () => {
    const many = Array.from({ length: 14 }, (_, i) => `${ORIGIN}/s/${i + 1}.jpg`);
    const calls = installFetch({ manifest: { [POST_URL]: { count: 14, urls: many } } });
    const { publishToInstagram } = await import("../modules/social/platforms/meta.platform.js");

    await publishToInstagram(input());
    expect(mediaPosts(calls)).toHaveLength(11); // 10 alt + 1 ana
  });
});
