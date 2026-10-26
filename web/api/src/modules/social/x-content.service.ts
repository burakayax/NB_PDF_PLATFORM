/**
 * X içerik kaynağı (`/social-x.json`): yazıların ipuçları, ürün gönderileri ve anketler.
 *
 * Dosya sitenin build'inde üretilir (frontend/scripts/generate-social-x.mjs). Okunamazsa X için o gün gönderi hazırlanmaz
 * (sessizce atlanır, panelde sebep yazar); diğer ağları ETKİLEMEZ.
 */

import { env } from "../../config/env.js";
import { logger } from "../../lib/file-log.js";
import type { XContent } from "./x-compose.js";

const TTL_MS = 60 * 60 * 1000;
let cache: { at: number; data: XContent } | null = null;

const absolute = (origin: string, path: string): string => (/^https?:\/\//.test(path) ? path : `${origin}${path}`);

/** Kart yollarını mutlak adrese çevirir (X görseli bu adresten indirir). */
export function absolutize(content: XContent, origin: string): XContent {
  const o = origin.replace(/\/$/, "");
  return {
    posts: Object.fromEntries(
      Object.entries(content.posts).map(([url, p]) => [url, { ...p, card: absolute(o, p.card), factCards: p.factCards.map((c) => absolute(o, c)) }]),
    ),
    products: content.products.map((p) => ({ ...p, card: absolute(o, p.card) })),
    polls: content.polls.map((q) => ({ ...q, card: q.card ? absolute(o, q.card) : undefined })),
  };
}

export async function loadXContent(): Promise<XContent | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const origin = env.FRONTEND_ORIGIN.replace(/\/$/, "");
  try {
    const res = await fetch(`${origin}/social-x.json`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = absolutize((await res.json()) as XContent, origin);
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    logger.warn("social", `X içerik kaynağı okunamadı: ${String(err)}`);
    return null;
  }
}
