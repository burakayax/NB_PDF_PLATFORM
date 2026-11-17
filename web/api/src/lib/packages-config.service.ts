import {
  AI_MONTHLY_CREDITS,
  EXTRA_SEAT_PRICE,
  PLAN_LIMITS,
  PLAN_PRICES,
  type CataloguePlanId,
  type PaidPlanId,
  type PlanLimits,
  type PlanPrice,
} from "./plan-catalogue.js";
import { getSetting, registerPackagesMergedInvalidator, setSetting } from "./site-config.service.js";
import { SITE_SETTING_KEYS } from "./site-setting-keys.js";

/**
 * Yönetim panelinden değiştirilebilen TL fiyatları. Varsayılanlar fiyat
 * kataloğundan gelir — katalog tek kaynaktır ([[plan-catalogue.ts]]).
 *
 * DİKKAT: Bu tutarlar KDV DAHİLDİR (müşterinin gördüğü ve ödediği rakam).
 * Panelden girilen değer de KDV dahil olmalıdır.
 */
export const DEFAULT_PAYMENT_PRICES_TRY: Record<"PRO" | "BUSINESS" | "PRO_ANNUAL", string> = {
  BUSINESS: PLAN_PRICES.BUSINESS.tryGrossMonthly,
  PRO: PLAN_PRICES.PRO.tryGrossMonthly,
  // Yıllık PRO = 10 ay fiyatına (2 ay bedava, ~%17 indirim). Yıllık TOPLAM tutar.
  PRO_ANNUAL: PLAN_PRICES.PRO.tryGrossYearly,
};

/**
 * FİYAT DEFTERİ — tüm ücretli planların TL (KDV dahil) ve USD fiyatları + ek koltuk.
 * Varsayılanı `plan-catalogue.ts`'tir; yönetim panelinde kayıtlı değer varsa o geçerlidir.
 * ESKİ `prices` (yalnız Pro/Business) kaydı artık OKUNMAZ: eski bir kayıt yeni katalog
 * fiyatını sessizce ezmesin diye. Yönetim paneli yeni defteri yazar.
 */
export type PriceBook = {
  plans: Record<PaidPlanId, PlanPrice>;
  extraSeat: { tryGrossMonthly: string; usdMonthly: string };
};
export type PriceBookPatch = {
  plans?: Partial<Record<PaidPlanId, Partial<PlanPrice>>>;
  extraSeat?: Partial<PriceBook["extraSeat"]>;
};
const PAID_IDS: PaidPlanId[] = ["STARTER", "PLUS", "PRO", "BUSINESS"];
const PRICE_FIELDS: Array<keyof PlanPrice> = ["tryGrossMonthly", "tryGrossYearly", "usdMonthly", "usdYearly"];

export function defaultPriceBook(): PriceBook {
  const plans = {} as Record<PaidPlanId, PlanPrice>;
  for (const id of PAID_IDS) plans[id] = { ...PLAN_PRICES[id] };
  return { plans, extraSeat: { ...EXTRA_SEAT_PRICE } };
}

function mergePriceBook(raw: unknown): PriceBook {
  const out = defaultPriceBook();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const r = raw as { plans?: Record<string, Record<string, unknown>>; extraSeat?: Record<string, unknown> };
  for (const id of PAID_IDS) {
    const row = r.plans?.[id];
    if (!row || typeof row !== "object") continue;
    for (const f of PRICE_FIELDS) {
      const v = row[f];
      if (typeof v !== "string") continue;
      try {
        const n = parsePriceToFixed2(v);
        if (Number.parseFloat(n) > 0) out.plans[id][f] = n;
      } catch {
        /* keep default */
      }
    }
  }
  const seat = r.extraSeat;
  if (seat && typeof seat === "object") {
    for (const f of ["tryGrossMonthly", "usdMonthly"] as const) {
      const v = seat[f];
      if (typeof v !== "string") continue;
      try {
        const n = parsePriceToFixed2(v);
        if (Number.parseFloat(n) > 0) out.extraSeat[f] = n;
      } catch {
        /* keep default */
      }
    }
  }
  return out;
}

