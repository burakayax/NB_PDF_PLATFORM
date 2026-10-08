/**
 * Reels için "önce onay / otomatik" kararı: kuyruğa alınırken kaydın durumu.
 *
 * Veritabanı, besleme ve yapay zekâ metni sahte; yalnızca `queueDailyPosts`in
 * Instagram kaydına hangi durumu ve hangi medya adresini yazdığı sınanır.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "../modules/social/social.types.js";

const POST_URL = "https://example.test/blog/yazi";
const VIDEO = "https://example.test/social/reels/tr/yazi/reel.mp4";
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
let reel: string | null = VIDEO;

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    socialAccount: {
      findMany: vi.fn(async () => []),
    },
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
vi.mock("../modules/social/reels.service.js", () => ({
  reelFor: vi.fn(async () => reel),
  isReelUrl: (u: string | null) => typeof u === "string" && u.endsWith(".mp4"),
}));
vi.mock("../modules/social/platforms/index.js", () => ({ PUBLISHERS: {}, VERIFIERS: {} }));
vi.mock("../lib/encryption.js", () => ({ decryptField: vi.fn(), encryptField: vi.fn() }));

// Hesap bağlı olmayan ağlar MANUAL olur; bu testte Instagram'ı "bağlı" göstermek için
// hesap listesini sahte bir bağlı hesapla doldururuz.
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
  reel = VIDEO;
});

describe("Reels kuyruk kararı", () => {
  it("onaylı mod (varsayılan): otomatik turda bile Reels TASLAK kalır, medya video adresidir", async () => {
    await connectInstagram();
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(instagramRow()?.status).toBe("DRAFT");
    expect(instagramRow()?.imageUrl).toBe(VIDEO);
  });

  it("otomatik mod: Reels onaysız KUYRUĞA girer", async () => {
    reelsAutoPublish = true;
    await connectInstagram();
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(instagramRow()?.status).toBe("QUEUED");
    expect(instagramRow()?.imageUrl).toBe(VIDEO);
  });

  it("otomatik mod açıkken bile elle 'taslak hazırla' (hold) taslak bırakır", async () => {
    reelsAutoPublish = true;
    await connectInstagram();
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), true);

    expect(instagramRow()?.status).toBe("DRAFT");
  });

  it("videosu olmayan yazı: eskisi gibi görselle kuyruğa girer, onay beklemez", async () => {
    reel = null;
    await connectInstagram();
    const { queueDailyPosts } = await import("../modules/social/social.service.js");

    await queueDailyPosts(new Date(), false);

    expect(instagramRow()?.status).toBe("QUEUED");
    expect(instagramRow()?.imageUrl).toBe(COVER);
  });
});
