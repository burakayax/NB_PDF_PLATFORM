import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import {
  getSpaHrefServerSnapshot,
  getSpaHrefSnapshot,
  subscribeSpaHref,
} from "../lib/spaHrefSync";
import { getGaMeasurementId, initializeGA, trackGAPageView } from "../lib/analytics";

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
    const pagePath = hrefFromHistory || `${routerLocation.pathname}${routerLocation.search}`;
    const tick = window.requestAnimationFrame(() => {
      trackGAPageView(pagePath, document.title);
    });
    return () => window.cancelAnimationFrame(tick);
  }, [enabled, hrefFromHistory, routerLocation.key, routerLocation.pathname, routerLocation.search]);
}
