/**
 * Instagram/Facebook Reels: bir gönderinin video adresi.
 *
 * YALNIZ ARAÇ TANITIM VİDEOLARI Reels olur. Blog yazıları için slayt videosu üretilmez
 * (kullanıcı kararı); blog gönderileri carousel/tek görselle gider. Araç videoları
 * `tool-reels.service.ts` içinde, paylaşım zamanı yaklaşınca üretilir ve paylaşıldıktan sonra silinir.
 *
 * HATA YUTULUR: Video yoksa `null` döner; otomasyon carousel/tek görselle devam eder.
 */

import { prisma } from "../../lib/prisma.js";
import { TOOL_REEL_PREFIX, videoUrlFor } from "./tool-reels.service.js";
import type { FeedItem } from "./social.types.js";

/**
 * Bu içeriğin Reels video adresi; yoksa `null`.
 * Araç videosunun gönderi kaydı zaten video adresini taşır; bu yalnızca eski/yardımcı çağrılar içindir.
 */
export async function reelFor(item: Pick<FeedItem, "guid" | "link">): Promise<string | null> {
  if (!item.guid.startsWith(TOOL_REEL_PREFIX)) return null;
  const toolId = item.guid.slice(TOOL_REEL_PREFIX.length);
  const row = await prisma.socialToolVideo.findFirst({
    where: { toolId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return row ? videoUrlFor(row.id) : null;
}

/**
 * Bir kaydın medya adresi video mu?
 *
 * Gönderi kaydında ayrı bir "tür" alanı yok; Reels gönderisinde `imageUrl` yerine video
 * adresi tutulur ve yayıncı bunu uzantısından anlar. Böylece veritabanı şeması değişmez.
 */
export function isReelUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\/.+\.mp4(\?.*)?$/i.test(url);
}
