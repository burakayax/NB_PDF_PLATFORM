/**
 * Pinterest bağdaştırıcısı (Pinterest API v5).
 *
 * İKİ İŞ: (1) BAĞLANTI — izin ekranı adresi, kod→anahtar değişimi, anahtar yenileme, pano listesi;
 * (2) YAYIN — görselli ve video pin oluşturma.
 *
 * Pin'de metin üç ayrı alana bölünür: başlık, açıklama ve TIKLANABİLİR bağlantı.
 * Bu yüzden gönderi metnine adres yazılmaz (bkz. PLATFORM_SPECS.linkStyle).
 *
 * TRIAL / STANDARD: Pinterest uygulaması "Trial" erişimdeyken istekler kum havuzu (sandbox)
 * adresine gitmelidir; pinler yalnız hesap sahibine görünür ve kum havuzunun panoları
 * gerçek panolardan ayrıdır. Standard onayı gelince panelde “Pinterest kum havuzu” ayarı kapatılır.
 *
 * Anahtarlar: erişim anahtarı ~30 gün, yenileme anahtarı daha uzun yaşar. Erişim anahtarı
 * reddedilirse (401) yenileme anahtarıyla otomatik yenilenir ve yeni anahtarlar şifreli saklanır.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../../../config/env.js";
import { logger } from "../../../lib/file-log.js";
import { PlatformError, requestJson, requireSecret } from "./common.js";
import type { Publisher, Verifier } from "./common.js";
import { availableReelCover } from "./reel-cover.js";
import { isReelUrl } from "../reels.service.js";
import { linkKindOf, socialLink } from "../social-link.js";
import { resolvePinKeywords } from "../pinterest-keywords.js";
import { boardIdFor, chooseBoard } from "../pinterest-board.js";
import {
  PIN_LIMITS,
  buildPinAltText,
  buildPinDescription,
  buildPinTitle,
} from "../pinterest-content.js";

const AUTHORIZE_URL = "https://www.pinterest.com/oauth/";
const API_PRODUCTION = "https://api.pinterest.com/v5";
const API_SANDBOX = "https://api-sandbox.pinterest.com/v5";

/** Kum havuzu (Trial) anahtarı yalnız sandbox adresinde, gerçek anahtar yalnız gerçek adreste geçer; ikisi de aynı kökten alınır. */
function apiRoot(sandbox: boolean): string {
  return sandbox ? API_SANDBOX : API_PRODUCTION;
}

/** İstenen izinler (Pinterest uygulamasında da tanımlı olmalı). */
export const PINTEREST_SCOPES = "boards:read,boards:write,pins:read,pins:write,user_accounts:read";

/** Pinterest'e kayıtlı geri dönüş adresiyle BİREBİR aynı olmalı. */
export function pinterestRedirectUri(): string {
  return new URL("/api/auth/pinterest/callback", env.APP_BASE_URL).toString();
}

// ───────────────────────── state (CSRF koruması) ─────────────────────────

const STATE_TTL_MS = 10 * 60_000;

/** İmzalı, 10 dakikalık "state": `<nonce>.<bitiş ms>.<HMAC-SHA256 imza>`. */
export function createPinterestState(now = Date.now()): string {
  const body = `${randomBytes(12).toString("hex")}.${now + STATE_TTL_MS}`;
  const sig = createHmac("sha256", env.JWT_ACCESS_SECRET).update(`pinterest:${body}`).digest("hex");
  return `${body}.${sig}`;
}

