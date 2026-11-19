import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { arePaymentsEnabled } from "../payment/payments-gate.middleware.js";
import { logAdminAudit } from "./admin-audit.service.js";

/**
 * TEK SEFERLİK — canlıya geçmeden önce YÖNETİCİ HESAPLARINA ait test ödemelerini siler.
 * POST /api/admin/payments/reset-test-data   gövde: { confirm?: "SIL" }
 *
 * Güvenlik kuralları:
 *  - Ödemeler AÇIKKEN çalışmaz (gerçek müşteri ödemesi gelmiş olabilir).
 *  - YALNIZ rolü ADMIN olan kullanıcıların kayıtlarına dokunur; başka kullanıcıya ait ödeme varsa silinmez, sayısı bildirilir.
 *  - "SIL" yazılmadıkça yalnız SAYAR (önizleme); hiçbir şeyi değiştirmez.
 *  - Silinen: ödeme kayıtları (+ bağlı fatura kayıtları ve kart kanıtları), yönetici hesaplarının kupon kullanımları,
 *    yönetici hesaplarındaki ek AI kredisi / CV geçişi / ek koltuk sayaçları.
 *  - Silinmeyen: kullanıcılar, ziyaretçi/analitik, araç kullanım sayaçları, BirFatura/PayTR tarafındaki kayıtlar.
 */
export async function adminResetTestPaymentsController(request: Request, response: Response) {
  if (await arePaymentsEnabled()) {
    throw new HttpError(409, "Ödemeler AÇIKKEN test verisi silinemez. Önce 'Ödemeleri kapat' deyin.");
  }
  const confirm = (request.body as { confirm?: unknown } | undefined)?.confirm === "SIL";

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  const adminIds = admins.map((a) => a.id);

  const [checkouts, foreignCount] = await Promise.all([
    prisma.paymentCheckout.findMany({ where: { userId: { in: adminIds } }, select: { id: true } }),
    prisma.paymentCheckout.count({ where: { userId: { notIn: adminIds } } }),
  ]);
  const checkoutIds = checkouts.map((c) => c.id);

  const [invoices, couponUses, usersWithBonus, usersWithCvPass, teamsWithSeats] = await Promise.all([
    prisma.invoice.count({ where: { checkoutId: { in: checkoutIds } } }),
    prisma.couponUse.count({ where: { userId: { in: adminIds } } }),
    prisma.user.count({ where: { id: { in: adminIds }, bonusAiCredits: { gt: 0 } } }),
    prisma.user.count({ where: { id: { in: adminIds }, cvPassUntil: { not: null } } }),
    prisma.team.count({ where: { ownerId: { in: adminIds }, extraSeats: { gt: 0 } } }),
  ]);

  const counts = {
    payments: checkoutIds.length,
    invoices,
    couponUses,
    usersWithBonusCredits: usersWithBonus,
    usersWithCvPass,
    teamsWithExtraSeats: teamsWithSeats,
    otherUsersPaymentsKept: foreignCount,
  };

  if (!confirm) {
    response.json({ deleted: false, counts });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.couponUse.deleteMany({ where: { userId: { in: adminIds } } });
    // Fatura kayıtları ödeme kaydına bağlıdır; ödeme silinince (cascade) birlikte gider.
    await tx.paymentCheckout.deleteMany({ where: { id: { in: checkoutIds } } });
    await tx.user.updateMany({ where: { id: { in: adminIds } }, data: { bonusAiCredits: 0, cvPassUntil: null } });
    await tx.team.updateMany({ where: { ownerId: { in: adminIds } }, data: { extraSeats: 0 } });
  });

  await logAdminAudit(
    { userId: request.authUser!.id, email: request.authUser!.email },
    "payments.reset_test_data",
    null,
    `Test ödemeleri temizlendi: ${counts.payments} ödeme, ${counts.invoices} fatura kaydı, ${counts.couponUses} kupon kullanımı`,
    counts,
  );
  response.json({ deleted: true, counts });
}
