/**
 * Instagram carousel slaytlarının adresleri.
 *
 * Slaytlar sitenin build'inde üretilir (frontend `scripts/generate-carousels.mjs`) ve
 * `/social/carousel/manifest.json` dosyasında yazı adresine göre listelenir. Burada o
 * dosya okunur; bir yazı için slayt varsa Instagram gönderisi carousel olur, yoksa
 * eskisi gibi tek görselle çıkar.
 *
 * HATA YUTULUR: Manifest okunamazsa ya da yazı listede yoksa boş döner. Bu bir hata
 * değil — otomasyon tek görselle devam eder; yayın hiçbir koşulda bu yüzden durmaz.
 */

import { env } from "../../config/env.js";
import { logger } from "../../lib/file-log.js";
import type { FeedItem } from "./social.types.js";

type Manifest = Record<string, { count?: number; urls?: string[] }>;

/** Instagram carousel'de en fazla 10 görsel olur. */
export const CAROUSEL_MIN = 2;
export const CAROUSEL_MAX = 10;

let cache: { at: number; data: Manifest } | null = null;
/** Manifest her yayında yenilenir; saatte bir okumak fazlasıyla yeter. */
const TTL_MS = 60 * 60 * 1000;

async function loadManifest(): Promise<Manifest> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const url = `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/social/carousel/manifest.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Manifest;
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    logger.warn("social", `carousel manifesti okunamadı (tek görsele düşülür): ${String(err)}`);
    // Başarısızlık da kısa süre önbelleğe alınır: her gönderide 20 sn beklemeyelim.
    cache = { at: Date.now() - TTL_MS + 5 * 60 * 1000, data: {} };
    return {};
  }
}

/** Test için: önbelleği sıfırlar. */
export function resetCarouselCache(): void {
  cache = null;
}

/**
 * Bu yazının carousel slayt adresleri (sırayla). Carousel yoksa boş dizi.
 * Yalnızca yazının KENDİ dilindeki slaytlar kullanılır (besleme dili: Türkçe).
 */
export async function carouselSlidesFor(item: FeedItem): Promise<string[]> {
  const manifest = await loadManifest();
  const entry = manifest[item.guid] ?? manifest[item.link];
  const urls = Array.isArray(entry?.urls) ? entry.urls.filter((u) => typeof u === "string" && /^https?:\/\//.test(u)) : [];
  if (urls.length < CAROUSEL_MIN) return [];
  return urls.slice(0, CAROUSEL_MAX);
}
