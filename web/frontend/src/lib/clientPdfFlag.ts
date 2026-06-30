/**
 * Client-side PDF işleme — "dark launch" bayrağı ve yetenek tablosu.
 *
 * Bayrak VARSAYILAN KAPALI: yalnızca `?clientpdf=1` ile açılır (ve localStorage'a
 * yazılır, kalıcı). `?clientpdf=0` kapatır. Böylece özellik canlıya alınsa bile
 * gerçek kullanıcılar görmez; yalnızca bayrağı açan (geliştirme/test) tarayıcı-içi
 * işlemeyi dener. Herkese açma kararı verilince bu bayrak kaldırılır/varsayılan
 * açılır.
 */

// Dosya-listesi araçları (sayfa-durumu gerektirmeyen) — GuestToolCore.
const CLIENT_PDF_TOOLS = new Set<string>(["merge", "image-to-pdf"]);

// Sayfa-seviyeli (thumbnail grid) misafir araçları — GuestPageTool.
const GUEST_PAGE_TOOLS = new Set<string>([
  "rotate-pdf",
  "delete-pages",
  "organize-pdf",
  "split",
]);

/** Misafirde grid'li sayfa aracı olarak çalışır mı (döndür/sil/düzenle)? */
export function isGuestPageTool(id: string): boolean {
  return GUEST_PAGE_TOOLS.has(id);
}

/** Giriş yapan workspace'te de client-side (cihazda) işlenebilen yapısal araçlar
 * — sunucuya gitmez, günlük limite saymaz. Birleştir + görsel→PDF + döndür/sil/
 * düzenle. (Guest routing'i bozmamak için isClientCapableTool'dan AYRI.) */
export function isWorkspaceClientTool(id: string): boolean {
  return CLIENT_PDF_TOOLS.has(id) || GUEST_PAGE_TOOLS.has(id);
}

/** Mobil bellek koruması: bu boyutun üstü sunucu yoluna düşer. */
export const CLIENT_PDF_MAX_BYTES = 80 * 1024 * 1024; // 80 MB

export function isClientCapableTool(id: string): boolean {
  return CLIENT_PDF_TOOLS.has(id);
}

export function isClientPdfEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = new URLSearchParams(window.location.search).get("clientpdf");
    if (v === "1") {
      window.localStorage.setItem("nb_clientpdf", "1");
      return true;
    }
    if (v === "0") {
      window.localStorage.removeItem("nb_clientpdf");
      return false;
    }
    return window.localStorage.getItem("nb_clientpdf") === "1";
  } catch {
    return false;
  }
}
