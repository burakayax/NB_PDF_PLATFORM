import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { recordMarketingConsent } from "./marketing-consent.service.js";

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
export async function unsubscribeByToken(
  token: string,
  context?: { ip?: string | null; userAgent?: string | null },
): Promise<boolean> {
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  await prisma.user.updateMany({
    where: { id: userId },
    data: { marketingConsent: false, marketingUnsubscribedAt: new Date() },
  });

  // Reddin işlendiğinin KANITI. "Çıktım ama e-posta gelmeye devam etti"
  // şikâyetinde tek savunma budur.
  if (user?.email) {
    await recordMarketingConsent({
      userId,
      email: user.email,
      granted: false,
      source: "unsubscribe_link",
      ip: context?.ip ?? null,
      userAgent: context?.userAgent ?? null,
    });
  }

  return true;
}
