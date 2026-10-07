import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { logAdminAudit } from "./admin-audit.service.js";

/**
 * YÖNETİM — MUHASEBE DÖKÜMÜ.
 * GET /api/admin/financial-export?year=2026&format=csv|json
 *
 * Seçilen yılın ödeme ve fatura kayıtlarını (canlı + silinmiş hesapların arşivi) tek dosyada verir.
 * Amaç: kayıtları veritabanı dışında (muhasebeciniz, kendi diskiniz) de saklayabilmeniz.
 * Kart bilgisi içermez. Her indirme denetim kaydına yazılır.
 */

type Row = Record<string, string | number | boolean | null>;

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0] as Row);
  const lines = [cols.join(";")];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(";"));
  // Excel Türkçe karakterleri doğru göstersin diye BOM.
  return "\uFEFF" + lines.join("\r\n");
}

type CheckoutLike = Record<string, unknown> & { id: string; createdAt: string | Date };
type InvoiceLike = Record<string, unknown> & { checkoutId: string };

function build(checkouts: CheckoutLike[], invoices: InvoiceLike[], who: { userId: string; email: string }, source: "canlı" | "silinmiş hesap arşivi"): Row[] {
  const byCheckout = new Map(invoices.map((i) => [i.checkoutId, i]));
  return checkouts.map((c) => {
    const inv = byCheckout.get(c.id);
    const s = (k: string) => (c[k] === undefined || c[k] === null ? null : (c[k] as string | number));
    return {
      kaynak: source,
      kullanici_no: who.userId,
      eposta: who.email,
      odeme_no: c.id,
      iyzico_odeme_no: s("iyzicoPaymentId"),
      tarih: new Date(c.createdAt).toISOString(),
      tamamlanma: c["completedAt"] ? new Date(c["completedAt"] as string).toISOString() : null,
      durum: s("status"),
      plan: s("plan"),
      donem: s("billingCycle"),
      tutar_try: s("priceTry"),
      net_tutar: s("netAmount"),
      kdv_orani: s("kdvRate"),
      kdv_tutari: s("kdvAmount"),
      iade_tarihi: c["refundedAt"] ? new Date(c["refundedAt"] as string).toISOString() : null,
      iade_nedeni: s("refundReason"),
      fatura_no: inv ? ((inv["invoiceNo"] as string) ?? null) : null,
      fatura_durumu: inv ? ((inv["status"] as string) ?? null) : null,
      fatura_brut: inv ? ((inv["grossAmount"] as string) ?? null) : null,
      musteri_adi: inv ? ((inv["customerName"] as string) ?? null) : null,
      musteri_ulke: inv ? ((inv["customerCountry"] as string) ?? null) : null,
    };
  });
}

export async function adminFinancialExportController(req: Request, res: Response): Promise<void> {
  const year = Number.parseInt(String(req.query["year"] ?? new Date().getFullYear()), 10);
  if (!Number.isFinite(year) || year < 2020 || year > 2100) throw new HttpError(400, "Geçersiz yıl.");
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const inRange = { createdAt: { gte: from, lt: to } };

  const [checkouts, invoices, archives] = await Promise.all([
    prisma.paymentCheckout.findMany({ where: inRange, include: { user: { select: { id: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.invoice.findMany({ where: inRange }),
    prisma.financialRecordArchive.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const rows: Row[] = [];
  const liveByUser = new Map<string, typeof checkouts>();
  for (const c of checkouts) liveByUser.set(c.userId ?? "-", [...(liveByUser.get(c.userId ?? "-") ?? []), c]);
  for (const [uid, list] of liveByUser) {
    const email = list[0]?.user?.email ?? "";
    rows.push(...build(list as unknown as CheckoutLike[], invoices.filter((i) => list.some((c) => c.id === i.checkoutId)) as unknown as InvoiceLike[], { userId: uid, email }, "canlı"));
  }
  for (const a of archives) {
    const p = a.payload as { paymentCheckouts?: CheckoutLike[]; invoices?: InvoiceLike[] };
    const cs = (p.paymentCheckouts ?? []).filter((c) => {
      const t = new Date(c.createdAt);
      return t >= from && t < to;
    });
    rows.push(...build(cs, p.invoices ?? [], { userId: a.originalUserId, email: a.emailSnapshot }, "silinmiş hesap arşivi"));
  }
  rows.sort((x, y) => String(x["tarih"]).localeCompare(String(y["tarih"])));

  const actor = req.authUser;
  if (actor) await logAdminAudit({ userId: actor.id, email: actor.email }, "financial_export", String(year), `Muhasebe dökümü indirildi (${year}, ${rows.length} satır)`);

  if (req.query["format"] === "json") {
    res.setHeader("Content-Disposition", `attachment; filename="muhasebe-${year}.json"`);
    res.json({ year, generatedAt: new Date().toISOString(), rows });
    return;
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="muhasebe-${year}.csv"`);
  res.send(toCsv(rows));
}
