import { envHttpUrlIsLoopback, isNonLocalDeployedHost } from "../lib/runtimeApiOrigin";

/**
 * SaaS (Express) API tabanı: önce `NEXT_PUBLIC_API_URL` (.env.local / üretim),
 * yoksa `VITE_SAAS_API_BASE` (geriye dönük uyumluluk).
 */
function readSaasApiBaseFromEnv(): string {
  const next = typeof import.meta.env.NEXT_PUBLIC_API_URL === "string" ? import.meta.env.NEXT_PUBLIC_API_URL.trim() : "";
  const vite = typeof import.meta.env.VITE_SAAS_API_BASE === "string" ? import.meta.env.VITE_SAAS_API_BASE.trim() : "";
  return next || vite;
}

/**
 * Kimlik ve SaaS API (Express, varsayılan :4000) kök adresi.
 * - Geliştirmede `http://localhost:4000` / `127.0.0.1:4000` gibi yerel adresler yok sayılır → göreli `/api/...` (Vite proxy).
 *   Aksi halde tarayıcı doğrudan :4000’e gider; UI API’den önce açılınca sıkça ERR_CONNECTION_REFUSED olur.
 * - Uzak veya özel adres (ör. staging URL) geliştirmede de kullanılır.
 * - Üretimde boşsa veya gerçek hostta localhost gömülüyse → göreli `/api/...` (aynı origin).
 */
function isLocalhostSaasDevUrl(trimmed: string): boolean {
  try {
    const u = new URL(trimmed);
    const h = u.hostname;
    if (h !== "localhost" && h !== "127.0.0.1") {
      return false;
    }
    const p = u.port;
    return p === "" || p === "4000";
  } catch {
    return false;
  }
}

/** localhost/127.0.0.1 (herhangi bir port) — dev veya `vite preview`. */
function isLocalBrowserHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

export function getSaasApiBase(): string {
  const trimmed = readSaasApiBaseFromEnv();

  const useRemoteSaasInDev = import.meta.env.VITE_USE_REMOTE_SAAS_IN_DEV === "true";

  // Yerel tarayıcıda (dev VE `vite preview`) her zaman göreli `/api` → Vite proxy hedefe iletir.
  // Üretim derlemesine gömülü mutlak API URL'si (ör. onrender) burada CORS'a takılırdı;
  // göreli istek preview proxy (vite.config preview.proxy) üzerinden gider, CORS olmaz.
  // Uzaktaki API'yi yerelde test etmek için açıkça VITE_USE_REMOTE_SAAS_IN_DEV=true gerekir.
  if (isLocalBrowserHost() && !useRemoteSaasInDev) {
    return "";
  }

  /**
   * Yerel UI (localhost) iken frontend .env’de üretim API adresi gömülü olabilir — Google OAuth
   * zinciri o zaman üretim sunucuya gider ve yönlendirme üretim SPA’ya çıkar (web/api/.env değişse bile).
   * Varsayılan: dev’de Vite `/api` proxy → yerel kimlik API. Uzaktaki API ile test için açıkça
   * VITE_USE_REMOTE_SAAS_IN_DEV=true kullanın.
   */
  if (
    import.meta.env.DEV &&
    !useRemoteSaasInDev &&
    trimmed !== "" &&
    !isLocalhostSaasDevUrl(trimmed) &&
    typeof window !== "undefined"
  ) {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      if (import.meta.env.DEV) {
        console.warn(
          "[saasBase] Yerel SPA üzerinden uzaktaki SaaS tabanı yüklü:",
          trimmed,
          "→ Yerel kimlik/API için göreli /api kullanılıyor. Üretim API’sine doğrudan erişim için frontend .env’de VITE_USE_REMOTE_SAAS_IN_DEV=true yazın.",
        );
      }
      return "";
    }
  }

  if (import.meta.env.DEV && (trimmed === "" || isLocalhostSaasDevUrl(trimmed))) {
    return "";
  }

  if (trimmed !== "") {
    if (import.meta.env.PROD && isNonLocalDeployedHost() && envHttpUrlIsLoopback(trimmed)) {
      return "";
    }
    return trimmed.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "";
  }
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    const p = window.location.port;
    if ((h === "localhost" || h === "127.0.0.1") && p === "4173") {
      return "";
    }
  }
  return "";
}
