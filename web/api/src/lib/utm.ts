/**
 * Kampanya etiketi (UTM) ekleme.
 *
 * Sosyal medya ve e-posta bağlantılarına kaynak bilgisi eklenir; Google Analytics
 * ziyaretçinin hangi paylaşımdan/e-postadan geldiğini ayırt edebilir. Adreste
 * zaten `utm_source` varsa dokunulmaz (elle girilmiş etiket ezilmez).
 */

export type UtmTags = {
  source: string;
  medium: string;
  campaign: string;
};

/** Sosyal ağ → GA4 kaynak adı. Medium her zaman `social`. */
const SOCIAL_SOURCE: Record<string, string> = {
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  LINKEDIN: "linkedin",
  X: "x",
  PINTEREST: "pinterest",
  YOUTUBE: "youtube",
};

export function socialUtm(platform: string, campaign: string): UtmTags {
  return {
    source: SOCIAL_SOURCE[platform] ?? platform.toLowerCase(),
    medium: "social",
    campaign,
  };
}

export function emailUtm(campaign: string): UtmTags {
  return { source: "email", medium: "email", campaign };
}

export function withUtm(url: string, tags: UtmTags): string {
  if (!url) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Göreli yol (ör. "/workspace?upgrade=1") — sahte bir kök ile ayrıştırıp yalnızca yolu geri ver.
    if (!url.startsWith("/")) return url;
    try {
      parsed = new URL(url, "https://placeholder.invalid");
    } catch {
      return url;
    }
    if (parsed.searchParams.has("utm_source")) return url;
    parsed.searchParams.set("utm_source", tags.source);
    parsed.searchParams.set("utm_medium", tags.medium);
    parsed.searchParams.set("utm_campaign", tags.campaign);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  if (parsed.searchParams.has("utm_source")) return url;
  parsed.searchParams.set("utm_source", tags.source);
  parsed.searchParams.set("utm_medium", tags.medium);
  parsed.searchParams.set("utm_campaign", tags.campaign);
  return parsed.toString();
}
