import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";

/**
 * YÖNETİM — ÖDEME / İADE / KDV ÖZET TABLOSU (gün – ay – yıl).
 * GET /api/admin/payments/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&group=day|month|year
 *
 * Kaynaklar (hepsi Türkiye saatiyle gruplanır):
 *  - Ödeme tutarı: tamamlanan ödemeler (completedAt), yalnız TL.
 *  - İade tutarı: iade edilen ödemeler (refundedAt), yalnız TL.
 *  - KDV: KESİLMİŞ faturaların KDV'si (fatura tarihi) − iade faturası KDV'si (iade faturası tarihi).
 *    Yani "ödenecek KDV" faturası gerçekten kesilmiş işlemlerden hesaplanır; henüz kesilmemiş (bekleyen)
 *    ödemelerin tahmini KDV'si ayrı bir satırda gösterilir ve toplama KATILMAZ.
 *  - Döviz (USD/EUR) ödemeler TL toplamlarına karıştırılmaz; ayrı sayılır.
 */

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const MAX_ROWS = 20_000;

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  group: z.enum(["day", "month", "year"]).optional().default("month"),
});

export type SummaryGroup = "day" | "month" | "year";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (s: string | null | undefined): number => {
  const n = Number.parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Anı Türkiye saatine göre gün/ay/yıl anahtarına çevirir. */
export function periodKey(d: Date, group: SummaryGroup): string {
  const iso = new Date(d.getTime() + TR_OFFSET_MS).toISOString();
  if (group === "day") return iso.slice(0, 10);
  if (group === "month") return iso.slice(0, 7);
  return iso.slice(0, 4);
}

/** Türkiye saatiyle gün başlangıcı (UTC anı). */
export function trDayStart(ymd: string): Date {
  return new Date(new Date(`${ymd}T00:00:00.000Z`).getTime() - TR_OFFSET_MS);
}

export type SummaryRow = {
  period: string;
  paidCount: number;
  paidTotal: number;
  refundedCount: number;
  refundedTotal: number;
  netTotal: number;
  kdvIssued: number;
  kdvCredited: number;
  kdvNet: number;
  pendingKdvEstimate: number;
  foreignCount: number;
};

const emptyRow = (period: string): SummaryRow => ({
  period,
  paidCount: 0,
  paidTotal: 0,
  refundedCount: 0,
  refundedTotal: 0,
  netTotal: 0,
  kdvIssued: 0,
  kdvCredited: 0,
  kdvNet: 0,
  pendingKdvEstimate: 0,
  foreignCount: 0,
});

export type SummaryInput = {
  paid: Array<{ at: Date; amount: number; currency: string; invoiced: boolean; scheduled: boolean }>;
  refunds: Array<{ at: Date; amount: number; currency: string }>;
  invoices: Array<{ at: Date; kdv: number; currency: string }>;
  creditNotes: Array<{ at: Date; kdv: number; currency: string }>;
};

/** Saf hesap: veritabanından bağımsız, test edilebilir. */
export function buildSummary(input: SummaryInput, group: SummaryGroup, kdvRatePct = 20): { rows: SummaryRow[]; totals: SummaryRow } {
  const map = new Map<string, SummaryRow>();
  const row = (d: Date) => {
    const k = periodKey(d, group);
    let r = map.get(k);
    if (!r) {
      r = emptyRow(k);
      map.set(k, r);
    }
    return r;
  };
  for (const p of input.paid) {
    const r = row(p.at);
    if (p.currency !== "TRY") {
      r.foreignCount += 1;
      continue;
    }
    r.paidCount += 1;
    r.paidTotal += p.amount;
    // Faturası henüz kesilmemiş ama kesilecek ödemenin tahmini KDV'si (KDV dahil tutardan).
    if (!p.invoiced && p.scheduled) r.pendingKdvEstimate += p.amount - p.amount / (1 + kdvRatePct / 100);
  }
  for (const x of input.refunds) {
    if (x.currency !== "TRY") continue;
    const r = row(x.at);
    r.refundedCount += 1;
    r.refundedTotal += x.amount;
  }
  for (const i of input.invoices) {
    if (i.currency !== "TRY") continue;
    row(i.at).kdvIssued += i.kdv;
  }
  for (const c of input.creditNotes) {
    if (c.currency !== "TRY") continue;
    row(c.at).kdvCredited += c.kdv;
  }
  const rows = [...map.values()].sort((a, b) => (a.period < b.period ? 1 : -1));
  const totals = emptyRow("Toplam");
  for (const r of rows) {
    r.netTotal = r.paidTotal - r.refundedTotal;
    r.kdvNet = r.kdvIssued - r.kdvCredited;
    for (const k of Object.keys(totals) as Array<keyof SummaryRow>) {
      if (k !== "period") (totals[k] as number) += r[k] as number;
    }
  }
  for (const r of [...rows, totals]) {
    for (const k of Object.keys(r) as Array<keyof SummaryRow>) {
      if (k !== "period" && typeof r[k] === "number") (r[k] as number) = round2(r[k] as number);
    }
  }
  return { rows, totals };
}

export async function adminPaymentsSummaryController(request: Request, response: Response) {
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Geçersiz tarih aralığı.");
  const { from, to, group } = parsed.data;
  const start = trDayStart(from);
  const end = new Date(trDayStart(to).getTime() + 24 * 60 * 60 * 1000); // bitiş günü dahil
  if (end <= start) throw new HttpError(400, "Bitiş tarihi başlangıçtan önce olamaz.");

  const [paid, refunds, invoices, creditNotes] = await Promise.all([
    prisma.paymentCheckout.findMany({
      where: { completedAt: { gte: start, lt: end } },
      select: { completedAt: true, priceTry: true, paymentCurrency: true, invoiceStatus: true, invoice: { select: { id: true } } },
      take: MAX_ROWS,
    }),
    prisma.paymentCheckout.findMany({
      where: { refundedAt: { gte: start, lt: end } },
      select: { refundedAt: true, priceTry: true, paymentCurrency: true },
      take: MAX_ROWS,
    }),
    prisma.invoice.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true, kdvAmount: true, currency: true },
      take: MAX_ROWS,
    }),
    prisma.invoice.findMany({
      where: { creditNoteStatus: "issued", creditNoteIssuedAt: { gte: start, lt: end } },
      select: { creditNoteIssuedAt: true, kdvAmount: true, currency: true },
      take: MAX_ROWS,
    }),
  ]);

  const cur = (c: string | null | undefined) => (c ?? "TRY").trim().toUpperCase() || "TRY";
  const data = buildSummary(
    {
      paid: paid
        .filter((p) => p.completedAt)
        .map((p) => ({
          at: p.completedAt as Date,
          amount: num(p.priceTry),
          currency: cur(p.paymentCurrency),
          invoiced: Boolean(p.invoice),
          scheduled: p.invoiceStatus === "scheduled" || p.invoiceStatus === null,
        })),
      refunds: refunds.filter((r) => r.refundedAt).map((r) => ({ at: r.refundedAt as Date, amount: num(r.priceTry), currency: cur(r.paymentCurrency) })),
      invoices: invoices.map((i) => ({ at: i.createdAt, kdv: num(i.kdvAmount), currency: cur(i.currency) })),
      creditNotes: creditNotes
        .filter((c) => c.creditNoteIssuedAt)
        .map((c) => ({ at: c.creditNoteIssuedAt as Date, kdv: num(c.kdvAmount), currency: cur(c.currency) })),
    },
    group,
  );

  // "Bu ay ödenecek KDV": takvim ayı (TR saati) için ayrı, aralıktan bağımsız hesap.
  const now = new Date();
  const monthKey = periodKey(now, "month");
  const monthStart = trDayStart(`${monthKey}-01`);
  const [mInv, mCn] = await Promise.all([
    prisma.invoice.findMany({ where: { createdAt: { gte: monthStart }, currency: "TRY" }, select: { kdvAmount: true }, take: MAX_ROWS }),
    prisma.invoice.findMany({
      where: { creditNoteStatus: "issued", creditNoteIssuedAt: { gte: monthStart }, currency: "TRY" },
      select: { kdvAmount: true },
      take: MAX_ROWS,
    }),
  ]);
  const monthKdv = round2(mInv.reduce((a, i) => a + num(i.kdvAmount), 0) - mCn.reduce((a, i) => a + num(i.kdvAmount), 0));

  response.json({
    group,
    from,
    to,
    rows: data.rows,
    totals: data.totals,
    currentMonth: { period: monthKey, kdvNet: monthKdv },
    truncated: [paid, refunds, invoices, creditNotes].some((a) => a.length >= MAX_ROWS),
  });
}