export function verifyPinterestState(state: unknown, now = Date.now()): boolean {
  if (typeof state !== "string") return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expRaw, sig] = parts as [string, string, string];
  const expires = Number(expRaw);
  if (!nonce || !Number.isFinite(expires) || expires < now) return false;
  const expected = createHmac("sha256", env.JWT_ACCESS_SECRET).update(`pinterest:${nonce}.${expRaw}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Yönetici "Pinterest ile bağlan"a basınca tarayıcının gideceği izin ekranı adresi. */
export function buildPinterestAuthorizeUrl(appId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: pinterestRedirectUri(),
    response_type: "code",
    scope: PINTEREST_SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ───────────────────────── Türkçe hata açıklamaları ─────────────────────────

const CODE_TR: Record<number, string> = {
  1: "Pinterest gönderilen bilgilerden birini geçersiz buldu.",
  2: "Pinterest kimlik doğrulaması başarısız: erişim anahtarı geçersiz ya da süresi dolmuş. Panelde “Pinterest ile bağlan”ı yeniden yapın.",
  29: "Pinterest istek sınırı aşıldı; biraz bekleyip tekrar deneyin.",
};

const STATUS_TR: Record<number, string> = {
  400: "Pinterest gönderilen bilgileri kabul etmedi.",
  401: "Pinterest erişim anahtarını kabul etmedi; panelde “Pinterest ile bağlan”ı yeniden yapın.",
  403: "Pinterest bu işleme izin vermedi: uygulama Trial erişimde olabilir, izinler (scope) eksik olabilir ya da bu pano size ait olmayabilir.",
  404: "Pinterest istenen pano ya da pini bulamadı (pano silinmiş ya da kum havuzu/gerçek ortam karışmış olabilir).",
  429: "Pinterest istek sınırı aşıldı; biraz bekleyip tekrar deneyin.",
  500: "Pinterest tarafında geçici bir sorun var; biraz sonra tekrar deneyin.",
  503: "Pinterest şu an yanıt vermiyor; biraz sonra tekrar deneyin.",
};

/** Pinterest hatasını (HTTP durumu + {code,message} gövdesi) okunur Türkçe cümleye çevirir. */
export function describePinterestError(err: PlatformError): string {
  let code: number | undefined;
  let message = "";
  try {
    const parsed = JSON.parse(err.detail) as { code?: unknown; message?: unknown };
    if (typeof parsed.code === "number") code = parsed.code;
    if (typeof parsed.message === "string") message = parsed.message;
  } catch {
    message = err.detail.slice(0, 200);
  }
  const tr = (code !== undefined ? CODE_TR[code] : undefined) ?? STATUS_TR[err.status] ?? "Pinterest isteği reddetti.";
  const raw = [code !== undefined ? `kod ${code}` : "", message].filter(Boolean).join(": ");
  return `${tr} (HTTP ${err.status}${raw ? `, ${raw}` : ""})`;
}

function translated(err: unknown): Error {
  return err instanceof PlatformError ? new Error(describePinterestError(err)) : err instanceof Error ? err : new Error(String(err));
}

// ───────────────────────── anahtar alışverişi ─────────────────────────

export type PinterestTokens = {
  accessToken: string;
  refreshToken: string;
  /** Erişim anahtarının bitiş anı (ms) — yanıttaki expires_in'den; bilinmiyorsa null. */
  accessExpiresAt: number | null;
  /** Yenileme anahtarının bitiş anı (ms) — refresh_token_expires_in / refresh_token_expires_at'tan; bilinmiyorsa null. */
  refreshExpiresAt: number | null;
};

function basicAuth(appId: string, appSecret: string): string {
  return `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`;
}

/** Yanıttaki süreleri okur. Süreler sabit varsayılmaz; Pinterest ne verdiyse o. */
export function parsePinterestTokenResponse(json: Record<string, unknown>, now = Date.now()): PinterestTokens {
  const accessToken = json.access_token;
  const refreshToken = json.refresh_token;
  if (typeof accessToken !== "string" || !accessToken || typeof refreshToken !== "string" || !refreshToken) {
    throw new Error("Pinterest anahtar yanıtı eksik (access_token/refresh_token yok).");
  }
  const positive = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const accessIn = positive(json.expires_in);
  const refreshIn = positive(json.refresh_token_expires_in);
  const refreshAtSec = positive(json.refresh_token_expires_at); // yenileme yanıtında Unix saniyesi
  return {
    accessToken,
    refreshToken,
    accessExpiresAt: accessIn ? now + accessIn * 1000 : null,
    refreshExpiresAt: refreshIn ? now + refreshIn * 1000 : refreshAtSec ? refreshAtSec * 1000 : null,
  };
}

/** Basic auth (client_id:client_secret) + application/x-www-form-urlencoded; adres kum havuzu ayarına göre. */
async function postToken(
  sandbox: boolean,
  appId: string,
  appSecret: string,
  params: Record<string, string>,
): Promise<PinterestTokens> {
  let json: Record<string, unknown>;
  try {
    json = await requestJson("Pinterest", `${apiRoot(sandbox)}/oauth/token`, {
      method: "POST",
      headers: {
        authorization: basicAuth(appId, appSecret),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });
  } catch (err) {
    throw translated(err);
  }
  return parsePinterestTokenResponse(json);
}

/** Geri dönüşte gelen tek kullanımlık kodu anahtarlara çevirir (sürekli yenileme açık). */
export function exchangePinterestCode(sandbox: boolean, appId: string, appSecret: string, code: string): Promise<PinterestTokens> {
  return postToken(sandbox, appId, appSecret, {
    grant_type: "authorization_code",
    code,
    redirect_uri: pinterestRedirectUri(),
    continuous_refresh: "true",
  });
}

/** Erişim anahtarı bitmeden yenileme anahtarıyla yenisini alır. */
export function refreshPinterestTokens(
  sandbox: boolean,
  appId: string,
  appSecret: string,
  refreshToken: string,
): Promise<PinterestTokens> {
  return postToken(sandbox, appId, appSecret, { grant_type: "refresh_token", refresh_token: refreshToken });
}

// ───────────────────────── API çağrısı (otomatik yenilemeli) ─────────────────────────

/** Kum havuzu ayarına göre API kökü (Trial → sandbox, Standard → gerçek). */
async function apiBase(): Promise<string> {
  const { readSocialConfig } = await import("../social.service.js");
  return apiRoot((await readSocialConfig()).pinterestSandbox);
}

export const RECONNECT_AFTER_TOGGLE =
  "Pinterest anahtarı başka ortamda (kum havuzu / gerçek) alınmış: “Pinterest ile bağlan”ı yeniden yap.";

/** Anahtar, şu anki kum havuzu ayarıyla aynı ortamda mı alınmış? Bilinmiyorsa (eski kayıt) uyumsuz sayılır. */
export function pinterestTokenMatches(info: { env: string } | null, sandbox: boolean): boolean {
  return info?.env === (sandbox ? "sandbox" : "production");
}

/** Yeni anahtarları + ortam/süre bilgisini şifreli kaydeder. Yenileme anahtarı döndüğü için kayıt iki kez denenir. */
export async function persistPinterestTokens(tokens: PinterestTokens, sandbox: boolean): Promise<void> {
  const { saveAccount, writeSocialConfig } = await import("../social.service.js");
  const save = async () => {
    await saveAccount({
      platform: "PINTEREST",
      secrets: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
      tokenExpiresAt: tokens.refreshExpiresAt ? new Date(tokens.refreshExpiresAt) : undefined,
    });
    await writeSocialConfig({
      pinterestToken: {
        env: sandbox ? "sandbox" : "production",
        accessExpiresAt: tokens.accessExpiresAt,
        refreshExpiresAt: tokens.refreshExpiresAt,
      },
    });
  };
  try {
    await save();
  } catch {
    await save().catch((err) => logger.error("social", `Pinterest yeni anahtarlar KAYDEDİLEMEDİ: ${String(err)}`));
  }
}

/** Erişim anahtarını yenileme anahtarıyla yeniler ve kaydeder (aynı anda tek yenileme). */
let refreshQueue: Promise<unknown> = Promise.resolve();
export function renewPinterestTokens(secrets: Record<string, string>, sandbox: boolean): Promise<PinterestTokens> {
  const run = async () => {
    const appId = requireSecret(secrets, "appId", "Pinterest App ID");
    const appSecret = requireSecret(secrets, "appSecret", "Pinterest App Secret");
    const refreshToken = secrets.refreshToken?.trim();
    if (!refreshToken) throw new Error("Pinterest bağlı değil: panelde “Pinterest ile bağlan”ı yapın.");
    let fresh: PinterestTokens;
    try {
      fresh = await refreshPinterestTokens(sandbox, appId, appSecret, refreshToken);
    } catch (err) {
      throw new Error(
        `Pinterest bağlantısı yenilenemedi: panelde “Pinterest ile bağlan”ı yeniden yapın. (${err instanceof Error ? err.message : String(err)})`,
      );
    }
    await persistPinterestTokens(fresh, sandbox);
    return fresh;
  };
  const result = refreshQueue.then(run, run);
  refreshQueue = result.catch(() => undefined);
  return result;
}

/** Günlük kontrol: süresi yaklaşan anahtarı pin atılmasa bile yeniler. Yenilendiyse true. */
export async function renewPinterestIfDue(now = Date.now()): Promise<boolean> {
  const { readAccountSecrets, readSocialConfig } = await import("../social.service.js");
  const secrets = await readAccountSecrets("PINTEREST");
  if (!secrets?.refreshToken || !secrets.appId || !secrets.appSecret) return false;
  const config = await readSocialConfig();
  // Ortam uyumsuzsa yenileme anlamsız (yeni ortamda geçmez); yeniden bağlanmak gerekir.
  if (!pinterestTokenMatches(config.pinterestToken, config.pinterestSandbox)) return false;
  const info = config.pinterestToken;
  const DAY = 86_400_000;
  // Erişim anahtarı 10 günden az kaldıysa ya da yenileme anahtarı 30 günden az kaldıysa (ya da süre bilinmiyorsa) yenile.
  const accessSoon = !info?.accessExpiresAt || info.accessExpiresAt - now < 10 * DAY;
  const refreshSoon = !info?.refreshExpiresAt || info.refreshExpiresAt - now < 30 * DAY;
  if (!accessSoon && !refreshSoon) return false;
  await renewPinterestTokens(secrets, config.pinterestSandbox);
  return true;
}

/**
 * Pinterest'e kimlikli istek atar. Erişim anahtarı reddedilirse (401) yenileme anahtarıyla bir kez
 * yenileyip tekrar dener; yenileme de olmazsa “yeniden bağlan” uyarısı verir.
 */
async function pinterestCall(
  secrets: Record<string, string>,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<Record<string, unknown>> {
  const { readSocialConfig } = await import("../social.service.js");
  const config = await readSocialConfig();
  // Kutu değiştiyse eldeki anahtar yeni ortamda geçmez: boşuna istek atmadan yeniden bağlanmayı söyle.
  if (!pinterestTokenMatches(config.pinterestToken, config.pinterestSandbox)) throw new Error(RECONNECT_AFTER_TOGGLE);
  const base = apiRoot(config.pinterestSandbox);
  const send = (token: string) =>
    requestJson("Pinterest", `${base}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });

  const accessToken = requireSecret(secrets, "accessToken", "Pinterest Access Token");
  try {
    return await send(accessToken);
  } catch (err) {
    if (!(err instanceof PlatformError) || err.status !== 401) throw translated(err);
  }

  const fresh = await renewPinterestTokens(secrets, config.pinterestSandbox);
  try {
    return await send(fresh.accessToken);
  } catch (err) {
    throw translated(err);
  }
}

