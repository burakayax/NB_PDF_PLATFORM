import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

/**
 * React.lazy'nin sertleştirilmiş sürümü.
 *
 * Sentry'de görülen `Cannot read properties of undefined (reading 'default')`
 * hatası, bir lazy chunk'ın YÜKLENEMEMESİ veya beklenen `default` export olmadan
 * dönmesi durumunda React.lazy'nin iç kodunda (`_result.default`) patlamasından
 * kaynaklanır. Tipik tetikleyici: YENİ DEPLOY sonrası kullanıcının açık eski
 * sekmesinin artık var olmayan chunk hash'ini çekmesi.
 *
 * Bu sarmalayıcı:
 *  - Modül şeklini doğrular (default yoksa net hata → belirsiz React crash'i yerine).
 *  - Chunk/yükleme hatasında GÜNCEL bundle'ı almak için sert yenileme yapar.
 *
 * DÖNGÜ GÜVENLİĞİ: Yenileme zaman damgasıyla kısıtlanır — cooldown içinde ikinci
 * bir otomatik yenileme YAPILMAZ (aksi halde bir chunk sürekli hata verirken
 * diğerleri başarılı olursa sonsuz reload oluşurdu). Cooldown geçtikten sonra
 * (gerçekten yeni bir deploy geçişinde) tekrar bir kez yenilemeye izin verilir.
 */
const RELOAD_TS_KEY = "nb_lazy_reload_ts";
const RELOAD_COOLDOWN_MS = 15000;

export function lazyWithRetry<
  // React.lazy'nin kendi imzası gibi: bileşen prop'ları çeşitli olduğundan `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends ComponentType<any>,
>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      if (!mod || typeof (mod as { default?: unknown }).default === "undefined") {
        throw new Error("Lazy modül geçerli bir default export ile dönmedi.");
      }
      return mod;
    } catch (err) {
      try {
        if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
          const last = Number(sessionStorage.getItem(RELOAD_TS_KEY) || "0");
          // Yalnızca son yenilemeden bu yana cooldown geçtiyse yenile → döngü yok.
          if (!Number.isFinite(last) || Date.now() - last > RELOAD_COOLDOWN_MS) {
            sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
            window.location.reload();
            // Yenileme gerçekleşene dek Suspense fallback'te kal (crash gösterme).
            return await new Promise<never>(() => {});
          }
        }
      } catch {
        /* sessionStorage/reload kullanılamıyor → aşağıda hatayı yükselt */
      }
      throw err;
    }
  });
}
