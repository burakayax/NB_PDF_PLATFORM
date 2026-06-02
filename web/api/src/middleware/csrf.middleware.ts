import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

/** Bir origin'i ve varyantlarını (localhost↔127.0.0.1, apex↔www) sete ekler. */
function addOriginVariants(set: Set<string>, raw: string): void {
  const origin = raw.replace(/\/$/, "");
  if (!origin) return;
  set.add(origin);
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost") { const v = new URL(origin); v.hostname = "127.0.0.1"; set.add(v.origin); }
    else if (u.hostname === "127.0.0.1") { const v = new URL(origin); v.hostname = "localhost"; set.add(v.origin); }
    else {
      const v = new URL(origin);
      v.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
      set.add(v.origin);
    }
  } catch { /* ignore */ }
}

function allowedOrigins(): Set<string> {
  const set = new Set<string>();
  addOriginVariants(set, env.FRONTEND_ORIGIN);
  addOriginVariants(set, env.OAUTH_FRONTEND_REDIRECT_ORIGIN);
  return set;
}

/**
 * Validates Origin (or Referer fallback) for state-mutating requests on
 * cookie-dependent auth routes.  Non-browser callers (no Origin header) are
 * allowed in development and blocked in production unless they carry a valid
 * Authorization Bearer token (used by the desktop app).
 */
export function csrfOriginCheck(request: Request, response: Response, next: NextFunction): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    next();
    return;
  }

  const origin = request.headers["origin"] as string | undefined;
  const referer = request.headers["referer"] as string | undefined;

  // Desktop app / server-to-server calls send a Bearer token, not a cookie.
  // Allow them through — they are not susceptible to CSRF.
  const hasBearer = (request.headers["authorization"] ?? "").startsWith("Bearer ");
  if (hasBearer) {
    next();
    return;
  }

  // No Origin header in non-production → allow (curl, Postman, local tests)
  if (!origin && env.NODE_ENV !== "production") {
    next();
    return;
  }

  const origins = allowedOrigins();

  if (origin) {
    const normalized = origin.replace(/\/$/, "");
    if (origins.has(normalized)) {
      next();
      return;
    }
    response.status(403).json({ message: "CSRF check failed: origin not allowed." });
    return;
  }

  // Fallback: check Referer host
  if (referer) {
    try {
      const refUrl = new URL(referer);
      const refOrigin = refUrl.origin.replace(/\/$/, "");
      if (origins.has(refOrigin)) {
        next();
        return;
      }
    } catch { /* malformed referer */ }
  }

  // Production with no recognizable origin: reject
  response.status(403).json({ message: "CSRF check failed: missing or unrecognized origin." });
}
