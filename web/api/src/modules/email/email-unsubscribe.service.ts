import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { recordMarketingConsent } from "./marketing-consent.service.js";
import { sendMail } from "../../lib/mailer.js";
import { logger } from "../../lib/file-log.js";

/**
 * Pazarlama e-postaları için imzalı abonelikten-çıkış token'ı.
 * Kullanıcı girişi gerektirmez (token = yetki). HMAC-SHA256 ile imzalanır.
 */
const SECRET = env.JWT_ACCESS_SECRET;

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function makeUnsubscribeToken(userId: string): string {
  const payload = Buffer.from(userId, "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload);
  // Sabit-zamanlı karşılaştırma (timing attack'a karşı).
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/** API kökünden tam abonelikten-çıkış URL'i (e-postada kullanılır). */
export function unsubscribeUrlFor(userId: string): string {
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  return `${base}/api/email/unsubscribe?token=${makeUnsubscribeToken(userId)}`;
}

/**
 * Kullanıcıyı pazarlama listesinden çıkarır (idempotent).
 *
 * Ret ANINDA işlenir. Mevzuat 3 iş günü sınırı koyuyor; beklemek için bir
 * sebep yok, gecikme yalnızca risk üretir.
 */
export type UnsubscribeOutcome = {
  /** invalid = token bozuk/kullanıcı yok; done = şimdi çıkarıldı; already = zaten listede değildi. */
  status: "invalid" | "done" | "already";
  /** Daha önce çıkış nedeni verilmiş mi (tekrar sormamak için). */
  hasReason: boolean;
};

const REASON_PREFIX = "Ret nedeni:";

async function latestOptOutRow(userId: string) {
  return prisma.marketingConsentLog.findFirst({
    where: { userId, granted: false, source: "unsubscribe_link" },
    orderBy: { createdAt: "desc" },
    select: { id: true, consentText: true },
  });
}

export async function unsubscribeByToken(
  token: string,
  context?: { ip?: string | null; userAgent?: string | null },
): Promise<UnsubscribeOutcome> {
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return { status: "invalid", hasReason: false };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, marketingConsent: true },
  });
  if (!user) return { status: "invalid", hasReason: false };

  // Zaten listede değilse tekrar işlem YAPMA: aynı bağlantıya art arda
  // tıklamak (bot dahil) veritabanına yazı, deftere satır eklemesin.
  if (!user.marketingConsent) {
    const row = await latestOptOutRow(userId);
    return { status: "already", hasReason: !!row?.consentText?.startsWith(REASON_PREFIX) };
  }

  await prisma.user.updateMany({
    where: { id: userId },
    data: { marketingConsent: false, marketingUnsubscribedAt: new Date() },
  });

  // Reddin işlendiğinin KANITI. "Çıktım ama e-posta gelmeye devam etti"
  // şikâyetinde tek savunma budur.
  if (user.email) {
    await recordMarketingConsent({
      userId,
      email: user.email,
      granted: false,
      source: "unsubscribe_link",
      ip: context?.ip ?? null,
      userAgent: context?.userAgent ?? null,
    });
  }

  return { status: "done", hasReason: false };
}

/** Çıkış sayfasında sorulan nedenler. Anahtar formdan gelir, etiket kayda ve e-postaya yazılır. */
export const UNSUBSCRIBE_REASONS = {
  too_many: "Çok sık e-posta alıyorum",
  not_relevant: "İçerikler ilgimi çekmiyor",
  not_signed_up: "Bu e-postalara kayıt olduğumu hatırlamıyorum",
  no_longer_using: "Artık hizmeti kullanmıyorum",
  looks_spam: "E-postalar bana spam gibi geldi",
  other: "Diğer",
} as const;

export type UnsubscribeReasonKey = keyof typeof UNSUBSCRIBE_REASONS;

