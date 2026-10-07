/**
 * Panel geçmişi: son 5 paylaşım, "Temizle" ve gerçek önizleme (slaytlar).
 *
 * Kritik kural: "Temizle" varsayılan olarak kayıtları SİLMEZ, gizler. Çünkü paylaşım sırası
 * (pickNextItem) bu kayıtlara bakıyor; silinirse aynı yazılar yeniden paylaşılırdı.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const updateMany = vi.fn();
const deleteMany = vi.fn();

vi.mock("../lib/prisma.js", () => ({
  prisma: { socialPost: { findMany, updateMany, deleteMany } },
}));

const carouselSlidesFor = vi.fn();
vi.mock("../modules/social/carousel.service.js", () => ({ carouselSlidesFor }));

const base = {
  id: "p1",
  platform: "INSTAGRAM",
  guid: "https://example.test/blog/a",
  linkUrl: "https://example.test/blog/a",
  imageUrl: "https://example.test/covers/square/a.png",
  status: "PUBLISHED",
  slidesJson: null as string | null,
};

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([]);
  updateMany.mockReset().mockResolvedValue({ count: 3 });
  deleteMany.mockReset().mockResolvedValue({ count: 3 });
  carouselSlidesFor.mockReset().mockResolvedValue([]);
});

describe("Temizle", () => {
  it("varsayılan: kayıtları SİLMEZ, panelden gizler (paylaşım sırası korunur)", async () => {
    const { clearHistory } = await import("../modules/social/social.history.js");
    const n = await clearHistory(false);

    expect(n).toBe(3);
    expect(deleteMany).not.toHaveBeenCalled();
    const arg = updateMany.mock.calls[0]![0];
    expect(arg.where.status.in).toEqual(["PUBLISHED", "SKIPPED"]);
    expect(arg.where.clearedAt).toBeNull(); // zaten gizlenmişe dokunma
    expect(arg.data.clearedAt).toBeInstanceOf(Date);
  });

  it("sırayı sıfırla seçilirse kayıtlar gerçekten silinir", async () => {
    const { clearHistory } = await import("../modules/social/social.history.js");
    await clearHistory(true);

    expect(updateMany).not.toHaveBeenCalled();
    expect(deleteMany.mock.calls[0]![0].where.status.in).toEqual(["PUBLISHED", "SKIPPED"]);
  });

  it("bekleyen/başarısız/elle gönderilere hiç dokunmaz", async () => {
    const { HISTORY_STATUSES } = await import("../modules/social/social.history.js");
    for (const s of ["DRAFT", "QUEUED", "PUBLISHING", "FAILED", "MANUAL"]) {
      expect(HISTORY_STATUSES as readonly string[]).not.toContain(s);
    }
  });

  it("tek kayıt kaldırma da gizler", async () => {
    const { clearHistoryPost } = await import("../modules/social/social.history.js");
    expect(await clearHistoryPost("p1")).toBe(true);
    expect(deleteMany).not.toHaveBeenCalled();
    updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await clearHistoryPost("yok")).toBe(false);
  });
});

describe("Her ağ için son 5 paylaşım", () => {
  it("her platform için ayrı, 5 ile sınırlı, temizlenmişler hariç sorgular", async () => {
    const { recentPublishedByPlatform } = await import("../modules/social/social.history.js");
    const { ALL_PLATFORMS } = await import("../modules/social/social.types.js");
    const out = await recentPublishedByPlatform();

    expect(findMany).toHaveBeenCalledTimes(ALL_PLATFORMS.length);
    for (const call of findMany.mock.calls) {
      const q = call[0];
      expect(q.take).toBe(5);
      expect(q.where.status).toBe("PUBLISHED");
      expect(q.where.clearedAt).toBeNull();
    }
    const platforms = findMany.mock.calls.map((c) => c[0].where.platform).sort();
    expect(platforms).toEqual([...ALL_PLATFORMS].sort());
    expect(Object.keys(out).sort()).toEqual([...ALL_PLATFORMS].sort());
  });
});

describe("Önizlemedeki slaytlar gerçek hâli yansıtır", () => {
  it("yayınlanmış Instagram: yayın anında kullanılan slaytlar", async () => {
    const { slidesForPost } = await import("../modules/social/social.history.js");
    const slides = ["https://x/1.jpg", "https://x/2.jpg"];
    const out = await slidesForPost({ ...base, slidesJson: JSON.stringify(slides) } as never);
    expect(out).toEqual(slides);
    expect(carouselSlidesFor).not.toHaveBeenCalled();
  });

  it("eski (tek görselle yayınlanmış) kayıt: slayt YOK — bugünün manifestine bakılmaz", async () => {
    const { slidesForPost } = await import("../modules/social/social.history.js");
    carouselSlidesFor.mockResolvedValue(["https://x/1.jpg", "https://x/2.jpg"]);
    expect(await slidesForPost({ ...base, slidesJson: null } as never)).toEqual([]);
  });

  it("yayın bekleyen Instagram: yayınlanırsa kullanılacak slaytlar (manifestten)", async () => {
    const { slidesForPost } = await import("../modules/social/social.history.js");
    carouselSlidesFor.mockResolvedValue(["https://x/1.jpg", "https://x/2.jpg", "https://x/3.jpg"]);
    expect(await slidesForPost({ ...base, status: "DRAFT" } as never)).toHaveLength(3);
  });

  it("Instagram dışı ve Reels (video) için slayt yok", async () => {
    const { slidesForPost } = await import("../modules/social/social.history.js");
    carouselSlidesFor.mockResolvedValue(["https://x/1.jpg", "https://x/2.jpg"]);
    expect(await slidesForPost({ ...base, platform: "FACEBOOK", status: "DRAFT" } as never)).toEqual([]);
    expect(
      await slidesForPost({ ...base, status: "DRAFT", imageUrl: "https://x/reel.mp4" } as never),
    ).toEqual([]);
  });

  it("manifest hatası önizlemeyi bozmaz", async () => {
    const { slidesForPost } = await import("../modules/social/social.history.js");
    carouselSlidesFor.mockRejectedValue(new Error("ağ yok"));
    expect(await slidesForPost({ ...base, status: "DRAFT" } as never)).toEqual([]);
  });
});
