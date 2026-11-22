import { socialPlatformFromUrl } from "../components/common/socialIcons";
import { BRAND_SOCIAL_LINKS } from "../seo/brandSocialLinks.mjs";

/**
 * Markanın resmi sosyal medya profilleri (alt bilgi + Organization sameAs).
 *
 * Yönetim panelinden girilen liste eksik ya da yanlış olabiliyor (canlıda Facebook yoktu,
 * LinkedIn kişisel profile gidiyordu). Aynı ağ için BURADAKİ adres geçerlidir; panelde başka
 * bir ağ (ör. GitHub) varsa korunur.
 */
export { BRAND_SOCIAL_LINKS };

export function resolveSocialLinks(configured: readonly string[] | undefined): string[] {
  const owned = new Set(BRAND_SOCIAL_LINKS.map(socialPlatformFromUrl));
  const extras = (configured ?? []).filter((url) => !owned.has(socialPlatformFromUrl(url)));
  return [...BRAND_SOCIAL_LINKS, ...extras];
}
