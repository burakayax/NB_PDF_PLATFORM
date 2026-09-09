import { prisma } from "../../lib/prisma.js";

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function countCouponUsesByUser(couponId: string, userId: string): Promise<number> {
  return prisma.couponUse.count({
    where: { couponId, userId },
  });
}

/** Kuponun tüm kullanıcılar tarafından toplam kaç kez kullanıldığı. */
export async function countCouponUsesTotal(couponId: string): Promise<number> {
  return prisma.couponUse.count({ where: { couponId } });
}

export async function findActiveCouponByCode(code: string) {
  const normalized = normalizeCouponCode(code);
  return prisma.coupon.findFirst({
    where: { code: normalized, isActive: true },
  });
}

/**
 * @returns { ok: true, coupon, uses } or { ok: false, reason }
 */
export async function validateCouponForUser(
  code: string,
  userId: string,
): Promise<
  | {
      ok: true;
      coupon: { id: string; discountPercent: number; usageLimitPerUser: number; usageLimitTotal: number | null };
      uses: number;
    }
  | { ok: false; reason: string }
> {
  const coupon = await findActiveCouponByCode(code);
  if (!coupon) {
    return { ok: false, reason: "invalid" };
  }
  // Son kullanma tarihi geçmişse geçersiz (admin kupon oluştururken tarih girebilir).
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  const uses = await countCouponUsesByUser(coupon.id, userId);
  if (uses >= coupon.usageLimitPerUser) {
    return { ok: false, reason: "limit" };
  }
  // Toplam kontenjan (varsa): kuponun tüm kullanıcılardaki toplam kullanımı.
  // null → sınırsız. Bu kontrol kuponu PASİFLEŞTİRMEZ; sadece kontenjan
  // dolduğunda yeni kullanımı reddeder.
  if (coupon.usageLimitTotal !== null && coupon.usageLimitTotal !== undefined) {
    const totalUses = await countCouponUsesTotal(coupon.id);
    if (totalUses >= coupon.usageLimitTotal) {
      return { ok: false, reason: "limit" };
    }
  }
  return {
    ok: true,
    coupon: {
      id: coupon.id,
      discountPercent: coupon.discountPercent,
      usageLimitPerUser: coupon.usageLimitPerUser,
      usageLimitTotal: coupon.usageLimitTotal ?? null,
    },
    uses,
  };
}
