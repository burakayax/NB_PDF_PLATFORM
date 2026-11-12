import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { REFUND_WINDOW_DAYS } from "../payment/payment.service.js";

/**
 * YÖNETİM — ÖDEME LİSTESİ (iade için kişiyi bulma).
 * GET /api/admin/payments
 *
 * Filtreler: q (e-posta / ad / sipariş no / fatura adı / fatura no), status, plan, kind,
 * from–to (işlem tarihi, YYYY-MM-DD, iki uç dahil), minAmount–maxAmount (TL).
 *
 * Neden bellekte süzülüyor: tutar veritabanında metin olarak tutuluyor ve arama büyük/küçük
 * harf duyarsız olmalı (geliştirmede SQLite, canlıda Postgres). Süzme öncesi en fazla
 * MAX_SCAN kayıt taranır; bu sınır aşılırsa `truncated: true` döner ve ekranda uyarı çıkar.
 */

const MAX_SCAN = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["all", "completed", "refunded", "pending", "failed"]).optional().default("all"),
  plan: z.enum(["all", "FREE", "STARTER", "PLUS", "PRO", "BUSINESS"]).optional().default("all"),
  kind: z.enum(["all", "plan", "topup", "cvpass", "seats"]).optional().default("all"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

type Kind = "plan" | "topup" | "cvpass" | "seats";

function kindOf(c: { bonusAiCredits: number | null; cvPassHours: number | null; seatsOnly: boolean }): Kind {
  if (c.bonusAiCredits) return "topup";
  if (c.cvPassHours) return "cvpass";
  if (c.seatsOnly) return "seats";
  return "plan";
}

function fullName(u: { firstName: string | null; lastName: string | null; name: string | null }): string {
  const joined = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return joined || (u.name ?? "").trim();
}

const toAmount = (s: string | null | undefined): number => {
  const n = Number.parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export async function adminListPaymentsController(request: Request, response: Response) {
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query.");
  }
  const f = parsed.data;

  const where: Record<string, unknown> = {};
  if (f.status !== "all") where.status = f.status;
  if (f.plan !== "all") where.plan = f.plan;
  if (f.from || f.to) {
    const range: { gte?: Date; lt?: Date } = {};
    if (f.from) range.gte = new Date(`${f.from}T00:00:00.000Z`);
    if (f.to) range.lt = new Date(new Date(`${f.to}T00:00:00.000Z`).getTime() + DAY_MS);
    where.createdAt = range;
  }

  const scanned = await prisma.paymentCheckout.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_SCAN + 1,
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, name: true } },
      invoice: { select: { invoiceNo: true, status: true, customerName: true, returnStatus: true, returnInvoiceNo: true } },
    },
  });
  const truncated = scanned.length > MAX_SCAN;
  const rowsAll = truncated ? scanned.slice(0, MAX_SCAN) : scanned;

  const needle = (f.q ?? "").toLocaleLowerCase("tr-TR");
  const now = Date.now();

  const filtered = rowsAll
    .map((c) => {
      const kind = kindOf(c);
      const amount = toAmount(c.priceTry);
      const paidAt = c.completedAt ?? c.createdAt;
      return {
        c,
        row: {
          conversationId: c.conversationId,
          createdAt: c.createdAt.toISOString(),
          completedAt: c.completedAt?.toISOString() ?? null,
          refundedAt: c.refundedAt?.toISOString() ?? null,
          refundReason: c.refundReason ?? null,
          status: c.status,
          kind,
          plan: c.plan,
          billingCycle: c.billingCycle,
          amount,
          currency: c.paymentCurrency,
          netAmount: c.netAmount ?? null,
          kdvAmount: c.kdvAmount ?? null,
          kdvRate: c.kdvRate ?? null,
          discountPercent: c.discountPercent ?? null,
          provider: c.iyzicoPaymentId?.startsWith("paytr:") ? "paytr" : "diger",
          invoiceStatus: c.invoice?.status ?? c.invoiceStatus ?? null,
          invoiceNo: c.invoice?.invoiceNo ?? null,
          returnStatus: c.invoice?.returnStatus ?? null,
          returnInvoiceNo: c.invoice?.returnInvoiceNo ?? null,
          invoiceDueAt: c.invoiceDueAt?.toISOString() ?? null,
          invoiceAction: c.invoiceAction ?? null,
          cardCountry: c.cardCountry ?? null,
          user: { id: c.user.id, email: c.user.email, name: fullName(c.user) },
          refundable: c.status === "completed",
          withinRefundWindow: now - paidAt.getTime() <= REFUND_WINDOW_DAYS * DAY_MS,
        },
      };
    })
    .filter(({ c, row }) => {
      if (f.kind !== "all" && row.kind !== f.kind) return false;
      if (f.minAmount !== undefined && row.amount < f.minAmount) return false;
      if (f.maxAmount !== undefined && row.amount > f.maxAmount) return false;
      if (needle) {
        const hay = [
          c.user.email,
          fullName(c.user),
          c.conversationId,
          c.invoice?.customerName ?? "",
          c.invoice?.invoiceNo ?? "",
        ]
          .join("\n")
          .toLocaleLowerCase("tr-TR");
        if (!hay.includes(needle)) return false;
      }
      return true;
    })
    .map((x) => x.row);

  const sum = (st: string) =>
    Math.round(filtered.filter((r) => r.status === st).reduce((a, r) => a + r.amount, 0) * 100) / 100;

  response.json({
    rows: filtered.slice(f.offset, f.offset + f.limit),
    total: filtered.length,
    offset: f.offset,
    limit: f.limit,
    truncated,
    refundWindowDays: REFUND_WINDOW_DAYS,
    totals: {
      completedCount: filtered.filter((r) => r.status === "completed").length,
      completedAmount: sum("completed"),
      refundedCount: filtered.filter((r) => r.status === "refunded").length,
      refundedAmount: sum("refunded"),
    },
  });
}
