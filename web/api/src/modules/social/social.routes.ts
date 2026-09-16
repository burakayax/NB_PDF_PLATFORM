/**
 * Sosyal medya otomasyonu — yönetim uçları (`/api/social/*`).
 *
 * Tamamı admin korumalı. Erişim anahtarları yalnızca YAZILIR; hiçbir uç bunları
 * geri döndürmez (bkz. AccountView).
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { HttpError } from "../../lib/http-error.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";
import { logAdminAudit } from "../admin/admin-audit.service.js";
import { fetchFeedItems, feedUrlFor } from "./rss.service.js";
import { ALL_PLATFORMS, PLATFORM_SPECS, PRIMARY_FEED_LANG } from "./social.types.js";
import {
  deletePost,
  disconnectAccount,
  listAccounts,
  listPosts,
  nextRunAt,
  postStats,
  publishNow,
  queueDailyPosts,
  saveAccount,
  testAccount,
  readSocialConfig,
  updatePostBody,
  writeSocialConfig,
} from "./social.service.js";

export const socialRouter = Router();
socialRouter.use(requireAdmin);

function actorOf(request: { authUser?: { id: string; email: string } }) {
  return { userId: request.authUser?.id ?? "", email: request.authUser?.email ?? "system" };
}

const platformSchema = z.enum(ALL_PLATFORMS as [string, ...string[]]);

/** Panelin ilk yüklemesi: platform künyeleri + hesap durumları + ayarlar. */
socialRouter.get(
  "/overview",
  asyncHandler(async (_request, response) => {
    const [accounts, config, stats] = await Promise.all([listAccounts(), readSocialConfig(), postStats()]);
    response.json({
      config,
      accounts,
      stats,
      nextRunAt: nextRunAt(config)?.toISOString() ?? null,
      feedUrl: feedUrlFor(PRIMARY_FEED_LANG),
      platforms: ALL_PLATFORMS.map((p) => ({
        platform: p,
        label: PLATFORM_SPECS[p].label,
        maxChars: PLATFORM_SPECS[p].maxChars,
        imageRequired: PLATFORM_SPECS[p].imageRequired,
        imageFormat: PLATFORM_SPECS[p].imageFormat,
        fields: PLATFORM_SPECS[p].secretFields,
      })),
    });
  }),
);

const configSchema = z.object({
  enabled: z.boolean().optional(),
  hour: z.number().int().min(0).max(23).optional(),
  minute: z.number().int().min(0).max(59).optional(),
  timeZone: z.string().min(1).max(64).optional(),
  recycleOldPosts: z.boolean().optional(),
  cadence: z.enum(["daily", "alternate", "thrice"]).optional(),
  bilingual: z.boolean().optional(),
  singleLang: z.enum(["tr", "en"]).optional(),
  researchKeywords: z.boolean().optional(),
});

socialRouter.put(
  "/config",
  asyncHandler(async (request, response) => {
    const patch = configSchema.parse(request.body);
    const config = await writeSocialConfig(patch);
    await logAdminAudit(actorOf(request), "social.config", "social.automation", "Sosyal medya ayarları güncellendi", patch);
    response.json({ config });
  }),
);

const accountSchema = z.object({
  platform: platformSchema,
  displayName: z.string().max(120).optional(),
  enabled: z.boolean().optional(),
  secrets: z.record(z.string().max(4000)).default({}),
});

socialRouter.put(
  "/accounts",
  asyncHandler(async (request, response) => {
    const body = accountSchema.parse(request.body);
    const accounts = await saveAccount({
      platform: body.platform as never,
      displayName: body.displayName,
      enabled: body.enabled,
      secrets: body.secrets,
    });
    // Denetim kaydına anahtar DEĞERLERİ değil, yalnızca hangi alanların
    // doldurulduğu yazılır.
    await logAdminAudit(
      actorOf(request),
      "social.account.save",
      body.platform,
      `${body.platform} hesabı güncellendi`,
      { fields: Object.keys(body.secrets) },
    );
    response.json({ accounts });
  }),
);

socialRouter.post(
  "/accounts/:platform/test",
  asyncHandler(async (request, response) => {
    const platform = platformSchema.parse(request.params.platform);
    const result = await testAccount(platform as never);
    await logAdminAudit(
      actorOf(request),
      "social.account.test",
      platform,
      `${platform} bağlantısı sınandı: ${result.ok ? "başarılı" : "başarısız"}`,
    );
    response.json(result);
  }),
);

socialRouter.delete(
  "/accounts/:platform",
  asyncHandler(async (request, response) => {
    const platform = platformSchema.parse(request.params.platform);
    const accounts = await disconnectAccount(platform as never);
    await logAdminAudit(actorOf(request), "social.account.delete", platform, `${platform} bağlantısı kaldırıldı`);
    response.json({ accounts });
  }),
);

socialRouter.get(
  "/posts",
  asyncHandler(async (request, response) => {
    const limit = Number.parseInt(String(request.query.limit ?? "50"), 10);
    response.json({ posts: await listPosts(Number.isFinite(limit) ? limit : 50) });
  }),
);

/** Beslemenin gerçekten okunabildiğini ve görsellerin bulunduğunu doğrular. */
socialRouter.get(
  "/feed-check",
  asyncHandler(async (_request, response) => {
    const items = await fetchFeedItems(PRIMARY_FEED_LANG);
    response.json({
      count: items.length,
      latest: items.slice(0, 5).map((i) => ({
        title: i.title,
        link: i.link,
        publishedAt: i.publishedAt,
        images: i.images,
      })),
    });
  }),
);

/**
 * Bugünün gönderilerini hazırlar ama YAYINLAMAZ — metinler kuyrukta bekler,
 * admin görüp onaylayabilir (ya da "şimdi paylaş" der).
 */
socialRouter.post(
  "/queue",
  asyncHandler(async (request, response) => {
    // Varsayılan TASLAK: hazırlanan metin, admin onaylamadan hiçbir yere gitmez.
    const publishImmediately = (request.body as { publishNow?: unknown } | undefined)?.publishNow === true;
    const result = await queueDailyPosts(new Date(), !publishImmediately);
    await logAdminAudit(
      actorOf(request),
      "social.queue",
      null,
      `${result.queued.length} gönderi ${publishImmediately ? "yayına alındı" : "taslak olarak hazırlandı"}`,
    );
    response.json(result);
  }),
);

socialRouter.post(
  "/posts/:id/publish",
  asyncHandler(async (request, response) => {
    const result = await publishNow(String(request.params.id));
    if (!result.ok) throw new HttpError(502, result.error ?? "Yayınlanamadı");
    await logAdminAudit(actorOf(request), "social.publish", String(request.params.id), "Gönderi elle yayınlandı");
    response.json({ ok: true });
  }),
);

socialRouter.patch(
  "/posts/:id",
  asyncHandler(async (request, response) => {
    const body = z.object({ body: z.string().min(1).max(5000) }).parse(request.body);
    await updatePostBody(String(request.params.id), body.body);
    response.json({ ok: true });
  }),
);

socialRouter.delete(
  "/posts/:id",
  asyncHandler(async (request, response) => {
    await deletePost(String(request.params.id));
    response.json({ ok: true });
  }),
);
