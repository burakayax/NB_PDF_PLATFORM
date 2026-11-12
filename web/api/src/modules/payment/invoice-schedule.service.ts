import { invoicePaymentId } from "./invoice-labels.js";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { sendMail } from "../../lib/mailer.js";
import { logger } from "../../lib/file-log.js";
import { exportExemptionOpen } from "../../lib/feature-switches.js";
import { captureCardEvidence, type CardVerdict } from "./card-evidence.service.js";

/**
 * ERTELENMİŞ FATURA.
 *
 * Neden: 7 günlük koşulsuz iade veriliyor; fatura ödemeyle hemen kesilirse iade durumunda hem e-fatura
 * kontörü boşa gider hem de iade faturası gerekir. Bu yüzden fatura, ödemeden birkaç gün sonra kesilir;
 * arada iade edilirse fatura hiç kesilmez.
 *
 * Yasal sınır: Vergi Usul Kanunu md. 231/5 — fatura, mal teslimi/hizmet ifasından itibaren en geç 7 gün içinde
 * düzenlenir (e-Fatura/e-Arşiv'de de geçerli; geç kesilen fatura "düzenlenmemiş" sayılabilir). Bu yüzden varsayılan
 * bekleme 156 saattir (6,5 gün): iade süresinin neredeyse tamamını kapsar ama yasal sınırın içinde, hata olursa
 * yeniden deneme payı kalır. INVOICE_DELAY_HOURS ile değiştirilir; 0 = eski davranış (hemen kes).
 *
 * invoiceStatus: scheduled → processing → issued | cancelled | skipped_refunded
 * invoiceAction (yönetici kararı): null = otomatik kural, "VAT" = KDV'li kes, "CANCEL" = kesme.
 */

export const LEGAL_INVOICE_DAYS = 7;
const HOUR_MS = 3_600_000;

export function invoiceDelayHours(): number {
  const raw = Number.parseFloat(process.env.INVOICE_DELAY_HOURS ?? "");
  if (!Number.isFinite(raw) || raw < 0) return 156;
  return Math.min(raw, LEGAL_INVOICE_DAYS * 24 - 6); // yasal sınırın en az 6 saat gerisinde
}

type CheckoutRow = NonNullable<Awaited<ReturnType<typeof prisma.paymentCheckout.findUnique>>>;
export type InvoiceTrigger = (
  checkout: CheckoutRow,
  retrieveResult: unknown,
  opts?: { forceDomestic?: boolean },
) => Promise<"ok" | "paused" | "failed">;

/** Ödeme tamamlanınca: faturayı "bekliyor" olarak planlar (yalnız ilk kez). */
export async function scheduleInvoiceRecord(checkoutId: string, delayHours: number, now = new Date()): Promise<void> {
  await prisma.paymentCheckout.updateMany({
    where: { id: checkoutId, invoiceStatus: null },
    data: { invoiceStatus: "scheduled", invoiceDueAt: new Date(now.getTime() + delayHours * HOUR_MS) },
  });
}

