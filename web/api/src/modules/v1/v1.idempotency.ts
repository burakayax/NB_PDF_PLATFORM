import type { Request, Response, NextFunction } from "express";
import type { ApiUser } from "./v1.middleware.js";

/**
 * Idempotency-Key desteği (Stripe/IETF draft deseni): aynı anahtarla yinelenen POST
 * istekleri, ilk BAŞARILI yanıtı tekrar döndürür (çift ücretlendirme/işlem olmaz).
 * Sonuç yalnız 2xx'te önbelleğe alınır (başarısız doğrulama tekrar denenebilir).
 * Not: tek süreç (WEB_CONCURRENCY=1) için bellek-içi; 24 saat TTL, boyut sınırlı.
 */
type Entry = { status: number; body: unknown; expires: number };
const store = new Map<string, Entry>();
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 5000;

function prune(): void {
  const now = Date.now();
  for (const [k, v] of store) if (v.expires <= now) store.delete(k);
  if (store.size > MAX_ENTRIES) {
    const excess = store.size - MAX_ENTRIES;
    let i = 0;
    for (const k of store.keys()) { store.delete(k); if (++i >= excess) break; }
  }
}

export function idempotency(req: Request, res: Response, next: NextFunction): void {
  const key = req.header("Idempotency-Key");
  if (!key) return next();
  if (key.length > 255) return next(); // spec: 255 char sınırı

  const u = (res.locals as { apiUser?: ApiUser }).apiUser;
  const cacheKey = `${u?.id ?? "?"}:${req.method}:${req.path}:${key}`;

  const hit = store.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    res.setHeader("Idempotent-Replayed", "true");
    res.status(hit.status).json(hit.body);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (store.size >= MAX_ENTRIES) prune();
      store.set(cacheKey, { status: res.statusCode, body, expires: Date.now() + TTL_MS });
    }
    return originalJson(body);
  };
  next();
}
