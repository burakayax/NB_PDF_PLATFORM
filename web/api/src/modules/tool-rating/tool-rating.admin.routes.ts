/**
 * Araç puanları — yönetim uçları (`/api/admin/tool-ratings`).
 *
 * NEDEN AYRI DOSYA: Misafire açık oylama uçlarıyla aynı yerde durursa, bir gün
 * biri yanlışlıkla bu uçları da açık listeye ekleyebilir. Yönetim uçları ayrı
 * dosyada ve ayrı kök altında; `requireAdmin` zinciri `/api/admin` üzerinde.
 */

import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";
import {
  BEST_RATING,
  COMMENT_ASKED_BELOW,
  MIN_RATINGS_TO_PUBLISH,
  adminBreakdown,
  recentComplaints,
} from "./tool-rating.service.js";

export const toolRatingAdminRouter: Router = Router();

// Admin korumasi her yonlendiricide AYRI uygulaniyor (bkz. socialRouter);
// "/api/admin" kokunde toplu bir koruma YOK. Bu satir olmadan uc aciktir.
toolRatingAdminRouter.use(requireAdmin);

toolRatingAdminRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const rawLimit = Number(request.query.limit);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
    const [tools, comments] = await Promise.all([adminBreakdown(), recentComplaints(limit)]);

    const totalRatings = tools.reduce((sum, t) => sum + t.ratingCount, 0);
    const weighted = tools.reduce((sum, t) => sum + t.ratingValue * t.ratingCount, 0);

    response.json({
      /** Eşik ve ölçek — panel bunları sabit yazmasın, kaynağı burası. */
      minRatingsToPublish: MIN_RATINGS_TO_PUBLISH,
      commentAskedBelow: COMMENT_ASKED_BELOW,
      bestRating: BEST_RATING,
      totals: {
        ratings: totalRatings,
        toolsRated: tools.length,
        average: totalRatings > 0 ? Math.round((weighted / totalRatings) * 10) / 10 : 0,
        publishable: tools.filter((t) => t.publishable).length,
      },
      tools,
      comments,
    });
  }),
);
