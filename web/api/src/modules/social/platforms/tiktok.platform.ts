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
 * Anahtarlar: erişim anahtarı ~24 saat, yenileme anahtarı ~1 yıl yaşar.
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
export const TIKTOK_SCOPES = "user.info.basic,video.publish";

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
  const refreshToken = requireSecret(secrets, "refreshToken", "TikTok Refresh Token");
  const fresh = await refreshTiktokTokens(clientKey, clientSecret, refreshToken);
  const name = await fetchTiktokDisplayName(fresh.accessToken);
  // Döngüsel içe aktarmayı önlemek için geç yüklenir (social.service bu dosyayı zaten içe aktarıyor).
  const { saveAccount } = await import("../social.service.js");
  await saveAccount({
    platform: "TIKTOK",
    secrets: { accessToken: fresh.accessToken, refreshToken: fresh.refreshToken },
    tokenExpiresAt: fresh.refreshExpiresAt ? new Date(fresh.refreshExpiresAt) : undefined,
  }).catch(() => undefined);
  return name;
};

// ───────────────────────── yayın ─────────────────────────

const API = "https://open.tiktokapis.com/v2";
/** TikTok tek parça yüklemede en çok 64 MB kabul eder (kısa Reels videosu bunun çok altında). */
const MAX_SINGLE_CHUNK = 64 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 5 * 60_000;
/** Başlık (açıklama) sınırı: TikTok 2.200 karakter. */
const MAX_TITLE = 2200;

/** Her yayında yenileme anahtarıyla taze erişim anahtarı alır; dönen yeni yenileme anahtarını saklar. */
async function freshAccessToken(secrets: Record<string, string>): Promise<string> {
  const clientKey = requireSecret(secrets, "clientKey", "TikTok Client Key");
  const clientSecret = requireSecret(secrets, "clientSecret", "TikTok Client Secret");
  const refreshToken = requireSecret(secrets, "refreshToken", "TikTok Refresh Token");
  let fresh: TiktokTokens;
  try {
    fresh = await refreshTiktokTokens(clientKey, clientSecret, refreshToken);
  } catch (err) {
    throw new Error(
      `TikTok yenileme anahtarı geçersiz ya da süresi dolmuş: panelde “TikTok ile bağlan”ı yeniden yapın. (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  const { saveAccount } = await import("../social.service.js");
  await saveAccount({
    platform: "TIKTOK",
    secrets: { accessToken: fresh.accessToken, refreshToken: fresh.refreshToken },
    tokenExpiresAt: fresh.refreshExpiresAt ? new Date(fresh.refreshExpiresAt) : undefined,
  }).catch((err) => logger.warn("social", `TikTok yeni anahtarlar kaydedilemedi: ${String(err)}`));
  return fresh.accessToken;
}

type TiktokEnvelope = { data?: Record<string, unknown>; error?: { code?: string; message?: string } };

function envelopeError(what: string, env: TiktokEnvelope, status: number): PlatformError {
  return new PlatformError("TikTok", status, `${what}: ${env.error?.code}${env.error?.message ? ` — ${env.error.message}` : ""}`);
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

/** Hesabın seçebileceği gizlilik düzeyleri (denetimsiz uygulamada genelde yalnız SELF_ONLY). */
async function privacyOptions(accessToken: string): Promise<string[]> {
  try {
    const data = await tiktokPost("/post/publish/creator_info/query/", accessToken, {}, "Hesap bilgisi");
    const options = data.privacy_level_options;
    return Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
  } catch (err) {
    logger.warn("social", `TikTok gizlilik seçenekleri okunamadı, "yalnız ben" ile denenecek: ${String(err)}`);
    return [];
  }
}

/** Açıklama: TikTok başlığı en çok 2.200 karakter; satır sonları korunur. */
export function toTiktokTitle(body: string): string {
  const clean = body.replace(/\r/g, "").trim();
  return clean.length <= MAX_TITLE ? clean : `${clean.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

const UNAUDITED = /unaudited_client|private accounts|SELF_ONLY/i;

/** Başlatma isteği; herkese açık reddedilirse bir kez "yalnız ben" ile yeniden dener. */
async function initUpload(
  accessToken: string,
  title: string,
  size: number,
  options: string[],
): Promise<{ publishId: string; uploadUrl: string; privacy: string; downgraded: boolean }> {
  const wanted = options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY";
  const attempt = async (privacy: string) => {
    const data = await tiktokPost(
      "/post/publish/video/init/",
      accessToken,
      {
        post_info: { title, privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false },
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
    return { ...(await attempt(wanted)), downgraded: false };
  } catch (err) {
    if (wanted !== "SELF_ONLY" && err instanceof PlatformError && UNAUDITED.test(err.detail)) {
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

/** Testlerde bekleme süresini kısaltmak için. */
export const tiktokPollPauseMs = { value: 5_000 };

export const publishToTiktok: Publisher = async ({ body, imageUrl, item, secrets }) => {
  if (!isReelUrl(imageUrl)) throw new Error("TikTok yalnızca video paylaşır; bu gönderide video yok");

  const accessToken = await freshAccessToken(secrets);
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Video indirilemedi (${res.status}): ${imageUrl}`);
  const video = Buffer.from(await res.arrayBuffer());
  if (video.byteLength > MAX_SINGLE_CHUNK) throw new Error("Video 64 MB'ı aşıyor; TikTok tek parça yüklemesi bunu kabul etmez");

  const options = await privacyOptions(accessToken);
  const init = await initUpload(accessToken, toTiktokTitle(body), video.byteLength, options);

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
    if (outcome.status === "FAILED") throw new Error(`TikTok videoyu reddetti: ${outcome.reason || "neden bildirilmedi"}`);

    logger.info("social", `TikTok videosu gönderildi (${outcome.status}): ${item.title}`);
    const warnings: string[] = [];
    if (init.privacy === "SELF_ONLY") {
      warnings.push(
        init.downgraded
          ? "TikTok uygulaması henüz denetimden geçmediği için video “yalnız ben” gizliliğiyle yüklendi; TikTok'ta Profil → Gizli videolardan açabilirsin."
          : "Video “yalnız ben” gizliliğiyle yüklendi (hesap yalnız bu seçeneğe izin veriyor).",
      );
    }
    if (outcome.status !== "PUBLISH_COMPLETE") {
      warnings.push(`TikTok videoyu hâlâ işliyor (durum: ${outcome.status}); birkaç dakika sonra profilde görünür.`);
    }
    return {
      externalId: outcome.postId ?? init.publishId,
      externalUrl: outcome.postId ? `https://www.tiktok.com/video/${outcome.postId}` : null,
      ...(warnings.length ? { warning: warnings.join(" ") } : {}),
    };
  } catch (err) {
    throw new PublishStageError(err instanceof Error ? err.message : String(err));
  }
};
