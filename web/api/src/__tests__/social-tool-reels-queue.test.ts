/**
 * Araç videosunun otomatik sıraya katılması: sıklık, sıra ve onay kararı.
 *
 * Veritabanı, besleme ve manifest sahte; yalnızca `queueDailyPosts`in araç videosu için
 * hangi kaydı ne durumda yazdığı sınanır.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "../modules/social/social.types.js";

const DAY = 24 * 3600_000;

const ITEM: FeedItem = {
  guid: "https://example.test/blog/yazi",
  lang: "tr",
  title: "Blog",
  summary: "Özet",
  link: "https://example.test/blog/yazi",
  publishedAt: Date.now(),
  categories: [],
  images: { wide: "https://example.test/c.png", square: "https://example.test/c.png", tall: "https://example.test/c.png" },
};

const reel = (id: string) => ({
  id,
  guid: `tool-reel:${id}`,
  videoUrl: `https://example.test/arac-videolari/${id}.mp4`,
  seconds: 20,
  tr: { title: `T ${id}`, summary: "s", link: `https://example.test/tools/${id}` },
  en: { title: `E ${id}`, summary: "s", link: `https://example.test/en/tools/${id}` },
  keywords: { tr: [], en: [], tagsTr: [], tagsEn: [] },
});

const created: { platform: string; guid: string; status: string; imageUrl: string | null }[] = [];
let config: Record<string, unknown> = {};
let toolRows: { guid: string; createdAt: Date }[] = [];

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    socialAccount: { findMany: vi.fn(async () => []) },
    socialPost: {
      findMany: vi.fn(async ({ where }: { where?: { guid?: { startsWith?: string } } }) =>
        where?.guid?.startsWith ? toolRows : [],
      ),
      create: vi.fn(
        async ({ data }: { data: { platform: string; guid: string; status: string; imageUrl: string | null } }) => {
          created.push({ platform: data.platform, guid: data.guid, status: data.status, imageUrl: data.imageUrl });
          return data;
        },
      ),
    },
  },
}));
vi.mock("../lib/site-config.service.js", () => ({
  getSettingWithFallback: vi.fn(async () => config),
  setSetting: vi.fn(),
}));
vi.mock("../modules/social/rss.service.js", () => ({ fetchPairedFeedItems: vi.fn(async () => [ITEM]) }));
vi.mock("../modules/social/keywords.service.js", () => ({ keywordsFor: vi.fn(async () => ({ tr: [], en: [] })) }));
vi.mock("../modules/social/copy.service.js", () => ({
  writePostBodies: vi.fn(async ({ platforms }: { platforms: string[] }) =>
    Object.fromEntries(platforms.map((p) => [p, `metin ${p}`])),
  ),
}));
vi.mock("../modules/social/reels.service.js", () => ({ reelFor: vi.fn(async () => null) }));
vi.mock("../modules/social/tool-reels.service.js", () => ({
  TOOL_REEL_PREFIX: "tool-reel:",
  loadToolReels: vi.fn(async () => [reel("compress"), reel("merge")]),
  toolReelFeedItem: (r: ReturnType<typeof reel>) => ({
    guid: r.guid,
    lang: "tr",
    title: r.tr.title,
    summary: r.tr.summary,
    link: r.tr.link,
    publishedAt: 0,
    categories: [],
    images: {},
  }),
}));
vi.mock("../modules/social/platforms/index.js", () => ({ PUBLISHERS: {}, VERIFIERS: {} }));
vi.mock("../lib/encryption.js", () => ({ decryptField: vi.fn(), encryptField: vi.fn() }));

async function connectInstagram() {
  const { prisma } = await import("../lib/prisma.js");
  const { decryptField } = await import("../lib/encryption.js");
  vi.mocked(decryptField).mockReturnValue(JSON.stringify({ igUserId: "IG1", pageAccessToken: "T" }));
  vi.mocked(prisma.socialAccount.findMany).mockResolvedValue([
    { platform: "INSTAGRAM", secretsJson: "x", enabled: true },
  ] as never);
}

const toolPosts = () => created.filter((c) => c.guid.startsWith("tool-reel:"));

beforeEach(() => {
  created.length = 0;
  toolRows = [];
  config = { reelsAutoPublish: false, researchKeywords: false, toolReelEveryDays: 3 };
});

describe("araç videosu otomatik sırası", () => {
  it("sıklık 0 (kapalı): araç videosu kuyruğa girmez", async () => {
    config = { ...config, toolReelEveryDays: 0 };
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(toolPosts()).toHaveLength(0);
  });

  it("açık ve daha önce hiç yok: ilk video Instagram + Facebook için hazırlanır, onaylı modda TASLAK", async () => {
    await connectInstagram();
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(toolPosts().map((p) => `${p.platform}:${p.guid}`).sort()).toEqual([
      "FACEBOOK:tool-reel:compress",
      "INSTAGRAM:tool-reel:compress",
    ]);
    const ig = toolPosts().find((p) => p.platform === "INSTAGRAM");
    expect(ig?.status).toBe("DRAFT");
    expect(ig?.imageUrl).toBe("https://example.test/arac-videolari/compress.mp4");
    // Facebook hesabı bağlı değil → elle paylaşılacak.
    expect(toolPosts().find((p) => p.platform === "FACEBOOK")?.status).toBe("MANUAL");
  });

  it("son araç videosu sıklıktan yakınsa: bugün eklenmez", async () => {
    toolRows = [{ guid: "tool-reel:compress", createdAt: new Date(Date.now() - 1 * DAY) }];
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(toolPosts()).toHaveLength(0);
  });

  it("süre dolduysa: en uzun süredir paylaşılmayan video seçilir", async () => {
    toolRows = [
      { guid: "tool-reel:compress", createdAt: new Date(Date.now() - 10 * DAY) },
      { guid: "tool-reel:merge", createdAt: new Date(Date.now() - 4 * DAY) },
    ];
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(new Set(toolPosts().map((p) => p.guid))).toEqual(new Set(["tool-reel:compress"]));
  });

  it("Reels otomatik mod açıksa: onaysız KUYRUĞA girer; elle hazırlıkta (hold) yine taslak", async () => {
    config = { ...config, reelsAutoPublish: true };
    await connectInstagram();
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);
    expect(toolPosts().find((p) => p.platform === "INSTAGRAM")?.status).toBe("QUEUED");

    created.length = 0;
    await queueDailyPosts(new Date(), true);
    expect(toolPosts().find((p) => p.platform === "INSTAGRAM")?.status).toBe("DRAFT");
  });
});