// ───────────────────────── hesap + panolar ─────────────────────────

/** Bağlı hesabın kullanıcı adı. */
export async function fetchPinterestUsername(secrets: Record<string, string>): Promise<string> {
  const json = await pinterestCall(secrets, "/user_account", { method: "GET" });
  const username = typeof json.username === "string" ? json.username : null;
  if (!username) throw new Error("Pinterest hesabı okunamadı");
  return username;
}

export type PinterestBoard = { id: string; name: string; privacy: string };

/** Hesaptaki panolar (en çok 100). */
export async function listPinterestBoards(secrets: Record<string, string>): Promise<PinterestBoard[]> {
  const json = await pinterestCall(secrets, "/boards?page_size=100", { method: "GET" });
  const items = Array.isArray(json.items) ? (json.items as Array<Record<string, unknown>>) : [];
  return items
    .filter((b) => typeof b.id === "string")
    .map((b) => ({
      id: b.id as string,
      name: typeof b.name === "string" ? b.name : String(b.id),
      privacy: typeof b.privacy === "string" ? b.privacy : "",
    }));
}

/** Yeni pano açar (kum havuzunda hazır pano olmadığı için gerekli). */
export async function createPinterestBoard(secrets: Record<string, string>, name: string, description?: string): Promise<PinterestBoard> {
  const json = await pinterestCall(secrets, "/boards", {
    method: "POST",
    body: { name: name.slice(0, 180), ...(description ? { description: description.slice(0, 500) } : {}), privacy: "PUBLIC" },
  });
  if (typeof json.id !== "string") throw new Error("Pinterest pano oluşturmadı");
  return { id: json.id, name: typeof json.name === "string" ? json.name : name, privacy: "PUBLIC" };
}

