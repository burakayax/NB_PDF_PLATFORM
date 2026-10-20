/**
 * Facebook gönderisinin İLK YORUMU.
 *
 * NEDEN: Dış bağlantı içeren gönderilerin erişimi düşüyor. Bağlantı metinden çıkarıldı;
 * gönderi yayınlanır yayınlanmaz sayfa adına ilk yorum olarak eklenir.
 *
 * EN İYİ ÇABA: Gönderi bu noktada zaten yayında; yorum eklenemezse paylaşım başarısız
 * sayılmaz (yeniden denemek gönderiyi ikiye katlardı), yalnızca kayda düşer.
 */

import { logger } from "../../../lib/file-log.js";
import { socialUtm, withUtm } from "../../../lib/utm.js";
import { toolIdFromGuid } from "./reel-cover.js";
import { requestJson } from "./common.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const SITE = "https://pdfplatform.app";

/** Yorum metni: gönderinin kendi sayfasına (yoksa ana siteye) kampanya etiketli bağlantı. */
export function firstCommentText(link: string, guid: string): string {
  const target = /^https?:\/\//.test(link) ? link : SITE;
  const url = withUtm(target, socialUtm("FACEBOOK", toolIdFromGuid(guid) ? "arac-videosu" : "blog"));
  return `Ücretsiz denemek için 👉 ${url}`;
}

export async function postFirstComment(
  objectId: string | null,
  token: string,
  link: string,
  guid: string,
): Promise<void> {
  if (!objectId) return;
  try {
    const params = new URLSearchParams();
    params.set("access_token", token);
    params.set("message", firstCommentText(link, guid));
    await requestJson("Facebook", `${GRAPH}/${objectId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch (err) {
    logger.warn("social", `Facebook ilk yorum eklenemedi (${objectId}): ${String(err)}`);
  }
}
