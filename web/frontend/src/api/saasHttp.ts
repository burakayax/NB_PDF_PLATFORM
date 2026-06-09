import { getSaasApiBase } from "./saasBase";

/**
 * Express (SaaS) API için merkezi istemci tabanı.
 * `getSaasApiBase()` → `NEXT_PUBLIC_API_URL` veya `VITE_SAAS_API_BASE` (bkz. saasBase.ts).
 *
 * `path` her zaman `/api/...` ile başlamalıdır (örn. `/api/auth/login`).
 */
export function buildSaasApiUrl(path: string): string {
  const base = getSaasApiBase().replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (base === "") {
    return normalized;
  }
  return `${base}${normalized}`;
}

function saasNetworkFailureMessage(): string {
  return import.meta.env.DEV
    ? "Kimlik API (port 4000) yanıt vermiyor. Proje kökünde veya `web/api` içinde API’yi başlatın. Geliştirmede `web/frontend/.env` içinde tabanı boş bırakın (Vite proxy kullanılır)."
    : "API sunucusuna ulaşılamıyor. NEXT_PUBLIC_API_URL / VITE_SAAS_API_BASE ve dağıtım adresini kontrol edin.";
}

/**
 * SaaS API’ye `fetch`; geliştirmede kısa retry (proxy / API geç açılışı).
 * `credentials: "include"` varsayılan (çerez tabanlı oturum).
 *
 * `opts.timeoutMs` verilirse istek bu süre sonunda iptal edilir (AbortController).
 * Zaman aşımı olmadan takılan bir istek sonsuza kadar asılı kalır; bu özellikle
 * OAuth dönüşünde (`/login-success`) sonsuz spinner'a yol açar. İptal, ağ hatası
 * gibi ele alınır → çağıran yeniden deneyebilir.
 */
export async function saasFetch(
  path: string,
  init?: RequestInit,
  opts?: { timeoutMs?: number },
): Promise<Response> {
  const url = buildSaasApiUrl(path);
  const attempts = import.meta.env.DEV ? 10 : 1;
  const delayMs = 320;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    const controller = opts?.timeoutMs ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), opts!.timeoutMs)
      : null;
    try {
      const merged: RequestInit = {
        ...init,
        credentials: init?.credentials ?? "include",
        signal: controller ? controller.signal : init?.signal,
      };
      return await fetch(url, merged);
    } catch (e) {
      last = e;
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      const retryable =
        (e instanceof TypeError || isAbort) &&
        import.meta.env.DEV &&
        i < attempts - 1;
      if (retryable) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      if (e instanceof TypeError || isAbort) {
        throw new Error(saasNetworkFailureMessage());
      }
      throw e;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
  throw last instanceof Error ? last : new Error(saasNetworkFailureMessage());
}
