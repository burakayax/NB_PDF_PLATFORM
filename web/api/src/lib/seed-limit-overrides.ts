/**
 * SEED + PANEL LİMİTLERİ: "panel kazanır, kod varsayılandır".
 *
 * Sorun: Her deploy'da `prisma/seed.ts` plan satırlarını ve kurum satırlarını koddaki varsayılan
 * limitlerle ezer. Panelde (Paket ve fiyat → Limitler) kaydedilen değer çalışma anında `quota.ts`
 * tarafından zaten önceliklidir; ama satırlar koda dönünce başka yerler eski değeri gösterebilir.
 *
 * Çözüm: Seed, panelde KAYDEDİLMİŞ limiti okur ve satıra koddaki değer yerine onu yazar.
 * Kaydı olmayan alan kodun değerini alır (davranış değişmez). Bu dosya SAFTIR: veritabanı/ağ yok,
 * bu yüzden birim testle doğrulanır. Doğrulama kuralları `packages-config.service.ts`
 * (`cleanLimitField`) ile birebir aynıdır; geçersiz kayıt yok sayılır (seed asla çökmez).
 */

export type SeedPlanId = "FREE" | "STARTER" | "PLUS" | "PRO" | "BUSINESS";

export type SeedLimitFields = {
  dailyOperationLimit: number | null;
  monthlyOperationLimit: number;
  fileSizeLimitMB: number;
  batchLimit: number;
};

export type SavedLimitOverrides = Partial<Record<SeedPlanId, Partial<SeedLimitFields>>>;

const PLAN_IDS: SeedPlanId[] = ["FREE", "STARTER", "PLUS", "PRO", "BUSINESS"];

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function cleanField(field: keyof SeedLimitFields, v: unknown): number | null | undefined {
  switch (field) {
    case "dailyOperationLimit":
      return v === null ? null : isInt(v, 0, 100_000) ? v : undefined;
    case "monthlyOperationLimit":
      return isInt(v, 1, 999_999) ? v : undefined;
    case "fileSizeLimitMB":
      return isInt(v, 1, 10_000) ? v : undefined;
    case "batchLimit":
      return isInt(v, 0, 1_000) ? v : undefined;
  }
}

const FIELDS: Array<keyof SeedLimitFields> = [
  "dailyOperationLimit",
  "monthlyOperationLimit",
  "fileSizeLimitMB",
  "batchLimit",
];

/**
 * `packages.config` (ve eski `plans.override`) ham değerinden panelde kaydedilmiş limitleri çıkarır.
 * Çalışma anındaki okuyucuyla aynı sıra: önce `limitBook`; Ücretsiz planın günlük hakkı için,
 * defterde yoksa eski yol `plansOverride.FREE.dailyLimit` korunur.
 */
export function extractSavedLimitOverrides(unified: unknown, legacyPlansOverride?: unknown): SavedLimitOverrides {
  const out: SavedLimitOverrides = {};
  const root = isRecord(unified) ? unified : {};

  const book = root.limitBook;
  if (isRecord(book)) {
    for (const id of PLAN_IDS) {
      const row = book[id];
      if (!isRecord(row)) continue;
      const clean: Partial<SeedLimitFields> = {};
      for (const f of FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(row, f)) continue;
        const v = cleanField(f, row[f]);
        if (v !== undefined) (clean as Record<string, unknown>)[f] = v;
      }
      if (Object.keys(clean).length) out[id] = clean;
    }
  }

  const plansOverride = Object.prototype.hasOwnProperty.call(root, "plansOverride")
    ? root.plansOverride
    : legacyPlansOverride;
  if (out.FREE?.dailyOperationLimit === undefined && isRecord(plansOverride) && isRecord(plansOverride.FREE)) {
    const v = cleanField("dailyOperationLimit", plansOverride.FREE.dailyLimit);
    if (v !== undefined) out.FREE = { ...(out.FREE ?? {}), dailyOperationLimit: v };
  }
  return out;
}

/** Koddaki yapılandırmaya panelde kayıtlı limitleri bindirir. Kayıtsız alan kodu izler. */
export function applySavedLimits<T extends SeedLimitFields>(
  plan: SeedPlanId,
  config: T,
  saved: SavedLimitOverrides,
): { config: T; changed: Array<keyof SeedLimitFields> } {
  const patch = saved[plan] ?? {};
  const changed: Array<keyof SeedLimitFields> = [];
  const next: T = { ...config };
  for (const f of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, f)) continue;
    const v = patch[f] as T[typeof f];
    if (next[f] !== v) {
      (next as SeedLimitFields)[f] = v as never;
      changed.push(f);
    }
  }
  return { config: next, changed };
}
