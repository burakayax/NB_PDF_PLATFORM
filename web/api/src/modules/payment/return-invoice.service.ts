import type { Invoice } from "@prisma/client";
import { env } from "../../config/env.js";
import { logger } from "../../lib/file-log.js";
import { sendMail } from "../../lib/mailer.js";
import { prisma } from "../../lib/prisma.js";
import { executeAdminRefund } from "./admin-refund.service.js";

/**
 * KURUMSAL İYİ NİYET İADESİ — müşteri bize İADE FATURASI keser, gelince parayı otomatik öderiz.
 *
 * Akış (hepsi otomatik):
 *  1) Yönetici "iade et" der → kesilmiş faturası olan kurumsal alıcıya e-posta gider (fatura PDF'i ekli):
 *     "iade faturası kesin; kesildiğinde ödemeniz yapılacaktır". Durum: requested.
 *  2) Saatlik tur BirFatura gelen kutusunu tarar; asıl faturamıza atıf yapan IADE tipli fatura gelince:
 *     durum received → PayTR iadesi → plan FREE → durum refunded; iade faturasının KDV'si KDV tablosuna otomatik düşer.
 *  3) 3. ve 7. günde müşteriye hatırlatma e-postası.
 *
 * Bireysel alıcıda iade faturası YOKTUR: fatura iptal edilir (markInvoiceCancelNeeded).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = [3, 7];
const pdfBackendBase = () => process.env.PDF_BACKEND_URL ?? "http://127.0.0.1:8000";

export type IncomingReturnInvoice = {
  invoice_uuid: string;
  invoice_no: string;
  issue_date: string;
  original_invoice_no: string;
  original_invoice_uuid: string;
  kdv_amount: string;
};

/** Saf eşleştirme: gelen iade faturası bu faturamıza mı ait? (UUID veya 16 haneli fatura no ile). */
export function matchIncomingToInvoice(
  inv: { externalId: string | null; invoiceNo: string | null },
  incoming: IncomingReturnInvoice[],
): IncomingReturnInvoice | null {
  const uuid = (inv.externalId ?? "").trim().toLowerCase();
  const no = (inv.invoiceNo ?? "").trim().toUpperCase();
  for (const r of incoming) {
    if (uuid && r.original_invoice_uuid.trim().toLowerCase() === uuid) return r;
    if (no && r.original_invoice_no.trim().toUpperCase() === no) return r;
  }
  return null;
}

/** Hatırlatma günü geldi mi? (daha önce gönderilen sayısı dikkate alınır). */
export function reminderDue(requestedAt: Date, sentCount: number, now = new Date()): boolean {
  const day = REMINDER_DAYS[sentCount];
  if (day === undefined) return false;
  return now.getTime() - requestedAt.getTime() >= day * DAY_MS;
}

/** Bu ödemenin faturası kesilmiş VE alıcı kurumsal mı? Öyleyse iade akışı "iade faturası bekle" olur. */
export async function findCorporateIssuedInvoice(checkoutId: string): Promise<Invoice | null> {
  const invoice = await prisma.invoice.findUnique({ where: { checkoutId } });
  if (!invoice?.externalId || invoice.status === "cancelled") return null;
  const user = await prisma.user.findUnique({ where: { id: invoice.userId }, select: { invoiceType: true } });
  return user?.invoiceType === "corporate" ? invoice : null;
}

