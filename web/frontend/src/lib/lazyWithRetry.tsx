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
 *  - Chunk/yükleme hatasında GÜNCEL bundle'ı almak için bir kez sert yenileme yapar
 *    (sessionStorage guard ile sonsuz döngü engellenir; başarılı yüklemede sıfırlanır).
 */
const RELOAD_GUARD_KEY = "nb_lazy_reload_once";

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
      // Başarılı → gelecekteki bir deploy geçişinde tekrar yenilemeye izin ver.
      try {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
      } catch {
        /* sessionStorage yoksa yoksay */
      }
      return mod;
    } catch (err) {
      try {
        if (
          typeof window !== "undefined" &&
          typeof sessionStorage !== "undefined" &&
          !sessionStorage.getItem(RELOAD_GUARD_KEY)
        ) {
          sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
          window.location.reload();
          // Yenileme gerçekleşene dek Suspense fallback'te kal (crash gösterme).
          return await new Promise<never>(() => {});
        }
      } catch {
        /* sessionStorage/reload kullanılamıyor → aşağıda hatayı yükselt */
      }
      throw err;
    }
  });
}
