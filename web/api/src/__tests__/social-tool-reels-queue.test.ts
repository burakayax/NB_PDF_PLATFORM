/**
 * Araç videosunun otomatik sıraya katılması: sıklık, hazır video şartı ve onay kararı.
 *
 * Veritabanı, besleme ve yapay zekâ sahte; sıra/video seçimi `tool-reels.service`in kendi
 * testinde sınanır. Burada yalnızca `queueDailyPosts`in araç videosu için ne yazdığına bakılır.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "../modules/social/social.types.js";

const VIDEO_URL = "https://api.example.test/api/public/tool-reels/compress-1791728774504.mp4";

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

const created: { platform: string; guid: string; status: string; imageUrl: string | null }[] = [];
let config: Record<string, unknown> = {};
let due: { id: string } | null = null;
let fresh: { id: string; url: string; seconds: number; createdAt: Date } | null = null;
const cleanup = vi.fn(async () => 0);

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    socialAccount: { findMany: vi.fn(async () => []) },
    socialPost: {
      findMany: vi.fn(async () => []),
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
vi.mock("../modules/social/tool-reels.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../modules/social/tool-reels.service.js")>();
  return {
    ...actual,
    pickDueToolReel: vi.fn(async () => due),
    unusedFreshVideoFor: vi.fn(async () => fresh),
    latestVideoFor: vi.fn(async () => fresh),
    cleanupToolVideos: cleanup,
  };
});
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
  cleanup.mockClear();
  config = { reelsAutoPublish: false, researchKeywords: false, toolReelEveryDays: 3 };
  due = { id: "compress" };
  fresh = { id: "compress-1791728774504", url: VIDEO_URL, seconds: 27, createdAt: new Date() };
});

describe("araç videosu otomatik sırası", () => {
  it("sıklık 0 (kapalı): araç videosu kuyruğa girmez", async () => {
    config = { ...config, toolReelEveryDays: 0 };
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(toolPosts()).toHaveLength(0);
  });

  it("bugün araç videosu günü değilse: eklenmez", async () => {
    due = null;
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(toolPosts()).toHaveLength(0);
  });

  it("video henüz hazır değilse: o gün atlanır, sebep sonuçta yazar, blog gönderileri etkilenmez", async () => {
    fresh = null;
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    const result = await queueDailyPosts(new Date(), false);

    expect(toolPosts()).toHaveLength(0);
    expect(result.skipped.some((s) => /henüz hazır değil/.test(s.reason))).toBe(true);
    expect(created.some((c) => c.guid === ITEM.guid)).toBe(true);
  });

  it("video hazırsa: Instagram + Facebook için hazırlanır; onaylı modda TASLAK, medya video adresi", async () => {
    await connectInstagram();
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(toolPosts().map((p) => `${p.platform}:${p.guid}`).sort()).toEqual([
      "FACEBOOK:tool-reel:compress",
      "INSTAGRAM:tool-reel:compress",
    ]);
    const ig = toolPosts().find((p) => p.platform === "INSTAGRAM");
    expect(ig?.status).toBe("DRAFT");
    expect(ig?.imageUrl).toBe(VIDEO_URL);
    // Facebook hesabı bağlı değil → elle paylaşılacak.
    expect(toolPosts().find((p) => p.platform === "FACEBOOK")?.status).toBe("MANUAL");
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

  it("her günlük turun sonunda paylaşılmış videolar temizlenir", async () => {
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(cleanup).toHaveBeenCalled();
  });
});
