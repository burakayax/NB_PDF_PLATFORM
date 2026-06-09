// Service Worker'ı tembel (window load sonrası) kaydeder ve güncelleme akışını yönetir.
// Yalnızca üretimde çalışır: dev'de cache-first varlık stratejisi Vite HMR'ı bozar.

type UpdateCallback = (apply: () => void) => void;

let refreshing = false;

/**
 * @param onUpdateAvailable Yeni bir SW kuruldu ve beklemede; `apply()` çağrısı onu etkinleştirip sayfayı yeniler.
 */
export function registerServiceWorker(onUpdateAvailable?: UpdateCallback): void {
  if (!import.meta.env.PROD) {
    return;
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Yeni SW etkin olunca (skipWaiting sonrası) sayfayı bir kez yenile.
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) {
            return;
          }
          refreshing = true;
          window.location.reload();
        });

        const notify = (worker: ServiceWorker | null) => {
          if (!worker) {
            return;
          }
          // Yalnızca halihazırda kontrol eden bir SW varsa "güncelleme" anlamlıdır
          // (ilk kuruluşta controller null'dur → güncelleme bildirimi gösterme).
          if (navigator.serviceWorker.controller && onUpdateAvailable) {
            onUpdateAvailable(() => {
              worker.postMessage({ type: "SKIP_WAITING" });
            });
          }
        };

        // Kayıt anında zaten beklemede bir SW olabilir.
        if (registration.waiting) {
          notify(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed") {
              notify(registration.waiting ?? installing);
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[pwa] Service Worker kaydı başarısız:", err);
      });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
