import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

/** Geçerli ay anahtarı, ör. "2026-07" (UTC). */
export function currentYearMonth(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Bir sonraki ayın 1'i (kotanın sıfırlanacağı an), ISO. */
function nextMonthResetAt(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
}

/**
 * Plana göre aylık AI kotası. ADMIN → null (sınırsız). PRO/BUSINESS → env limiti.
 * Diğer planlar zaten requireAiAccess'te engelli (0 döner).
 * (İleride top-up: burada `+ satın alınan ek kota` eklenecek.)
 */
export function aiLimitForPlan(
  plan: string | undefined,
  role: string | undefined,
): number | null {
  if (role === "ADMIN") return null;
  if (plan === "BUSINESS") return env.AI_MONTHLY_LIMIT_BUSINESS;
  if (plan === "PRO") return env.AI_MONTHLY_LIMIT_PRO;
  return 0;
}

export type AiQuota = {
  used: number;
  limit: number | null; // null = sınırsız (admin)
  remaining: number | null;
  unlimited: boolean;
  resetAt: string;
};

export async function getAiQuota(
  userId: string,
  plan?: string,
  role?: string,
): Promise<AiQuota> {
  const limit = aiLimitForPlan(plan, role);
  const yearMonth = currentYearMonth();
  const row = await prisma.aiUsage.findUnique({
    where: { userId_yearMonth: { userId, yearMonth } },
  });
  const used = row?.count ?? 0;
  return {
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    unlimited: limit === null,
    resetAt: nextMonthResetAt(),
  };
}

/** Kullanıcının bu ay AI hakkı var mı (işlemden ÖNCE kontrol). */
export async function hasAiQuota(
  userId: string,
  plan?: string,
  role?: string,
): Promise<boolean> {
  const limit = aiLimitForPlan(plan, role);
  if (limit === null) return true; // admin sınırsız
  if (limit <= 0) return false;
  const { used } = await getAiQuota(userId, plan, role);
  return used < limit;
}

/** Başarılı AI işleminden SONRA sayacı 1 artır (aylık satır, atomik upsert). */
export async function consumeAiQuota(userId: string): Promise<void> {
  const yearMonth = currentYearMonth();
  await prisma.aiUsage.upsert({
    where: { userId_yearMonth: { userId, yearMonth } },
    create: { userId, yearMonth, count: 1 },
    update: { count: { increment: 1 } },
  });
}
