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
import { env } from "../../config/env.js";
import { isGscConfigured } from "./gsc.service.js";
import {
  approveReplyDraft,
  collectReplyDrafts,
  generateWeeklyReport,
  listReplyDrafts,
  readWeeklyReport,
  rejectReplyDraft,
} from "./facebook-engagement.service.js";
import { fetchFeedItems, feedUrlFor } from "./rss.service.js";
import {
  buildTiktokAuthorizeUrl,
  createTiktokState,
  loadTiktokCreator,
  postTiktokVideo,
  tiktokRedirectUri,
} from "./platforms/tiktok.platform.js";
import {
  SANDBOX_NOTE,
  buildPinterestAuthorizeUrl,
  createPinterestBoard,
  createPinterestPin,
  createPinterestState,
  fetchPinterestUsername,
  listPinterestBoards,
  pinterestRedirectUri,
  pinterestTokenMatches,
} from "./platforms/pinterest.platform.js";
import { ALL_PLATFORMS, PLATFORM_SPECS, PRIMARY_FEED_LANG } from "./social.types.js";
import { clearHistory, listPanelPosts, recentPublishedByPlatform } from "./social.history.js";
import {
  deletePost,
  unsharePost,
  disconnectAccount,
  listAccounts,
  markPostShared,
  listToolReelsWithStatus,
  nextRunAt,
  postStats,
  publishNow,
  queueDailyPosts,
  queueNextToolReel,
  queueToolReel,
  readAccountSecrets,
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
      // Gönderilerin panelde görüneceği an — admin'in düzeltme penceresi buradan başlar.
      nextPrepareAt: (() => {
        const run = nextRunAt(config);
        if (!run) return null;
        return new Date(run.getTime() - config.prepareLeadMinutes * 60_000).toISOString();
      })(),
      feedUrl: feedUrlFor(PRIMARY_FEED_LANG),
      /**
       * Anahtar kelimelerin hangi kaynaklardan beslendiği.
       *
       * NEDEN PANELDE: Search Console ve yapay zekâ araştırması, ayarları eksik
       * olduğunda SESSİZCE devre dışı kalır — otomasyon çalışmaya devam eder,
       * sadece zayıf terim üretir. Sessiz bir arıza, panelden görülmüyorsa
       * aylarca fark edilmez. Yalnızca "kurulu mu" bilgisi döner; hiçbir gizli
       * değer buradan dışarı çıkmaz.
       */
      keywordSources: {
        suggest: true,
        gsc: isGscConfigured(),
        // Mülk kimliği gizli değil (herkese açık bir adres) ama en sık hata
        // burada yapılıyor: www'lu ve www'suz hali Search Console'da AYRI
        // mülktür ve yanlışı 403 verir. Görünür olması teşhisi anında bitirir.
        gscSite: env.GSC_SITE_URL || null,
        research: Boolean(env.ANTHROPIC_API_KEY),
      },
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
  prepareLeadMinutes: z.number().int().min(0).max(1440).optional(),
  bilingual: z.boolean().optional(),
  singleLang: z.enum(["tr", "en"]).optional(),
  researchKeywords: z.boolean().optional(),
  reelsAutoPublish: z.boolean().optional(),
  toolReelEveryDays: z.number().int().min(0).max(30).optional(),
  tiktokPublic: z.boolean().optional(),
  tiktokBrandOrganic: z.boolean().optional(),
  pinterestSandbox: z.boolean().optional(),
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
  secrets: z.record(z.string(), z.string().max(4000)).default({}),
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

/**
 * TikTok: "TikTok ile bağlan". Kayıtlı Client Key ile TikTok izin ekranı adresini ve TikTok
 * geliştirici sayfasına yazılacak geri dönüş adresini verir. Panel adresi yeni sekmede açar;
 * dönüşü girişsiz `/api/auth/tiktok/callback` karşılar (bkz. tiktok.routes.ts).
 */
socialRouter.get(
  "/tiktok/connect",
  asyncHandler(async (_request, response) => {
    const redirectUri = tiktokRedirectUri();
    const secrets = await readAccountSecrets("TIKTOK");
    const clientKey = secrets?.clientKey?.trim();
    if (!clientKey || !secrets?.clientSecret?.trim()) {
      throw new HttpError(400, "Önce TikTok Client Key ve Client Secret değerlerini kaydedin.");
    }
    response.json({ url: buildTiktokAuthorizeUrl(clientKey, createTiktokState()), redirectUri });
  }),
);

/** Demo/önizleme ekranı: bağlı hesabın adı, fotoğrafı ve TikTok'un izin verdiği gizlilik seçenekleri. */
socialRouter.get(
  "/tiktok/creator",
  asyncHandler(async (_request, response) => {
    const secrets = await readAccountSecrets("TIKTOK");
    if (!secrets?.refreshToken) throw new HttpError(400, "TikTok bağlı değil. Önce “TikTok ile bağlan”ı tamamlayın.");
    try {
      const creator = await loadTiktokCreator(secrets);
      const config = await readSocialConfig();
      response.json({ creator, brandOrganic: config.tiktokBrandOrganic, publicAllowed: config.tiktokPublic });
    } catch (err) {
      throw new HttpError(502, err instanceof Error ? err.message : "TikTok hesabı okunamadı");
    }
  }),
);

const tiktokShareSchema = z.object({
  videoUrl: z.string().url().max(500),
  title: z.string().min(1).max(2200),
  privacy: z.string().min(1).max(40),
  brandOrganic: z.boolean(),
  allowComment: z.boolean(),
  allowDuet: z.boolean(),
  allowStitch: z.boolean(),
});

/**
 * Elle paylaşım (kullanıcı videoyu izler, açıklamayı yazar, gizliliği KENDİ seçer, "Paylaş"a basar).
 * TikTok'un Direct Post kuralı: gizlilik varsayılanla verilmez, kullanıcı seçer.
 */
socialRouter.post(
  "/tiktok/share",
  asyncHandler(async (request, response) => {
    const body = tiktokShareSchema.parse(request.body);
    const secrets = await readAccountSecrets("TIKTOK");
    if (!secrets?.refreshToken) throw new HttpError(400, "TikTok bağlı değil.");
    try {
      const result = await postTiktokVideo(secrets, {
        videoUrl: body.videoUrl,
        title: body.title,
        privacy: body.privacy,
        brandOrganic: body.brandOrganic,
        disableComment: !body.allowComment,
        disableDuet: !body.allowDuet,
        disableStitch: !body.allowStitch,
      });
      await logAdminAudit(
        actorOf(request),
        "social.tiktok.share",
        "TIKTOK",
        `TikTok'a elle paylaşıldı (${result.privacy}, ${result.status})`,
      );
      response.json(result);
    } catch (err) {
      throw new HttpError(502, err instanceof Error ? err.message : "TikTok paylaşımı başarısız");
    }
  }),
);

// ───────────────────────── Pinterest ─────────────────────────

/** "Pinterest ile bağlan": kayıtlı App ID ile izin ekranı adresini ve Pinterest'e yazılacak geri dönüş adresini verir. */
socialRouter.get(
  "/pinterest/connect",
  asyncHandler(async (_request, response) => {
    const secrets = await readAccountSecrets("PINTEREST");
    const appId = secrets?.appId?.trim();
    if (!appId || !secrets?.appSecret?.trim()) {
      throw new HttpError(400, "Önce Pinterest App ID ve App Secret değerlerini kaydedin.");
    }
    response.json({ url: buildPinterestAuthorizeUrl(appId, createPinterestState()), redirectUri: pinterestRedirectUri() });
  }),
);

socialRouter.get(
  "/pinterest/redirect-uri",
  asyncHandler(async (_request, response) => {
    response.json({ redirectUri: pinterestRedirectUri() });
  }),
);

/** Demo ekranı: bağlı hesap adı, panolar, seçili pano ve kum havuzu durumu. */
socialRouter.get(
  "/pinterest/overview",
  asyncHandler(async (_request, response) => {
    const secrets = await readAccountSecrets("PINTEREST");
    if (!secrets?.refreshToken) throw new HttpError(400, "Pinterest bağlı değil. Önce “Pinterest ile bağlan”ı tamamlayın.");
    const cfg = await readSocialConfig();
    if (!pinterestTokenMatches(cfg.pinterestToken, cfg.pinterestSandbox)) {
      // Kutu değişti (ya da eski kayıt): kimlik bilgisi geçmez; panel “yeniden bağlan” uyarısı gösterir.
      response.json({ username: "", boards: [], boardId: "", sandbox: cfg.pinterestSandbox, needsReconnect: true });
      return;
    }
    try {
      const [username, boards, config] = await Promise.all([
        fetchPinterestUsername(secrets),
        listPinterestBoards(secrets),
        readSocialConfig(),
      ]);
      response.json({ username, boards, boardId: secrets.boardId ?? "", sandbox: config.pinterestSandbox, needsReconnect: false });
    } catch (err) {
      throw new HttpError(502, err instanceof Error ? err.message : "Pinterest hesabı okunamadı");
    }
  }),
);

/** Pano seçimi (ID elle yazılmaz): seçilen pano hesabın kayıtlı panosu olur. */
socialRouter.put(
  "/pinterest/board",
  asyncHandler(async (request, response) => {
    const body = z.object({ boardId: z.string().min(1).max(64) }).parse(request.body);
    const secrets = await readAccountSecrets("PINTEREST");
    if (!secrets?.refreshToken) throw new HttpError(400, "Pinterest bağlı değil.");
    const boards = await listPinterestBoards(secrets).catch((err) => {
      throw new HttpError(502, err instanceof Error ? err.message : "Panolar okunamadı");
    });
    if (!boards.some((b) => b.id === body.boardId)) throw new HttpError(400, "Bu pano hesabında bulunamadı.");
    await saveAccount({ platform: "PINTEREST", secrets: { boardId: body.boardId } });
    await logAdminAudit(actorOf(request), "social.pinterest.board", "PINTEREST", "Pinterest panosu seçildi");
    response.json({ ok: true });
  }),
);

/** Yeni pano açar (kum havuzunda hazır pano yoktur) ve seçer. */
socialRouter.post(
  "/pinterest/boards",
  asyncHandler(async (request, response) => {
    const body = z.object({ name: z.string().trim().min(1).max(100) }).parse(request.body);
    const secrets = await readAccountSecrets("PINTEREST");
    if (!secrets?.refreshToken) throw new HttpError(400, "Pinterest bağlı değil.");
    try {
      const board = await createPinterestBoard(secrets, body.name);
      await saveAccount({ platform: "PINTEREST", secrets: { boardId: board.id } });
      await logAdminAudit(actorOf(request), "social.pinterest.board-create", "PINTEREST", "Pinterest panosu oluşturuldu");
      response.json({ board });
    } catch (err) {
      throw new HttpError(502, err instanceof Error ? err.message : "Pano oluşturulamadı");
    }
  }),
);

const pinterestPinSchema = z.object({
  imageUrl: z.string().url().max(500),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  link: z.string().url().max(500),
});

/** Aynı pinin kısa sürede iki kez gönderilmesini önler (çift tıklama / yeniden deneme). */
const recentPins = new Map<string, number>();
const PIN_DEDUPE_MS = 10 * 60_000;

/** Elle pin: kullanıcı önizlemeyi görür, "Pinle"ye basar. */
socialRouter.post(
  "/pinterest/pin",
  asyncHandler(async (request, response) => {
    const body = pinterestPinSchema.parse(request.body);
    const secrets = await readAccountSecrets("PINTEREST");
    if (!secrets?.refreshToken) throw new HttpError(400, "Pinterest bağlı değil.");
    const boardId = secrets.boardId?.trim();
    if (!boardId) throw new HttpError(400, "Önce bir pano seçin.");

    const now = Date.now();
    for (const [k, t] of recentPins) if (now - t > PIN_DEDUPE_MS) recentPins.delete(k);
    const key = JSON.stringify([boardId, body.imageUrl, body.title, body.description, body.link]);
    if (recentPins.has(key)) throw new HttpError(409, "Bu pin az önce zaten gönderildi; aynı pin iki kez gönderilmez.");
    recentPins.set(key, now);

    try {
      const pin = await createPinterestPin(secrets, { boardId, ...body });
      await logAdminAudit(actorOf(request), "social.pinterest.pin", "PINTEREST", `Pinterest'e elle pin gönderildi${pin.sandbox ? " (kum havuzu)" : ""}`);
      response.json({ ...pin, warning: pin.sandbox ? SANDBOX_NOTE : null });
    } catch (err) {
      recentPins.delete(key); // Başarısız denemeyi yeniden denemeye izin ver.
      throw new HttpError(502, err instanceof Error ? err.message : "Pin gönderilemedi");
    }
  }),
);

socialRouter.get(
  "/tiktok/redirect-uri",
  asyncHandler(async (_request, response) => {
    response.json({ redirectUri: tiktokRedirectUri() });
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
    const [posts, recent] = await Promise.all([
      listPanelPosts(Number.isFinite(limit) ? limit : 50),
      recentPublishedByPlatform(),
    ]);
    // `recent`: her ağın son 5 paylaşımı (panelde ağ başına ayrı gösterilir).
    response.json({ posts, recent });
  }),
);

/**
 * Geçmişi temizler (yayınlanmış + atlanmış kayıtlar).
 * Varsayılan: panelden gizler, paylaşım sırası korunur. `?reset=1`: kayıtları siler,
 * sıra başa döner. Ağlardaki gerçek gönderilere dokunmaz.
 */
socialRouter.delete(
  "/posts-history",
  asyncHandler(async (request, response) => {
    const reset = String(request.query.reset ?? "") === "1";
    const cleared = await clearHistory(reset);
    await logAdminAudit(
      actorOf(request),
      "social.history.clear",
      "social.automation",
      reset
        ? `Sosyal medya geçmişi silindi (${cleared} kayıt; paylaşım sırası sıfırlandı)`
        : `Sosyal medya geçmişi panelden temizlendi (${cleared} kayıt; paylaşım sırası korundu)`,
      { cleared, resetRotation: reset },
    );
    response.json({ ok: true, cleared, resetRotation: reset });
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

/** Araç tanıtım videoları: izlenebilir liste + hangi ağlarda gönderiye çevrildiği. */
socialRouter.get(
  "/tool-reels",
  asyncHandler(async (_request, response) => {
    response.json({ reels: await listToolReelsWithStatus() });
  }),
);

/** Sırası gelen, videosu hazır aracın Reels TASLAĞINI hazırlar ("Reels hazırla" düğmesi). */
socialRouter.post(
  "/tool-reels/queue-next",
  asyncHandler(async (request, response) => {
    const result = await queueNextToolReel();
    await logAdminAudit(
      actorOf(request),
      "social.tool-reel",
      result.toolId,
      `Reels hazırla: ${result.queued.length} taslak hazırlandı${result.toolId ? ` (${result.toolId})` : ""}`,
    );
    response.json(result);
  }),
);

/** Bir araç videosunu Instagram + Facebook Reels, YouTube Shorts ve TikTok TASLAĞI olarak hazırlar (onay beklenir). */
socialRouter.post(
  "/tool-reels/:id/queue",
  asyncHandler(async (request, response) => {
    const toolId = String(request.params.id);
    // İsteğe bağlı: { platforms: ["FACEBOOK"] } yalnız o ağ için hazırlar. Elle istendiğinde aynı gün
    // ikinci kez de hazırlanabilir (ilk gönderi hatalıysa yeniden yayınlamak için).
    const parsed = z
      .object({ platforms: z.array(z.enum(["INSTAGRAM", "FACEBOOK", "YOUTUBE", "TIKTOK"])).max(4).optional() })
      .safeParse(request.body ?? {});
    const platforms = parsed.success ? parsed.data.platforms : undefined;
    const result = await queueToolReel(toolId, new Date(), true, undefined, { platforms, repeat: true });
    await logAdminAudit(
      actorOf(request),
      "social.tool-reel",
      toolId,
      `Araç videosu (${toolId}): ${result.queued.length} taslak hazırlandı`,
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

/** Bağlı olmayan ağa elle atılan gönderinin "paylaştım" işareti. */
socialRouter.post(
  "/posts/:id/shared",
  asyncHandler(async (request, response) => {
    await markPostShared(String(request.params.id));
    await logAdminAudit(
      actorOf(request),
      "social.manual-shared",
      String(request.params.id),
      "Gönderi elle paylaşıldı olarak işaretlendi",
    );
    response.json({ ok: true });
  }),
);

/** Geçmişteki kaydı "paylaşılmadı" sayar: yazı bu ağda yeniden sıraya girer. */
socialRouter.post(
  "/posts/:id/unshare",
  asyncHandler(async (request, response) => {
    const removed = await unsharePost(String(request.params.id));
    if (!removed) throw new HttpError(404, "Geçmişte böyle bir paylaşım kaydı yok");
    await logAdminAudit(actorOf(request), "social.unshare", String(request.params.id), "Paylaşım kaydı geri alındı (paylaşılmadı sayıldı)");
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

// ─── Facebook: yorum yanıt taslakları + haftalık rapor ────────────────────────

socialRouter.get(
  "/facebook/reply-drafts",
  asyncHandler(async (_request, response) => {
    response.json({ drafts: await listReplyDrafts() });
  }),
);

/** Yeni yorumları şimdi tara (cron her 2 saatte bir de yapar). */
socialRouter.post(
  "/facebook/reply-drafts/scan",
  asyncHandler(async (_request, response) => {
    response.json({ created: await collectReplyDrafts() });
  }),
);

socialRouter.post(
  "/facebook/reply-drafts/:id/approve",
  asyncHandler(async (request, response) => {
    const text = (request.body as { text?: unknown } | undefined)?.text;
    const result = await approveReplyDraft(String(request.params.id), typeof text === "string" ? text : undefined);
    if (!result.ok) throw new HttpError(400, result.error ?? "Yanıt gönderilemedi");
    response.json({ ok: true });
  }),
);

socialRouter.post(
  "/facebook/reply-drafts/:id/reject",
  asyncHandler(async (request, response) => {
    await rejectReplyDraft(String(request.params.id));
    response.json({ ok: true });
  }),
);

socialRouter.get(
  "/facebook/report",
  asyncHandler(async (_request, response) => {
    response.json({ report: await readWeeklyReport() });
  }),
);

socialRouter.post(
  "/facebook/report/run",
  asyncHandler(async (_request, response) => {
    const text = await generateWeeklyReport();
    if (text == null) throw new HttpError(400, "Facebook hesabı bağlı değil");
    response.json({ text });
  }),
);
