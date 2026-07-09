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
  if (plan === "PLUS") return env.AI_MONTHLY_LIMIT_PLUS;
  if (plan === "STARTER") return env.AI_MONTHLY_LIMIT_STARTER;
  return 0;
}

export type AiQuota = {
  used: number;
  limit: number | null; // null = sınırsız (admin)
  remaining: number | null; // aylık kalan + bonus kredi
  bonus: number; // top-up ile alınan ek kredi (kalıcı)
  unlimited: boolean;
  resetAt: string;
  /** Bu ay araç bazında istek sayıları: { summarize: 5, chat: 3, ... } */
  byOp: Record<string, number>;
};

/** Json alanını güvenle Record<string, number>'a çevirir. */
function normalizeOpCounts(v: unknown): Record<string, number> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "number" && Number.isFinite(val)) out[k] = val;
    }
    return out;
  }
  return {};
}

export async function getAiQuota(
  userId: string,
  plan?: string,
  role?: string,
): Promise<AiQuota> {
  const limit = aiLimitForPlan(plan, role);
  const yearMonth = currentYearMonth();
  const [row, user] = await Promise.all([
    prisma.aiUsage.findUnique({ where: { userId_yearMonth: { userId, yearMonth } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { bonusAiCredits: true } }),
  ]);
  const used = row?.count ?? 0;
  const bonus = Math.max(0, user?.bonusAiCredits ?? 0);
  const monthlyRemaining = limit === null ? null : Math.max(0, limit - used);
  return {
    used,
    limit,
    // Aylık kalan bittiğinde bonus kredi devreye girer → toplam kalan gösterilir.
    remaining: limit === null ? null : (monthlyRemaining ?? 0) + bonus,
    bonus,
    unlimited: limit === null,
    resetAt: nextMonthResetAt(),
    byOp: normalizeOpCounts(row?.operationCounts),
  };
}

/** Kullanıcının AI hakkı var mı (aylık VEYA bonus). İşlemden ÖNCE kontrol. */
export async function hasAiQuota(
  userId: string,
  plan?: string,
  role?: string,
): Promise<boolean> {
  const limit = aiLimitForPlan(plan, role);
  if (limit === null) return true; // admin sınırsız
  const q = await getAiQuota(userId, plan, role);
  return (q.remaining ?? 0) > 0;
}

/** Başarılı AI işleminden SONRA tüket: aylık kota varsa onu, bittiyse bonus krediyi düş. */
export async function consumeAiQuota(userId: string, plan?: string, role?: string, op?: string): Promise<void> {
  const yearMonth = currentYearMonth();
  const limit = aiLimitForPlan(plan, role);
  const row = await prisma.aiUsage.findUnique({ where: { userId_yearMonth: { userId, yearMonth } } });
  const used = row?.count ?? 0;

  // Araç bazında istek sayacı — her durumda (bonus dahil) güncellenir.
  const counts = normalizeOpCounts(row?.operationCounts);
  if (op) counts[op] = (counts[op] ?? 0) + 1;

  if (limit !== null && used >= limit) {
    // Aylık kota dolu → bonus krediden düş (0'ın altına inme). Aylık count artmaz;
    // ama araç sayacını yine de yaz (row mevcut, çünkü used >= limit > 0).
    await prisma.user.updateMany({ where: { id: userId, bonusAiCredits: { gt: 0 } }, data: { bonusAiCredits: { decrement: 1 } } });
    if (op && row) {
      await prisma.aiUsage.update({ where: { userId_yearMonth: { userId, yearMonth } }, data: { operationCounts: counts } });
    }
    return;
  }
  // Aylık sayacı artır (admin dahil — analitik için) + araç sayacı.
  await prisma.aiUsage.upsert({
    where: { userId_yearMonth: { userId, yearMonth } },
    create: { userId, yearMonth, count: 1, operationCounts: op ? { [op]: 1 } : undefined },
    update: { count: { increment: 1 }, operationCounts: op ? counts : undefined },
  });
}

/** Top-up: kullanıcıya ek AI kredisi ekle (ödeme başarılı olunca çağrılır). */
export async function grantAiCredits(userId: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return;
  await prisma.user.update({ where: { id: userId }, data: { bonusAiCredits: { increment: Math.floor(amount) } } });
}

/** Ek AI kredisi paketleri (top-up). Fiyatlar ödeme açılınca kullanılır; kredi aylar
 * arası kalıcıdır ve aylık kota bitince devreye girer. */
export const TOPUP_PACKS = [
  // Pay-per-use — abone olmayan kullanıcı için tek/az işlem.
  { id: "ai-1", credits: 1, priceUSD: 0.99, priceTRY: 29 },
  { id: "ai-5", credits: 5, priceUSD: 3.49, priceTRY: 89 },
  // Toplu paketler (top-up).
  { id: "ai-50", credits: 50, priceUSD: 4.99, priceTRY: 149 },
  { id: "ai-150", credits: 150, priceUSD: 11.99, priceTRY: 349, popular: true },
  { id: "ai-500", credits: 500, priceUSD: 29.99, priceTRY: 899 },
] as const;

/** Fatura kalem adı — top-up ödeme akışı bağlanınca payment.service basketItemName /
 * triggerInvoiceGeneration'a bu geçilecek (KDV + bireysel/kurumsal fatura zaten destekli). */
export const TOPUP_INVOICE_LABEL = "Ek AI Hizmet Bedeli";
export function topupInvoiceLabel(pack: { credits: number }): string {
  return `${TOPUP_INVOICE_LABEL} (${pack.credits} kredi)`;
}

export function topupPackById(id: string) {
  return TOPUP_PACKS.find((p) => p.id === id) ?? null;
}
