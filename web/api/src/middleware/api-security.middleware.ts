import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { verifyAccessToken } from "../lib/jwt.js";
import { logSuspiciousActivity } from "../lib/app-logger.js";
import { appendLogLine } from "../lib/file-log.js";
import { resolveRoleFromEmail } from "../lib/role-policy.js";
import {
  apiRateLimitForRequest,
  getApiSecurityResolved,
  logicalApiPath,
  rateLimitCountsTowardAbuseBlock,
  rateLimitTierForRequest,
} from "../lib/api-security-settings.js";
import { requireAuth } from "./auth.middleware.js";

/** Express req.ip / socket; proxy güvenilirse X-Forwarded-For ile uyumludur. */
export function getClientIp(request: Request): string {
  const raw = request.ip || request.socket?.remoteAddress || "";
  return String(raw).replace(/^::ffff:/, "") || "unknown";
}

/** Bearer JWT ile gelen gerçek ADMIN istekleri dakikalık limitten muaf (panel / geliştirme). */
async function requestHasAdminBearer(request: Request): Promise<boolean> {
  const header = request.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    return false;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return false;
  }
  try {
    const payload = verifyAccessToken(token);
    return resolveRoleFromEmail(payload.email) === "ADMIN";
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Redis-backed abuse store (falls back to in-memory when REDIS_URL is not set)
// ══════════════════════════════════════════════════════════════════════════════

const ABUSE_VIOLATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REDIS_KEY_PREFIX = "abuse:";

// Lazy Redis client — initialised once on first use.
let _redisClient: any = null;
let _redisAvailable: boolean | null = null;

async function getRedis(): Promise<any | null> {
  if (_redisAvailable === false) return null;
  if (_redisClient !== null) return _redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    _redisAvailable = false;
    return null;
  }

  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: redisUrl });
    client.on("error", (err: Error) => {
      appendLogLine(JSON.stringify({ ts: new Date().toISOString(), kind: "security", level: "warn", message: "abuse-store Redis error", detail: err.message }));
    });
    await client.connect();
    _redisClient = client;
    _redisAvailable = true;
    appendLogLine(JSON.stringify({ ts: new Date().toISOString(), kind: "startup", level: "info", message: "abuse-store Redis connected — abuse tracking is persistent" }));
    return _redisClient;
  } catch (err: any) {
    _redisAvailable = false;
    appendLogLine(JSON.stringify({ ts: new Date().toISOString(), kind: "startup", level: "warn", message: "abuse-store Redis unavailable — falling back to in-memory abuse tracking", detail: err?.message }));
    return null;
  }
}

// ─── In-memory fallback ────────────────────────────────────────────────────────

type AbuseState = {
  rateLimitHits: number;
  windowStart: number;
  blockedUntil: number;
};

const abuseByIp = new Map<string, AbuseState>();

function pruneAbuseMap() {
  if (abuseByIp.size < 5000) return;
  const now = Date.now();
  for (const [ip, s] of abuseByIp) {
    if (s.blockedUntil < now && now - s.windowStart > ABUSE_VIOLATION_WINDOW_MS) {
      abuseByIp.delete(ip);
    }
  }
}

// ─── Storage abstraction ───────────────────────────────────────────────────────

async function readAbuseState(ip: string): Promise<AbuseState | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      const raw = await redis.get(`${REDIS_KEY_PREFIX}${ip}`);
      if (!raw) return null;
      return JSON.parse(raw) as AbuseState;
    } catch {
      // Redis read failure — degrade to in-memory
    }
  }
  return abuseByIp.get(ip) ?? null;
}

async function writeAbuseState(ip: string, state: AbuseState): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      // Keep the Redis key alive for 2× the violation window so it auto-expires.
      const ttlSeconds = Math.ceil((ABUSE_VIOLATION_WINDOW_MS * 2) / 1000);
      await redis.set(`${REDIS_KEY_PREFIX}${ip}`, JSON.stringify(state), { EX: ttlSeconds });
      return;
    } catch {
      // Redis write failure — fall through to in-memory
    }
  }
  pruneAbuseMap();
  abuseByIp.set(ip, state);
}

