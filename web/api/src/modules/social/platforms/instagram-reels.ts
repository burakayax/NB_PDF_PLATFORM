/**
 * Instagram Reels yayını (Meta Graph API, `media_type=REELS`).
 *
 * Video, sitemizdeki ADRESİYLE verilir; Instagram dosyayı kendisi indirip işler.
 * Video işleme görselden çok daha yavaş olabilir, bu yüzden bekleme süresi uzundur.
 *
 * ÇİFT PAYLAŞIM KORUMASI: `media_publish` BAŞLADIKTAN sonraki hata `PublishStageError`
 * olarak fırlatılır; çağıran bu durumda başka biçime (carousel/tek görsel) DÜŞMEZ.
 * Ondan ÖNCEKİ her hata düz `Error`dır ve güvenle yedek yola düşülebilir.
 */

import { logger } from "../../../lib/file-log.js";
import { PublishStageError, requestJson, requireSecret } from "./common.js";
import type { PublishInput } from "./common.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const POLL_DELAY_MS = 6000;
/** ~6 dakika: 20 sn'lik, yarım MB'lık video için bol bol yeter; takılırsa yedeğe düşülür. */
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

async function waitForReel(creationId: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < POLL_MAX_TRIES; attempt++) {
    const status = await requestJson(
      "Instagram",
      `${GRAPH}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
      { method: "GET" },
    );
    const code = status.status_code as string | undefined;
    if (code === "FINISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Instagram videoyu işleyemedi: ${String(status.status ?? code)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
  }
  throw new Error("Instagram videoyu zamanında işlemedi");
}

export async function publishInstagramReel(
  { body, item, secrets }: Pick<PublishInput, "body" | "item" | "secrets">,
  videoUrl: string,
) {
  const igUserId = requireSecret(secrets, "igUserId", "Instagram İşletme Hesabı ID");
  const token = requireSecret(secrets, "pageAccessToken", "Instagram Sayfa Erişim Anahtarı");

  // 1) Reels kabı. `share_to_feed`: aynı video profil akışında da görünsün.
  const created = await requestJson(
    "Instagram",
    `${GRAPH}/${igUserId}/media`,
    form({
      access_token: token,
      media_type: "REELS",
      video_url: videoUrl,
      caption: body,
      share_to_feed: "true",
    }),
  );
  const creationId = created.id as string | undefined;
  if (!creationId) throw new Error("Instagram Reels kap kimliği dönmedi");

  // 2) Video işlenene kadar bekle.
  await waitForReel(creationId, token);

  // 3) Yayınla — bundan sonrası geri dönüşsüz kabul edilir.
  try {
    const json = await requestJson(
      "Instagram",
      `${GRAPH}/${igUserId}/media_publish`,
      form({ access_token: token, creation_id: creationId }),
    );
    const id = (json.id as string | undefined) ?? null;
    logger.info("social", `Instagram Reels yayınlandı: ${item.title}`);
    return { externalId: id, externalUrl: id ? `https://www.instagram.com/reel/${id}` : null };
  } catch (err) {
    throw new PublishStageError(err instanceof Error ? err.message : String(err));
  }
}
