/**
 * Ödeme / PSP yönlendirmesinden sonra araç “indirme hazır” ekranını geri yüklemek için
 * localStorage anahtarı — kullanıcı kredi aldıktan sonra aynı result/job ile devam edebilir.
 */

import type { FeatureKey } from "../api/subscription";
import type { UserBalance } from "../api/entitlement";

export const NB_RESUME_PROCESS_KEY = "NB_RESUME_PROCESS";

/** Önbellekte çok eski kayıtları at */
export const NB_RESUME_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export type NbResumeProcessV1 = {
  v: 1;
  userId: string;
  toolId: FeatureKey;
  fileName: string;
  featureTitle: string;
  fallbackName: string;
  resultId?: string;
  mergeJobId?: string;
  /** Son bilinen maliyet (kotasız kullanıcı için yeterli kredi kontrolü). */
  requiredCredits: number;
  /** İnsan okuması / debug — gerçek indirme istemci kodunda ids ile yapılır */
  downloadUrl: string;
  timestamp: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFeatureKey(v: unknown): v is FeatureKey {
  const keys = new Set<string>([
    "split",
    "merge",
    "pdf-to-word",
    "word-to-pdf",
    "excel-to-pdf",
    "pdf-to-excel",
    "compress",
    "encrypt",
    "delete-pages",
    "rotate-pdf",
    "organize-pdf",
    "unlock-pdf",
    "watermark",
    "pdf-to-ppt",
    "ppt-to-pdf",
    "page-numbers",
    "repair-pdf",
    "pdf-to-image",
    "image-to-pdf",
    "html-to-pdf",
  ]);
  return typeof v === "string" && keys.has(v);
}

export function readNbResumeProcess(): NbResumeProcessV1 | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(NB_RESUME_PROCESS_KEY);
    if (!raw?.trim()) {
      return null;
    }
    const j: unknown = JSON.parse(raw);
    if (!isRecord(j) || j.v !== 1) {
      return null;
    }
    if (typeof j.userId !== "string" || !j.userId.trim()) {
      return null;
    }
    if (!isFeatureKey(j.toolId)) {
      return null;
    }
    if (typeof j.fileName !== "string" || typeof j.featureTitle !== "string") {
      return null;
    }
    if (typeof j.fallbackName !== "string") {
      return null;
    }
    const resultId = typeof j.resultId === "string" ? j.resultId.trim() || undefined : undefined;
    const mergeJobId = typeof j.mergeJobId === "string" ? j.mergeJobId.trim() || undefined : undefined;
    if (!resultId && !mergeJobId) {
      return null;
    }
    const requiredCredits =
      typeof j.requiredCredits === "number" && Number.isFinite(j.requiredCredits)
        ? Math.max(0, Math.trunc(j.requiredCredits))
        : 1;
    const downloadUrl = typeof j.downloadUrl === "string" ? j.downloadUrl : "";
    const timestamp = typeof j.timestamp === "number" && Number.isFinite(j.timestamp) ? j.timestamp : 0;
    return {
      v: 1,
      userId: j.userId.trim(),
      toolId: j.toolId,
      fileName: j.fileName,
      featureTitle: j.featureTitle,
      fallbackName: j.fallbackName,
      resultId,
      mergeJobId,
      requiredCredits,
      downloadUrl,
      timestamp,
    };
  } catch {
    return null;
  }
}

export function saveNbResumeProcess(payload: NbResumeProcessV1): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(NB_RESUME_PROCESS_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearNbResumeProcess(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(NB_RESUME_PROCESS_KEY);
  } catch {
    /* ignore */
  }
}

export function buildResumeDownloadUrl(
  toolId: FeatureKey,
  resultId?: string,
  mergeJobId?: string,
): string {
  if (mergeJobId) {
    return `/api/jobs/${encodeURIComponent(mergeJobId)}/download`;
  }
  if (resultId) {
    return `/api/pdf/result/${encodeURIComponent(resultId)}/download`;
  }
  return "";
}

/** PSP dönüşünden sonra kullanıcının indirmeye yetecek kadar kredisi var mı? */
export function canResumeAfterPayment(
  payload: NbResumeProcessV1,
  balance: UserBalance | null | undefined,
): boolean {
  if (!balance) {
    return false;
  }
  if (balance.role === "ADMIN") {
    return true;
  }
  if (balance.hasActiveSubscription) {
    return true;
  }
  return balance.creditBalance >= payload.requiredCredits;
}

export function isNbResumeStale(payload: NbResumeProcessV1, nowMs = Date.now()): boolean {
  return nowMs - payload.timestamp > NB_RESUME_MAX_AGE_MS;
}
