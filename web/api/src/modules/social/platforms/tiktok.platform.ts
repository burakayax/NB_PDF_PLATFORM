/**
 * TikTok bağdaştırıcısı (TikTok API v2, Login Kit).
 *
 * İKİ İŞ: (1) BAĞLANTI — yetkilendirme adresi, kod→anahtar değişimi, anahtar yenileme, sınama;
 * (2) YAYIN — araç videosunu Content Posting API (Direct Post, FILE_UPLOAD) ile yükler.
 *
 * DENETİM DURUMU: TikTok, denetimden geçmemiş uygulamanın paylaşımlarını yalnızca "yalnız ben"
 * (SELF_ONLY) gizliliğiyle kabul eder. Yayıncı önce hesabın izin verdiği gizlilik seçeneklerini
 * sorar; herkese açık seçenek varsa onu dener, TikTok "denetimsiz uygulama" diye reddederse
 * "yalnız ben" ile yeniden dener ve bunu panelde uyarı olarak gösterir. Denetim geçince hiçbir
 * kod değişikliği gerekmez. Paylaşım yalnızca yönetici taslağı onaylayınca (ya da otomatik mod
 * açıksa) çalışır.
 *
 * Anahtarlar (TikTok dokümanı): erişim anahtarı 2 saat, yenileme anahtarı 180 gün yaşar; her yenilemede
 * yenileme anahtarı DEĞİŞİR (eskisi geçersiz olur).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../../../config/env.js";
import { PlatformError, PublishStageError, requestJson, requireSecret } from "./common.js";
import { isReelUrl } from "../reels.service.js";
import { logger } from "../../../lib/file-log.js";
import type { Publisher, Verifier } from "./common.js";

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name";

/** İstenen izinler; TikTok uygulamasında "Login Kit" ve "Content Posting API" ürünleri ekli olmalı. */
export const TIKTOK_SCOPES = "user.info.basic,video.upload,video.publish";

/** TikTok'a kayıtlı geri dönüş adresiyle BİREBİR aynı olmalı (harf, eğik çizgi dâhil). */
export function tiktokRedirectUri(): string {
  return new URL("/api/auth/tiktok/callback", env.APP_BASE_URL).toString();
}

// ───────────────────────── state (CSRF koruması) ─────────────────────────

const STATE_TTL_MS = 10 * 60_000;

function stateKey(): string {
  return env.JWT_ACCESS_SECRET;
}

/**
 * İmzalı, 10 dakikalık "state": geri dönüş adresine dışarıdan sahte istek atılmasını önler.
 * Biçim: `<nonce>.<bitiş ms>.<imza>`; imza HMAC-SHA256.
 */
export function createTiktokState(now = Date.now()): string {
  const body = `${randomBytes(12).toString("hex")}.${now + STATE_TTL_MS}`;
  const sig = createHmac("sha256", stateKey()).update(`tiktok:${body}`).digest("hex");
  return `${body}.${sig}`;
}

