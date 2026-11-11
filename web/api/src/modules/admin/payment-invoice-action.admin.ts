import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { triggerInvoiceGeneration } from "../payment/payment.service.js";
import { applyAdminInvoiceAction, type InvoiceTrigger } from "../payment/invoice-schedule.service.js";

/**
 * YÖNETİM — ERTELENMİŞ FATURA KARARI.
 * POST /api/admin/payments/:conversationId/invoice-action   gövde: { action }
 *   AUTO    otomatik kural, vade gününde kesilir
 *   VAT     vade gününde KDV'li kes (yurt içi müşteri)
 *   CANCEL  fatura kesme (yalnız satış gerçekten iptal/iade ise doğrudur)
 *   NOW     hemen kes (otomatik kurala göre)
 *   NOW_VAT hemen KDV'li kes
 */
const bodySchema = z.object({ action: z.enum(["AUTO", "VAT", "CANCEL", "NOW", "NOW_VAT"]) });

const trigger: InvoiceTrigger = (c, r, o) =>
  triggerInvoiceGeneration(c as Parameters<typeof triggerInvoiceGeneration>[0], r as Parameters<typeof triggerInvoiceGeneration>[1], o);

export async function adminInvoiceActionController(request: Request, response: Response) {
  const { conversationId } = request.params as { conversationId: string };
  if (!conversationId?.trim()) throw new HttpError(400, "conversationId is required.");
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) throw new HttpError(400, "Geçersiz işlem.");
  const actorEmail = request.authUser?.email;
  if (!request.authUser?.id || !actorEmail) throw new HttpError(401, "Authentication is required.");

  let result;
  try {
    result = await applyAdminInvoiceAction(conversationId, parsed.data.action, trigger);
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status) throw new HttpError(status, e instanceof Error ? e.message : "İşlem yapılamadı.");
    throw e;
  }
  await prisma.adminAuditLog
    .create({
      data: {
        userEmail: actorEmail,
        action: `INVOICE_${parsed.data.action}`,
        summary: `Fatura kararı: ${parsed.data.action} — sipariş ${conversationId} → ${result.invoiceStatus ?? "—"}${result.outcome ? ` (${result.outcome})` : ""}`,
      },
    })
    .catch(() => undefined);
  response.json({ ok: true, ...result });
}
