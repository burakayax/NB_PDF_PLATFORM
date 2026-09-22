import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import {
  getSpaHrefServerSnapshot,
  getSpaHrefSnapshot,
  subscribeSpaHref,
} from "../lib/spaHrefSync";
import { getGaMeasurementId, initializeGA, trackGAPageView } from "../lib/analytics";

/**
 * Adres yolundaki GİZLİ parametreleri ölçüm verisinden ayıklar.
 *
 * NEDEN: Google ile giriş sonrası kullanıcı `/login-success?token=<erişim
 * anahtarı>` adresine düşüyor. Sayfa görüntüleme olayı adresi sorgu kısmıyla
 * birlikte gönderdiği için bu anahtar Google Analytics'e — yani üçüncü bir
 * tarafa — gidiyordu. Anahtarı ele geçiren biri, süresi dolana kadar hesabı
 * kullanabilir. Ölçüm için parametrenin VARLIĞI yeterli; DEĞERİ asla gerekmez.
 */
const GIZLI_PARAMETRELER = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "sessionid",
  "session_id",
  "email",
  "password",
  "apikey",
  "api_key",
  "secret",
]);

export function gizliParametreleriAyikla(yol: string): string {
  const soruIsareti = yol.indexOf("?");
  if (soruIsareti === -1) return yol;

  const taban = yol.slice(0, soruIsareti);
  const params = new URLSearchParams(yol.slice(soruIsareti + 1));
  let degisti = false;
  for (const anahtar of Array.from(params.keys())) {
    if (GIZLI_PARAMETRELER.has(anahtar.toLowerCase())) {
      params.set(anahtar, "gizlendi");
      degisti = true;
    }
  }
  if (!degisti) return yol;
  const kalan = params.toString();
  return kalan ? `${taban}?${kalan}` : taban;
}

type UseGAPageTrackingOptions = {
  /** Çerez onayı / test bayrağı — false iken hiçbir şey gönderilmez. */
  enabled: boolean;
};

/**
 * GA4: `useLocation` (React Router) + yerel `history` yamaları ile her SPA geçişinde `page_view`.
 * Uygulama `history.replaceState` kullandığı için yalnızca Router yeterli olmaz; `spaHrefSync` eklenir.
 */
export function useGAPageTracking({ enabled }: UseGAPageTrackingOptions) {
  const routerLocation = useLocation();
  const hrefFromHistory = useSyncExternalStore(
    subscribeSpaHref,
    getSpaHrefSnapshot,
    getSpaHrefServerSnapshot,
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (!getGaMeasurementId()) {
      return;
    }
    initializeGA();
    const pagePath = gizliParametreleriAyikla(
      hrefFromHistory || `${routerLocation.pathname}${routerLocation.search}`,
    );
    const tick = window.requestAnimationFrame(() => {
      trackGAPageView(pagePath, document.title);
    });
    return () => window.cancelAnimationFrame(tick);
  }, [enabled, hrefFromHistory, routerLocation.key, routerLocation.pathname, routerLocation.search]);
}
