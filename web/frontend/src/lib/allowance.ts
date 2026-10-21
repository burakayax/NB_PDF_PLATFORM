import { PLANS, type PlanId } from "./planConfig";

/**
 * HAK GÖSTERİMİ — üst çubuk, plan kartı, hak göstergesi ve uyarılar AYNI sayıyı söylesin diye
 * tek yerde hesaplanır. Sunucu "kullanılan" ve "limit" gönderir; "kalan" burada türetilir ve
 * her yerde "kalan/limit" olarak yazılır (eskiden biri kullanılanı, biri kalanı gösteriyordu).
 */
export type AllowancePart = { used: number; limit: number | null; resetAt?: string | null };

export type EffectiveAllowance = {
  /** Hangi sınır önce dolacaksa o: günlük ya da aylık. */
  kind: "daily" | "monthly";
  used: number;
  limit: number;
  left: number;
  resetAt: string | null;
};

const hasLimit = (p?: AllowancePart | null): p is AllowancePart & { limit: number } =>
  !!p && p.limit !== null && p.limit > 0;

/**
 * Kullanıcının GERÇEKTE kaç hakkı kaldığı: günlük ve aylık sınırdan hangisi daha az kalmışsa o.
 * Ücretsiz üyede günlük 3 hak duruyor ama aylık 30 dolmuşsa kalan 0'dır ve neden "aylık"tır.
 * Hiç sınır yoksa null.
 */
export function effectiveAllowance(
  daily?: AllowancePart | null,
  monthly?: AllowancePart | null,
): EffectiveAllowance | null {
  const d = hasLimit(daily)
    ? { kind: "daily" as const, used: daily.used, limit: daily.limit, left: Math.max(0, daily.limit - daily.used), resetAt: daily.resetAt ?? null }
    : null;
  const m = hasLimit(monthly)
    ? { kind: "monthly" as const, used: monthly.used, limit: monthly.limit, left: Math.max(0, monthly.limit - monthly.used), resetAt: monthly.resetAt ?? null }
    : null;
  if (d && m) return m.left < d.left ? m : d;
  return d ?? m;
}

/** "24/25" — kalan/limit. */
export function leftOfLimit(a: Pick<EffectiveAllowance, "left" | "limit">): string {
  return `${a.left}/${a.limit}`;
}

/** Plan kataloğundan sayısal limit (statik metinler için) — elle yazılmaz. */
export function planOps(plan: PlanId): { daily: number | null; monthly: number | null } {
  const p = PLANS.find((x) => x.id === plan);
  return { daily: p?.dailyOpsLimit ?? null, monthly: p?.monthlyOpsLimit ?? null };
}

/** Ücretsiz üyenin sayısal hakkı: günde X, ayda Y. */
export const FREE_OPS = planOps("FREE");
