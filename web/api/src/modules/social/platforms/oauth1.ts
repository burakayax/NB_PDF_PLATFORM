/**
 * OAuth 1.0a imzalama — yalnızca X (Twitter) için gerekli.
 *
 * X'in medya yükleme ucu hâlâ OAuth 1.0a istiyor; kütüphane eklemek yerine
 * imza burada üretiliyor (HMAC-SHA1, Node'un kendi crypto modülüyle).
 */

import { createHmac, randomBytes } from "node:crypto";

export type OAuth1Keys = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
};

/** RFC 3986 — OAuth imzası, encodeURIComponent'in bıraktığı karakterleri de ister. */
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Authorization başlığını üretir.
 *
 * NOT: İmza tabanına yalnızca sorgu dizesi parametreleri ve OAuth alanları
 * girer. Gövde JSON veya multipart olduğunda gövde imzaya KATILMAZ — X'in
 * beklediği davranış budur.
 */
export function oauth1Header(
  method: string,
  url: string,
  keys: OAuth1Keys,
  extraParams: Record<string, string> = {},
): string {
  const parsed = new URL(url);
  const baseUrl = `${parsed.origin}${parsed.pathname}`;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: keys.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: keys.accessToken,
    oauth_version: "1.0",
  };

  const allParams: Record<string, string> = { ...oauthParams, ...extraParams };
  parsed.searchParams.forEach((v, k) => {
    allParams[k] = v;
  });

  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(allParams[k] ?? "")}`)
    .join("&");

  const baseString = [method.toUpperCase(), rfc3986(baseUrl), rfc3986(paramString)].join("&");
  const signingKey = `${rfc3986(keys.apiSecret)}&${rfc3986(keys.accessSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");

  const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature };
  return `OAuth ${Object.keys(headerParams)
    .sort()
    .map((k) => `${rfc3986(k)}="${rfc3986(headerParams[k] ?? "")}"`)
    .join(", ")}`;
}
