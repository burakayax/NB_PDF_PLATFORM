import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { checkAndIncrementQuota } from "../../lib/quota.js";

const settleSchema = z.object({
  resultId: z.string().trim().min(1).max(256),
  toolId: z.string().trim().min(1).max(64),
});

/** Tarayıcı onayı bekleyen satırı, sonuç numarası yoksa bu süre içinde eşleştiririz. */
const PENDING_MATCH_WINDOW_MS = 15 * 60 * 1000;

/**
 * POST /api/entitlement/download-settle
 *
 * PDF API dosyayı teslim ettiğinde çağrılır (kullanıcının kendi oturum anahtarıyla).
 * Kota artık yalnızca tarayıcının "indirdim" onayına bağlı değildir: onay hiç gelmese
 * bile sunucu teslim anında hakkı düşer. Aynı indirme için tarayıcı onayı sonradan
 * gelirse tekrar düşmez — ikisi de aynı satırı atomik olarak "SUCCESS" yapmaya çalışır,
 * yalnızca ilki kazanır.
 */
export async function downloadSettleController(request: Request, response: Response) {
  const userId = request.authUser?.id;
  if (!userId) throw new HttpError(401, "Authentication is required.");
  const body = settleSchema.parse(request.body);

  let row = await prisma.downloadLog.findFirst({
    where: { userId, resultId: body.resultId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    // Tarayıcı kaydı sonuç numarasız açmış olabilir: aynı araç için bekleyen son satır.
    row = await prisma.downloadLog.findFirst({
      where: {
        userId,
        toolId: body.toolId,
        resultId: null,
        status: { not: "SUCCESS" },
        createdAt: { gte: new Date(Date.now() - PENDING_MATCH_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!row) {
    // Tarayıcı hiç kayıt açmadı (doğrudan indirme): kaydı biz açıp sayarız.
    row = await prisma.downloadLog.create({
      data: { userId, resultId: body.resultId, toolId: body.toolId, status: "PENDING" },
    });
  }

  const claimed = await prisma.downloadLog.updateMany({
    where: { id: row.id, userId, status: { not: "SUCCESS" } },
    data: { status: "SUCCESS", ackedAt: new Date() },
  });
  if (claimed.count === 0) {
    response.status(200).json({ ok: true, already: true });
    return;
  }

  const quota = await checkAndIncrementQuota(userId, row.toolId, 1, 0);
  response.status(200).json({ ok: true, quotaCounted: quota.allowed });
}
