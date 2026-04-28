/**
 * Google Analytics 4 (gtag.js) — SPA sayfa görünümleri.
 * Çerez onayı (`useCookieConsent`) verilmeden script yüklenmez.
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_PLACEHOLDER = "G-XXXXXXXXXX";

function normalizeMeasurementId(raw: string | undefined): string | null {
  const id = raw?.trim() ?? "";
  if (!id || id === GA_PLACEHOLDER) {
    return null;
  }
  if (!/^G-[A-Z0-9]+$/i.test(id)) {
    return null;
  }
  return id;
}

export function getGaMeasurementId(): string | null {
  return normalizeMeasurementId(import.meta.env.VITE_GA_MEASUREMENT_ID);
}

let gaInitialized = false;

/** gtag.js ekler ve ilk config ile GA4’ü başlatır. Çoklu çağrıda yalnızca bir kez çalışır. */
export function initializeGA(): boolean {
  const id = getGaMeasurementId();
  if (!id || gaInitialized) {
    return gaInitialized;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };

  window.gtag("js", new Date());
  window.gtag("config", id);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);

  gaInitialized = true;
  return true;
}

/** SPA rota / sorgu değişiminde page_view gönderir (özellikle /tools/&lt;slug&gt;). */
export function trackGAPageView(pagePath: string, pageTitle?: string): void {
  const id = getGaMeasurementId();
  if (!id || typeof window.gtag !== "function") {
    return;
  }
  const payload: Record<string, string> = {
    page_path: pagePath.startsWith("/") ? pagePath : `/${pagePath}`,
  };
  if (pageTitle?.trim()) {
    payload.page_title = pageTitle.trim();
  }
  window.gtag("config", id, payload);
}
