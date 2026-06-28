/**
 * Client-side PDF işleme — "dark launch" bayrağı ve yetenek tablosu.
 *
 * Bayrak VARSAYILAN KAPALI: yalnızca `?clientpdf=1` ile açılır (ve localStorage'a
 * yazılır, kalıcı). `?clientpdf=0` kapatır. Böylece özellik canlıya alınsa bile
 * gerçek kullanıcılar görmez; yalnızca bayrağı açan (geliştirme/test) tarayıcı-içi
 * işlemeyi dener. Herkese açma kararı verilince bu bayrak kaldırılır/varsayılan
 * açılır.
 */

// Şimdilik pilot kapsam: yapısal araçlar (sayfa-durumu gerektirmeyenler).
const CLIENT_PDF_TOOLS = new Set<string>(["merge", "image-to-pdf"]);

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
