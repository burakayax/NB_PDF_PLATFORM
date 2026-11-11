import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { binListInfo } from "../../lib/bin-country.js";
import { exportExemptionOpen } from "../../lib/feature-switches.js";

/**
 * YÖNETİM — BIN listesi sağlığı (salt okunur).
 * GET /api/admin/payments/card-list-status
 * Liste boşsa ya da eskiyse ve son 30 günde "belirlenemedi" oranı yüksekse listenin yenilenmesi gerekir.
 */
const DAY_MS = 86_400_000;

export async function adminCardListStatusController(_request: Request, response: Response) {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const [total30d, unknown30d] = await Promise.all([
    prisma.paymentCheckout.count({ where: { createdAt: { gte: since }, cardCountry: { not: null } } }),
    prisma.paymentCheckout.count({ where: { createdAt: { gte: since }, cardCountry: "??" } }),
  ]);
  const info = binListInfo();
  const ageDays = info.generatedAt ? Math.floor((Date.now() - new Date(info.generatedAt).getTime()) / DAY_MS) : null;
  response.json({
    entries: info.entries,
    generatedAt: info.generatedAt,
    ageDays,
    stale: !info.exists || info.entries === 0 || (ageDays !== null && ageDays > 90),
    total30d,
    unknown30d,
    exemptionOpen: await exportExemptionOpen(),
  });
}