async function fetchInvoicePdf(externalId: string): Promise<Buffer | null> {
  try {
    const r = await fetch(`${pdfBackendBase()}/api/internal/invoice-pdf-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: externalId }),
      signal: AbortSignal.timeout(45_000),
    });
    const d = (await r.json()) as { success?: boolean; pdfUrl?: string };
    if (!d.success || !d.pdfUrl) return null;
    const f = await fetch(d.pdfUrl, { signal: AbortSignal.timeout(45_000) });
    if (!f.ok) return null;
    return Buffer.from(await f.arrayBuffer());
  } catch (err) {
    logger.warn("payment", "[return-invoice] fatura PDF'i alınamadı", err instanceof Error ? err.message : err);
    return null;
  }
}

async function mailCustomer(invoice: Invoice, kind: "ask" | "remind"): Promise<void> {
  const pdf = await fetchInvoicePdf(invoice.externalId as string);
  const no = invoice.invoiceNo ?? "";
  const subject =
    kind === "ask"
      ? `Aboneliğiniz iptal edildi — iade faturası talebi${no ? ` (Fatura ${no})` : ""}`
      : `Hatırlatma: iade faturanızı bekliyoruz${no ? ` (Fatura ${no})` : ""}`;
  const text = [
    `Merhaba ${invoice.customerName},`,
    "",
    kind === "ask"
      ? "İsteğiniz üzerine aboneliğinizi iptal ettiniz."
      : "Aboneliğinizin iptaline ilişkin iade faturanızı henüz almadık.",
    `Ekte bulunan ${no ? `${no} numaralı ` : ""}faturaya istinaden bize bir iade faturası göndermenizi rica ederiz.`,
    "İade faturanız kesildiğinde ödemeniz tarafınıza yapılacaktır. Fatura sistemimize ulaştığında iade otomatik olarak başlatılır.",
    "",
    "İade faturasını, ekteki faturadaki alıcı (bizim) unvan ve vergi numarasına, ilgili fatura numarasına atıf yaparak e-Fatura sistemi üzerinden gönderebilirsiniz.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.55">${text
    .split("\n")
    .map((l) => (l ? `<p style="margin:0 0 10px">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : ""))
    .join("")}</div>`;
  await sendMail({
    to: invoice.customerEmail,
    subject,
    text,
    html,
    ...(pdf ? { attachments: [{ filename: `fatura-${no || "belge"}.pdf`, content: pdf, contentType: "application/pdf" }] } : {}),
  });
}

async function mailAdmin(subject: string, lines: string[]): Promise<void> {
  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">${lines
    .map((l) => `<p style="margin:0 0 8px">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
    .join("")}</div>`;
  await sendMail({ to: env.ADMIN_EMAIL, subject, text, html });
}

/** Yönetici iade dedi ve alıcı kurumsal: para HEMEN iade edilmez; iade faturası beklenir. */
export async function requestReturnInvoice(invoice: Invoice, reason: string, force: boolean): Promise<void> {
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      returnStatus: "requested",
      returnRequestedAt: new Date(),
      returnReason: reason.slice(0, 500),
      returnForce: force,
      returnReminderCount: 0,
    },
  });
  await mailCustomer(invoice, "ask").catch((err) =>
    logger.error("payment", "[return-invoice] müşteri e-postası gönderilemedi", err instanceof Error ? err.message : err),
  );
}

/** Bireysel alıcı: iade yapıldı ama kesilmiş fatura iptal edilmeli. Programla iptal ucu teyitli değil → yönetici uyarılır. */
export async function markInvoiceCancelNeeded(invoice: Invoice, reason: string): Promise<void> {
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { returnStatus: "cancel_needed", returnReason: reason.slice(0, 500) },
  });
  await mailAdmin("Fatura iptali gerekiyor", [
    `${invoice.customerName} için ${invoice.invoiceNo ?? invoice.externalId} numaralı fatura, ödeme iade edildiği için İPTAL edilmeli.`,
    "BirFatura panelinden iptal edin (e-arşiv iptali ayın 20'sine kadar yapılabilir). İade faturası KESMEYİN.",
    `Gerekçe: ${reason}`,
  ]).catch(() => {});
}

async function listIncoming(sinceIso: string): Promise<IncomingReturnInvoice[] | null> {
  try {
    const r = await fetch(`${pdfBackendBase()}/api/internal/return-invoices/incoming`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sinceIso }),
      signal: AbortSignal.timeout(90_000),
    });
    const d = (await r.json()) as { success?: boolean; items?: IncomingReturnInvoice[] };
    return d.success ? (d.items ?? []) : null;
  } catch (err) {
    logger.warn("payment", "[return-invoice] gelen kutu okunamadı", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Saatlik tur: bekleyen iade faturalarını yakalar, parayı öder, hatırlatma gönderir. */
export async function processReturnInvoices(now = new Date()): Promise<Record<string, number>> {
  const tally: Record<string, number> = {};
  const bump = (k: string) => (tally[k] = (tally[k] ?? 0) + 1);

  const pending = await prisma.invoice.findMany({
    where: { returnStatus: { in: ["requested", "received"] } },
    include: { checkout: { select: { conversationId: true } } },
    take: 200,
  });
  if (pending.length === 0) return tally;

  const oldest = pending.reduce((a, p) => ((p.returnRequestedAt ?? now) < a ? (p.returnRequestedAt ?? now) : a), now);
  const incoming = await listIncoming(new Date(oldest.getTime() - DAY_MS).toISOString());

  for (const inv of pending) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { returnLastCheckedAt: now } });
    const match = incoming ? matchIncomingToInvoice(inv, incoming) : null;

    if (match || inv.returnStatus === "received") {
      const uuid = match?.invoice_uuid ?? inv.returnInvoiceUuid;
      if (match) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            returnStatus: "received",
            returnInvoiceUuid: match.invoice_uuid || null,
            returnInvoiceNo: match.invoice_no || null,
            returnKdvAmount: match.kdv_amount || null,
            returnReceivedAt: now,
          },
        });
      }
      try {
        await executeAdminRefund(inv.checkout.conversationId, `iade faturası alındı (${match?.invoice_no ?? inv.returnInvoiceNo ?? uuid})`, true);
        await prisma.invoice.update({ where: { id: inv.id }, data: { returnStatus: "refunded" } });
        bump("refunded");
      } catch (err) {
        // "received" kalır; bir sonraki tur yeniden dener.
        logger.error("payment", "[return-invoice] otomatik iade başarısız", err instanceof Error ? err.message : err);
        bump("refund_failed");
      }
      continue;
    }

    if (inv.returnRequestedAt && reminderDue(inv.returnRequestedAt, inv.returnReminderCount, now)) {
      await mailCustomer(inv, "remind").catch(() => {});
      await prisma.invoice.update({ where: { id: inv.id }, data: { returnReminderCount: { increment: 1 } } });
      bump("reminded");
    }
  }
  return tally;
}
