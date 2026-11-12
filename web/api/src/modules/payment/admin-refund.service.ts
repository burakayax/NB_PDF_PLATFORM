import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { processRefund, refundPaytrCheckoutIfApplicable, REFUND_WINDOW_DAYS } from "./payment.service.js";

/**
 * Yönetici iadesinin ÇEKİRDEĞİ: PayTR'ye iade gönderir, kaydı "iade edildi" yapar, planı FREE'ye düşürür.
 * Hem yönetici butonu (normal) hem de gelen iade faturası yakalanınca otomatik iade bunu kullanır.
 * Başarısızsa kayıt DEĞİŞMEZ ve HttpError fırlatır.
 */
export async function executeAdminRefund(
  conversationId: string,
  reason: string,
  forceOverrideWindow: boolean,
): Promise<{ userId: string; planBefore: string; providerRefunded: boolean }> {
  let providerRefunded = false;
  if (forceOverrideWindow) {
    const checkout = await prisma.paymentCheckout.findUnique({ where: { conversationId } });
    if (!checkout) throw new HttpError(404, "Payment not found.");
    if (checkout.status === "refunded") throw new HttpError(409, "Payment already refunded.");
    if (checkout.status !== "completed") throw new HttpError(400, `Cannot refund a payment with status "${checkout.status}".`);
    const gw = await refundPaytrCheckoutIfApplicable(checkout);
    if (gw && !gw.ok) throw new HttpError(502, `PayTR iadesi başarısız, kayıt değiştirilmedi: ${gw.error ?? "bilinmeyen hata"}`);
    providerRefunded = gw !== null;
    await prisma.$transaction(async (tx) => {
      await tx.paymentCheckout.update({
        where: { conversationId },
        data: { status: "refunded", refundedAt: new Date(), refundReason: `[admin-force] ${reason}`.slice(0, 500) },
      });
      await tx.user.update({ where: { id: checkout.userId }, data: { plan: "FREE" } });
      if (checkout.organizationId) {
        await tx.organization.update({
          where: { id: checkout.organizationId },
          data: { plan: "FREE", subscriptionStatus: "canceled", subscriptionExpiry: null },
        });
      }
    });
    return { userId: checkout.userId, planBefore: checkout.plan, providerRefunded };
  }

  const result = await processRefund(conversationId, `admin: ${reason}`, async (c) => {
    const gw = await refundPaytrCheckoutIfApplicable(c);
    if (gw === null) return { ok: true }; // PayTR ödemesi değil: eski akış (iade elle yapılır)
    providerRefunded = true;
    return gw;
  });
  if (!result.ok) {
    if (result.reason === "provider_failed") throw new HttpError(502, `PayTR iadesi başarısız, kayıt değiştirilmedi: ${result.detail}`);
    const statusMap: Record<string, number> = { not_found: 404, already_refunded: 409, window_expired: 422, not_completed: 400 };
    const reasonMsg: Record<string, string> = {
      not_found: "Payment record not found.",
      already_refunded: "This payment has already been refunded.",
      window_expired: `Refund window of ${REFUND_WINDOW_DAYS} days has expired. Use forceOverrideWindow: true to override.`,
      not_completed: "Cannot refund a payment that has not been completed.",
    };
    throw new HttpError(statusMap[result.reason] ?? 400, reasonMsg[result.reason] ?? "Refund failed.");
  }
  return { userId: result.userId, planBefore: result.planBefore, providerRefunded };
}
