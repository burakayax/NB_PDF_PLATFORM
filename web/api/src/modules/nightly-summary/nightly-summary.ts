import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { buildSummary, trDayStart } from "../admin/payments-summary.admin.js";

/**
 * GECELİK ÖZET (yalnız okuma). Kişisel veri YOK: yalnız toplam sayılar. 5'ten küçük sayılar "<5" yazılır.
 * Yetki: `Authorization: Bearer <NIGHTLY_SUMMARY_TOKEN>`; token tanımlı değilse uç KAPALI (404).
 * Hiçbir değer günlüğe yazılmaz.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const num = (s: string | null | undefined): number => {
  const n = Number.parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const cur = (c: string | null | undefined) => (c ?? "TRY").trim().toUpperCase() || "TRY";
/** Küçük sayılar kişiyi tanıtabilir: 1-4 arası "<5" yazılır. */
const mask = (n: number): number | string => (n > 0 && n < 5 ? "<5" : n);

function tokenOk(request: Request): boolean {
  const expected = (process.env.NIGHTLY_SUMMARY_TOKEN ?? "").trim();
  if (expected.length < 32) return false;
  const h = String(request.headers.authorization ?? "");
  const provided = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function trYesterdayYmd(now = new Date()): string {
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000 - DAY_MS);
  return tr.toISOString().slice(0, 10);
}

export type NightlySummary = Awaited<ReturnType<typeof buildNightlySummary>>;

export async function buildNightlySummary(ymd: string) {
  const start = trDayStart(ymd);
  const end = new Date(start.getTime() + DAY_MS);
  const day = { gte: start, lt: end };

  const [
    newUsers, totalUsers, activeUsers, guestSessions,
    paidRows, refundRows, paidCount2, refundCount2,
    planGroups, ops, opsFailed, topTools, clientErrors, pendingPayments,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: day } }),
    prisma.user.count(),
    prisma.user.count({ where: { lastLoginAt: day } }),
    prisma.pageView.findMany({ where: { createdAt: day, userId: null }, select: { sessionId: true }, distinct: ["sessionId"] }),
    prisma.paymentCheckout.findMany({
      where: { completedAt: day },
      select: { completedAt: true, priceTry: true, paymentCurrency: true, invoiceStatus: true, invoice: { select: { id: true } } },
    }),
    prisma.paymentCheckout.findMany({
      where: { refundedAt: day },
      select: { refundedAt: true, priceTry: true, paymentCurrency: true },
    }),
    // Doğrulama için bağımsız ham sayım (Yol 2)
    prisma.paymentCheckout.count({ where: { completedAt: day } }),
    prisma.paymentCheckout.count({ where: { refundedAt: day } }),
    prisma.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.operationLog.count({ where: { createdAt: day } }),
    prisma.operationLog.count({ where: { createdAt: day, status: "FAILED" } }),
    prisma.operationLog.groupBy({ by: ["toolType"], where: { createdAt: day }, _count: { _all: true }, orderBy: { _count: { toolType: "desc" } }, take: 10 }),
    prisma.clientErrorLog.count({ where: { createdAt: day } }),
    prisma.paymentCheckout.count({ where: { status: "pending", createdAt: day } }),
  ]);

  // Yol 1: panelin kullandığı hesap (buildSummary)
  const { totals } = buildSummary(
    {
      paid: paidRows.filter((p) => p.completedAt).map((p) => ({
        at: p.completedAt as Date, amount: num(p.priceTry), currency: cur(p.paymentCurrency),
        invoiced: Boolean(p.invoice), scheduled: p.invoiceStatus === "scheduled" || p.invoiceStatus === null,
      })),
      refunds: refundRows.filter((r) => r.refundedAt).map((r) => ({ at: r.refundedAt as Date, amount: num(r.priceTry), currency: cur(r.paymentCurrency) })),
      invoices: [],
      creditNotes: [],
    },
    "day",
  );

  // Doğrulama: panel hesabının adedi == ham sayım
  const checks = [
    { name: "ödeme adedi (TL + yurt dışı)", panel: totals.paidCount + totals.foreignCount, raw: paidCount2 },
    { name: "iade adedi (TL)", panel: totals.refundedCount, raw: refundRows.filter((r) => cur(r.paymentCurrency) === "TRY").length },
    { name: "iade kayıt sayısı", panel: refundRows.length, raw: refundCount2 },
  ].map((c) => ({ ...c, ok: c.panel === c.raw }));

  const verified = checks.every((c) => c.ok);
  const paidSmall = totals.paidCount > 0 && totals.paidCount < 5;
  const refundSmall = totals.refundedCount > 0 && totals.refundedCount < 5;

  return {
    date: ymd,
    timezone: "Europe/Istanbul",
    generatedAt: new Date().toISOString(),
    verified,
    verification: checks,
    users: { new: mask(newUsers), total: totalUsers, active: mask(activeUsers), guestSessions: mask(guestSessions.length) },
    plans: Object.fromEntries(planGroups.map((g) => [g.plan, mask(g._count._all)])),
    sales: {
      currencyNote: "TL ve yurt dışı ayrı tutulur; kur dönüşümü yok",
      paidCountTRY: mask(totals.paidCount),
      paidTotalTRY: paidSmall ? "<5 işlem" : totals.paidTotal,
      refundCountTRY: mask(totals.refundedCount),
      refundTotalTRY: refundSmall ? "<5 işlem" : totals.refundedTotal,
      netTotalTRY: paidSmall || refundSmall ? "<5 işlem" : totals.netTotal,
      foreignPaymentCount: mask(totals.foreignCount),
      pendingCheckouts: mask(pendingPayments),
    },
    usage: {
      operations: ops,
      failedOperations: mask(opsFailed),
      topTools: topTools.map((t) => ({ tool: t.toolType, count: mask(t._count._all) })),
    },
    health: { clientErrors: mask(clientErrors) },
  };
}

export async function nightlySummaryController(request: Request, response: Response) {
  if (!(process.env.NIGHTLY_SUMMARY_TOKEN ?? "").trim()) throw new HttpError(404, "Not found.");
  if (!tokenOk(request)) throw new HttpError(403, "Forbidden.");
  const q = typeof request.query.date === "string" ? request.query.date : "";
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : trYesterdayYmd();
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(await buildNightlySummary(ymd));
}
