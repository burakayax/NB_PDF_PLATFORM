/**
 * Araç puanları — arama sonuçlarındaki yıldızların DAYANAĞI.
 *
 * NEDEN GERÇEK VERİ ŞART: Google'ın yapısal veri kuralları yıldızları yalnızca
 * gerçek kullanıcı puanlarına izin veriyor; uydurma ya da teşvikli puan elle
 * cezaya yol açar ve yıldızlar kalıcı olarak kaybolur. Bu yüzden burada tek bir
 * "başlangıç puanı" ya da varsayılan ortalama YOKTUR — ortalama neyse odur.
 *
 * ÖLÇEK NEDEN 5 YILDIZ: Başparmak (olumlu/olumsuz) daha çok ve daha dürüst oy
 * topluyor; ama sayısal bir ortalama üretmiyor. Google `ratingValue` için
 * dereceli bir ölçek istiyor, o yüzden 5 puanlık ölçek kullanılıyor.
 *
 * KİMLİK: Ham IP saklanmaz. IP + tarayıcı imzası birlikte karmalanır; aynı
 * kişinin aynı aracı tekrar puanlaması böylece engellenir, kimliği ise
 * saklanmaz.
 */

import { createHash } from "node:crypto";

import { prisma } from "../../lib/prisma.js";

/** Ölçeğin sınırları — Google'ın varsayılanlarıyla aynı (worst 1, best 5). */
export const WORST_RATING = 1;
export const BEST_RATING = 5;

/**
 * Yıldızların yayınlanması için gereken en az puan sayısı.
 *
 * Google bir alt sınır şart koşmuyor. Sınır yine de var, çünkü tek bir oydan
 * "5,0" üretmek hem kırılgan (bir kişi ortalamayı uçurur) hem de ziyaretçiye
 * güven vermiyor. Araç sayfası bu sayıya ulaşana kadar aggregateRating
 * YAYINLANMAZ; puan toplanmaya devam eder.
 */
export const MIN_RATINGS_TO_PUBLISH = 10;

/** Düşük puanda istenen açıklamanın üst sınırı. */
const MAX_COMMENT = 300;

/** Açıklama yalnızca bu puanın altında sorulur (teşhis değeri orada). */
export const COMMENT_ASKED_BELOW = 4;

export type RatingSummary = {
  toolSlug: string;
  /** Ortalama, bir ondalık basamağa yuvarlanmış (Google nokta ayırıcı ister). */
  ratingValue: number;
  ratingCount: number;
  /** Yayınlanabilir mi — MIN_RATINGS_TO_PUBLISH eşiği geçildi mi? */
  publishable: boolean;
};

/**
 * Oy verenin takma kimliği.
 *
 * IP tek başına yetersiz (aynı ev/ofis ağındaki herkes aynı görünür) ve ham
 * haliyle saklanması da gereksiz. IP + User-Agent karması ikisini de çözüyor.
 */
export function voterHashFor(ip: string, userAgent: string): string {
  return createHash("sha256").update(`${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

/** Puanı kaydeder. Aynı kişi aynı aracı yeniden puanlarsa oyu GÜNCELLENİR. */
export async function recordRating(params: {
  toolSlug: string;
  value: number;
  voterHash: string;
  comment?: string | null;
}): Promise<void> {
  const value = Math.round(params.value);
  if (value < WORST_RATING || value > BEST_RATING) {
    throw new Error("RATING_OUT_OF_RANGE");
  }
  // Açıklama yalnızca düşük puanda anlamlı; yüksek puanla gelen metin yok sayılır.
  const comment = value < COMMENT_ASKED_BELOW ? (params.comment ?? null) : null;
  await prisma.toolRating.upsert({
    where: { toolSlug_voterHash: { toolSlug: params.toolSlug, voterHash: params.voterHash } },
    create: { toolSlug: params.toolSlug, value, voterHash: params.voterHash, comment },
    update: { value, comment },
  });
}

/** Son düşük puanlar ve açıklamaları — hangi aracın nerede tökezlediğini gösterir. */
export async function recentComplaints(limit = 50): Promise<
  Array<{ toolSlug: string; value: number; comment: string; createdAt: Date }>
> {
  const rows = await prisma.toolRating.findMany({
    where: { value: { lt: COMMENT_ASKED_BELOW }, comment: { not: null } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    select: { toolSlug: true, value: true, comment: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, comment: r.comment ?? "" }));
}

/** Tek bir aracın özeti. */
export async function summaryFor(toolSlug: string): Promise<RatingSummary> {
  const agg = await prisma.toolRating.aggregate({
    where: { toolSlug },
    _avg: { value: true },
    _count: { value: true },
  });
  const count = agg._count.value ?? 0;
  return {
    toolSlug,
    ratingValue: Math.round((agg._avg.value ?? 0) * 10) / 10,
    ratingCount: count,
    publishable: count >= MIN_RATINGS_TO_PUBLISH,
  };
}

/**
 * Tüm araçların özeti — SEO üretimi build sırasında bunu okur.
 * Yalnızca eşiği geçenler döner; geçmeyeni yayınlamak yanlış olur.
 */
export async function publishableSummaries(): Promise<RatingSummary[]> {
  const rows = await prisma.toolRating.groupBy({
    by: ["toolSlug"],
    _avg: { value: true },
    _count: { value: true },
  });
  return rows
    .map((r) => ({
      toolSlug: r.toolSlug,
      ratingValue: Math.round((r._avg.value ?? 0) * 10) / 10,
      ratingCount: r._count.value ?? 0,
      publishable: (r._count.value ?? 0) >= MIN_RATINGS_TO_PUBLISH,
    }))
    .filter((r) => r.publishable)
    .sort((a, b) => a.toolSlug.localeCompare(b.toolSlug));
}

/** Açıklama metnini temizler; boşsa null döner. */
export function normalizeComment(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim().slice(0, MAX_COMMENT);
  return text.length > 0 ? text : null;
}
