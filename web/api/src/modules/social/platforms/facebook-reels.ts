/**
 * Facebook Sayfası Reels yayını (Meta Graph API, `/{page-id}/video_reels`).
 *
 * Üç adımlı akış: (1) yükleme oturumu aç, (2) videoyu ADRESİYLE ver (Facebook dosyayı
 * kendisi indirir), (3) yayınla. Video sitemizin kendi adresinden çekildiği için
 * sunucuda dosya tutmak ya da yüklemek gerekmez; Instagram Reels ile aynı mimari.
 *
 * ÇİFT PAYLAŞIM KORUMASI: Yayınlama (3. adım) BAŞLADIKTAN sonraki hata `PublishStageError`
 * olarak fırlatılır; çağıran bu durumda yedek yola DÜŞMEZ. Ondan önceki her hata düz
 * `Error`dır ve güvenle yedek yola düşülebilir.
 */

import { logger } from "../../../lib/file-log.js";
import { PublishStageError, requestJson, requireSecret } from "./common.js";
import type { PublishInput } from "./common.js";
import { availableReelCover } from "./reel-cover.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const POLL_DELAY_MS = 6000;
/** ~6 dakika: kısa bir videonun işlenmesi için bol bol yeter. */
const POLL_MAX_TRIES = 60;

const form = (fields: Record<string, string>) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) params.set(k, v);
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  } satisfies RequestInit;
};

/**
 * Videonun Facebook'a YÜKLENMESİNİ bekler (Meta belgesi: yayınlamadan önce yükleme tamamlanmış olmalı,
 * `uploading_phase.status = complete`). İşleme ("ready") yayın isteğinden SONRA gerçekleşir; ona
 * burada beklenirse yayın hiç başlamaz ve zaman aşımına düşülür.
 */
async function waitForReel(videoId: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < POLL_MAX_TRIES; attempt++) {
    const res = await requestJson(
      "Facebook",
      `${GRAPH}/${videoId}?fields=status&access_token=${encodeURIComponent(token)}`,
      { method: "GET" },
    );
    const status = (res.status ?? {}) as { video_status?: string; uploading_phase?: { status?: string } };
    const code = status.video_status;
    if (status.uploading_phase?.status === "complete") return;
    if (code === "upload_complete" || code === "processing" || code === "ready" || code === "published") return;
    if (code === "error" || code === "expired") {
      throw new Error(`Facebook videoyu işleyemedi (${code})`);
    }
    if (status.uploading_phase?.status === "error") {
      throw new Error("Facebook videoyu indiremedi (adres erişilebilir mi?)");
    }
    await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
  }
  throw new Error("Facebook videoyu zamanında işlemedi");
}

/**
 * Markalı kapağı yükler (Graph API video küçük resmi, `is_preferred`). EN İYİ ÇABA: Reels bu noktada zaten
 * yayında; kapak yüklenemezse (izin eksik, görsel reddedildi) paylaşım başarısız sayılmaz, yalnız kayda düşer.
 */
async function setReelCover(videoId: string, token: string, guid: string): Promise<void> {
  try {
    const coverUrl = await availableReelCover(guid);
    if (!coverUrl) return;
    const img = await fetch(coverUrl, { signal: AbortSignal.timeout(30_000) });
    if (!img.ok) return;
    const form = new FormData();
    form.set("access_token", token);
    form.set("is_preferred", "true");
    form.set("source", new Blob([new Uint8Array(await img.arrayBuffer())], { type: "image/jpeg" }), "kapak.jpg");
    const res = await fetch(`${GRAPH}/${videoId}/thumbnails`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      logger.warn("social", `Facebook Reels kapağı yüklenemedi (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
  } catch (err) {
    logger.warn("social", `Facebook Reels kapağı yüklenemedi: ${String(err)}`);
  }
}

export async function publishFacebookReel(
  { body, item, secrets }: Pick<PublishInput, "body" | "item" | "secrets">,
  videoUrl: string,
) {
  const pageId = requireSecret(secrets, "pageId", "Facebook Sayfa ID");
  const token = requireSecret(secrets, "pageAccessToken", "Facebook Sayfa Erişim Anahtarı");

  // 1) Yükleme oturumu.
  const started = await requestJson(
    "Facebook",
    `${GRAPH}/${pageId}/video_reels`,
    form({ access_token: token, upload_phase: "start" }),
  );
  const videoId = started.video_id as string | undefined;
  const uploadUrl = started.upload_url as string | undefined;
  if (!videoId || !uploadUrl) throw new Error("Facebook Reels yükleme oturumu açılamadı");

  // 2) Videoyu adresiyle ver: Facebook dosyayı kendisi indirir.
  await requestJson("Facebook", uploadUrl, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_url: videoUrl },
  });

  // 3) Yükleme/işleme bitene kadar bekle.
  await waitForReel(videoId, token);

  // 4) Yayınla — bundan sonrası geri dönüşsüz kabul edilir.
  try {
    await requestJson(
      "Facebook",
      `${GRAPH}/${pageId}/video_reels`,
      form({
        access_token: token,
        upload_phase: "finish",
        video_id: videoId,
        video_state: "PUBLISHED",
        description: body,
      }),
    );
    logger.info("social", `Facebook Reels yayınlandı: ${item.title}`);
    await setReelCover(videoId, token, item.guid);
    return { externalId: videoId, externalUrl: `https://www.facebook.com/reel/${videoId}` };
  } catch (err) {
    throw new PublishStageError(err instanceof Error ? err.message : String(err));
  }
}
