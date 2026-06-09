import { useEffect, useState } from "react";
import { registerServiceWorker } from "./registerServiceWorker";

export interface PwaUpdateState {
  /** Yeni sürüm hazır, kullanıcı yenileyebilir. */
  updateReady: boolean;
  /** Yeni SW'yi etkinleştirir; controllerchange sonrası sayfa yenilenir. */
  applyUpdate: () => void;
}

/**
 * SW'yi kaydeder ve güncelleme hazır olduğunda durumu açar.
 * Uygulamada yalnızca bir kez (kök) çağrılmalı.
 */
export function usePwaUpdate(): PwaUpdateState {
  const [updateReady, setUpdateReady] = useState(false);
  const [apply, setApply] = useState<(() => void) | null>(null);

  useEffect(() => {
    registerServiceWorker((doApply) => {
      // setState'e fonksiyon geçişi: güncelleyici sanılmasın diye sarmala.
      setApply(() => doApply);
      setUpdateReady(true);
    });
  }, []);

  return {
    updateReady,
    applyUpdate: () => {
      apply?.();
    },
  };
}