function adminMail(subject: string, lines: string[]): Promise<void> {
  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${lines
    .map((l) => `<p style="margin:0 0 8px">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
    .join("")}</div>`;
  return sendMail({ to: env.ADMIN_EMAIL, subject, html, text }).catch((e) => {
    logger.warn("payment", "[invoice-schedule] yönetici e-postası gönderilemedi", e instanceof Error ? e.message : e);
  });
}

/**
 * Ödeme anında kartı değerlendirir (istisna açık + yabancı para birimi). Fatura adresi yurt dışı olduğu hâlde kart
 * yurt içi çıktıysa ya da belirlenemediyse yöneticiye e-posta atar; böylece fatura kesilmeden önce karar verilebilir.
 * ASLA hata fırlatmaz.
 */
export async function reviewCardAtPayment(checkout: {
  id: string;
  userId: string;
  conversationId: string;
  paymentCurrency?: string | null;
  priceTry: string;
  invoiceDueAt?: Date | null;
  iyzicoPaymentId?: string | null;
}): Promise<CardVerdict | null> {
  try {
    const verdict = await captureCardEvidence(checkout);
    if (!verdict || verdict === "FOREIGN") return verdict;
    if (!(await exportExemptionOpen())) return verdict;

    const user = await prisma.user.findUnique({
      where: { id: checkout.userId },
      select: { email: true, billingCountryCode: true },
    });
    const declared = (user?.billingCountryCode ?? "").toUpperCase().trim();
    if (!declared || declared === "TR") return verdict; // adres de yurt içi: karar zaten KDV'li, sormaya gerek yok

    const claimed = await prisma.paymentCheckout.updateMany({
      where: { id: checkout.id, invoiceReviewNotifiedAt: null },
      data: { invoiceReviewNotifiedAt: new Date() },
    });
    if (claimed.count === 0) return verdict;

    const due = checkout.invoiceDueAt ? checkout.invoiceDueAt.toLocaleString("tr-TR") : "—";
    await adminMail(
      verdict === "UNKNOWN"
        ? "Kart ülkesi belirlenemedi — fatura kararı gerekiyor"
        : "Yurt dışı adresli müşteri Türk kartıyla ödedi — fatura kararı",
      [
        verdict === "UNKNOWN"
          ? "Yurt dışı adresli bir müşterinin ödemesinde kartın hangi ülkeden olduğu belirlenemedi."
          : "Yurt dışı adresli bir müşteri, yurt içinde çıkarılmış bir kartla ödeme yaptı.",
        `Müşteri: ${user?.email ?? "—"}`,
        `Fatura adresi ülkesi: ${declared}`,
        `Tutar: ${checkout.priceTry} ${checkout.paymentCurrency ?? ""}`.trim(),
        `Kart sonucu: ${verdict === "UNKNOWN" ? "belirlenemedi" : "yurt içi kart"}`,
        `Hiçbir işlem yapmazsanız fatura ${due} tarihinde KDV'Lİ kesilecek.`,
        "Karar vermek için: Yönetim paneli → Ödemeler ve iade → ilgili satırın Fatura sütunu (KDV'li kes / Fatura kesme / Şimdi kes).",
        `Sipariş no: ${checkout.conversationId}`,
      ],
    );
    return verdict;
  } catch (e) {
    logger.warn("payment", "[invoice-schedule] kart incelemesi başarısız", e instanceof Error ? e.message : e);
    return null;
  }
}

const lateAlertSent = new Map<string, number>();

function retrieveShim(c: CheckoutRow) {
  return { paidPrice: c.priceTry, currency: c.paymentCurrency, paymentId: invoicePaymentId(c) } as unknown;
}

export type ProcessOutcome = "issued" | "cancelled" | "skipped_refunded" | "paused" | "failed" | "busy" | "not_found";

/** Tek bir ödemenin faturasını (vadesi gelmiş ya da "şimdi kes" denmiş) işler. */
export async function processInvoiceNow(checkoutId: string, trigger: InvoiceTrigger): Promise<ProcessOutcome> {
  const claim = await prisma.paymentCheckout.updateMany({
    where: { id: checkoutId, OR: [{ invoiceStatus: "scheduled" }, { invoiceStatus: null }] },
    data: { invoiceStatus: "processing" },
  });
  if (claim.count === 0) return "busy";
  const c = await prisma.paymentCheckout.findUnique({ where: { id: checkoutId } });
  if (!c) return "not_found";

  const finish = async (status: string) => {
    await prisma.paymentCheckout.update({ where: { id: c.id }, data: { invoiceStatus: status } });
  };

  if (c.status === "refunded" || c.refundedAt) {
    await finish("skipped_refunded");
    return "skipped_refunded";
  }
  if (c.invoiceAction === "CANCEL") {
    await finish("cancelled");
    return "cancelled";
  }
  const existing = await prisma.invoice.findUnique({ where: { checkoutId: c.id }, select: { id: true } });
  if (existing) {
    await finish("issued");
    return "issued";
  }

  const attempt = await trigger(c, retrieveShim(c), { forceDomestic: c.invoiceAction === "VAT" });
  if (attempt === "ok") {
    await finish("issued");
    // Yarış: fatura kesilirken müşteri iade aldıysa iade faturası otomatik üretilmemiş olabilir → yöneticiye haber.
    const after = await prisma.paymentCheckout.findUnique({ where: { id: c.id }, select: { status: true, refundedAt: true } });
    if (after?.status === "refunded" || after?.refundedAt) {
      await adminMail("Dikkat: fatura kesilirken iade yapıldı — iade faturası gerekebilir", [
        `Sipariş no: ${c.conversationId}`,
        "Müşteri tam fatura kesilirken iade aldı. Fatura kesildi ama iade faturası otomatik oluşturulmamış olabilir.",
        "BirFatura panelinden bu faturaya iade faturası kesin.",
      ]);
    }
    return "issued";
  }
  await finish("scheduled"); // paused / failed: bir sonraki turda yeniden denenir
  if (attempt === "failed") {
    const deadline = (c.completedAt ?? c.createdAt).getTime() + LEGAL_INVOICE_DAYS * 24 * HOUR_MS;
    const last = lateAlertSent.get(c.id) ?? 0;
    if (Date.now() > deadline - 12 * HOUR_MS && Date.now() - last > 12 * HOUR_MS) {
      lateAlertSent.set(c.id, Date.now());
      await adminMail("ACİL: Fatura kesilemedi, yasal 7 gün süre dolmak üzere", [
        `Sipariş no: ${c.conversationId}`,
        `Yasal son tarih: ${new Date(deadline).toLocaleString("tr-TR")}`,
        "Fatura kesme denemesi başarısız oldu. BirFatura bağlantısını ve anahtarlarını kontrol edin; gerekirse faturayı elle kesin.",
      ]);
    }
    return "failed";
  }
  return "paused";
}

/** Saatlik iş: vadesi gelen faturaları keser. Takılı kalmış "processing" kayıtlarını geri alır. */
export async function processDueInvoices(trigger: InvoiceTrigger, now = new Date()) {
  await prisma.paymentCheckout.updateMany({
    where: { invoiceStatus: "processing", invoiceDueAt: { lt: new Date(now.getTime() - 3 * HOUR_MS) } },
    data: { invoiceStatus: "scheduled" },
  });
  const due = await prisma.paymentCheckout.findMany({
    where: { invoiceStatus: "scheduled", invoiceDueAt: { lte: now } },
    orderBy: { invoiceDueAt: "asc" },
    take: 50,
    select: { id: true },
  });
  const tally: Record<string, number> = {};
  for (const { id } of due) {
    const r = await processInvoiceNow(id, trigger);
    tally[r] = (tally[r] ?? 0) + 1;
  }
  return tally;
}

export type AdminInvoiceAction = "AUTO" | "VAT" | "CANCEL" | "NOW" | "NOW_VAT";

/**
 * Yönetici kararı. AUTO: otomatik kural (vade günü). VAT: vade gününde KDV'li kes. CANCEL: fatura kesme.
 * NOW / NOW_VAT: hemen kes (otomatik kurala göre / KDV'li). Kesilmiş ya da işlenmekte olan faturaya dokunulmaz.
 */
export async function applyAdminInvoiceAction(
  conversationId: string,
  action: AdminInvoiceAction,
  trigger: InvoiceTrigger,
): Promise<{ invoiceStatus: string | null; invoiceAction: string | null; outcome?: ProcessOutcome }> {
  const c = await prisma.paymentCheckout.findUnique({
    where: { conversationId },
    select: { id: true, status: true, invoiceStatus: true, invoiceAction: true, completedAt: true },
  });
  if (!c) throw Object.assign(new Error("Payment not found."), { statusCode: 404 });
  if (c.status !== "completed") {
    throw Object.assign(new Error("Yalnız tamamlanmış (iade edilmemiş) ödemenin faturası yönetilebilir."), { statusCode: 409 });
  }
  const hasInvoice = await prisma.invoice.findUnique({ where: { checkoutId: c.id }, select: { id: true } });
  const editable = !hasInvoice && (c.invoiceStatus === null || c.invoiceStatus === "scheduled" || c.invoiceStatus === "cancelled");
  if (!editable) {
    throw Object.assign(new Error("Bu ödemenin faturası zaten kesilmiş ya da işleniyor."), { statusCode: 409 });
  }

  if (action === "CANCEL") {
    await prisma.paymentCheckout.update({ where: { id: c.id }, data: { invoiceAction: "CANCEL", invoiceStatus: "cancelled" } });
    return { invoiceStatus: "cancelled", invoiceAction: "CANCEL" };
  }

  const newAction = action === "VAT" || action === "NOW_VAT" ? "VAT" : null;
  const immediate = action === "NOW" || action === "NOW_VAT";
  const now = new Date();
  // Planı olmayan (eski / fatura durdurulmuşken alınmış) ödemede vade = ödeme + bekleme süresi; geçmişse hemen.
  const planned = new Date((c.completedAt ?? now).getTime() + invoiceDelayHours() * HOUR_MS);
  const dueAt = immediate ? now : c.invoiceStatus === "scheduled" ? undefined : planned > now ? planned : now;
  await prisma.paymentCheckout.update({
    where: { id: c.id },
    data: { invoiceAction: newAction, invoiceStatus: "scheduled", ...(dueAt ? { invoiceDueAt: dueAt } : {}) },
  });
  if (immediate) {
    const outcome = await processInvoiceNow(c.id, trigger);
    const fresh = await prisma.paymentCheckout.findUnique({ where: { id: c.id }, select: { invoiceStatus: true, invoiceAction: true } });
    return { invoiceStatus: fresh?.invoiceStatus ?? null, invoiceAction: fresh?.invoiceAction ?? null, outcome };
  }
  return { invoiceStatus: "scheduled", invoiceAction: newAction };
}

