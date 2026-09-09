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
      // NOT: Burada kuponu otomatik PASİFLEŞTİRMİYORUZ. Eskiden kuponun toplam
      // kullanımı "kullanıcı başına limit" ile karşılaştırılıyordu; varsayılan 1
      // olduğu için her kampanya kuponu ilk müşteriden sonra herkese kapanıyordu.
      // Kullanıcı başına limit ve (varsa) toplam kontenjan artık kupon
      // doğrulamasında uygulanır; kuponun açık/kapalı olması yalnızca yöneticinin
      // kararıdır.
    }
    // lastExitIntentCreditDiscountAt field removed from User model
  });
}
