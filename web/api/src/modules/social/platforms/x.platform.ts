/**
 * X (Twitter) yayıncısı.
 *
 * İki adım: görsel önce medya ucuna yüklenir (OAuth 1.0a şart), dönen kimlik
 * gönderiye eklenir. Metin gönderinin `text` alanında gider — görselin içine
 * ASLA gömülmez.
 */

import { oauth1Header } from "./oauth1.js";
import type { OAuth1Keys } from "./oauth1.js";
import { PlatformError, downloadImage, requestJson, requireSecret } from "./common.js";
import type { Publisher, Verifier } from "./common.js";

/** Güncel medya ucu. X, eski 1.1 ucunu kullanımdan kaldırma sürecinde. */
const MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";
/** Yeni uç bir hesapta henüz açık değilse düşülecek eski uç. */
const LEGACY_MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
const TWEET_URL = "https://api.x.com/2/tweets";
const ME_URL = "https://api.x.com/2/users/me";

function keysFrom(secrets: Record<string, string>): OAuth1Keys {
  return {
    apiKey: requireSecret(secrets, "apiKey", "X API Key"),
    apiSecret: requireSecret(secrets, "apiSecret", "X API Key Secret"),
    accessToken: requireSecret(secrets, "accessToken", "X Access Token"),
    accessSecret: requireSecret(secrets, "accessSecret", "X Access Token Secret"),
  };
}

/**
 * multipart gövdesi elle kuruluyor: OAuth 1.0a imzası yalnızca
 * form-urlencoded gövdeleri kapsar; multipart'ta gövde imzaya girmez, bu yüzden
 * dev base64 dizeleri imzalamak zorunda kalmıyoruz.
 */
function multipart(
  fields: { name: string; value: string }[],
  file: { name: string; filename: string; mime: string; bytes: Buffer },
) {
  const boundary = `----nbpdf${Date.now().toString(16)}`;
  const parts: Buffer[] = [];
  for (const f of fields) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}\r\n`,
        "utf8",
      ),
    );
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n` +
        `Content-Type: ${file.mime}\r\n\r\n`,
      "utf8",
    ),
    file.bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
  );
  return { boundary, body: Buffer.concat(parts) };
}

/** Yanıt gövdesinden medya kimliğini çıkarır (yeni ve eski biçim). */
function readMediaId(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as {
      media_id_string?: string;
      id?: string;
      data?: { id?: string; media_key?: string };
    };
    return parsed.data?.id ?? parsed.media_id_string ?? parsed.id ?? null;
  } catch {
    return null;
  }
}

async function postMedia(
  url: string,
  keys: OAuth1Keys,
  mime: string,
  bytes: Buffer,
): Promise<Response> {
  const { boundary, body } = multipart(
    [{ name: "media_category", value: "tweet_image" }],
    { name: "media", filename: "cover.png", mime, bytes },
  );
  return fetch(url, {
    method: "POST",
    headers: {
      authorization: oauth1Header("POST", url, keys),
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(60_000),
  });
}

async function uploadMedia(imageUrl: string, keys: OAuth1Keys): Promise<string> {
  const { bytes, mime } = await downloadImage(imageUrl);

  let res = await postMedia(MEDIA_UPLOAD_URL, keys, mime, bytes);
  // Yeni uç bu uygulamada açık değilse (404/410) eski uçla tekrar denenir;
  // yetki hataları (401/403) burada yutulmaz, doğrudan yüzeye çıkar.
  if (res.status === 404 || res.status === 410) {
    res = await postMedia(LEGACY_MEDIA_UPLOAD_URL, keys, mime, bytes);
  }

  const text = await res.text();
  if (!res.ok) throw new PlatformError("X medya yükleme", res.status, text);

  const id = readMediaId(text);
  if (!id) throw new Error("X medya kimliği dönmedi");
  return id;
}

export const publishToX: Publisher = async ({ body, imageUrl, secrets }) => {
  const keys = keysFrom(secrets);

  const payload: Record<string, unknown> = { text: body };
  if (imageUrl) {
    payload.media = { media_ids: [await uploadMedia(imageUrl, keys)] };
  }

  const json = await requestJson("X", TWEET_URL, {
    method: "POST",
    headers: {
      authorization: oauth1Header("POST", TWEET_URL, keys),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = json.data as { id?: string } | undefined;
  const id = data?.id ?? null;
  return { externalId: id, externalUrl: id ? `https://x.com/i/web/status/${id}` : null };
};

/** Anahtarların X tarafından kabul edildiğini ve hangi hesaba ait olduğunu söyler. */
export const verifyX: Verifier = async (secrets) => {
  const keys = keysFrom(secrets);
  const json = await requestJson("X", ME_URL, {
    method: "GET",
    headers: { authorization: oauth1Header("GET", ME_URL, keys) },
  });
  const data = json.data as { username?: string; name?: string } | undefined;
  if (!data?.username) throw new Error("X hesabı okunamadı");
  return `@${data.username}`;
};