/**
 * LİMİT DEFTERİ — plan başına günlük/aylık sunucu işlemi, dosya boyutu, toplu işlem ve aylık yapay zekâ hakkı.
 * Varsayılan `plan-catalogue.ts`'tir. Panelde KAYDEDİLEN alanlar (`saved`) kota kontrolünde geçerlidir;
 * hiç kaydedilmemiş alan eskisi gibi kodu/veritabanı satırını izler (kayıtsız plan davranışı DEĞİŞMEZ).
 * Business'ta aylık işlem, 5 koltuğun HAVUZUDUR (ek koltuk başına +1.000 kodda sabittir).
 */
export type LimitRow = PlanLimits & { aiMonthlyCredits: number };
export type LimitBook = Record<CataloguePlanId, LimitRow>;
export type SavedLimits = Partial<Record<CataloguePlanId, Partial<LimitRow>>>;
export const LIMIT_PLAN_IDS: CataloguePlanId[] = ["FREE", "STARTER", "PLUS", "PRO", "BUSINESS"];

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Tek bir limit alanını doğrular; geçersizse `undefined` (alan yok sayılır). */
function cleanLimitField(field: keyof LimitRow, v: unknown): number | null | undefined {
  switch (field) {
    case "dailyOperationLimit":
      return v === null ? null : isInt(v, 0, 100_000) ? v : undefined;
    case "monthlyOperationLimit":
      return isInt(v, 1, 999_999) ? v : undefined;
    case "fileSizeLimitMB":
      return isInt(v, 1, 10_000) ? v : undefined;
    case "batchLimit":
      return isInt(v, 0, 1_000) ? v : undefined;
    case "aiMonthlyCredits":
      return isInt(v, 0, 100_000) ? v : undefined;
  }
}
const LIMIT_FIELDS: Array<keyof LimitRow> = ["dailyOperationLimit", "monthlyOperationLimit", "fileSizeLimitMB", "batchLimit", "aiMonthlyCredits"];

export function defaultLimitBook(): LimitBook {
  const out = {} as LimitBook;
  for (const id of LIMIT_PLAN_IDS) out[id] = { ...PLAN_LIMITS[id], aiMonthlyCredits: AI_MONTHLY_CREDITS[id] };
  return out;
}

/** Kayıtlı ham değerden yalnız GEÇERLİ alanları süzer. Ücretsiz planın yapay zekâ hakkı panelden değişmez. */
function sanitizeSavedLimits(raw: unknown): SavedLimits {
  const out: SavedLimits = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const id of LIMIT_PLAN_IDS) {
    const row = (raw as Record<string, unknown>)[id];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const clean: Partial<LimitRow> = {};
    for (const f of LIMIT_FIELDS) {
      if (id === "FREE" && f === "aiMonthlyCredits") continue;
      if (!hasOwn(row, f)) continue;
      const v = cleanLimitField(f, (row as Record<string, unknown>)[f]);
      if (v !== undefined) (clean as Record<string, unknown>)[f] = v;
    }
    if (Object.keys(clean).length) out[id] = clean;
  }
  return out;
}

function mergeLimitBook(saved: SavedLimits): LimitBook {
  const out = defaultLimitBook();
  for (const id of LIMIT_PLAN_IDS) Object.assign(out[id], saved[id] ?? {});
  return out;
}

type UnifiedPackagesShape = {
  plansOverride?: unknown;
  marketing?: unknown;
  prices?: Partial<Record<"PRO" | "BUSINESS" | "PRO_ANNUAL", string>>;
  priceBook?: unknown;
  limitBook?: unknown;
};

let mergedCache: { at: number; v: ResolvedPackagesConfig } | null = null;
const MERGED_TTL_MS = 15_000;

function invalidateMerged() {
  mergedCache = null;
}

/** Clears merged packages view (call after direct DB writes outside setSetting). */
export function invalidateResolvedPackagesConfig() {
  invalidateMerged();
}

registerPackagesMergedInvalidator(invalidateMerged);

function hasOwn(obj: object, k: string) {
  return Object.prototype.hasOwnProperty.call(obj, k);
}

function parsePriceToFixed2(raw: string): string {
  const n = Number.parseFloat(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 999_999.99) {
    throw new Error("Invalid price.");
  }
  return n.toFixed(2);
}

