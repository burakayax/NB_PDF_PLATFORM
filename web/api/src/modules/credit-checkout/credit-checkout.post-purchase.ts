import { prisma } from "../../lib/prisma.js";

/**
 * Kredi satın alma **başarılı** olduktan sonra: kupon kullanımı + çıkış niyeti tarihi.
 */
export async function recordCreditPackPurchaseMeta(params: {
  userId: string;
  couponId: string | null;
  exitIntentApplied: boolean;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (params.couponId) {
      await tx.couponUse.create({
        data: { userId: params.userId, couponId: params.couponId },
      });
      // Toplam kullanım usageLimitPerUser'a ulaştıysa kuponu pasif yap
      const coupon = await tx.coupon.findUnique({
        where: { id: params.couponId },
        select: { usageLimitPerUser: true },
      });
      if (coupon) {
        const totalUses = await tx.couponUse.count({ where: { couponId: params.couponId } });
        if (totalUses >= coupon.usageLimitPerUser) {
          await tx.coupon.update({
            where: { id: params.couponId },
            data: { isActive: false },
          });
        }
      }
    }
    // lastExitIntentCreditDiscountAt field removed from User model
  });
}
