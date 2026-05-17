import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import {
  getSubscriptionStatus,
  getSubscriptionSummary,
  listPlans,
} from "./subscription.service.js";
import { processRefund, REFUND_WINDOW_DAYS } from "../payment/payment.service.js";

/*
 * Daily-quota HTTP surface (``/assert-feature`` and ``/record-usage``) has
 * been removed along with the legacy daily-limit system. All tool gating
 * now goes through the entitlement engine (``/api/entitlement/*``). The
 * remaining controllers are read-only surfaces for plan / status data.
 */

function requireUserId(request: Request) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }
  return userId;
}

export async function listPlansController(_request: Request, response: Response) {
  response.json({
    plans: await listPlans(),
  });
}

export async function currentSubscriptionController(request: Request, response: Response) {
  const userId = requireUserId(request);
  const summary = await getSubscriptionSummary(userId);
  response.json(summary);
}

export async function subscriptionStatusController(request: Request, response: Response) {
  const userId = requireUserId(request);
  const status = await getSubscriptionStatus(userId);
  response.json(status);
}

/**
 * Self-service abonelik iptali.
 * - 7 gün içinde: tam iade + anında FREE'ye düşür
 * - 7 günden sonra: abonelik süresi dolana kadar aktif kalır, yenileme yapılmaz
 */
export async function cancelSubscriptionController(request: Request, response: Response) {
  const userId = requireUserId(request);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "User not found.");
  if (user.plan === "FREE") {
    throw new HttpError(400, "Aktif ücretli bir aboneliğiniz bulunmamaktadır.");
  }

  // En son tamamlanmış ödemeyi bul
  const lastCheckout = await prisma.paymentCheckout.findFirst({
    where: { userId, status: "completed" },
    orderBy: { completedAt: "desc" },
  });

  if (!lastCheckout) {
    throw new HttpError(404, "Ödeme kaydı bulunamadı.");
  }

  const completedAt = lastCheckout.completedAt ?? lastCheckout.createdAt;
  const ageMs = Date.now() - completedAt.getTime();
  const withinWindow = ageMs <= REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  if (withinWindow) {
    // 7 gün içinde: tam iade
    const result = await processRefund(lastCheckout.conversationId, "self_service_cancel_refund");
    if (!result.ok) {
      if (result.reason === "already_refunded") {
        throw new HttpError(409, "Bu abonelik için zaten iade işlendi.");
      }
      throw new HttpError(500, "İade işlemi gerçekleştirilemedi. Lütfen destek ekibiyle iletişime geçin.");
    }
    response.json({ ok: true, action: "refunded", message: "Aboneliğiniz iptal edildi ve ücret iade edildi." });
  } else {
    // 7 günden sonra: yenilemeyi iptal et, süre dolana kadar aktif
    const orgId = lastCheckout.organizationId;
    if (orgId) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { subscriptionStatus: "canceled" },
      });
    }
    response.json({
      ok: true,
      action: "cancel_pending",
      message: "Aboneliginiz iptal edildi. Mevcut donem sonunda FREE plana gececeksiniz.",
    });
  }
}
