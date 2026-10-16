/**
 * YouTube Shorts yayıncısı (YouTube Data API v3, `videos.insert`).
 *
 * YALNIZ VİDEO: Reels için üretilen dikey araç videosu Shorts olarak yüklenir. Blog gönderileri
 * (görsel) YouTube'a gitmez; kuyruk oluşturma bu ağı atlar (bkz. `PLATFORM_SPECS.videoOnly`).
 *
 * Kimlik: kalıcı bir yenileme anahtarı (refresh token) saklanır; her yayında kısa ömürlü erişim
 * anahtarına çevrilir. Shorts için ayrı bir uç yoktur: dikey ve 3 dakikayı aşmayan video, açıklamada
 * #Shorts varsa Shorts olarak sınıflanır.
 *
 * İKİ AŞAMALI YÜKLEME: (1) oturum aç (video bilgisi), (2) dosyayı gönder. Videoyu sitemizin kendi
 * adresinden indirip YouTube'a yüklüyoruz (YouTube, Meta gibi adresten çekmez).
 */

import { logger } from "../../../lib/file-log.js";
import { PlatformError, PublishStageError, requestJson, requireSecret } from "./common.js";
import type { Publisher, Verifier } from "./common.js";
import { isReelUrl } from "../reels.service.js";
import { findCatalogEntry } from "../tool-reels.service.js";
import { availableReelCover, toolIdFromGuid } from "./reel-cover.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";
const API = "https://www.googleapis.com/youtube/v3";
/** Yükleme dosya boyutuyla orantılı; kısa Reels videosu için bol. */
const UPLOAD_TIMEOUT_MS = 5 * 60_000;
/** YouTube başlık sınırı 100 karakter. */
const MAX_TITLE = 100;
/** Fen ve Teknoloji. */
const CATEGORY_ID = "28";

/** Yenileme anahtarını kısa ömürlü erişim anahtarına çevirir. */
async function accessTokenFor(secrets: Record<string, string>): Promise<string> {
  const clientId = requireSecret(secrets, "clientId", "YouTube Client ID");
  const clientSecret = requireSecret(secrets, "clientSecret", "YouTube Client Secret");
  const refreshToken = requireSecret(secrets, "refreshToken", "YouTube Refresh Token");
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  let json: Record<string, unknown>;
  try {
    json = await requestJson("YouTube", TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch (err) {
    if (err instanceof PlatformError && /invalid_grant/.test(err.detail)) {
      throw new Error(
        "YouTube yenileme anahtarı geçersiz veya süresi dolmuş (invalid_grant). Google uygulaması 'Test' durumundaysa anahtar 7 günde ölür; uygulamayı 'Üretimde' yapıp anahtarı yeniden alın.",
      );
    }
    throw err;
  }
  const token = json.access_token;
  if (typeof token !== "string" || !token) throw new Error("YouTube erişim anahtarı alınamadı");
  return token;
}

/**
 * Arama etiketleri: aracın doğrulanmış arama terimleri (katalog). YouTube toplam 500 karaktere
 * izin verir; güvenli pay bırakılır. Etiketler yalnızca yanlış yazılarak aranan içerikte işe yarar,
 * bu yüzden kısa tutulur.
 */
function toTags(guid: string): string[] {
  const toolId = toolIdFromGuid(guid);
  const entry = toolId ? findCatalogEntry(toolId) : undefined;
  const raw = entry
    ? [...entry.keywords.tr, ...entry.keywords.tagsTr, ...entry.keywords.en, ...entry.keywords.tagsEn]
    : [];
  const out: string[] = [];
  let total = 0;
  for (const tag of raw.map((t) => t.replace(/[<>]/g, "").trim().toLowerCase())) {
    if (!tag || out.includes(tag)) continue;
    // Boşluklu etiket tırnaklanarak sayılır (+2).
    const cost = tag.length + (tag.includes(" ") ? 2 : 0) + 1;
    if (total + cost > 400) break;
    out.push(tag);
    total += cost;
  }
  return out;
}

/**
 * Markalı küçük resmi yükler. EN İYİ ÇABA: video bu noktada zaten yayında; küçük resim yüklenemezse
 * (kanal telefonla doğrulanmamış olabilir, görsel kabul edilmemiş olabilir) paylaşım başarısız sayılmaz.
 */
async function setThumbnail(accessToken: string, videoId: string, guid: string): Promise<void> {
  try {
    const coverUrl = await availableReelCover(guid);
    if (!coverUrl) return;
    const img = await fetch(coverUrl, { signal: AbortSignal.timeout(30_000) });
    if (!img.ok) return;
    const bytes = Buffer.from(await img.arrayBuffer());
    const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "image/jpeg" },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      logger.warn(
        "social",
        `YouTube küçük resmi yüklenemedi (HTTP ${res.status}): ${(await res.text()).slice(0, 200)} — özel küçük resim için kanalın telefonla doğrulanmış olması gerekir.`,
      );
    }
  } catch (err) {
    logger.warn("social", `YouTube küçük resmi yüklenemedi: ${String(err)}`);
  }
}

