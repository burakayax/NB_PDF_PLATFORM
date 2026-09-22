import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { logError } from "../lib/app-logger.js";

const OPERATION_LOG_RETENTION_DAYS = 90;
const DOWNLOAD_LOG_RETENTION_DAYS = 90;
/** VUK Madde 253: Faturalar 10 yıl arşivlenir (silinmez). */
const INVOICE_ARCHIVE_DAYS = 10 * 365;
/**
 * Ticari ileti onay kanıtları: Ticari İletişim Yönetmeliği, onayın geçerliliği
 * bittikten sonra 3 yıl saklanmasını istiyor. Kanıt olmadan "izni vardı"
 * denemez; süre dolmadan silinmemeli, dolduktan sonra da tutulmamalı.
 */
const CONSENT_LOG_RETENTION_DAYS = 3 * 365;
/**
 * Araç puanlarındaki serbest metin açıklamalar.
 *
 * NEDEN SİLİNİYOR: Puanın kendisi (yıldız) kimliksiz bir sayıdır ve ortalamayı
 * oluşturduğu için kalır. Açıklama ise kullanıcının yazdığı serbest metindir;
 * içine istemeden kişisel bilgi yazılmış olabilir ve teşhis değeri birkaç ay
 * sonra biter. Amacı biten veri saklanmaz (KVKK md.4 — ilgili olma ve
 * sınırlılık ilkesi).
 */
const RATING_COMMENT_RETENTION_DAYS = 180;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function safeRun(name: string, fn: () => Promise<void>) {
  fn().catch((err) => {
    logError({
      category: "unhandled",
      message: `[cron/${name}] ${err instanceof Error ? err.message : String(err)}`,
      status: 500,
      method: "CRON",
      path: `/${name}`,
    });
  });
}

/** Operation loglarını 90 günden sonra arşivler (siler değil). */
async function archiveOldOperationLogs(): Promise<void> {
  const cutoff = daysAgo(OPERATION_LOG_RETENTION_DAYS);
  const now = new Date();

  const result = await prisma.operationLog.updateMany({
    where: { createdAt: { lt: cutoff }, isArchived: false },
    data: { isArchived: true, archivedAt: now },
  });

  if (result.count > 0) {
    await prisma.adminAuditLog.create({
      data: {
        userEmail: "system@retention",
        action: "RETENTION_ARCHIVE_OPERATION_LOGS",
        summary: `${result.count} operation log(s) archived (older than ${OPERATION_LOG_RETENTION_DAYS} days).`,
      },
    });
  }
}

/** Download loglarını 90 günden sonra arşivler (siler değil). */
async function archiveOldDownloadLogs(): Promise<void> {
  const cutoff = daysAgo(DOWNLOAD_LOG_RETENTION_DAYS);
  const now = new Date();

  const result = await prisma.downloadLog.updateMany({
    where: { createdAt: { lt: cutoff }, isArchived: false },
    data: { isArchived: true, archivedAt: now },
  });

  if (result.count > 0) {
    await prisma.adminAuditLog.create({
      data: {
        userEmail: "system@retention",
        action: "RETENTION_ARCHIVE_DOWNLOAD_LOGS",
        summary: `${result.count} download log(s) archived (older than ${DOWNLOAD_LOG_RETENTION_DAYS} days).`,
      },
    });
  }
}

/** Fatura arşivleme — VUK Madde 253 gereği 10 yıllık kayıtlar arşivlenir (silinmez). */
async function archiveOldInvoices(): Promise<void> {
  const cutoff = daysAgo(INVOICE_ARCHIVE_DAYS);
  const now = new Date();

  const result = await prisma.invoice.updateMany({
    where: { createdAt: { lt: cutoff }, isArchived: false },
    data: { isArchived: true, archivedAt: now },
  });

  if (result.count > 0) {
    await prisma.adminAuditLog.create({
      data: {
        userEmail: "system@retention",
        action: "RETENTION_ARCHIVE_INVOICES",
        summary: `${result.count} invoice(s) archived (older than ${INVOICE_ARCHIVE_DAYS} days — VUK Article 253).`,
      },
    });
  }
}

/**
 * Süresi dolmuş ticari ileti onay kanıtlarını siler.
 *
 * Kanıtın saklanması yükümlülük, süresiz saklanması ihlaldir.
 */
async function purgeExpiredConsentLogs(): Promise<void> {
  const cutoff = daysAgo(CONSENT_LOG_RETENTION_DAYS);
  const result = await prisma.marketingConsentLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    await prisma.adminAuditLog.create({
      data: {
        userEmail: "system@retention",
        action: "RETENTION_PURGE_CONSENT_LOGS",
        summary: `${result.count} onay kanıtı silindi (${CONSENT_LOG_RETENTION_DAYS} günden eski).`,
      },
    });
  }
}

/**
 * Eski puan açıklamalarını temizler — puanın kendisi korunur.
 *
 * `comment` alanı boşaltılır, satır silinmez: satırın silinmesi ortalamayı
 * ve oy sayısını değiştirirdi, oysa kişinin verdiği puan hâlâ geçerli.
 */
async function purgeOldRatingComments(): Promise<void> {
  const cutoff = daysAgo(RATING_COMMENT_RETENTION_DAYS);
  const result = await prisma.toolRating.updateMany({
    where: { createdAt: { lt: cutoff }, comment: { not: null } },
    data: { comment: null },
  });

  if (result.count > 0) {
    await prisma.adminAuditLog.create({
      data: {
        userEmail: "system@retention",
        action: "RETENTION_PURGE_RATING_COMMENTS",
        summary: `${result.count} puan açıklaması silindi (${RATING_COMMENT_RETENTION_DAYS} günden eski); puanlar korundu.`,
      },
    });
  }
}

export function registerDataRetentionJobs() {
  // Her gece 02:00 — veri saklama politikası uygulama
  cron.schedule("0 2 * * *", () => {
    safeRun("archiveOldOperationLogs", archiveOldOperationLogs);
    safeRun("archiveOldDownloadLogs", archiveOldDownloadLogs);
    safeRun("archiveOldInvoices", archiveOldInvoices);
    safeRun("purgeExpiredConsentLogs", purgeExpiredConsentLogs);
    safeRun("purgeOldRatingComments", purgeOldRatingComments);
  });
}