export function verifyTiktokState(state: unknown, now = Date.now()): boolean {
  if (typeof state !== "string") return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expRaw, sig] = parts as [string, string, string];
  const expires = Number(expRaw);
  if (!nonce || !Number.isFinite(expires) || expires < now) return false;
  const expected = createHmac("sha256", stateKey()).update(`tiktok:${nonce}.${expRaw}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Yönetici "TikTok ile bağlan"a basınca tarayıcının gideceği TikTok izin ekranı adresi. */
export function buildTiktokAuthorizeUrl(clientKey: string, state: string): string {
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: TIKTOK_SCOPES,
    response_type: "code",
    redirect_uri: tiktokRedirectUri(),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ───────────────────────── anahtar alışverişi ─────────────────────────

export type TiktokTokens = {
  accessToken: string;
  refreshToken: string;
  openId: string;
  /** Yenileme anahtarının bitiş anı (ms); bilinmiyorsa null. */
  refreshExpiresAt: number | null;
};

/** TikTok bazı hataları HTTP 200 ile `error` alanında döndürür; hepsini tek hataya çevirir. */
function parseTokenResponse(json: Record<string, unknown>): TiktokTokens {
  const error = typeof json.error === "string" ? json.error : "";
  if (error) {
    const desc = typeof json.error_description === "string" ? json.error_description : "";
    throw new Error(`TikTok reddetti: ${error}${desc ? ` — ${desc}` : ""}`);
  }
  const accessToken = json.access_token;
  const refreshToken = json.refresh_token;
  if (typeof accessToken !== "string" || !accessToken || typeof refreshToken !== "string" || !refreshToken) {
    throw new Error("TikTok anahtar yanıtı eksik (access_token/refresh_token yok).");
  }
  const refreshIn = Number(json.refresh_expires_in);
  return {
    accessToken,
    refreshToken,
    openId: typeof json.open_id === "string" ? json.open_id : "",
    refreshExpiresAt: Number.isFinite(refreshIn) && refreshIn > 0 ? Date.now() + refreshIn * 1000 : null,
  };
}

async function postToken(params: Record<string, string>): Promise<TiktokTokens> {
  const json = await requestJson("TikTok", TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "cache-control": "no-cache" },
    body: new URLSearchParams(params).toString(),
  });
  return parseTokenResponse(json);
}

/** Geri dönüşte gelen tek kullanımlık kodu anahtarlara çevirir. */
export function exchangeTiktokCode(clientKey: string, clientSecret: string, code: string): Promise<TiktokTokens> {
  return postToken({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: tiktokRedirectUri(),
  });
}

/** Erişim anahtarı (24 saat) bittiğinde yenileme anahtarıyla yenisini alır. */
export function refreshTiktokTokens(clientKey: string, clientSecret: string, refreshToken: string): Promise<TiktokTokens> {
  return postToken({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

/** Hesabın görünen adını okur (panelde "Hesap: …" için). */
export async function fetchTiktokDisplayName(accessToken: string): Promise<string> {
  const json = await requestJson("TikTok", USER_INFO_URL, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = json.data as { user?: { display_name?: string; open_id?: string } } | undefined;
  const name = data?.user?.display_name?.trim();
  if (!name) {
    const err = (json.error as { code?: string; message?: string } | undefined) ?? {};
    throw new Error(`TikTok hesap bilgisi okunamadı${err.message ? `: ${err.message}` : ""}`);
  }
  return name;
}

// ───────────────────────── sınama + yayıncı ─────────────────────────

/**
 * Bağlantıyı sınar. Erişim anahtarı geçersizse (24 saat sonra olağan) yenileme anahtarıyla
 * yenilenir ve yeni anahtarlar kaydedilir; kayıt başarısız olsa bile sınama sonucu döner.
 */
export const verifyTiktok: Verifier = async (secrets) => {
  const clientKey = requireSecret(secrets, "clientKey", "TikTok Client Key");
  const clientSecret = requireSecret(secrets, "clientSecret", "TikTok Client Secret");
  const accessToken = requireSecret(secrets, "accessToken", "TikTok Access Token");
  try {
    return await fetchTiktokDisplayName(accessToken);
  } catch {
    // Erişim anahtarı süresi dolmuş olabilir: yenile ve bir kez daha dene.
  }
  const name = await fetchTiktokDisplayName(await freshAccessToken(secrets));
  return name;
};

// ───────────────────────── yayın ─────────────────────────

const API = "https://open.tiktokapis.com/v2";
/** TikTok tek parça yüklemede en çok 64 MB kabul eder (kısa Reels videosu bunun çok altında). */
const MAX_SINGLE_CHUNK = 64 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 5 * 60_000;
/** Başlık (açıklama) sınırı: TikTok 2.200 karakter. */
const MAX_TITLE = 2200;

/**
 * Yenileme anahtarı DÖNER: her başarılı yenileme yeni bir yenileme anahtarı verir ve eskisini hemen
 * geçersiz kılar (TikTok, 1 Aralık 2026'dan itibaren; erişim anahtarı 2 saat, yenileme 180 gün).
 * Bu yüzden: (1) yenilemeler tek sıraya dizilir (aynı anda iki yenileme ikincisini patlatırdı),
 * (2) en güncel yenileme anahtarı her seferinde kayıttan okunur, (3) taze erişim anahtarı bellekte
 * tutulup süresi dolana kadar yeniden kullanılır (gereksiz yenileme = gereksiz dönüş riski),
 * (4) yeni anahtar kaydedilemezse bir kez daha denenir ve hata açıkça günlüğe yazılır.
 */
const ACCESS_REUSE_MS = 100 * 60_000; // 2 saatlik anahtarı 100 dakika kullan
let tokenCache: { refreshToken: string; accessToken: string; until: number } | null = null;
let refreshQueue: Promise<unknown> = Promise.resolve();

async function persistTiktokTokens(fresh: TiktokTokens): Promise<void> {
  const { saveAccount } = await import("../social.service.js");
  const save = () =>
    saveAccount({
      platform: "TIKTOK",
      secrets: { accessToken: fresh.accessToken, refreshToken: fresh.refreshToken },
      tokenExpiresAt: fresh.refreshExpiresAt ? new Date(fresh.refreshExpiresAt) : undefined,
    });
  try {
    await save();
  } catch (first) {
    try {
      await save();
    } catch (second) {
      logger.error("social", `TikTok yeni yenileme anahtarı KAYDEDİLEMEDİ (eskisi geçersiz; yeniden bağlanmak gerekebilir): ${String(second ?? first)}`);
    }
  }
}

/** Taze erişim anahtarı verir; gerekiyorsa yenilemeyi sıraya alır. */
async function freshAccessToken(secrets: Record<string, string>): Promise<string> {
  const run = async (): Promise<string> => {
    const { readAccountSecrets } = await import("../social.service.js");
    // Sıra beklerken başka bir çağrı anahtarı döndürmüş olabilir: kayıttaki en günceli kullan.
    const stored = await readAccountSecrets("TIKTOK").catch(() => null);
    const latest = stored?.refreshToken && stored.clientKey && stored.clientSecret ? stored : secrets;
    const refreshToken = requireSecret(latest, "refreshToken", "TikTok Refresh Token");
    if (tokenCache && tokenCache.refreshToken === refreshToken && tokenCache.until > Date.now()) {
      return tokenCache.accessToken;
    }
    const clientKey = requireSecret(latest, "clientKey", "TikTok Client Key");
    const clientSecret = requireSecret(latest, "clientSecret", "TikTok Client Secret");
    let fresh: TiktokTokens;
    try {
      fresh = await refreshTiktokTokens(clientKey, clientSecret, refreshToken);
    } catch (err) {
      tokenCache = null;
      throw new Error(
        `TikTok yenileme anahtarı geçersiz ya da süresi dolmuş: panelde “TikTok ile bağlan”ı yeniden yapın. (${err instanceof Error ? err.message : String(err)})`,
      );
    }
    tokenCache = { refreshToken: fresh.refreshToken, accessToken: fresh.accessToken, until: Date.now() + ACCESS_REUSE_MS };
    await persistTiktokTokens(fresh);
    return fresh.accessToken;
  };
  const result = refreshQueue.then(run, run);
  refreshQueue = result.catch(() => undefined);
  return result;
}

type TiktokEnvelope = { data?: Record<string, unknown>; error?: { code?: string; message?: string } };

/** TikTok hata kodlarının Türkçe açıklaması (panelde okunur olsun). Bilinmeyen kod ham gösterilir. */
const ERROR_TR: Record<string, string> = {
  unaudited_client_can_only_post_to_private_accounts:
    "TikTok uygulaması henüz denetimden geçmediği için video yalnızca “yalnız ben” gizliliğiyle paylaşılabilir.",
  spam_risk_too_many_posts: "TikTok günlük paylaşım sınırına ulaşıldı (spam koruması). Yarın tekrar deneyin.",
  spam_risk_user_banned_from_posting: "Bu TikTok hesabı şu an paylaşım yapmaktan kısıtlanmış.",
  spam_risk_text: "TikTok açıklamayı spam olarak işaretledi; metni sadeleştirin.",
  spam_risk_too_many_pending_share: "Bu hesapta işlenmeyi bekleyen çok fazla video var; birkaç dakika sonra deneyin.",
  rate_limit_exceeded: "TikTok istek sınırı aşıldı; biraz bekleyip tekrar deneyin.",
  access_token_invalid: "TikTok erişim anahtarı geçersiz; panelde “TikTok ile bağlan”ı yeniden yapın.",
  scope_not_authorized: "TikTok hesabı bu işlem için izin vermemiş (video.upload / video.publish). “TikTok ile bağlan”ı yeniden yapıp tüm izinleri verin.",
  scope_permission_missed: "TikTok uygulamasında gerekli izin (scope) tanımlı değil; geliştirici panelinde Content Posting API ve izinleri kontrol edin.",
  token_not_authorized_for_specified_user: "Bu anahtar bu TikTok hesabı için yetkili değil; hesabı yeniden bağlayın.",
  url_ownership_unverified: "Video adresinin alan adı TikTok'ta doğrulanmamış.",
  privacy_level_option_mismatch: "Seçilen gizlilik düzeyine bu hesap izin vermiyor.",
  invalid_param: "TikTok gönderilen bilgilerden birini geçersiz buldu.",
  file_format_check_failed: "Video biçimi TikTok'a uygun değil (MP4 olmalı).",
  duration_check_failed: "Video süresi bu hesabın sınırını aşıyor.",
  frame_rate_check_failed: "Video kare hızı TikTok'a uygun değil.",
  picture_size_check_failed: "Video çözünürlüğü TikTok'a uygun değil.",
  invalid_file_upload: "Video dosyası TikTok'a yüklenemedi.",
  invalid_publish_id: "TikTok paylaşım kaydı bulunamadı.",
  reached_active_user_cap: "TikTok uygulamasının günlük kullanıcı sınırına ulaşıldı.",
  spam_risk: "TikTok bu isteği riskli/spam olarak işaretledi; tekrar denemeyin, içeriği ve açıklamayı gözden geçirin.",
  auth_removed: "Hesap sahibi işlem sürerken uygulamanın erişimini kaldırdı; yeniden bağlanıp tekrar deneyin.",
  internal: "TikTok tarafında geçici bir sorun var; biraz sonra tekrar deneyin.",
  video_pull_failed: "TikTok videoyu adresinden çekemedi (bağlantı hatası ya da zaman aşımı).",
  publish_cancelled: "Paylaşım iptal edildi.",
};

/** Hata kodunun Türkçe açıklaması; bilinmiyorsa null. */
export function describeTiktokError(code: string | undefined): string | null {
  return code ? (ERROR_TR[code] ?? null) : null;
}

function envelopeError(what: string, env: TiktokEnvelope, status: number): PlatformError {
  const code = env.error?.code;
  const tr = describeTiktokError(code);
  return new PlatformError(
    "TikTok",
    status,
    `${what}: ${tr ?? code ?? "bilinmeyen hata"} [${code ?? "?"}]${env.error?.message && !tr ? ` — ${env.error.message}` : ""}`,
  );
}

/** TikTok hataları çoğu zaman 200 + `error.code` ile gelir; "ok" dışındakini hataya çevirir. */
function unwrap(json: Record<string, unknown>, what: string): Record<string, unknown> {
  const env = json as TiktokEnvelope;
  const code = env.error?.code;
  if (code && code !== "ok") throw envelopeError(what, env, 400);
  return env.data ?? {};
}

async function tiktokPost(path: string, accessToken: string, body: unknown, what: string): Promise<Record<string, unknown>> {
  let json: Record<string, unknown>;
  try {
    json = await requestJson("TikTok", `${API}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json; charset=UTF-8" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // HTTP 4xx gövdesinde de `error.code` olur; okunur hâle getir.
    if (err instanceof PlatformError) {
      let parsed: TiktokEnvelope | null = null;
      try {
        parsed = JSON.parse(err.detail) as TiktokEnvelope;
      } catch {
        /* JSON değil */
      }
      if (parsed?.error?.code) throw envelopeError(what, parsed, err.status);
    }
    throw err;
  }
  return unwrap(json, what);
}

