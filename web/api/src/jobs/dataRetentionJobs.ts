import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { logError } from "../lib/app-logger.js";

const OPERATION_LOG_RETENTION_DAYS = 90;
const DOWNLOAD_LOG_RETENTION_DAYS = 90;
/** VUK Madde 253: Faturalar 10 yıl arşivlenir (silinmez). */
const INVOICE_ARCHIVE_DAYS = 10 * 365;

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

export function registerDataRetentionJobs() {
  // Her gece 02:00 — veri saklama politikası uygulama
  cron.schedule("0 2 * * *", () => {
    safeRun("archiveOldOperationLogs", archiveOldOperationLogs);
    safeRun("archiveOldDownloadLogs", archiveOldDownloadLogs);
    safeRun("archiveOldInvoices", archiveOldInvoices);
  });
}