// ───────────────────────── pin ─────────────────────────

export type PinterestPinInput = {
  boardId: string;
  title: string;
  description: string;
  link: string;
  imageUrl: string;
  altText?: string;
};

export type PinterestPinOutcome = { id: string | null; url: string | null; sandbox: boolean };

/** Alan sınırları Pinterest'in resmî tanımından (bkz. pinterest-content.ts). */
function pinBase(input: { boardId: string; title: string; description: string; link: string; altText?: string }) {
  return {
    board_id: input.boardId,
    title: input.title.slice(0, PIN_LIMITS.title),
    description: input.description.slice(0, PIN_LIMITS.description),
    link: input.link.slice(0, PIN_LIMITS.link),
    ...(input.altText ? { alt_text: input.altText.slice(0, PIN_LIMITS.altText) } : {}),
  };
}

async function pinOutcome(json: Record<string, unknown>): Promise<PinterestPinOutcome> {
  const id = typeof json.id === "string" ? json.id : null;
  const sandbox = (await apiBase()) === API_SANDBOX;
  return { id, url: id ? `https://www.pinterest.com/pin/${id}/` : null, sandbox };
}

/** Görselli pin oluşturur. */
export async function createPinterestPin(secrets: Record<string, string>, input: PinterestPinInput): Promise<PinterestPinOutcome> {
  const json = await pinterestCall(secrets, "/pins", {
    method: "POST",
    body: { ...pinBase(input), media_source: { source_type: "image_url", url: input.imageUrl } },
  });
  return pinOutcome(json);
}

