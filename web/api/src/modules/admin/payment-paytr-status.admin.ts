import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { getPaytrCredentials } from "../payment/paytr/paytr.service.js";
import { queryPaytrStatus } from "../payment/paytr/paytr.client.js";
import { readCardEvidence } from "../payment/card-evidence.service.js";

/**
 * YÖNETİM — PayTR DURUM SORGUSU (salt okunur).
 * GET /api/admin/payments/:conversationId/paytr-status
 *
 * Seçilen ödemeyi PayTR "Durum Sorgu" servisinde (POST /odeme/durum-sorgu) sorgular ve cevabı
 * olduğu gibi (izinli alanlarla) döndürür: PayTR siparişi bulabiliyor mu, test mi canlı mı,
 * tutar, varsa iadeler. Veritabanını DEĞİŞTİRMEZ, para hareketi yapmaz.
 * Tam kart numarası/provizyon kodu bilerek yanıta konmaz; yalnız kart markası ve ilk 6 hane (BIN) gösterilir.
 */

const SAFE_FIELDS = [
  "payment_amount",
  "payment_total",
  "payment_date",
  "currency",
  "net_tutar",
  "kesinti_tutari",
  "taksit",
  "odeme_tipi",
  "kart_marka",
  "test_mode",
  "returns",
] as const;

export async function adminPaytrStatusController(request: Request, response: Response) {
  const { conversationId } = request.params as { conversationId: string };
  if (!conversationId?.trim()) {
    throw new HttpError(400, "conversationId is required.");
  }

  const checkout = await prisma.paymentCheckout.findUnique({
    where: { conversationId },
    select: { conversationId: true, iyzicoPaymentId: true },
  });
  if (!checkout) {
    throw new HttpError(404, "Payment not found.");
  }
  if (!checkout.iyzicoPaymentId?.startsWith("paytr:")) {
    throw new HttpError(400, "Bu ödeme PayTR ile alınmamış; PayTR'de sorgulanamaz.");
  }
  const merchantOid = checkout.iyzicoPaymentId.slice("paytr:".length);

  let result;
  try {
    result = await queryPaytrStatus(merchantOid, getPaytrCredentials());
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `PayTR'ye ulaşılamadı: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!result.ok) {
    response.json({ ok: false, merchantOid, errNo: result.errNo, errMsg: result.errMsg });
    return;
  }

  const fields: Record<string, unknown> = {};
  for (const k of SAFE_FIELDS) {
    if (result.raw[k] !== undefined) fields[k] = result.raw[k];
  }
  // Kartın yerli/yabancı ayrımı için yalnız ilk 6 hane (BIN) gösterilir; tam maskeli numara ASLA döndürülmez.
  const pan = String(result.raw.masked_pan ?? "");
  const bin = /^\d{6}/.exec(pan)?.[0];
  if (bin) fields.kart_bin = bin;
  // Kayıtlı (şifreli saklanan) kart kanıtı: yalnız yönetici isteğinde çözülür.
  let evidence: { bin: string | null; country: string | null; verdict: string } | null = null;
  try {
    evidence = await readCardEvidence(conversationId);
  } catch {
    evidence = null;
  }
  response.json({ ok: true, merchantOid, testMode: result.testMode, fields, savedEvidence: evidence });
}