async function readBlockedUntil(ip: string): Promise<number> {
  const s = await readAbuseState(ip);
  return s?.blockedUntil ?? 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public abuse tracking API
// ═══════════════════════════════════════════════════════════════════════════════

async function recordRateLimitViolation(ip: string, abuseThreshold: number, abuseBlockMinutes: number) {
  const now = Date.now();
  let s = await readAbuseState(ip);
  if (!s || now - s.windowStart > ABUSE_VIOLATION_WINDOW_MS) {
    s = { rateLimitHits: 0, windowStart: now, blockedUntil: 0 };
  }
  s.rateLimitHits += 1;
  if (s.rateLimitHits >= abuseThreshold) {
    s.blockedUntil = now + abuseBlockMinutes * 60 * 1000;
    logSuspiciousActivity({
      type: "ip_blocked",
      ip,
      detail: `rate_limit_hits=${s.rateLimitHits} window_hours=1`,
    });
  }
  await writeAbuseState(ip, s);
}

/** Tekrarlı rate limit ihlallerinden sonra IP geçici blok. */
export async function abuseBlockMiddleware(request: Request, response: Response, next: NextFunction) {
  const ip = getClientIp(request);
  const blockedUntil = await readBlockedUntil(ip);
  const now = Date.now();
  if (blockedUntil > now) {
    logSuspiciousActivity({
      type: "blocked_request",
      ip,
      path: request.originalUrl?.split("?")[0],
      method: request.method,
      detail: "abuse_block_active",
    });
    response.status(429).json({ message: "Too many requests. Try again later." });
    return;
  }
  next();
}

export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  skip: async (request) => requestHasAdminBearer(request),
  limit: async (req) => {
    const cfg = await getApiSecurityResolved();
    return apiRateLimitForRequest(req, cfg);
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${getClientIp(req)}:${rateLimitTierForRequest(req)}`,
  message: { message: "Too many requests from this IP. Please try again shortly." },
  handler: async (request, response, _next, options) => {
    const cfg = await getApiSecurityResolved();
    const ip = getClientIp(request);
    logSuspiciousActivity({
      type: "rate_limit_exceeded",
      ip,
      path: request.originalUrl?.split("?")[0],
      method: request.method,
      userAgent: request.headers["user-agent"] as string | undefined,
      detail: `limit=${options.limit}`,
    });
    if (rateLimitCountsTowardAbuseBlock(request)) {
      await recordRateLimitViolation(ip, cfg.abuseThreshold, cfg.abuseBlockMinutes);
    }
    response.status(options.statusCode ?? 429).json(options.message ?? { message: "Too many requests." });
  },
});

/** iyzico callback uçları için ayrı rate limit: 60 istek/dakika/IP (HMAC doğrulaması CPU'ya pahalı). */
export const paymentCallbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { message: "Too many payment callback requests. Try again shortly." },
});

/** Kimlik gerektirmeyen uçlar (auth akışı, sağlık, plan listesi, iletişim). */
export function isPublicApiPath(method: string, path: string): boolean {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/health") return true;
  if (p === "/subscription/plans" && method === "GET") return true;
  if (p.startsWith("/public/") && method === "GET") return true;
  if (p === "/analytics/page-view" && method === "POST") return true;
  if (p === "/contact" && method === "POST") return true;
  if (p.startsWith("/auth/")) {
    if (p === "/auth/register" && method === "POST") return true;
    if (p === "/auth/login" && method === "POST") return true;
    if (p === "/auth/refresh" && method === "POST") return true;
    if (p === "/auth/logout" && method === "POST") return true;
    if (p === "/auth/google" && method === "GET") return true;
    if (p === "/auth/google/callback" && method === "GET") return true;
    if (p === "/auth/verify-email" && method === "GET") return true;
    if (p.startsWith("/auth/forgot-password/") && method === "POST") return true;
  }
  if (p === "/payment/callback" && method === "POST") return true;
  if (p === "/payments/callback" && method === "POST") return true;
  if (p === "/payments/pricing" && method === "GET") return true;
  if (p === "/team/invite/preview" && method === "GET") return true;
  return false;
}

/**
 * /api altında JWT zorunluluğu; istisnalar `isPublicApiPath` ile.
 * Sıra: abuseBlock → globalApiLimiter → requireJwtUnlessPublic → rotalar.
 */
export function requireJwtUnlessPublic(request: Request, response: Response, next: NextFunction) {
  const path = logicalApiPath(request);
  if (isPublicApiPath(request.method, path)) {
    next();
    return;
  }
  requireAuth(request, response, next);
}
