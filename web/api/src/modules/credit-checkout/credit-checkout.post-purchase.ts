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
    }
    if (params.exitIntentApplied) {
      await tx.user.update({
        where: { id: params.userId },
        data: { lastExitIntentCreditDiscountAt: new Date() },
      });
    }
  });
}
