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

/**
 * Yeniden deneme ayarı. Reels'te video yayınlandıktan sonra bir süre yorum kabul etmeyebilir (işleniyor);
 * bu yüzden Reels daha uzun bekler ve daha çok dener. Testlerde sıfırlanabilir.
 */
export type CommentTiming = { initialWait: number; retryBase: number; attempts: number };
export const feedCommentTiming: CommentTiming = { initialWait: 0, retryBase: 3000, attempts: 2 };
export const reelCommentTiming: CommentTiming = { initialWait: 10_000, retryBase: 12_000, attempts: 5 };

/**
 * @returns yorum eklenemediyse NEDENİ (panelde uyarı olarak görünür), eklendiyse null.
 */
export async function postFirstComment(
  objectId: string | null,
  token: string,
  link: string,
  guid: string,
  timing: CommentTiming = feedCommentTiming,
): Promise<string | null> {
  if (!objectId) return null;
  // Metinde "Link ilk yorumda" yazıyor; yorum eksik kalırsa okuyucu bağlantısız kalır.
  // Bu yüzden geçici hatalarda tekrar denenir (gönderi tekrarlanmaz, yalnız yorum).
  let lastErr: unknown;
  if (timing.initialWait > 0) await new Promise((r) => setTimeout(r, timing.initialWait));
  for (let attempt = 0; attempt < timing.attempts; attempt++) {
    try {
      const params = new URLSearchParams();
      params.set("access_token", token);
      params.set("message", firstCommentText(link, guid));
      await requestJson("Facebook", `${GRAPH}/${objectId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      return null;
    } catch (err) {
      lastErr = err;
      if (attempt < timing.attempts - 1) await new Promise((r) => setTimeout(r, timing.retryBase * (attempt + 1)));
    }
  }
  logger.warn("social", `Facebook ilk yorum eklenemedi (${objectId}): ${String(lastErr)}`);
  return `Facebook ilk yorum (bağlantı) eklenemedi: ${String(lastErr).slice(0, 300)} — Sayfa erişim anahtarında yorum izni (pages_manage_engagement) var mı?`;
}
