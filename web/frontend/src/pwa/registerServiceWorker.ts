// Service Worker'ı tembel (window load sonrası) kaydeder ve güncelleme akışını yönetir.
// Yalnızca üretimde çalışır: dev'de cache-first varlık stratejisi Vite HMR'ı bozar.

type UpdateCallback = (apply: () => void) => void;

let refreshing = false;
// Kayıt anında zaten bir SW kontrol ediyor muydu? Varsa, controllerchange bir GÜNCELLEME
// demektir (yeni deploy) → sayfayı otomatik tazele. Controller yoksa bu İLK kuruluştur
// (activate→clients.claim); o durumda reload İSTEMİYORUZ (gereksiz sıfırlama olmasın).
let hadControllerAtStart = false;

/**
 * @param onUpdateAvailable Geriye dönük uyumluluk için tutulur; otomatik güncellemede
 *   artık kullanıcı onayı beklenmez, yeni sürüm kendiliğinden devreye girip sayfayı tazeler.
 */
export function registerServiceWorker(onUpdateAvailable?: UpdateCallback): void {
  if (!import.meta.env.PROD) {
    return;
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  hadControllerAtStart = !!navigator.serviceWorker.controller;

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // OTOMATIK GÜNCELLEME: yeni SW kontrolü ele aldığında (sw.js skipWaiting() çağırıp
        // activate olunca) sayfayı tek seferde tazele — ama yalnızca önceden bir controller
        // varsa (gerçek güncelleme). İlk kuruluşun claim'inde tazeleme YAPMA.
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!hadControllerAtStart || refreshing) {
            return;
          }
          refreshing = true;
          window.location.reload();
        });

        const notify = (worker: ServiceWorker | null) => {
          if (!worker) {
            return;
          }
          // Yeni SW zaten skipWaiting ile otomatik devreye giriyor; banner opsiyoneldir.
          // Yine de tüketici bir geri-çağırım verdiyse "hemen uygula" seçeneğini sunalım.
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
