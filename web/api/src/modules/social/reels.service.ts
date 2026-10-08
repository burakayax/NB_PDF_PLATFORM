/**
 * Instagram Reels videolarının adresleri.
 *
 * Videolar sitenin build'inde üretilir (frontend `scripts/generate-reels.mjs`, carousel
 * slaytlarından) ve `/social/reels/manifest.json` dosyasında yazı adresine göre listelenir.
 * Burada o dosya okunur; bir yazı için video varsa Instagram gönderisi Reels olur.
 *
 * HATA YUTULUR: Manifest okunamazsa ya da yazı listede yoksa `null` döner. Bu bir hata
 * değil — otomasyon carousel/tek görselle devam eder; yayın hiçbir koşulda bu yüzden durmaz.
 */

import { env } from "../../config/env.js";
import { logger } from "../../lib/file-log.js";
import type { FeedItem } from "./social.types.js";

type Manifest = Record<string, { url?: string; seconds?: number }>;

let cache: { at: number; data: Manifest } | null = null;
/** Manifest her yayında yenilenir; saatte bir okumak fazlasıyla yeter. */
const TTL_MS = 60 * 60 * 1000;

async function loadManifest(): Promise<Manifest> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const url = `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/social/reels/manifest.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Manifest;
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    logger.warn("social", `Reels manifesti okunamadı (carousel/tek görsele düşülür): ${String(err)}`);
    // Başarısızlık da kısa süre önbelleğe alınır: her gönderide 20 sn beklemeyelim.
    cache = { at: Date.now() - TTL_MS + 5 * 60 * 1000, data: {} };
    return {};
  }
}

/** Test için: önbelleği sıfırlar. */
export function resetReelsCache(): void {
  cache = null;
}

/** Bu yazının Reels video adresi; yoksa `null`. */
export async function reelFor(item: Pick<FeedItem, "guid" | "link">): Promise<string | null> {
  const manifest = await loadManifest();
  const url = (manifest[item.guid] ?? manifest[item.link])?.url;
  return typeof url === "string" && isReelUrl(url) ? url : null;
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