export type ResolvedPackagesConfig = {
  plansOverride: Record<string, unknown>;
  marketing: unknown;
  /** Geriye dönük kısa görünüm: fiyat defterinden türetilir (TL, KDV dahil). */
  prices: Record<"PRO" | "BUSINESS" | "PRO_ANNUAL", string>;
  priceBook: PriceBook;
  /** Panelde kayıtlı olanlar + kod varsayılanları (ekranda gösterilen tam görünüm). */
  limitBook: LimitBook;
  /** YALNIZ panelde kaydedilmiş limit alanları — kota kontrolü bunları uygular. */
  savedLimits: SavedLimits;
};

async function computeResolvedPackagesConfig(): Promise<ResolvedPackagesConfig> {
  // Dört anahtar AYNI ANDA istenir: getSetting bunları tek `WHERE key IN (...)` sorgusunda toplar.
  // Eskiden eski (legacy) anahtarlar sırayla bekleniyordu → her biri ayrı sorgu (Sentry "N+1 sorgu").
  const [unifiedRaw, legacyPlans, legacyMarketing] = await Promise.all([
    getSetting(SITE_SETTING_KEYS.PACKAGES_CONFIG),
    getSetting(SITE_SETTING_KEYS.PLANS_OVERRIDE_LEGACY),
    getSetting(SITE_SETTING_KEYS.PACKAGES_MARKETING_LEGACY),
  ]);
  const unified =
    unifiedRaw != null && typeof unifiedRaw === "object" && !Array.isArray(unifiedRaw)
      ? (unifiedRaw as UnifiedPackagesShape)
      : {};

  let plansOverride: Record<string, unknown>;
  if (hasOwn(unified as object, "plansOverride")) {
    const po = unified.plansOverride;
    plansOverride =
      po != null && typeof po === "object" && !Array.isArray(po) ? { ...(po as Record<string, unknown>) } : {};
  } else {
    const leg = legacyPlans;
    plansOverride =
      leg != null && typeof leg === "object" && !Array.isArray(leg) ? { ...(leg as Record<string, unknown>) } : {};
  }

  let marketing: unknown;
  if (hasOwn(unified as object, "marketing")) {
    marketing = unified.marketing ?? {};
  } else {
    marketing = legacyMarketing ?? {};
  }

  const priceBook = mergePriceBook(unified.priceBook);
  const prices = {
    PRO: priceBook.plans.PRO.tryGrossMonthly,
    BUSINESS: priceBook.plans.BUSINESS.tryGrossMonthly,
    PRO_ANNUAL: priceBook.plans.PRO.tryGrossYearly,
  };

  const savedLimits = sanitizeSavedLimits(unified.limitBook);
  // ESKİ yol: Ücretsiz günlük hak "Erişim" formundan plansOverride.FREE.dailyLimit olarak kaydediliyordu.
  // Yeni defterde kayıt yoksa o değer korunur (davranış kaybolmasın).
  const legacyFreeDaily = (plansOverride.FREE as Record<string, unknown> | undefined)?.dailyLimit;
  if (savedLimits.FREE?.dailyOperationLimit === undefined) {
    const v = cleanLimitField("dailyOperationLimit", legacyFreeDaily);
    if (v !== undefined) savedLimits.FREE = { ...(savedLimits.FREE ?? {}), dailyOperationLimit: v };
  }
  const limitBook = mergeLimitBook(savedLimits);

  return { plansOverride, marketing, prices, priceBook, limitBook, savedLimits };
}

/** Kota kontrolü için: yalnız panelde kaydedilmiş limitler. Okunamazsa null (kayıtlı satırlar kullanılır). */
export async function getSavedLimits(): Promise<SavedLimits | null> {
  try {
    return (await getResolvedPackagesConfig()).savedLimits;
  } catch {
    return null;
  }
}

/**
 * Single merged view: `packages.config` wins per-field; legacy keys fill gaps.
 */
export async function getResolvedPackagesConfig(): Promise<ResolvedPackagesConfig> {
  const now = Date.now();
  if (mergedCache && now - mergedCache.at < MERGED_TTL_MS) {
    return mergedCache.v;
  }
  const v = await computeResolvedPackagesConfig();
  mergedCache = { at: now, v };
  return v;
}

