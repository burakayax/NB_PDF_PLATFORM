/**
 * Araç videosu yaşam döngüsü: sıradaki araç, taze/kullanılmamış video ve paylaşıldıktan sonra silme.
 *
 * Veritabanı bellekte sahte; kural kararları (neyin silineceği, hangi aracın sırası) sınanır.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-10-11T10:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

type Video = { id: string; toolId: string; createdAt: Date; seconds: number };
type Post = { guid: string; imageUrl: string | null; status: string; createdAt: Date };

let videos: Video[] = [];
let posts: Post[] = [];
const deleted: string[] = [];

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    socialToolVideo: {
      findMany: vi.fn(async () => videos),
      findFirst: vi.fn(async ({ where }: { where: { toolId: string; createdAt: { gte: Date } } }) =>
        videos
          .filter((v) => v.toolId === where.toolId && v.createdAt >= where.createdAt.gte)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        deleted.push(where.id);
        videos = videos.filter((v) => v.id !== where.id);
      }),
    },
    socialPost: {
      findMany: vi.fn(async ({ where }: { where: { guid?: { startsWith: string }; imageUrl?: { contains: string } } }) =>
        posts.filter((p) =>
          where.guid ? p.guid.startsWith(where.guid.startsWith) : (p.imageUrl ?? "").includes(where.imageUrl?.contains ?? "\0"),
        ),
      ),
      count: vi.fn(async ({ where }: { where: { imageUrl: { contains: string } } }) =>
        posts.filter((p) => (p.imageUrl ?? "").includes(where.imageUrl.contains)).length,
      ),
    },
  },
}));

const video = (id: string, toolId: string, age: number): Video => ({ id, toolId, createdAt: ago(age), seconds: 20 });
const post = (videoId: string | null, status: string, age = HOUR, guid = "tool-reel:compress"): Post => ({
  guid,
  imageUrl: videoId ? `https://api.example.test/api/public/tool-reels/${videoId}.mp4` : null,
  status,
  createdAt: ago(age),
});

beforeEach(() => {
  videos = [];
  posts = [];
  deleted.length = 0;
});

describe("paylaşıldıktan sonra silme", () => {
  it("tüm gönderileri yayınlanmış video silinir", async () => {
    videos = [video("compress-1000000000001", "compress", 5 * HOUR)];
    posts = [post("compress-1000000000001", "PUBLISHED"), post("compress-1000000000001", "PUBLISHED")];
    const { cleanupToolVideos } = await import("../modules/social/tool-reels.service.js");

    expect(await cleanupToolVideos(NOW)).toBe(1);
    expect(deleted).toEqual(["compress-1000000000001"]);
  });

  it.each(["DRAFT", "QUEUED", "PUBLISHING", "MANUAL", "FAILED"])("%s gönderisi varken video silinmez", async (status) => {
    videos = [video("compress-1000000000001", "compress", 5 * HOUR)];
    posts = [post("compress-1000000000001", "PUBLISHED"), post("compress-1000000000001", status)];
    const { cleanupToolVideos } = await import("../modules/social/tool-reels.service.js");

    expect(await cleanupToolVideos(NOW)).toBe(0);
    expect(deleted).toEqual([]);
  });

  it("henüz gönderiye bağlanmamış taze video (sabah üretildi, tur sonra) silinmez; bayatlayınca silinir", async () => {
    videos = [video("merge-1000000000002", "merge", 10 * HOUR), video("compress-1000000000001", "compress", 40 * HOUR)];
    const { cleanupToolVideos } = await import("../modules/social/tool-reels.service.js");

    expect(await cleanupToolVideos(NOW)).toBe(1);
    expect(deleted).toEqual(["compress-1000000000001"]);
  });

  it("unutulmuş taslak 14 gün sonra silinir (video dosyası sonsuza dek kalmaz)", async () => {
    videos = [video("compress-1000000000001", "compress", 15 * DAY)];
    posts = [post("compress-1000000000001", "DRAFT", 15 * DAY)];
    const { cleanupToolVideos } = await import("../modules/social/tool-reels.service.js");

    expect(await cleanupToolVideos(NOW)).toBe(1);
  });

  it("başka videonun gönderisi bu videoyu tutmaz", async () => {
    videos = [video("compress-1000000000001", "compress", 5 * HOUR), video("compress-1000000000009", "compress", 2 * HOUR)];
    posts = [post("compress-1000000000009", "DRAFT")];
    const { cleanupToolVideos } = await import("../modules/social/tool-reels.service.js");

    // Birincisinin gönderisi yok ve taze süresi içinde → ikisi de kalır.
    expect(await cleanupToolVideos(NOW)).toBe(0);
  });
});

describe("taze ve kullanılmamış video", () => {
  it("taze video gönderiye bağlanmadıysa verilir", async () => {
    videos = [video("merge-1000000000002", "merge", 5 * HOUR)];
    const { unusedFreshVideoFor } = await import("../modules/social/tool-reels.service.js");

    expect((await unusedFreshVideoFor("merge", NOW))?.id).toBe("merge-1000000000002");
  });

  it("zaten gönderiye çevrilmişse tekrar verilmez (aynı video iki kez paylaşılmasın)", async () => {
    videos = [video("merge-1000000000002", "merge", 5 * HOUR)];
    posts = [post("merge-1000000000002", "DRAFT", HOUR, "tool-reel:merge")];
    const { unusedFreshVideoFor } = await import("../modules/social/tool-reels.service.js");

    expect(await unusedFreshVideoFor("merge", NOW)).toBeNull();
  });

  it("36 saatten eski video taze sayılmaz", async () => {
    videos = [video("merge-1000000000002", "merge", 40 * HOUR)];
    const { unusedFreshVideoFor } = await import("../modules/social/tool-reels.service.js");

    expect(await unusedFreshVideoFor("merge", NOW)).toBeNull();
  });
});

describe("sıradaki araç", () => {
  it("kapalıyken (0 gün) hiç araç dönmez", async () => {
    const { pickDueToolReel } = await import("../modules/social/tool-reels.service.js");
    expect(await pickDueToolReel(NOW, 0)).toBeNull();
  });

  it("hiç paylaşılmamışken katalogdaki ilk araç", async () => {
    const { pickDueToolReel } = await import("../modules/social/tool-reels.service.js");
    expect((await pickDueToolReel(NOW, 3))?.id).toBe("compress");
  });

  it("son araç videosu sıklıktan yakınsa bugün araç günü değil", async () => {
    posts = [post(null, "PUBLISHED", 1 * DAY)];
    const { pickDueToolReel } = await import("../modules/social/tool-reels.service.js");
    expect(await pickDueToolReel(NOW, 3)).toBeNull();
  });

  it("süre dolduysa en uzun süredir paylaşılmayan araç seçilir", async () => {
    posts = [
      post(null, "PUBLISHED", 10 * DAY, "tool-reel:compress"),
      post(null, "PUBLISHED", 4 * DAY, "tool-reel:merge"),
      post(null, "PUBLISHED", 6 * DAY, "tool-reel:cv-olustur"),
    ];
    const { pickDueToolReel } = await import("../modules/social/tool-reels.service.js");
    expect((await pickDueToolReel(NOW, 3))?.id).toBe("compress");
  });

  it("birini paylaştıysa sıra diğerine geçer", async () => {
    posts = [post(null, "PUBLISHED", 4 * DAY, "tool-reel:compress")];
    const { pickDueToolReel } = await import("../modules/social/tool-reels.service.js");
    expect((await pickDueToolReel(NOW, 3))?.id).toBe("merge");
  });
});
