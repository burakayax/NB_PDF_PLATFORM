/**
 * Panelde gösterilen gönderi görünümleri ve geçmişi temizleme.
 *
 * GEÇMİŞ NEDEN SİLİNMİYOR (varsayılan): `pickNextItem`, bir yazının bir ağda daha önce
 * paylaşılıp paylaşılmadığını bu kayıtlara bakarak anlar. Kayıtlar gerçekten silinirse
 * sıra başa döner ve aynı yazılar yeniden paylaşılır. "Temizle" bu yüzden kayıtları
 * yalnızca panelden GİZLER (`clearedAt`); sıra bozulmaz. Sıranın da sıfırlanması
 * isteniyorsa kayıtlar gerçekten silinir (`resetRotation`) — bu bilinçli ve ayrı bir seçim.
 *
 * Temizleme yalnızca bizim panel kaydımızı etkiler; Instagram/Facebook/… üzerindeki
 * gerçek gönderiye dokunmaz.
 */

import type { SocialPlatform, SocialPost } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { carouselSlidesFor } from "./carousel.service.js";
import { ALL_PLATFORMS } from "./social.types.js";
import type { FeedItem } from "./social.types.js";

/** Her ağ için panelde gösterilen son paylaşım sayısı. */
export const RECENT_PER_PLATFORM = 5;

/** Panelden temizlenebilen (artık işlem beklemeyen) durumlar. */
export const HISTORY_STATUSES = ["PUBLISHED", "SKIPPED"] as const;

export type PanelPost = SocialPost & {
  /**
   * Gönderinin gerçek kaydırmalı hâli.
   * Yayınlanmışsa yayın anında kullanılan slaytlar; yayın bekleyense yayınlanırsa
   * kullanılacak slaytlar (manifestten). Tek görselse boş.
   */
  carouselSlides: string[];
};

function parseSlides(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

/** Kaydın panelde gösterilecek slaytları. Instagram dışında hep boş. */
export async function slidesForPost(post: SocialPost): Promise<string[]> {
  if (post.platform !== "INSTAGRAM") return [];
  // Reels'te "görsel" adresi videodur; slayt yok.
  if (/\.mp4(\?|$)/i.test(post.imageUrl ?? "")) return [];
  // Yayınlanmış gönderi: gerçekte ne gittiyse o (eski kayıtlar tek görseldi → boş).
  if (post.status === "PUBLISHED") return parseSlides(post.slidesJson);
  // Henüz yayınlanmamış: yayınlanırsa hangi slaytlar kullanılacaksa onlar.
  const item = { guid: post.guid, link: post.linkUrl } as FeedItem;
  return carouselSlidesFor(item).catch(() => []);
}

async function withSlides(posts: SocialPost[]): Promise<PanelPost[]> {
  return Promise.all(posts.map(async (p) => ({ ...p, carouselSlides: await slidesForPost(p) })));
}

/** Panelin kuyruk/elle/başarısız listesi: temizlenmişler hariç, en yeni başta. */
export async function listPanelPosts(limit = 50): Promise<PanelPost[]> {
  const rows = await prisma.socialPost.findMany({
    where: { clearedAt: null },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
  return withSlides(rows);
}

/** Her ağ için son N paylaşım (temizlenmişler hariç). */
export async function recentPublishedByPlatform(
  perPlatform = RECENT_PER_PLATFORM,
): Promise<Record<SocialPlatform, PanelPost[]>> {
  const out = {} as Record<SocialPlatform, PanelPost[]>;
  await Promise.all(
    ALL_PLATFORMS.map(async (platform) => {
      const rows = await prisma.socialPost.findMany({
        where: { platform, status: "PUBLISHED", clearedAt: null },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: perPlatform,
      });
      out[platform] = await withSlides(rows);
    }),
  );
  return out;
}

/**
 * Geçmişi temizler (yayınlanmış ve atlanmış kayıtlar).
 *
 * @param resetRotation `false` (varsayılan): kayıtlar panelden gizlenir, paylaşım sırası korunur.
 *   `true`: kayıtlar silinir — sıra başa döner, aynı yazılar yeniden paylaşılabilir.
 * @returns etkilenen kayıt sayısı
 */
export async function clearHistory(resetRotation = false): Promise<number> {
  const statuses = [...HISTORY_STATUSES];
  if (resetRotation) {
    const res = await prisma.socialPost.deleteMany({ where: { status: { in: statuses } } });
    return res.count;
  }
  const res = await prisma.socialPost.updateMany({
    where: { status: { in: statuses }, clearedAt: null },
    data: { clearedAt: new Date() },
  });
  return res.count;
}

/** Tek bir geçmiş kaydını panelden kaldırır (gizler); sıra korunur. */
export async function clearHistoryPost(postId: string): Promise<boolean> {
  const res = await prisma.socialPost.updateMany({
    where: { id: postId, status: { in: [...HISTORY_STATUSES] }, clearedAt: null },
    data: { clearedAt: new Date() },
  });
  return res.count > 0;
}
