import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

/**
 * SÖZLEŞME DENETÇİSİ — HESAP DEFTERİ ve KANIT.
 *
 * Her analiz, işlem BAŞLAMADAN ÖNCE bu tabloya (contract_review_logs) yazılır:
 *   • kullanıcının AÇIK ONAYI (sürüm, zaman, IP, tarayıcı) ve onayladığı bedel,
 *   • düşülen hak/kredi (kaynağı ve miktarı),
 *   • sonuç: DONE (rapor özeti + imza) ya da FAILED (+ iade zamanı ve nedeni).
 *
 * Neden veritabanı (bellek değil)? İş durumu bellekte tutulur; sunucu yeniden başlarsa kullanıcı
 * sonucu alamaz ama krediyi kaybetmiş olur. Defter, bu "ortada kalan" işleri bulup iade etmeyi ve
 * anlaşmazlıkta "kim, ne zaman, neyi onayladı, ne düşüldü, ne indirdi" sorusunu yanıtlamayı sağlar.
 *
 * GİZLİLİK: Belge metni ve rapor içeriği ASLA saklanmaz; yalnızca SHA-256 özetleri tutulur.
 */

/** Onay metninin sürümü: ekrandaki onay penceresi değişirse artırılır; her kayıt hangisini onayladığını taşır. */
export const CONSENT_VERSION = "2026-10-02";

export const REFUND_ABUSE_LIMIT_24H = 3;

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Anahtarları sıralı, `undefined` alanları atılmış kararlı JSON (aynı içerik → aynı özet). */
export function canonicalJson(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(o)
          .filter((k) => o[k] !== undefined)
          .sort()
          .map((k) => [k, norm(o[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(norm(value));
}

function proofKey(): string {
  // Oturum anahtarından AYRI, amaca özel türetilmiş anahtar.
  return `contract-review-proof:v1:${env.JWT_ACCESS_SECRET}`;
}

export type ProofRecord = { reportId: string; reportSha256: string; issuedAt: string; signature: string };

/** Rapora imza: kimlik + içerik özeti + üretim zamanı üzerinden HMAC-SHA256. */
export function signReport(reportId: string, report: unknown, issuedAt: Date): ProofRecord {
  const reportSha256 = sha256Hex(canonicalJson(report));
  const iso = issuedAt.toISOString();
  const signature = createHmac("sha256", proofKey()).update(`${reportId}.${reportSha256}.${iso}`).digest("hex");
  return { reportId, reportSha256, issuedAt: iso, signature };
}

/** İmza doğru mu? (zamanlama saldırısına dayanıklı karşılaştırma) */
export function verifySignature(p: ProofRecord): boolean {
  const expected = createHmac("sha256", proofKey()).update(`${p.reportId}.${p.reportSha256}.${p.issuedAt}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(p.signature ?? ""), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type NewLog = {
  id: string;
  userId: string;
  mode: "quick" | "full";
  units: number;
  chargeSource: "monthly_then_credit" | "credit" | "admin_exempt";
  chars: number;
  docSha256: string;
  consentVersion: string;
  clientIp: string | null;
  userAgent: string | null;
};

export async function createLog(l: NewLog): Promise<void> {
  await prisma.contractReviewLog.create({ data: { ...l, consentAt: new Date() } });
}

export async function markDone(id: string, proof: ProofRecord): Promise<void> {
  await prisma.contractReviewLog.updateMany({
    where: { id, status: "RUNNING" },
    data: {
      status: "DONE",
      reportSha256: proof.reportSha256,
      reportSignature: proof.signature,
      finishedAt: new Date(proof.issuedAt),
    },
  });
}

/**
 * İşi FAILED yapar ve — yalnızca BİR KEZ (atomik) — iade gerektiğini bildirir.
 * @returns iade yapılmalıysa log satırı; zaten işlenmişse (ya da yönetici muafsa) null.
 */
export async function claimRefund(id: string, reason: string): Promise<{ userId: string; mode: string; units: number; chargeSource: string } | null> {
  const row = await prisma.contractReviewLog.findUnique({ where: { id } });
  if (!row) return null;
  const claimed = await prisma.contractReviewLog.updateMany({
    where: { id, refundedAt: null, status: { not: "DONE" } },
    data: { status: "FAILED", failReason: reason.slice(0, 300), refundedAt: new Date(), finishedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  if (row.chargeSource === "admin_exempt") return null; // yönetici: hiçbir şey düşülmemişti
  return { userId: row.userId, mode: row.mode, units: row.units, chargeSource: row.chargeSource };
}

/** Son 24 saatte (iade edilen) başarısız analiz sayısı — kötüye kullanım koruması. */
export async function recentRefunds(userId: string): Promise<number> {
  return prisma.contractReviewLog.count({
    where: { userId, refundedAt: { gte: new Date(Date.now() - 24 * 3_600_000) } },
  });
}
