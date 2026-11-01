/**
 * TikTok bağdaştırıcısı (TikTok API v2, Login Kit).
 *
 * KAPSAM (bilerek dar): bu dosya yalnızca BAĞLANTIYI kurar ve sınar — yetkilendirme adresi,
 * kod→anahtar değişimi, anahtar yenileme, hesap sınaması. Video paylaşımı (Content Posting API)
 * YOKTUR: TikTok, denetimden geçmemiş uygulamada paylaşımı yalnızca "yalnız ben" gizliliğiyle
 * kabul ediyor ve paylaşım öncesi onay ekranı istiyor. O iş yapılana kadar yayıncı, hiçbir
 * gönderiyi sessizce kaybetmesin diye açık bir hatayla durur; ayrıca TikTok hiçbir kuyruğa
 * girmez (`videoOnly`, araç videosu listesinde de yok).
 *
 * Anahtarlar: erişim anahtarı ~24 saat, yenileme anahtarı ~1 yıl yaşar.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../../../config/env.js";
import { requestJson, requireSecret } from "./common.js";
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

/** Paylaşım henüz yok: sessizce "başarılı" saymak yerine açık hata. */
export const publishToTiktok: Publisher = async () => {
  throw new Error(
    "TikTok'a otomatik paylaşım henüz etkin değil: bağlantı kuruldu, ancak video yayını TikTok uygulama denetimi ve paylaşım onay ekranı tamamlandıktan sonra eklenecek.",
  );
};
