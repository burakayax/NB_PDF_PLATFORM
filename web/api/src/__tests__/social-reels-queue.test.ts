/**
 * Blog gönderileri Reels OLMAZ: yalnız araç tanıtım videoları Reels olur (kullanıcı kararı).
 *
 * Veritabanı, besleme ve yapay zekâ metni sahte; yalnızca `queueDailyPosts`in Instagram
 * kaydına hangi durumu ve hangi medya adresini yazdığı sınanır.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "../modules/social/social.types.js";

const POST_URL = "https://example.test/blog/yazi";
const COVER = "https://example.test/covers/square/yazi.png";

const ITEM: FeedItem = {
  guid: POST_URL,
  lang: "tr",
  title: "Deneme yazısı",
  summary: "Özet",
  link: POST_URL,
  publishedAt: Date.now(),
  categories: [],
  images: { wide: COVER, square: COVER, tall: COVER },
};

const created: { platform: string; status: string; imageUrl: string | null }[] = [];
let reelsAutoPublish = false;

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    socialAccount: { findMany: vi.fn(async () => []) },
    socialToolVideo: { findMany: vi.fn(async () => []), delete: vi.fn() },
    socialPost: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: { platform: string; status: string; imageUrl: string | null } }) => {
        created.push({ platform: data.platform, status: data.status, imageUrl: data.imageUrl });
        return data;
      }),
    },
  },
}));
vi.mock("../lib/site-config.service.js", () => ({
  getSettingWithFallback: vi.fn(async () => ({ reelsAutoPublish, researchKeywords: false })),
  setSetting: vi.fn(),
}));
vi.mock("../modules/social/rss.service.js", () => ({
  fetchPairedFeedItems: vi.fn(async () => [ITEM]),
}));
vi.mock("../modules/social/keywords.service.js", () => ({ keywordsFor: vi.fn(async () => ({ tr: [], en: [] })) }));
vi.mock("../modules/social/copy.service.js", () => ({
  writePostBodies: vi.fn(async ({ platforms }: { platforms: string[] }) =>
    Object.fromEntries(platforms.map((p) => [p, `metin ${p}`])),
  ),
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

const instagramRow = () => created.find((c) => c.platform === "INSTAGRAM");

beforeEach(() => {
  created.length = 0;
  reelsAutoPublish = false;
});

describe("blog gönderisi Reels olmaz", () => {
  it("onaylı mod: görselle, onay beklemeden KUYRUĞA girer; medya video değil kapaktır", async () => {
    await connectInstagram();
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(instagramRow()?.status).toBe("QUEUED");
    expect(instagramRow()?.imageUrl).toBe(COVER);
  });

  it("Reels otomatik modu açık olsa da blog gönderisi görsel kalır", async () => {
    reelsAutoPublish = true;
    await connectInstagram();
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(instagramRow()?.status).toBe("QUEUED");
    expect(instagramRow()?.imageUrl).toBe(COVER);
  });

  it("elle 'taslak hazırla' (hold): taslak bırakır", async () => {
    await connectInstagram();
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), true);

    expect(instagramRow()?.status).toBe("DRAFT");
    expect(instagramRow()?.imageUrl).toBe(COVER);
  });
});
