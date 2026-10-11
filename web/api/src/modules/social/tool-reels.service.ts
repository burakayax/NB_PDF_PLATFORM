/**
 * Araç tanıtım videoları (ekran kaydı Reels'leri).
 *
 * Videolar elle/yarı otomatik üretilir ve sitenin `public/arac-videolari/` klasörüne
 * konur; `manifest.json` her aracın videosunu, başlık/özetini ve arama terimlerini listeler.
 * Burada o dosya okunur ve her video, blog yazısı gibi bir `FeedItem` olarak sunulur —
 * böylece metin yazımı, kuyruk, onay ve yayın aynı hatlardan geçer.
 *
 * VİDEO ADRESİ SİTEDEN: Instagram/Facebook dosyayı bizim adresimizden kendisi indirir;
 * sunucuda ffmpeg ya da kalıcı disk gerekmez (blog Reels'leriyle aynı mimari).
 *
 * HATA YUTULUR: Manifest okunamazsa boş liste döner; blog otomasyonu bu yüzden durmaz.
 */

import { env } from "../../config/env.js";
import { logger } from "../../lib/file-log.js";
import type { KeywordSet } from "./keywords.service.js";
import type { FeedItem } from "./social.types.js";

/** Araç videosu gönderilerinin `guid` öneki: blog yazılarıyla karışmasın. */
export const TOOL_REEL_PREFIX = "tool-reel:";

type SideText = { title: string; summary: string; link: string };

type RawEntry = {
  video?: string;
  seconds?: number;
  tr?: Partial<SideText>;
  en?: Partial<SideText>;
  keywords?: { tr?: string[]; en?: string[]; tagsTr?: string[]; tagsEn?: string[] };
};

export type ToolReel = {
  id: string;
  guid: string;
  /** Mutlak video adresi. */
  videoUrl: string;
  seconds: number;
  tr: SideText;
  en: SideText;
  keywords: KeywordSet;
};

let cache: { at: number; data: ToolReel[] } | null = null;
/** Manifest her yayında yenilenir; saatte bir okumak yeter. */
const TTL_MS = 60 * 60 * 1000;

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

function side(raw: Partial<SideText> | undefined): SideText | null {
  if (!raw || !raw.title?.trim() || !raw.summary?.trim() || !raw.link?.trim()) return null;
  return { title: raw.title.trim(), summary: raw.summary.trim(), link: raw.link.trim() };
}

/** Manifest satırını doğrular; eksik/bozuk satır atlanır (yarım gönderi çıkmasın). */
export function parseToolReels(manifest: Record<string, RawEntry>, origin: string): ToolReel[] {
  const base = origin.replace(/\/$/, "");
  const out: ToolReel[] = [];
  for (const [id, entry] of Object.entries(manifest)) {
    const tr = side(entry.tr);
    const en = side(entry.en);
    const video = typeof entry.video === "string" ? entry.video.trim() : "";
    if (!tr || !en || !/\.mp4$/i.test(video)) continue;
    out.push({
      id,
      guid: `${TOOL_REEL_PREFIX}${id}`,
      videoUrl: /^https?:\/\//i.test(video) ? video : `${base}${video.startsWith("/") ? "" : "/"}${video}`,
      seconds: typeof entry.seconds === "number" ? entry.seconds : 0,
      tr,
      en,
      keywords: {
        tr: strings(entry.keywords?.tr),
        en: strings(entry.keywords?.en),
        tagsTr: strings(entry.keywords?.tagsTr),
        tagsEn: strings(entry.keywords?.tagsEn),
      },
    });
  }
  return out;
}

export async function loadToolReels(): Promise<ToolReel[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const origin = env.FRONTEND_ORIGIN;
  const url = `${origin.replace(/\/$/, "")}/arac-videolari/manifest.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = parseToolReels((await res.json()) as Record<string, RawEntry>, origin);
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    logger.warn("social", `Araç videoları manifesti okunamadı: ${String(err)}`);
    // Başarısızlık da kısa süre önbelleğe alınır: her istekte 20 sn beklemeyelim.
    cache = { at: Date.now() - TTL_MS + 5 * 60 * 1000, data: [] };
    return [];
  }
}

/** Test için: önbelleği sıfırlar. */
export function resetToolReelsCache(): void {
  cache = null;
}

/** Videoyu blog yazısı biçimine çevirir (metin yazımı ve kuyruk aynı hattan geçsin). */
export function toolReelFeedItem(reel: ToolReel): FeedItem {
  return {
    guid: reel.guid,
    lang: "tr",
    title: reel.tr.title,
    summary: reel.tr.summary,
    link: reel.tr.link,
    publishedAt: Date.now(),
    categories: [],
    images: {},
    alt: { lang: "en", title: reel.en.title, summary: reel.en.summary, link: reel.en.link },
  };
}

/** Bu `guid` bir araç videosuna aitse video adresi; değilse `null`. */
export async function toolReelUrlFor(guid: string): Promise<string | null> {
  if (!guid.startsWith(TOOL_REEL_PREFIX)) return null;
  return (await loadToolReels()).find((r) => r.guid === guid)?.videoUrl ?? null;
}
