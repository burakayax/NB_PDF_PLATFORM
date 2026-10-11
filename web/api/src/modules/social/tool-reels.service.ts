/**
 * Araç tanıtım videoları (ekran kaydı Reels'leri): katalog, depolama, sıra ve temizlik.
 *
 * AKIŞ: Paylaşım zamanı yaklaşınca GitHub'daki iş akışı videoyu üretir ve API'ye yükler
 * (`tool-reel-factory.routes.ts`). Günlük tur o videoyu Instagram + Facebook Reels
 * gönderisine çevirir. Gönderiler yayınlandıktan sonra video SİLİNİR (`cleanupToolVideos`).
 *
 * NEDEN VERİTABANI: Sunucuda kalıcı disk yok; Instagram/Facebook videoyu bizim adresimizden
 * indirir. Dosya birkaç MB ve yalnızca birkaç gün tutulur, tek satır yeter.
 *
 * KAYIT ADRESİ: Her üretim ayrı kimlik alır (`<araç>-<ms>`); gönderi o adresi saklar, böylece
 * sonradan üretilen yeni video eski gönderinin videosunu değiştirmez.
 */

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { TOOL_REEL_CATALOG } from "./tool-reel-catalog.js";
import type { ToolReelCatalogEntry } from "./tool-reel-catalog.js";
import type { FeedItem } from "./social.types.js";

/** Araç videosu gönderilerinin `guid` öneki: blog yazılarıyla karışmasın. */
export const TOOL_REEL_PREFIX = "tool-reel:";

/** Üretilen video bu süre içinde "taze" sayılır (sabah üretilip akşam paylaşılsa bile yeter). */
export const FRESH_MS = 36 * 3600_000;
/** Elle taslak hazırlarken kullanılabilecek en eski video. */
export const MANUAL_MAX_AGE_MS = 14 * 24 * 3600_000;

/** Bu durumdaki gönderi videoya hâlâ ihtiyaç duyar. */
const PENDING_STATUSES = ["DRAFT", "QUEUED", "PUBLISHING", "MANUAL", "FAILED"];

export type ToolReelVideoInfo = { id: string; url: string; seconds: number; createdAt: Date };
export type ToolReel = ToolReelCatalogEntry & { guid: string; video: ToolReelVideoInfo | null };

export const toolReelGuid = (toolId: string): string => `${TOOL_REEL_PREFIX}${toolId}`;

export const findCatalogEntry = (toolId: string): ToolReelCatalogEntry | undefined =>
  TOOL_REEL_CATALOG.find((t) => t.id === toolId);

/** Videonun herkese açık adresi (Instagram/Facebook buradan indirir). */
export function videoUrlFor(videoId: string): string {
  return `${env.APP_BASE_URL.replace(/\/$/, "")}/api/public/tool-reels/${videoId}.mp4`;
}

const infoOf = (r: { id: string; seconds: number; createdAt: Date }): ToolReelVideoInfo => ({
  id: r.id,
  url: videoUrlFor(r.id),
  seconds: r.seconds,
  createdAt: r.createdAt,
});

