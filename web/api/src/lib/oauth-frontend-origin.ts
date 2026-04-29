import { env } from "../config/env.js";

/** Güvenilir OAuth sonrası yönlendirme kökleri (tam origin string). */
function collectTrustedOrigins(): Set<string> {
  const set = new Set<string>();
  const push = (raw: string) => {
    try {
      set.add(new URL(raw.trim()).origin);
    } catch {
      /* skip */
    }
  };
  push(env.FRONTEND_ORIGIN);
  push(env.OAUTH_FRONTEND_REDIRECT_ORIGIN);
  push(env.APP_BASE_URL);
  for (const s of env.oauthAllowedRedirectOrigins ?? []) {
    push(s);
  }
  return set;
}

export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function developmentLoopbackCandidate(candidate: string): boolean {
  try {
    const url = new URL(candidate.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    return isLoopbackHostname(url.hostname);
  } catch {
    return false;
  }
}

/**
 * GET /api/auth/google?frontend_origin= — development’ta loopback SPA köklerini güvenilir kabul et
 * (çoğu zaman localhost .env doğru da istek üretime gidebilir; callback yine doğru hosta gönderilsin).
 */
export function acceptOAuthFrontendOriginFromRequest(candidate: string): boolean {
  const c = candidate.trim();
  if (!c) {
    return false;
  }
  if (env.NODE_ENV === "development" && developmentLoopbackCandidate(c)) {
    return true;
  }
  return isTrustedOAuthFrontendOrigin(c);
}

/**
 * SPA'nın gönderdiği `frontend_origin` güvenliyse kullanılabilir (open redirect önlenir).
 * Node env veya `OAUTH_ALLOW_LOOPBACK_REDIRECTS` ile localhost/127.0.0.1:any port için izin.
 */
export function isTrustedOAuthFrontendOrigin(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  const candidateOrigin = url.origin;

  const trusted = collectTrustedOrigins();
  if (trusted.has(candidateOrigin)) {
    return true;
  }

  if (
    env.oauthAllowLoopbackRedirects &&
    isLoopbackHostname(url.hostname) &&
    (url.protocol === "http:" || url.protocol === "https:")
  ) {
    return true;
  }

  return false;
}

/**
 * Google callback sonrası /login-success|login-error için kullanılacak SPA kökü.
 * development: önce cookie’deki loopback `frontend_origin`, yoksa `OAUTH_FRONTEND_REDIRECT_ORIGIN`.
 * production: yalnızca güven listesi + allowlist.
 */
export function resolveOAuthSpaRedirectBase(frontendOriginRaw: string | null | undefined): string {
  const fallback = env.OAUTH_FRONTEND_REDIRECT_ORIGIN.replace(/\/$/, "");

  if (env.NODE_ENV === "development") {
    const raw = frontendOriginRaw?.trim();
    if (raw && developmentLoopbackCandidate(raw)) {
      try {
        return new URL(raw).origin;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  if (frontendOriginRaw && isTrustedOAuthFrontendOrigin(frontendOriginRaw)) {
    return frontendOriginRaw.replace(/\/$/, "");
  }
  return fallback;
}
