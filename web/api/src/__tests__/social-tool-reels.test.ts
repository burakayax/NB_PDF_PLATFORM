/**
 * Araç tanıtım videoları: manifest okuma + Facebook Reels yayını.
 *
 * Ağ çağrıları sahte `fetch` ile yakalanır — gerçek Facebook'a istek gitmez.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "../modules/social/social.types.js";

const ORIGIN = "https://example.test";
const VIDEO = `${ORIGIN}/arac-videolari/pdf-sikistirma.mp4`;

const MANIFEST = {
  compress: {
    video: "/arac-videolari/pdf-sikistirma.mp4",
    seconds: 27,
    tr: { title: "PDF Sıkıştır", summary: "Özet", link: "https://example.test/tools/compress" },
    en: { title: "Compress PDF", summary: "Summary", link: "https://example.test/en/tools/compress" },
    keywords: { tr: ["pdf sıkıştırma"], en: ["compress pdf"], tagsTr: ["pdf sıkıştır"], tagsEn: ["compress pdf"] },
  },
  // Eksik özet → atlanır (yarım gönderi çıkmasın).
  broken: {
    video: "/arac-videolari/x.mp4",
    tr: { title: "x", link: "https://example.test/x" },
    en: { title: "x", summary: "x", link: "https://example.test/en/x" },
  },
  // mp4 değil → atlanır.
  notvideo: {
    video: "/arac-videolari/x.png",
    tr: { title: "x", summary: "x", link: "https://example.test/x" },
    en: { title: "x", summary: "x", link: "https://example.test/en/x" },
  },
};

type Call = { method: string; url: string; body: URLSearchParams | null; headers: Record<string, string> };

function installFetch(opts: { failOn?: (c: Call) => boolean; videoStatus?: string } = {}): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const body = typeof init?.body === "string" ? new URLSearchParams(init.body) : null;
      const call: Call = { method, url, body, headers: (init?.headers ?? {}) as Record<string, string> };
      calls.push(call);

      if (url.endsWith("/arac-videolari/manifest.json")) return new Response(JSON.stringify(MANIFEST), { status: 200 });
      if (opts.failOn?.(call)) return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 400 });
      if (url.endsWith("/PAGE1/video_reels") && body?.get("upload_phase") === "start") {
        return new Response(JSON.stringify({ video_id: "VID1", upload_url: "https://rupload.test/VID1" }), { status: 200 });
      }
      if (url === "https://rupload.test/VID1") return new Response(JSON.stringify({ success: true }), { status: 200 });
      if (method === "GET" && url.includes("/VID1?fields=status")) {
        return new Response(JSON.stringify({ status: { video_status: opts.videoStatus ?? "ready" } }), { status: 200 });
      }
      if (url.endsWith("/PAGE1/video_reels") && body?.get("upload_phase") === "finish") {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "POST1" }), { status: 200 });
    }),
  );
  return calls;
}

const SECRETS = { pageId: "PAGE1", pageAccessToken: "TOKEN" };
const ITEM: FeedItem = {
  guid: "tool-reel:compress",
  lang: "tr",
  title: "PDF Sıkıştır",
  summary: "Özet",
  link: "https://example.test/tools/compress",
  publishedAt: Date.now(),
  categories: [],
  images: {},
};
const input = () => ({ body: "metin", imageUrl: VIDEO, item: ITEM, secrets: SECRETS });

beforeEach(() => {
  vi.resetModules();
  process.env.FRONTEND_ORIGIN = ORIGIN;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("araç videosu manifesti", () => {
  it("geçerli satırları mutlak adresle listeler, bozuk satırı atlar", async () => {
    const { parseToolReels } = await import("../modules/social/tool-reels.service.js");
    const reels = parseToolReels(MANIFEST, ORIGIN);
    expect(reels.map((r) => r.id)).toEqual(["compress"]);
    expect(reels[0]?.videoUrl).toBe(VIDEO);
    expect(reels[0]?.guid).toBe("tool-reel:compress");
  });

  it("video blog yazısı biçimine çevrilir: TR esas, EN karşılık", async () => {
    const { parseToolReels, toolReelFeedItem } = await import("../modules/social/tool-reels.service.js");
    const item = toolReelFeedItem(parseToolReels(MANIFEST, ORIGIN)[0]!);
    expect(item.lang).toBe("tr");
    expect(item.alt?.lang).toBe("en");
    expect(item.alt?.link).toBe("https://example.test/en/tools/compress");
  });

  it("reelFor: araç videosunun guid'i için video adresi, bilinmeyen guid için null", async () => {
    installFetch();
    const { reelFor } = await import("../modules/social/reels.service.js");
    expect(await reelFor({ guid: "tool-reel:compress", link: "" })).toBe(VIDEO);
    expect(await reelFor({ guid: "tool-reel:yok", link: "" })).toBeNull();
  });
});

describe("Facebook Reels yayını", () => {
  const reelCalls = (calls: Call[]) => calls.filter((c) => c.url.endsWith("/PAGE1/video_reels"));

  it("video adresi varsa: oturum aç, videoyu adresle ver, bekle, yayınla", async () => {
    const calls = installFetch();
    const { publishToFacebook } = await import("../modules/social/platforms/meta.platform.js");

    const res = await publishToFacebook(input());

    const phases = reelCalls(calls).map((c) => c.body?.get("upload_phase"));
    expect(phases).toEqual(["start", "finish"]);
    const upload = calls.find((c) => c.url === "https://rupload.test/VID1");
    expect(upload?.headers.file_url).toBe(VIDEO);
    const finish = reelCalls(calls)[1];
    expect(finish?.body?.get("video_id")).toBe("VID1");
    expect(finish?.body?.get("video_state")).toBe("PUBLISHED");
    expect(finish?.body?.get("description")).toBe("metin");
    expect(res.externalId).toBe("VID1");
  });

  it("oturum açılamazsa: metin gönderisine düşer, video adresi görsel diye gönderilmez", async () => {
    const calls = installFetch({
      failOn: (c) => c.url.endsWith("/PAGE1/video_reels") && c.body?.get("upload_phase") === "start",
    });
    const { publishToFacebook } = await import("../modules/social/platforms/meta.platform.js");

    await publishToFacebook(input());

    expect(calls.some((c) => c.url.endsWith("/PAGE1/photos"))).toBe(false);
    const feed = calls.find((c) => c.url.endsWith("/PAGE1/feed"));
    expect(feed?.body?.get("message")).toBe("metin");
    expect(calls.some((c) => c.body?.get("url") === VIDEO)).toBe(false);
  });

  it("yayın adımı başladıktan sonra hata olursa: yedek yola DÜŞMEZ (çift paylaşım olmasın)", async () => {
    const calls = installFetch({
      failOn: (c) => c.url.endsWith("/PAGE1/video_reels") && c.body?.get("upload_phase") === "finish",
    });
    const { publishToFacebook } = await import("../modules/social/platforms/meta.platform.js");

    await expect(publishToFacebook(input())).rejects.toThrow();
    expect(calls.some((c) => c.url.endsWith("/PAGE1/feed"))).toBe(false);
  });

  it("video adresi yoksa: davranış eskisi gibi (Reels oturumu açılmaz)", async () => {
    const calls = installFetch();
    const { publishToFacebook } = await import("../modules/social/platforms/meta.platform.js");

    await publishToFacebook({ ...input(), imageUrl: `${ORIGIN}/covers/wide/x.png` });

    expect(reelCalls(calls)).toHaveLength(0);
    expect(calls.some((c) => c.url.endsWith("/PAGE1/photos"))).toBe(true);
  });
});
