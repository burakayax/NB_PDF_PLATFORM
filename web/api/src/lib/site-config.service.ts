import { prisma } from "./prisma.js";
import { PACKAGES_RELATED_KEYS } from "./site-setting-keys.js";

const TTL_MS = 15_000;

type CacheEntry = { at: number; value: unknown };

const cache = new Map<string, CacheEntry>();

let invalidatePackagesMerged: (() => void) | null = null;

/** Allows packages-config module to clear its merged cache when any package key changes. */
export function registerPackagesMergedInvalidator(fn: () => void) {
  invalidatePackagesMerged = fn;
}

function bumpCache(key: string, value: unknown) {
  cache.set(key, { at: Date.now(), value });
}

/**
 * Read a JSON SiteSetting value with in-memory cache.
 * Returns `null` if the row is missing or empty.
 */
/** Read current DB value without in-memory cache (for admin audit / revision capture). */
export async function getSettingDirect(key: string): Promise<unknown | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  if (!row?.value?.trim()) {
    return null;
  }
  try {
    return JSON.parse(row.value) as unknown;
  } catch {
    return row.value;
  }
}

function parseSettingValue(value: string | null | undefined): unknown | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

/**
 * TOPLU OKUMA: Aynı anda (aynı olay-döngüsü turunda) istenen ayar anahtarları tek bir
 * `WHERE key IN (...)` sorgusunda okunur.
 *
 * NEDEN: Üye tarafındaki abonelik özeti uç noktası ~10 ayarı `Promise.all` ile ister. Bellek
 * (15 sn) bu uç dakikada bir çağrıldığı için çoğu kez boştur; her ayar ayrı sorgu olup ayrı bağlantı
 * bekliyordu (Sentry "N+1 sorgu": 1,5 sn, bunun 0,9 sn'si yalnızca bağlantı beklemesi).
 */
type SettingWaiter = { resolve: (v: unknown | null) => void; reject: (e: unknown) => void };
const pendingLoads = new Map<string, SettingWaiter[]>();
let flushScheduled = false;

function loadSettingBatched(key: string): Promise<unknown | null> {
  return new Promise((resolve, reject) => {
    const waiter: SettingWaiter = { resolve, reject };
    const list = pendingLoads.get(key);
    if (list) {
      list.push(waiter);
    } else {
      pendingLoads.set(key, [waiter]);
    }
    if (!flushScheduled) {
      flushScheduled = true;
      setImmediate(() => void flushPendingLoads());
    }
  });
}

async function flushPendingLoads(): Promise<void> {
  flushScheduled = false;
  const batch = new Map(pendingLoads);
  pendingLoads.clear();
  if (batch.size === 0) {
    return;
  }
  try {
    const rows = await prisma.siteSetting.findMany({ where: { key: { in: [...batch.keys()] } } });
    const byKey = new Map(rows.map((r) => [r.key, r.value] as const));
    for (const [key, waiters] of batch) {
      const parsed = parseSettingValue(byKey.get(key));
      bumpCache(key, parsed);
      for (const w of waiters) {
        w.resolve(parsed);
      }
    }
  } catch (err) {
    for (const waiters of batch.values()) {
      for (const w of waiters) {
        w.reject(err);
      }
    }
  }
}

export async function getSetting(key: string): Promise<unknown | null> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) {
    return hit.value;
  }
  return loadSettingBatched(key);
}

/**
 * Same as getSetting but returns `fallback` when missing or null.
 */
export async function getSettingWithFallback<T>(key: string, fallback: T): Promise<T> {
  const v = await getSetting(key);
  if (v == null) {
    return fallback;
  }
  return v as T;
}

/**
 * Upsert a value (objects are JSON-stringified). Clears cache for that key.
 */
export async function setSetting(key: string, value: unknown): Promise<void> {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: str },
    update: { value: str },
  });
  cache.delete(key);
  if (PACKAGES_RELATED_KEYS.has(key)) {
    invalidatePackagesMerged?.();
  }
}

/**
 * Admin bulk patch: preserves legacy behavior where string values are stored verbatim (non-JSON-wrapped).
 */
export async function setSettingFromAdminPatch(key: string, value: unknown): Promise<void> {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: str },
    update: { value: str },
  });
  cache.delete(key);
  if (PACKAGES_RELATED_KEYS.has(key)) {
    invalidatePackagesMerged?.();
  }
}

export function invalidateSettingCache(key: string) {
  cache.delete(key);
  if (PACKAGES_RELATED_KEYS.has(key)) {
    invalidatePackagesMerged?.();
  }
}

export function clearAllSettingCache() {
  cache.clear();
  invalidatePackagesMerged?.();
}

/** @internal */
export function seedSettingCacheForTests(key: string, value: unknown) {
  bumpCache(key, value);
}

export { SITE_SETTING_KEYS, type SiteSettingKey } from "./site-setting-keys.js";