export type CreatorInfo = {
  nickname: string;
  avatarUrl: string;
  /** Hesabın seçebileceği gizlilik düzeyleri (denetimsiz uygulamada yalnız SELF_ONLY). */
  privacyOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoSeconds: number;
};

/** Paylaşım öncesi TikTok'tan hesabın sınırlarını ve gizlilik seçeneklerini sorar (TikTok'un zorunlu ilk adımı). */
export async function queryCreatorInfo(accessToken: string): Promise<CreatorInfo> {
  const data = await tiktokPost("/post/publish/creator_info/query/", accessToken, {}, "Hesap bilgisi");
  const options = data.privacy_level_options;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    nickname: str(data.creator_nickname) || str(data.creator_username),
    avatarUrl: str(data.creator_avatar_url),
    privacyOptions: Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [],
    commentDisabled: data.comment_disabled === true,
    duetDisabled: data.duet_disabled === true,
    stitchDisabled: data.stitch_disabled === true,
    maxVideoSeconds: Number(data.max_video_post_duration_sec) || 0,
  };
}

/** Panelin demo/önizleme ekranı için: erişim anahtarını yeniler, hesap adı + fotoğraf + gizlilik seçeneklerini verir. */
export async function loadTiktokCreator(secrets: Record<string, string>): Promise<CreatorInfo> {
  const accessToken = await freshAccessToken(secrets);
  const info = await queryCreatorInfo(accessToken);
  if (!info.nickname || !info.avatarUrl) {
    // creator_info bazı alanları boş dönebilir; user.info.basic ile tamamla.
    try {
      const json = await requestJson("TikTok", `${API}/user/info/?fields=open_id,display_name,avatar_url`, {
        method: "GET",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const user = (json.data as { user?: { display_name?: string; avatar_url?: string } } | undefined)?.user;
      return { ...info, nickname: info.nickname || user?.display_name || "", avatarUrl: info.avatarUrl || user?.avatar_url || "" };
    } catch {
      /* en iyi çaba */
    }
  }
  return info;
}

/** Açıklama: TikTok başlığı en çok 2.200 karakter; satır sonları korunur. */
export function toTiktokTitle(body: string): string {
  const clean = body.replace(/\r/g, "").trim();
  return clean.length <= MAX_TITLE ? clean : `${clean.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

const UNAUDITED = /unaudited_client|private accounts|SELF_ONLY/i;

export type TiktokPostOptions = {
  videoUrl: string;
  title: string;
  /** İstenen gizlilik düzeyi; hesap izin vermiyorsa ya da uygulama denetimsizse "yalnız ben"e düşülür. */
  privacy: string;
  /** "Kendi markan": videoya "Tanıtım içeriği" etiketi. */
  brandOrganic: boolean;
  /** "Markalı içerik" (üçüncü tarafı tanıtan ücretli ortaklık). Yalnızca elle paylaşım ekranından gelir. */
  brandContent?: boolean;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
};

/** Başlatma isteği; herkese açık reddedilirse bir kez "yalnız ben" ile yeniden dener. */
async function initUpload(
  accessToken: string,
  opts: TiktokPostOptions,
  size: number,
  allowed: string[],
): Promise<{ publishId: string; uploadUrl: string; privacy: string; downgraded: boolean }> {
  // Hesabın izin vermediği düzey istenmişse doğrudan "yalnız ben" (TikTok zaten reddederdi).
  // TikTok kuralı: markalı içerik (ücretli ortaklık) "yalnız ben" olamaz.
  if (opts.brandContent && opts.privacy === "SELF_ONLY") {
    throw new Error("Markalı içeriğin görünürlüğü “Yalnız ben” olamaz (TikTok kuralı); başka bir gizlilik düzeyi seçin.");
  }
  const wanted = opts.privacy !== "SELF_ONLY" && allowed.includes(opts.privacy) ? opts.privacy : "SELF_ONLY";
  const attempt = async (privacy: string) => {
    const data = await tiktokPost(
      "/post/publish/video/init/",
      accessToken,
      {
        post_info: {
          title: opts.title,
          privacy_level: privacy,
          disable_duet: opts.disableDuet,
          disable_comment: opts.disableComment,
          disable_stitch: opts.disableStitch,
          // Kendi markamızı tanıtan içerik: TikTok videoya "Tanıtım içeriği" etiketi koyar.
          brand_organic_toggle: opts.brandOrganic,
          brand_content_toggle: opts.brandContent === true,
        },
        source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 },
      },
      "Yükleme başlatılamadı",
    );
    const publishId = data.publish_id;
    const uploadUrl = data.upload_url;
    if (typeof publishId !== "string" || typeof uploadUrl !== "string") throw new Error("TikTok yükleme adresi dönmedi");
    return { publishId, uploadUrl, privacy };
  };
  try {
    return { ...(await attempt(wanted)), downgraded: opts.privacy !== "SELF_ONLY" && wanted === "SELF_ONLY" };
  } catch (err) {
    if (wanted !== "SELF_ONLY" && !opts.brandContent && err instanceof PlatformError && UNAUDITED.test(err.detail)) {
      return { ...(await attempt("SELF_ONLY")), downgraded: true };
    }
    throw err;
  }
}

/** Yüklemeden sonra TikTok'un işlemesini bekler (en çok ~60 sn); sonucu döndürür. */
async function waitForPublish(
  accessToken: string,
  publishId: string,
  pauseMs = 5_000,
): Promise<{ status: string; postId: string | null; reason: string }> {
  let status = "PROCESSING_UPLOAD";
  let reason = "";
  let postId: string | null = null;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, pauseMs));
    try {
      const data = await tiktokPost("/post/publish/status/fetch/", accessToken, { publish_id: publishId }, "Durum");
      status = typeof data.status === "string" ? data.status : status;
      reason = typeof data.fail_reason === "string" ? data.fail_reason : "";
      const ids = data.publicaly_available_post_id;
      if (Array.isArray(ids) && ids.length > 0) postId = String(ids[0]);
      if (status === "PUBLISH_COMPLETE" || status === "FAILED") break;
    } catch (err) {
      logger.warn("social", `TikTok durum sorgusu başarısız: ${String(err)}`);
    }
  }
  return { status, postId, reason };
}

/** Panelin durum takibi için: tek seferlik `status/fetch` sorgusu (TikTok sınırı: dakikada 30). */
export async function fetchTiktokPublishStatus(
  secrets: Record<string, string>,
  publishId: string,
): Promise<{ status: string; postId: string | null; reason: string; message: string | null }> {
  const accessToken = await freshAccessToken(secrets);
  const data = await tiktokPost("/post/publish/status/fetch/", accessToken, { publish_id: publishId }, "Durum");
  const status = typeof data.status === "string" ? data.status : "PROCESSING_UPLOAD";
  const reason = typeof data.fail_reason === "string" ? data.fail_reason : "";
  const ids = data.publicaly_available_post_id;
  return {
    status,
    postId: Array.isArray(ids) && ids.length > 0 ? String(ids[0]) : null,
    reason,
    message: reason ? (describeTiktokError(reason) ?? reason) : null,
  };
}

/** Testlerde bekleme süresini kısaltmak için. */
export const tiktokPollPauseMs = { value: 5_000 };

export type TiktokPostOutcome = { publishId: string; postId: string | null; status: string; privacy: string; warning: string | null };

/** Videoyu indirir, TikTok'a yükler ve işlenmesini bekler. Otomatik yayıncı ve panel ekranı aynı çekirdeği kullanır. */
export async function postTiktokVideo(secrets: Record<string, string>, opts: TiktokPostOptions): Promise<TiktokPostOutcome> {
  if (!isReelUrl(opts.videoUrl)) throw new Error("TikTok yalnızca video paylaşır; bu gönderide video yok");

  const accessToken = await freshAccessToken(secrets);
  const res = await fetch(opts.videoUrl, { signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Video indirilemedi (${res.status}): ${opts.videoUrl}`);
  const video = Buffer.from(await res.arrayBuffer());
  if (video.byteLength > MAX_SINGLE_CHUNK) throw new Error("Video 64 MB'ı aşıyor; TikTok tek parça yüklemesi bunu kabul etmez");

  let allowed: string[] = [];
  try {
    allowed = (await queryCreatorInfo(accessToken)).privacyOptions;
  } catch (err) {
    logger.warn("social", `TikTok gizlilik seçenekleri okunamadı, "yalnız ben" ile denenecek: ${String(err)}`);
  }
  const init = await initUpload(accessToken, { ...opts, title: toTiktokTitle(opts.title) }, video.byteLength, allowed);

  // Bu noktadan sonra TikTok'ta bir yayın kaydı var: hata olursa yeniden denemek çift gönderi riski taşır.
  try {
    const up = await fetch(init.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": "video/mp4",
        "content-length": String(video.byteLength),
        "content-range": `bytes 0-${video.byteLength - 1}/${video.byteLength}`,
      },
      body: new Uint8Array(video),
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    if (!up.ok) throw new PlatformError("TikTok", up.status, await up.text());

    const outcome = await waitForPublish(accessToken, init.publishId, tiktokPollPauseMs.value);
    if (outcome.status === "FAILED") {
      throw new Error(`TikTok videoyu reddetti: ${describeTiktokError(outcome.reason) ?? "neden bildirilmedi"}${outcome.reason ? ` [${outcome.reason}]` : ""}`);
    }

    const warnings: string[] = [];
    if (init.privacy === "SELF_ONLY") {
      warnings.push(
        init.downgraded
          ? "Video “yalnız ben” gizliliğiyle yüklendi (TikTok uygulaması henüz denetimden geçmedi ya da hesap bu seçeneğe izin vermiyor); TikTok'ta Profil → Gizli videolardan açabilirsin."
          : "Video “yalnız ben” gizliliğiyle yüklendi.",
      );
    }
    if (outcome.status !== "PUBLISH_COMPLETE") {
      warnings.push(`TikTok videoyu hâlâ işliyor (durum: ${outcome.status}); birkaç dakika sonra profilde görünür.`);
    }
    return {
      publishId: init.publishId,
      postId: outcome.postId,
      status: outcome.status,
      privacy: init.privacy,
      warning: warnings.length ? warnings.join(" ") : null,
    };
  } catch (err) {
    throw new PublishStageError(err instanceof Error ? err.message : String(err));
  }
}

/** Otomatik/onaylı hattın yayıncısı: gizlilik ve marka işareti panel ayarlarından gelir. */
export const publishToTiktok: Publisher = async ({ body, imageUrl, item, secrets }) => {
  if (!imageUrl) throw new Error("TikTok yalnızca video paylaşır; bu gönderide video yok");
  // Döngüsel içe aktarmayı önlemek için geç yüklenir.
  const { readSocialConfig } = await import("../social.service.js");
  const config = await readSocialConfig();
  const result = await postTiktokVideo(secrets, {
    videoUrl: imageUrl,
    title: body,
    privacy: config.tiktokPublic ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY",
    brandOrganic: config.tiktokBrandOrganic,
    // TikTok kuralı: etkileşimler varsayılan KAPALI başlar; otomatik hatta kullanıcı açmadığı için kapalı gider.
    disableComment: true,
    disableDuet: true,
    disableStitch: true,
  });
  logger.info("social", `TikTok videosu gönderildi (${result.status}, ${result.privacy}): ${item.title}`);
  return {
    externalId: result.postId ?? result.publishId,
    externalUrl: result.postId ? `https://www.tiktok.com/video/${result.postId}` : null,
    ...(result.warning ? { warning: result.warning } : {}),
  };
};