export function isUnsubscribeReason(v: unknown): v is UnsubscribeReasonKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(UNSUBSCRIBE_REASONS, v);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Çıkış nedenini kaydeder ve yöneticiye e-posta gönderir.
 *
 * Neden ZORUNLU DEĞİL ve çıkışı etkilemez: kullanıcı bağlantıya tıkladığı anda
 * zaten listeden çıkmıştır; bu form yalnız geri bildirimdir. Hata durumunda
 * çıkış bozulmaz.
 */
export async function saveUnsubscribeFeedback(
  token: string,
  input: { reason: unknown; comment: unknown },
): Promise<"ok" | "invalid" | "duplicate"> {
  const userId = verifyUnsubscribeToken(token);
  if (!userId || !isUnsubscribeReason(input.reason)) return "invalid";

  const label = UNSUBSCRIBE_REASONS[input.reason];
  const comment = typeof input.comment === "string" ? input.comment.trim().slice(0, 1000) : "";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, marketingConsent: true },
  });
  // Listede olan birinin "çıkış nedeni" olmaz.
  if (!user || user.marketingConsent) return "invalid";

  // Her çıkış için TEK geri bildirim: ikincisi kaydedilmez, e-posta da gitmez
  // (sayfayı art arda gönderen bot yönetici kutusunu dolduramasın).
  try {
    const row = await latestOptOutRow(userId);
    if (row?.consentText?.startsWith(REASON_PREFIX)) return "duplicate";
    if (row) {
      await prisma.marketingConsentLog.update({
        where: { id: row.id },
        data: { consentText: `${REASON_PREFIX} ${label}${comment ? ` — ${comment}` : ""}` },
      });
    }
  } catch (err) {
    logger.error("email-unsubscribe", "çıkış nedeni deftere yazılamadı", { detail: String(err) });
  }

  try {
    const html = `<p>Bir kullanıcı tanıtım e-postası listesinden çıktı ve neden belirtti.</p>
<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
<tr><td><b>Kullanıcı</b></td><td>${escapeHtml(user.email)}</td></tr>
<tr><td><b>Neden</b></td><td>${escapeHtml(label)}</td></tr>
<tr><td><b>Yorum</b></td><td>${comment ? escapeHtml(comment).replace(/\n/g, "<br>") : "—"}</td></tr>
</table>`;
    await sendMail({
      to: env.ADMIN_EMAIL,
      subject: `Tanıtım listesinden çıkış: ${label}`,
      html,
      text: `Kullanıcı: ${user.email}\nNeden: ${label}\nYorum: ${comment || "—"}`,
    });
  } catch (err) {
    logger.error("email-unsubscribe", "çıkış nedeni e-postası gönderilemedi", { detail: String(err) });
  }
  return "ok";
}

/** Çıkış sayfasındaki "Yeniden abone ol" metni — kanıt defterine aynen yazılır. */
export const RESUBSCRIBE_CONSENT_TEXT =
  "v1 · Abonelikten çıkış sayfasında \"Yeniden abone ol\" düğmesine basarak kampanya, ipucu ve yeniliklerden e-posta ile haberdar olmak istediğimi bildirdim.";

/** Kullanıcının kendi tıklamasıyla (POST) tanıtım iznini yeniden açar. */
export async function resubscribeByToken(
  token: string,
  context?: { ip?: string | null; userAgent?: string | null },
): Promise<"done" | "already" | "invalid"> {
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return "invalid";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, marketingConsent: true },
  });
  if (!user) return "invalid";
  // Zaten listedeyse tekrar yazma: deftere gereksiz onay satırı eklenmez.
  if (user.marketingConsent) return "already";

  await prisma.user.update({
    where: { id: userId },
    data: { marketingConsent: true, marketingConsentAt: new Date(), marketingUnsubscribedAt: null },
  });
  await recordMarketingConsent({
    userId,
    email: user.email,
    granted: true,
    source: "unsubscribe_page",
    consentText: RESUBSCRIBE_CONSENT_TEXT,
    ip: context?.ip ?? null,
    userAgent: context?.userAgent ?? null,
  });
  return "done";
}
