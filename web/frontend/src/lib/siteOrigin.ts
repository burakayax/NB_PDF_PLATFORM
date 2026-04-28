/**
 * Kamuya açık site kökü (kanonik, hreflang, JSON-LD URL).
 * Üretimde `VITE_PUBLIC_SITE_URL` veya `NEXT_PUBLIC_SITE_URL` ile APP_BASE_URL ile hizalanır.
 */
export function getPublicSiteOrigin(): string {
  const raw =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_PUBLIC_SITE_URL) ||
    (typeof import.meta !== "undefined" && import.meta.env?.NEXT_PUBLIC_SITE_URL) ||
    "";
  const trimmed = String(raw).trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}