async function readUnifiedRowForWrite(): Promise<Record<string, unknown>> {
  const raw = await getSetting(SITE_SETTING_KEYS.PACKAGES_CONFIG);
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

/**
 * Persists into `packages.config` only (canonical write path).
 */
export async function upsertPackagesConfigPartial(patch: {
  plansOverride?: unknown;
  marketing?: unknown;
  prices?: Partial<Record<"PRO" | "BUSINESS" | "PRO_ANNUAL", string>>;
  priceBook?: PriceBookPatch;
  limitBook?: Partial<Record<CataloguePlanId, Partial<LimitRow>>>;
}): Promise<void> {
  const base = await readUnifiedRowForWrite();
  const next: Record<string, unknown> = { ...base };
  if (patch.plansOverride !== undefined) {
    next.plansOverride = patch.plansOverride;
  }
  if (patch.marketing !== undefined) {
    next.marketing = patch.marketing;
  }
  if (patch.prices !== undefined) {
    const prevPrices =
      next.prices != null && typeof next.prices === "object" && !Array.isArray(next.prices)
        ? (next.prices as Record<string, unknown>)
        : {};
    const merged: Record<string, unknown> = { ...prevPrices };
    if (patch.prices.PRO !== undefined) {
      merged.PRO = parsePriceToFixed2(patch.prices.PRO);
    }
    if (patch.prices.BUSINESS !== undefined) {
      merged.BUSINESS = parsePriceToFixed2(patch.prices.BUSINESS);
    }
    if (patch.prices.PRO_ANNUAL !== undefined) {
      merged.PRO_ANNUAL = parsePriceToFixed2(patch.prices.PRO_ANNUAL);
    }
    next.prices = merged;
  }
  if (patch.priceBook !== undefined) {
    // Kayıtlı defteri ve gelen yamayı üst üste bindir; yalnız GEÇERLİ sayılar yazılır.
    const cur = mergePriceBook(next.priceBook);
    for (const id of PAID_IDS) {
      const row = patch.priceBook.plans?.[id];
      if (!row) continue;
      for (const f of PRICE_FIELDS) {
        const v = row[f];
        if (v !== undefined) cur.plans[id][f] = parsePriceToFixed2(v);
      }
    }
    for (const f of ["tryGrossMonthly", "usdMonthly"] as const) {
      const v = patch.priceBook.extraSeat?.[f];
      if (v !== undefined) cur.extraSeat[f] = parsePriceToFixed2(v);
    }
    for (const id of PAID_IDS) {
      for (const f of PRICE_FIELDS) {
        if (!(Number.parseFloat(cur.plans[id][f]) > 0)) throw new Error("Invalid price.");
      }
    }
    if (!(Number.parseFloat(cur.extraSeat.tryGrossMonthly) > 0 && Number.parseFloat(cur.extraSeat.usdMonthly) > 0)) {
      throw new Error("Invalid price.");
    }
    next.priceBook = cur;
  }
  if (patch.limitBook !== undefined) {
    // Yama doğrulanır: geçersiz alan sessizce atılmaz, hata verir (yanlış rakam kaydedilmesin).
    const cur = sanitizeSavedLimits(next.limitBook);
    for (const id of LIMIT_PLAN_IDS) {
      const row = patch.limitBook[id];
      if (!row) continue;
      for (const f of LIMIT_FIELDS) {
        if (!hasOwn(row, f)) continue;
        if (id === "FREE" && f === "aiMonthlyCredits") continue;
        const v = cleanLimitField(f, (row as Record<string, unknown>)[f]);
        if (v === undefined) throw new Error(`Invalid limit: ${id}.${f}`);
        cur[id] = { ...(cur[id] ?? {}), [f]: v };
      }
    }
    next.limitBook = cur;
  }
  await setSetting(SITE_SETTING_KEYS.PACKAGES_CONFIG, next);
}

export async function putPaymentPricesTry(prices: Record<"PRO" | "BUSINESS", string>) {
  await upsertPackagesConfigPartial({
    priceBook: { plans: { PRO: { tryGrossMonthly: prices.PRO }, BUSINESS: { tryGrossMonthly: prices.BUSINESS } } },
  });
}

export function invalidatePaymentPricesCache() {
  invalidateMerged();
}
