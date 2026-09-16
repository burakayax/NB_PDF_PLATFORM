/** Platform bağdaştırıcılarının ortak yardımcıları. */

import type { FeedItem, PublishResult } from "../social.types.js";

/** Bir gönderinin yayına gitmeden önceki tam hâli. */
export type PublishInput = {
  body: string;
  imageUrl: string | null;
  item: FeedItem;
  secrets: Record<string, string>;
};

export type Publisher = (input: PublishInput) => Promise<PublishResult>;

/**
 * Kayıtlı anahtarların ağ tarafından gerçekten kabul edildiğini sınar.
 *
 * SINIRI: yalnızca kimliğin geçerli olduğunu kanıtlar. Ağlar "bu anahtar
 * paylaşım da yapabilir mi" sorusunu ucuza cevaplayan bir uç sunmuyor; yazma
 * yetkisinin tek kesin kanıtı gerçek bir gönderidir. Dönen metin admin'e
 * gösterilir, bu yüzden hesap adı gibi tanınır bir bilgi içermeli.
 */
export type Verifier = (secrets: Record<string, string>) => Promise<string>;

const REQUEST_TIMEOUT_MS = 45_000;

/** Dış API hatalarını okunur tek satıra indirger (anahtar sızdırmadan). */
export class PlatformError extends Error {
  constructor(platform: string, status: number, detail: string) {
    super(`${platform} reddetti (HTTP ${status}): ${detail.slice(0, 400)}`);
    this.name = "PlatformError";
  }
}

export async function requestJson(
  platform: string,
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const text = await res.text();
  if (!res.ok) throw new PlatformError(platform, res.status, text);
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Görseli indirir — medya yüklemesi gereken platformlar için. */
export async function downloadImage(url: string): Promise<{ bytes: Buffer; mime: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Görsel indirilemedi (${res.status}): ${url}`);
  const mime = res.headers.get("content-type") ?? "image/png";
  return { bytes: Buffer.from(await res.arrayBuffer()), mime };
}

export function requireSecret(secrets: Record<string, string>, key: string, label: string): string {
  const value = secrets[key]?.trim();
  if (!value) throw new Error(`Eksik bilgi: ${label}`);
  return value;
}
