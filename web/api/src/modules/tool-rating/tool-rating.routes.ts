/**
 * Araç puanlama uçları.
 *
 * MİSAFİRE AÇIK: Puan veren kişilerin çoğu üye değil — aracı kullanıp çıkan
 * ziyaretçiler. Üyelik şartı koymak, toplanacak veriyi neredeyse tamamen
 * yok ederdi. Kötüye kullanım, oy başına tekilleştirme ve hız sınırıyla
 * kısıtlanıyor.
 *
 * Yollar:
 *   POST /api/tool-rating/:slug   → puan ver (1-5, düşük puanda açıklama)
 *   GET  /api/tool-rating/:slug   → o aracın özeti
 *   GET  /api/tool-rating         → yayınlanabilir tüm özetler (SEO üretimi okur)
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { HttpError } from "../../lib/http-error.js";
import {
  BEST_RATING,
  COMMENT_ASKED_BELOW,
  MIN_RATINGS_TO_PUBLISH,
  WORST_RATING,
  normalizeComment,
  publishableSummaries,
  recordRating,
  summaryFor,
  voterHashFor,
} from "./tool-rating.service.js";

export const toolRatingRouter: Router = Router();

/** Araç kimliği: yalnızca küçük harf, rakam ve tire. */
const SLUG = /^[a-z0-9-]{2,64}$/;

const bodySchema = z.object({
  value: z.number().int().min(WORST_RATING).max(BEST_RATING),
  comment: z.string().max(1000).optional(),
});

/**
 * Oy hız sınırı.
 *
 * Tekilleştirme zaten aynı kişinin aynı aracı ikinci kez saymasını engelliyor;
 * bu sınır, 45 aracı sırayla otomatik puanlamaya çalışan bir betiği durdurur.
 */
const voteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function slugOf(raw: unknown): string {
  const slug = String(raw ?? "");
  if (!SLUG.test(slug)) throw new HttpError(400, "Geçersiz araç kimliği.");
  return slug;
}

toolRatingRouter.post(
  "/:slug",
  voteLimiter,
  asyncHandler(async (request, response) => {
    const slug = slugOf(request.params.slug);
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "Puan 1 ile 5 arasında olmalı.");

    const ip = request.ip ?? "";
    const userAgent = String(request.get("user-agent") ?? "");
    await recordRating({
      toolSlug: slug,
      value: parsed.data.value,
      voterHash: voterHashFor(ip, userAgent),
      comment: normalizeComment(parsed.data.comment),
    });

    // Oy verenin kendi oyunu görmesi için güncel özet geri döner.
    response.json({ ok: true, summary: await summaryFor(slug) });
  }),
);

toolRatingRouter.get(
  "/:slug",
  asyncHandler(async (request, response) => {
    response.json(await summaryFor(slugOf(request.params.slug)));
  }),
);

toolRatingRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json({
      minRatingsToPublish: MIN_RATINGS_TO_PUBLISH,
      commentAskedBelow: COMMENT_ASKED_BELOW,
      bestRating: BEST_RATING,
      worstRating: WORST_RATING,
      tools: await publishableSummaries(),
    });
  }),
);
