import { socialPlatformFromUrl } from "../components/common/socialIcons";

/**
 * Markanın resmi sosyal medya profilleri (alt bilgi + Organization sameAs).
 *
 * Yönetim panelinden girilen liste eksik ya da yanlış olabiliyor (canlıda Facebook yoktu,
 * LinkedIn kişisel profile gidiyordu). Aynı ağ için BURADAKİ adres geçerlidir; panelde başka
 * bir ağ (ör. GitHub) varsa korunur.
 */
export const BRAND_SOCIAL_LINKS: readonly string[] = [
  "https://www.instagram.com/pdfplatformapp",
  "https://www.facebook.com/pdfplatform",
  "https://x.com/pdfplatformapp",
  "https://www.linkedin.com/company/pdfplatform",
  "https://www.youtube.com/@pdfplatformapp",
  "https://www.tiktok.com/@pdfplatformapp",
  "https://tr.pinterest.com/pdfplatformapp",
];

export function resolveSocialLinks(configured: readonly string[] | undefined): string[] {
  const owned = new Set(BRAND_SOCIAL_LINKS.map(socialPlatformFromUrl));
  const extras = (configured ?? []).filter((url) => !owned.has(socialPlatformFromUrl(url)));
  return [...BRAND_SOCIAL_LINKS, ...extras];
}
