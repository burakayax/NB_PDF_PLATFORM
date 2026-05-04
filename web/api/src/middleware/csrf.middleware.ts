import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

function allowedOrigins(): Set<string> {
  const normalize = (o: string) => o.replace(/\/$/, "");
  const primary = normalize(env.FRONTEND_ORIGIN);
  const set = new Set<string>([primary]);
  try {
    const u = new URL(primary);
    if (u.hostname === "localhost") { u.hostname = "127.0.0.1"; set.add(u.origin); }
    else if (u.hostname === "127.0.0.1") { u.hostname = "localhost"; set.add(u.origin); }
  } catch { /* ignore */ }
  const oauth = normalize(env.OAUTH_FRONTEND_REDIRECT_ORIGIN);
  if (oauth && oauth !== primary) {
    set.add(oauth);
    try {
      const u = new URL(oauth);
      if (u.hostname === "localhost") { u.hostname = "127.0.0.1"; set.add(u.origin); }
      else if (u.hostname === "127.0.0.1") { u.hostname = "localhost"; set.add(u.origin); }
    } catch { /* ignore */ }
  }
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
