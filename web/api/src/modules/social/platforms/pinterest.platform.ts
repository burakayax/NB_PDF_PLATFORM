/**
 * Pinterest yayıncısı.
 *
 * Pin'de metin üç ayrı alana bölünür: başlık, açıklama ve TIKLANABİLİR bağlantı.
 * Bu yüzden gönderi metnine adres yazılmaz (bkz. PLATFORM_SPECS.inlineLink).
 */

import { requestJson, requireSecret } from "./common.js";
import type { Publisher, Verifier } from "./common.js";

const API = "https://api.pinterest.com/v5/pins";

export const publishToPinterest: Publisher = async ({ body, imageUrl, item, secrets }) => {
  const token = requireSecret(secrets, "accessToken", "Pinterest Access Token");
  const boardId = requireSecret(secrets, "boardId", "Pinterest Pano ID");
  if (!imageUrl) throw new Error("Pinterest görselsiz pin kabul etmiyor");

  const json = await requestJson("Pinterest", API, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      board_id: boardId,
      title: item.title.slice(0, 100),
      description: body,
      link: item.link,
      media_source: { source_type: "image_url", url: imageUrl },
    }),
  });

  const id = (json.id as string | undefined) ?? null;
  return { externalId: id, externalUrl: id ? `https://www.pinterest.com/pin/${id}/` : null };
};

/** Pinterest anahtarının geçerli olduğunu ve hangi hesaba ait olduğunu söyler. */
export const verifyPinterest: Verifier = async (secrets) => {
  const token = requireSecret(secrets, "accessToken", "Pinterest Access Token");
  const json = await requestJson("Pinterest", "https://api.pinterest.com/v5/user_account", {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
  });
  const username = typeof json.username === "string" ? json.username : null;
  if (!username) throw new Error("Pinterest hesabı okunamadı");
  return `@${username}`;
};
