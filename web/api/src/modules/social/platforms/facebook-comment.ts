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
import { linkKindOf, socialLink } from "../social-link.js";
import { requestJson } from "./common.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const SITE = "https://pdfplatform.app";

/** Yorum metni: gönderinin kendi sayfasına (yoksa ana siteye) kampanya etiketli bağlantı. */
export function firstCommentText(link: string, guid: string): string {
  const target = /^https?:\/\//.test(link) ? link : SITE;
  const url = socialLink("FACEBOOK", target, linkKindOf(guid));
  return `Adım adım anlatımı burada bulabilirsin 👉 ${url}`;
}

export async function postFirstComment(
  objectId: string | null,
  token: string,
  link: string,
  guid: string,
): Promise<void> {
  if (!objectId) return;
  // Metinde "Link ilk yorumda" yazıyor; yorum eksik kalırsa okuyucu bağlantısız kalır.
  // Bu yüzden geçici hatalarda bir kez daha denenir (gönderi tekrarlanmaz, yalnız yorum).
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const params = new URLSearchParams();
      params.set("access_token", token);
      params.set("message", firstCommentText(link, guid));
      await requestJson("Facebook", `${GRAPH}/${objectId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      return;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  logger.warn("social", `Facebook ilk yorum eklenemedi (${objectId}): ${String(lastErr)}`);
}
