/**
 * Pinterest anahtar kelimeleri: araç/yazı başına ana kelime + 2-4 yan kelime.
 *
 * Panelden düzeltilenler ayarlarda tutulur (`pinterestKeywords`). Düzeltilmemişse öneri
 * otomatik gelir: araçlar için katalogdaki arama terimleri (araç sayfasının SEO başlığından
 * türetilmiştir), yazılar için SEO bankasındaki terimler.
 */

import { TOOL_REEL_CATALOG } from "./tool-reel-catalog.js";
import { seoKeywordsFor } from "./keywords.service.js";
import { toolIdFromGuid } from "./platforms/reel-cover.js";
import type { FeedItem } from "./social.types.js";
import type { PinKeywords } from "./social.service.js";

type ItemLike = Pick<FeedItem, "guid" | "lang"> & Partial<FeedItem>;

/** Ayar anahtarı: araçta araç kimliği, yazıda guid. */
export function pinKeywordKey(guid: string): string {
  return toolIdFromGuid(guid) ?? guid;
}

function fromTerms(terms: string[]): PinKeywords | null {
  const clean = terms.map((t) => t.trim()).filter(Boolean);
  return clean[0] ? { main: clean[0], extra: clean.slice(1, 4) } : null;
}

/** Otomatik öneri (ayarda kayıt yoksa bu kullanılır). */
export async function suggestPinKeywords(item: ItemLike): Promise<PinKeywords | null> {
  const toolId = toolIdFromGuid(item.guid);
  if (toolId) {
    const entry = TOOL_REEL_CATALOG.find((e) => e.id === toolId);
    return entry ? fromTerms(item.lang === "en" ? entry.keywords.en : entry.keywords.tr) : null;
  }
  try {
    const seo = await seoKeywordsFor(item as FeedItem);
    return fromTerms(item.lang === "en" ? seo.en : seo.tr);
  } catch {
    return null;
  }
}

/** Panelde düzeltilmiş kayıt varsa o, yoksa otomatik öneri. */
export async function resolvePinKeywords(item: ItemLike, saved: Record<string, PinKeywords>): Promise<PinKeywords | null> {
  return saved[pinKeywordKey(item.guid)] ?? (await suggestPinKeywords(item));
}