// ───────────────────────── video pin ─────────────────────────

const MEDIA_POLL_MS = 4_000;
const MEDIA_WAIT_MS = 5 * 60_000;
const MEDIA_UPLOAD_TIMEOUT_MS = 3 * 60_000;
/** Bellek için makul tavan (araç videoları bundan çok küçük). */
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export type PinterestVideoPinInput = Omit<PinterestPinInput, "imageUrl"> & {
  videoUrl: string;
  /** Kapak görseli adresi. Yoksa videonun 1. saniyesindeki kare kullanılır (kapaksız istek Pinterest'te yanıltıcı 401 verir). */
  coverImageUrl?: string | null;
};

/** Adım 1: medya kaydı. Adım 2: dosya yükleme (Pinterest'in S3 adresine; Bearer anahtarı GÖNDERİLMEZ). */
async function uploadPinterestVideo(secrets: Record<string, string>, video: Buffer): Promise<string> {
  const reg = await pinterestCall(secrets, "/media", { method: "POST", body: { media_type: "video" } });
  const mediaId = typeof reg.media_id === "string" ? reg.media_id : null;
  const uploadUrl = typeof reg.upload_url === "string" ? reg.upload_url : null;
  const params = reg.upload_parameters;
  if (!mediaId || !uploadUrl || !params || typeof params !== "object") throw new Error("Pinterest video yükleme adresi vermedi");

  const form = new FormData();
  // Pinterest'in verdiği parametreler AYNEN ve DOSYADAN ÖNCE eklenir (S3 sırayı şart koşar).
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) form.append(key, String(value));
  form.append("file", new Blob([new Uint8Array(video)], { type: "video/mp4" }), "video.mp4");

  const res = await fetch(uploadUrl, { method: "POST", body: form, signal: AbortSignal.timeout(MEDIA_UPLOAD_TIMEOUT_MS) });
  // Başarılı yükleme 204 döner.
  if (res.status !== 204 && !res.ok) throw new PlatformError("Pinterest video yükleme", res.status, await res.text());
  return mediaId;
}

/** Adım 3: işlenmesini bekler (registered/processing → succeeded). */
async function waitForPinterestMedia(
  secrets: Record<string, string>,
  mediaId: string,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  const deadline = Date.now() + MEDIA_WAIT_MS;
  for (;;) {
    const info = await pinterestCall(secrets, `/media/${encodeURIComponent(mediaId)}`, { method: "GET" });
    const status = typeof info.status === "string" ? info.status : "";
    if (status === "succeeded") return;
    if (status === "failed") throw new Error("Pinterest videoyu işleyemedi (durum: failed). Video biçimini kontrol edin.");
    if (Date.now() > deadline) throw new Error("Pinterest videoyu zamanında işlemedi; birkaç dakika sonra yeniden deneyin.");
    await sleep(MEDIA_POLL_MS);
  }
}

