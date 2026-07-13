/**
 * Üretimde hafif caydırıcılar (sağ tık / yaygın devTOOLS kısayolları).
 * Gerçek güvenlik değildir; her zaman atlanabilir.
 */
export function installProductionGuards(): void {
  if (!import.meta.env.PROD) {
    return;
  }

  const blockContextMenu = import.meta.env.VITE_BLOCK_CONTEXT_MENU !== "false";
  if (blockContextMenu) {
    document.addEventListener(
      "contextmenu",
      (e) => {
        e.preventDefault();
      },
      { capture: true },
    );
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "F12") {
        e.preventDefault();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (e.shiftKey && mod && (e.key === "I" || e.key === "J")) {
        e.preventDefault();
      }
    },
    { capture: true },
  );
}

/**
 * Yeni sürüm dağıtıldığında, arka planda açık kalmış eski sekme yeni bir lazy chunk
 * istediğinde eski hash'li dosya sunucuda artık bulunmaz (404) ve uygulama "buga girip"
 * boş/eski ekran gösterir. Vite bunu `vite:preloadError` ile bildirir; burada oturum
 * başına TEK bir reload ile taze index.html + güncel chunk'lara geçeriz. sessionStorage
 * guard'ı sonsuz yeniden yükleme döngüsünü önler (ör. gerçekten ağ koptuysa).
 */
export function installChunkReloadGuard(): void {
  const KEY = "nbpdf-chunk-reloaded";
  window.addEventListener("vite:preloadError", (event) => {
    if (sessionStorage.getItem(KEY)) {
      return; // bu oturumda zaten bir kez denedik → döngüye girme
    }
    event.preventDefault();
    sessionStorage.setItem(KEY, "1");
    window.location.reload();
  });
}
