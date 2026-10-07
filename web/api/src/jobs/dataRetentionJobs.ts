import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { logError } from "../lib/app-logger.js";

const OPERATION_LOG_RETENTION_DAYS = 90;
const DOWNLOAD_LOG_RETENTION_DAYS = 90;
/** Çıktı dosyası parmak izi kayıtları (SHA-256; içerik yok): itiraz/iade anlaşmazlıkları için 1 yıl. */
const OUTPUT_RECORD_RETENTION_DAYS = 365;
/** Yapay zekâ istek defteri (içerik yok, yalnızca özet): aynı gerekçeyle 1 yıl. */
const AI_REQUEST_LOG_RETENTION_DAYS = 365;
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

/** Çıktı parmak izi kayıtlarını 1 yıl sonra SİLER (amaç — itiraz kanıtı — biter; KVKK md.4). */
async function purgeOldOutputRecords(): Promise<void> {
  const result = await prisma.outputRecord.deleteMany({
    where: { createdAt: { lt: daysAgo(OUTPUT_RECORD_RETENTION_DAYS) } },
  });
  if (result.count > 0) {
    await prisma.adminAuditLog.create({
      data: {
        userEmail: "system@retention",
        action: "RETENTION_PURGE_OUTPUT_RECORDS",
        summary: `${result.count} çıktı parmak izi kaydı silindi (${OUTPUT_RECORD_RETENTION_DAYS} günden eski).`,
      },
    });
  }
}

/** Yapay zekâ istek defterini 1 yıl sonra SİLER. */
async function purgeOldAiRequestLogs(): Promise<void> {
  const result = await prisma.aiRequestLog.deleteMany({
    where: { createdAt: { lt: daysAgo(AI_REQUEST_LOG_RETENTION_DAYS) } },
  });
  if (result.count > 0) {
    await prisma.adminAuditLog.create({
      data: {
        userEmail: "system@retention",
        action: "RETENTION_PURGE_AI_REQUEST_LOGS",
        summary: `${result.count} yapay zekâ istek kaydı silindi (${AI_REQUEST_LOG_RETENTION_DAYS} günden eski).`,
      },
    });
  }
}

/** Mali kayıt arşivi: yasal saklama süresi (retainUntil) dolunca silinir. */
async function purgeExpiredFinancialArchives(): Promise<void> {
  const result = await prisma.financialRecordArchive.deleteMany({ where: { retainUntil: { lt: new Date() } } });
  if (result.count > 0) {
    await prisma.adminAuditLog.create({
      data: {
        userEmail: "system@retention",
        action: "RETENTION_PURGE_FINANCIAL_ARCHIVE",
        summary: `${result.count} mali kayıt arşivi silindi (yasal saklama süresi doldu).`,
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
    safeRun("purgeOldOutputRecords", purgeOldOutputRecords);
    safeRun("purgeOldAiRequestLogs", purgeOldAiRequestLogs);
    safeRun("purgeExpiredFinancialArchives", purgeExpiredFinancialArchives);
    safeRun("purgeExpiredConsentLogs", purgeExpiredConsentLogs);
    safeRun("purgeOldRatingComments", purgeOldRatingComments);
  });
}
