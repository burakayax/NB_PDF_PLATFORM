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
  readonly status: number;
  readonly detail: string;

  constructor(platform: string, status: number, detail: string) {
    super(`${platform} reddetti (HTTP ${status}): ${detail.slice(0, 400)}`);
    this.name = "PlatformError";
    this.status = status;
    this.detail = detail;
  }

  /**
   * Ret, anahtarların yanlış olmasından değil ödemeden mi kaynaklanıyor?
   *
   * NEDEN ÖNEMLİ: X Şubat 2026'da kullandıkça öde modeline geçti ve bakiye
   * bitince OKUMA isteklerini de engelliyor. Bunu ayırt etmezsek panel,
   * anahtarlar gayet doğruyken "bağlantı çalışmıyor" der ve admin saatlerce
   * yanlış yerde arar.
   */
  get looksLikeBilling(): boolean {
    if (this.status === 402) return true;
    if (this.status !== 401 && this.status !== 403 && this.status !== 429) return false;
    return /payment|billing|credit|balance|insufficient|quota|usage-cap|usage cap/i.test(this.detail);
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