/** Başlık: satır sonu/kapatma işaretlerinden arındırılmış, 100 karakteri aşmayan tek satır. */
function toTitle(raw: string): string {
  const clean = raw.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  const base = clean || "PDF Platform";
  return base.length <= MAX_TITLE ? base : `${base.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

/** Açıklama: `<`/`>` yasak; Shorts sınıflaması için #Shorts eklenir. */
function toDescription(raw: string): string {
  const clean = raw.replace(/[<>]/g, "").trim();
  const withTag = /#shorts\b/i.test(clean) ? clean : `${clean}\n\n#Shorts`;
  return withTag.slice(0, 4900);
}

async function downloadVideo(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Video indirilemedi (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

export const publishToYouTube: Publisher = async ({ body, imageUrl, item, secrets }) => {
  // YouTube yalnız video kabul eder; görsel/salt metin gönderisi buraya gelmemeli.
  if (!isReelUrl(imageUrl)) throw new Error("YouTube yalnızca video paylaşır; bu gönderide video yok");

  const accessToken = await accessTokenFor(secrets);
  const video = await downloadVideo(imageUrl);

  // 1) Yükleme oturumu: video bilgisi burada verilir. Bu adım güvenle yinelenebilir.
  const startRes = await fetch(`${UPLOAD_URL}?uploadType=resumable&part=snippet,status,recordingDetails`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": "video/mp4",
      "x-upload-content-length": String(video.byteLength),
    },
    body: JSON.stringify({
      snippet: {
        title: toTitle(item.title),
        description: toDescription(body),
        categoryId: CATEGORY_ID,
        tags: toTags(item.guid),
        // Başlık/açıklama dili: gönderi Türkçe başta, İngilizce altta.
        defaultLanguage: "tr",
      },
      status: {
        privacyStatus: "public",
        // Açıkça verilmezse YouTube yüklemeyi çocuk içeriği sorusu için bekletebilir.
        selfDeclaredMadeForKids: false,
        embeddable: true,
        // "Yapay zekâ kullanımı": videolar gerçek ürün ekran kaydıdır; gerçekçi sahte medya değildir.
        containsSyntheticMedia: false,
      },
      // "Kayıt tarihi": videonun üretildiği/yüklendiği gün.
      recordingDetails: { recordingDate: new Date().toISOString() },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!startRes.ok) throw new PlatformError("YouTube", startRes.status, await startRes.text());
  const sessionUrl = startRes.headers.get("location");
  if (!sessionUrl) throw new Error("YouTube yükleme oturumu adresi dönmedi");

  // 2) Dosyayı gönder. Bu adım başladıktan sonra video oluşmuş olabilir (zaman aşımında bile),
  //    bu yüzden hata PublishStageError olarak işaretlenir.
  try {
    const up = await fetch(sessionUrl, {
      method: "PUT",
      headers: { "content-type": "video/mp4", "content-length": String(video.byteLength) },
      body: new Uint8Array(video),
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    const text = await up.text();
    if (!up.ok) throw new PlatformError("YouTube", up.status, text);
    const json = JSON.parse(text) as { id?: string; status?: { privacyStatus?: string; uploadStatus?: string } };
    if (!json.id) throw new Error("YouTube video kimliği dönmedi");

    // Denetimden geçmemiş API projesinde video, public istense bile özel kilitlenir.
    if (json.status?.privacyStatus && json.status.privacyStatus !== "public") {
      logger.warn(
        "social",
        `YouTube videosu ${json.status.privacyStatus} olarak yüklendi: API projesi denetimden geçmemiş olabilir (video yine de kanalda; Studio'dan elle herkese açılabilir).`,
      );
    }
    logger.info("social", `YouTube Shorts yüklendi: ${item.title}`);
    await setThumbnail(accessToken, json.id, item.guid);
    return { externalId: json.id, externalUrl: `https://www.youtube.com/shorts/${json.id}` };
  } catch (err) {
    throw new PublishStageError(err instanceof Error ? err.message : String(err));
  }
};

/** Anahtarların geçerli olduğunu ve hangi kanala ait olduğunu sınar. Paylaşım yapmaz. */
export const verifyYouTube: Verifier = async (secrets) => {
  const accessToken = await accessTokenFor(secrets);
  const json = await requestJson("YouTube", `${API}/channels?part=snippet&mine=true`, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const items = Array.isArray(json.items) ? (json.items as { snippet?: { title?: string } }[]) : [];
  const title = items[0]?.snippet?.title;
  if (!title) {
    throw new Error(
      "Kanal okunamadı — yetkilendirme sırasında doğru Google hesabı/kanal seçilmemiş olabilir ya da 'youtube.readonly' izni verilmemiş.",
    );
  }
  return title;
};