/** Katalog + her aracın en yeni videosu (video baytları OKUNMAZ). */
export async function loadToolReels(): Promise<ToolReel[]> {
  const rows = await prisma.socialToolVideo.findMany({
    select: { id: true, toolId: true, seconds: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return TOOL_REEL_CATALOG.map((entry) => {
    const latest = rows.find((r) => r.toolId === entry.id);
    return { ...entry, guid: toolReelGuid(entry.id), video: latest ? infoOf(latest) : null };
  });
}

/** Aracın, en fazla `maxAgeMs` yaşında en yeni videosu. */
export async function latestVideoFor(toolId: string, maxAgeMs: number, now = new Date()): Promise<ToolReelVideoInfo | null> {
  const row = await prisma.socialToolVideo.findFirst({
    where: { toolId, createdAt: { gte: new Date(now.getTime() - maxAgeMs) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, seconds: true, createdAt: true },
  });
  return row ? infoOf(row) : null;
}

/** Henüz hiçbir gönderiye bağlanmamış taze video (otomatik tur yalnız bunu kullanır). */
export async function unusedFreshVideoFor(toolId: string, now = new Date()): Promise<ToolReelVideoInfo | null> {
  const video = await latestVideoFor(toolId, FRESH_MS, now);
  if (!video) return null;
  const used = await prisma.socialPost.count({ where: { imageUrl: { contains: video.id } } });
  return used === 0 ? video : null;
}

export async function saveToolVideo(toolId: string, data: Buffer, seconds: number): Promise<ToolReelVideoInfo> {
  const id = `${toolId}-${Date.now()}`;
  const row = await prisma.socialToolVideo.create({
    data: { id, toolId, data, sizeBytes: data.length, seconds },
    select: { id: true, seconds: true, createdAt: true },
  });
  return infoOf(row);
}

export async function readToolVideo(videoId: string): Promise<Buffer | null> {
  const row = await prisma.socialToolVideo.findUnique({ where: { id: videoId }, select: { data: true } });
  return row ? Buffer.from(row.data) : null;
}

/**
 * Sıradaki araç: hiç paylaşılmamış önce, hepsi paylaşıldıysa en eski paylaşılan.
 * Sıklık (`everyDays`) dolmadıysa `null` (bugün araç videosu günü değil).
 */
export async function pickDueToolReel(
  now: Date,
  everyDays: number,
): Promise<ToolReelCatalogEntry | null> {
  if (everyDays <= 0 || TOOL_REEL_CATALOG.length === 0) return null;
  const rows = await prisma.socialPost.findMany({
    where: { guid: { startsWith: TOOL_REEL_PREFIX } },
    select: { guid: true, createdAt: true },
  });
  const lastAt = rows.reduce((m, r) => Math.max(m, r.createdAt.getTime()), 0);
  // 6 saat pay: tur her gün aynı saatte çalışır, milisaniye farkı bir günü kaçırmasın.
  if (lastAt && now.getTime() - lastAt < everyDays * 24 * 3600_000 - 6 * 3600_000) return null;

  const lastByGuid = new Map<string, number>();
  for (const r of rows) lastByGuid.set(r.guid, Math.max(lastByGuid.get(r.guid) ?? 0, r.createdAt.getTime()));
  return (
    TOOL_REEL_CATALOG.slice().sort(
      (a, b) => (lastByGuid.get(toolReelGuid(a.id)) ?? 0) - (lastByGuid.get(toolReelGuid(b.id)) ?? 0),
    )[0] ?? null
  );
}

/**
 * Videoyu siler: bekleyen gönderisi kalmadıysa. Hiç gönderiye bağlanmamış video taze süresi
 * dolunca, bekleyen gönderisi olan video ise 14 gün sonra (unutulmuş taslak) silinir.
 */
export async function cleanupToolVideos(now = new Date()): Promise<number> {
  const videos = await prisma.socialToolVideo.findMany({ select: { id: true, createdAt: true } });
  let removed = 0;
  for (const v of videos) {
    const age = now.getTime() - v.createdAt.getTime();
    const posts = await prisma.socialPost.findMany({
      where: { imageUrl: { contains: v.id } },
      select: { status: true },
    });
    const pending = posts.some((p) => PENDING_STATUSES.includes(p.status));
    const keep = posts.length === 0 ? age < FRESH_MS : pending && age < MANUAL_MAX_AGE_MS;
    if (keep) continue;
    await prisma.socialToolVideo.delete({ where: { id: v.id } });
    removed += 1;
  }
  return removed;
}

/** Videoyu blog yazısı biçimine çevirir (metin yazımı ve kuyruk aynı hattan geçsin). */
export function toolReelFeedItem(entry: ToolReelCatalogEntry): FeedItem {
  return {
    guid: toolReelGuid(entry.id),
    lang: "tr",
    title: entry.tr.title,
    summary: entry.tr.summary,
    link: entry.tr.link,
    publishedAt: Date.now(),
    categories: [],
    images: {},
    alt: { lang: "en", title: entry.en.title, summary: entry.en.summary, link: entry.en.link },
  };
}
