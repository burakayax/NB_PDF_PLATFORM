import { prisma } from "../../lib/prisma.js";

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function countCouponUsesByUser(couponId: string, userId: string): Promise<number> {
  return prisma.couponUse.count({
    where: { couponId, userId },
  });
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
  | { ok: true; coupon: { id: string; discountPercent: number; usageLimitPerUser: number }; uses: number }
  | { ok: false; reason: string }
> {
  const coupon = await findActiveCouponByCode(code);
  if (!coupon) {
    return { ok: false, reason: "invalid" };
  }
  const uses = await countCouponUsesByUser(coupon.id, userId);
  if (uses >= coupon.usageLimitPerUser) {
    return { ok: false, reason: "limit" };
  }
  return {
    ok: true,
    coupon: { id: coupon.id, discountPercent: coupon.discountPercent, usageLimitPerUser: coupon.usageLimitPerUser },
    uses,
  };
}