/** Dört adımlı video pin: kayıt → yükleme → bekleme → pin. */
export async function createPinterestVideoPin(
  secrets: Record<string, string>,
  input: PinterestVideoPinInput,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<PinterestPinOutcome> {
  const res = await fetch(input.videoUrl, { signal: AbortSignal.timeout(MEDIA_UPLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Video indirilemedi (${res.status}): ${input.videoUrl}`);
  const video = Buffer.from(await res.arrayBuffer());
  if (video.byteLength > MAX_VIDEO_BYTES) throw new Error("Video çok büyük; Pinterest'e gönderilmedi");

  const mediaId = await uploadPinterestVideo(secrets, video);
  await waitForPinterestMedia(secrets, mediaId, sleep);

  const json = await pinterestCall(secrets, "/pins", {
    method: "POST",
    body: {
      ...pinBase(input),
      media_source: {
        source_type: "video_id",
        media_id: mediaId,
        // Kapak zorunlu sayılır: yoksa videonun 1. saniyesindeki kare kullanılır.
        ...(input.coverImageUrl ? { cover_image_url: input.coverImageUrl } : { cover_image_key_frame_time: 1 }),
      },
    },
  });
  return pinOutcome(json);
}

export const SANDBOX_NOTE =
  "Pin Pinterest kum havuzuna (Trial) gönderildi: yalnızca hesap sahibi görür ve bağlantı normal Pinterest'te açılmayabilir. Standard onayı gelince panelde “Pinterest kum havuzu”nu kapat.";

export const publishToPinterest: Publisher = async ({ body, imageUrl, item, secrets, boardKey: postBoardKey }) => {
  if (!imageUrl) throw new Error("Pinterest görselsiz pin kabul etmiyor");
  // Döngüsel içe aktarmayı önlemek için geç yüklenir.
  const { readSocialConfig } = await import("../social.service.js");
  const config = await readSocialConfig();

  // Konuya ayrılmış pano (CV / PDF / Sözleşme) varsa o, yoksa seçili tek pano.
  const env = config.pinterestSandbox ? "sandbox" : "production";
  const choice = postBoardKey ? { key: postBoardKey } : chooseBoard({ guid: item.guid, title: item.title, link: item.link, categories: item.categories });
  const mapped = boardIdFor(choice.key, config.pinterestBoards, config.pinterestBoardsEnv, env);
  const boardId = mapped ?? secrets.boardId?.trim();
  if (!boardId) throw new Error("Pinterest Pano seçilmemiş (panelden seçilir)");
  let boardWarning: string | undefined;
  if (!mapped) boardWarning = "Konuya ayrılmış pano eşleşmedi; seçili tek panoya gönderildi (panelden “Panoları eşleştir” yapın).";

  const lang = item.lang === "en" ? "en" : "tr";
  const keywords = await resolvePinKeywords(item, config.pinterestKeywords);
  const content = {
    boardId,
    title: buildPinTitle(item.title, keywords, lang),
    description: buildPinDescription(body, lang),
    link: socialLink("PINTEREST", item.link, linkKindOf(item.guid)),
    altText: buildPinAltText(item.title, keywords, lang),
  };

  let warning: string | undefined;
  let pin: PinterestPinOutcome;
  if (isReelUrl(imageUrl)) {
    const cover = await availableReelCover(item.guid);
    if (!cover) warning = "Kapak görseli bulunamadı; videonun 1. saniyesindeki kare kapak yapıldı.";
    pin = await createPinterestVideoPin(secrets, { ...content, videoUrl: imageUrl, coverImageUrl: cover });
  } else {
    pin = await createPinterestPin(secrets, { ...content, imageUrl });
  }
  const notes = [warning, boardWarning, pin.sandbox ? SANDBOX_NOTE : undefined].filter(Boolean).join(" ");
  return { externalId: pin.id, externalUrl: pin.url, ...(notes ? { warning: notes } : {}) };
};

/** Pinterest bağlantısının geçerli olduğunu ve hangi hesaba ait olduğunu söyler. */
export const verifyPinterest: Verifier = async (secrets) => `@${await fetchPinterestUsername(secrets)}`;
