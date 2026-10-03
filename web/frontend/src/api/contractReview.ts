import { getSaasApiBase } from "./saasBase";
import type { AiQuota, AiError } from "./ai";

/** Sözleşme Denetçisi tipleri — backend `contract-review.types.ts` ile aynı şekil. */
export type ContractRole =
  | "alici" | "satici" | "hizmet_alan" | "hizmet_veren" | "kiraci" | "kiraya_veren"
  | "isveren" | "isci" | "istekli" | "idare" | "diger";

export type Severity = "kritik" | "yuksek" | "orta" | "dusuk";
export type LegalStatus = "dayanak_var" | "mevzuata_aykiri" | "dogrulanamadi" | "ilgisiz";

export type LegalReference = { law: string; article: string; note: string; sourceUrl: string };

export type Finding = {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  clause: string;
  page: number | null;
  quote: string;
  quoteMatch: "exact" | "partial" | "none";
  whyRisky: string;
  impact: string;
  recommendation: string;
  suggestedText: string;
  legalStatus: LegalStatus;
  legalReferences: LegalReference[];
  confidence: "yuksek" | "orta" | "dusuk";
};

export type ContractMode = "quick" | "full";

/** Sunucunun rapora verdiği imzalı kayıt: rapor no, içerik özeti (SHA-256) ve doğrulama imzası. */
export type ContractProof = {
  reportId: string;
  reportSha256: string;
  issuedAt: string;
  signature: string;
};

export type ContractReport = {
  meta: {
    /** quick = hızlı tarama (tek geçiş, mevzuatsız); full = detaylı denetim. */
    mode?: ContractMode;
    docType: string;
    parties: string[];
    pageCount: number;
    role: ContractRole;
    analyzedAt: string;
    model: string;
    lawCheck: { performed: boolean; sources: Array<{ title: string; url: string }>; note: string };
  };
  riskLevel: Severity;
  headline: string;
  summary: string;
  priorities: Array<{ title: string; why: string; findingId: string | null }>;
  concernResponses: Array<{ note: string; response: string; findingIds: string[] }>;
  findings: Finding[];
  missingClauses: Array<{ title: string; why: string; suggestedText: string }>;
  questionsForUser: string[];
  assumptions: string[];
};

export type ContractJobView = {
  id: string;
  status: "running" | "done" | "error";
  mode?: ContractMode;
  stageIndex: number;
  stageCount: number;
  stageLabel: string;
  /** Bu işin tüm aşama adları (ilerleme listesi). */
  stageLabels?: string[];
  /** Bitince: raporun imzalı kaydı (dışa aktarılan dosyalara gömülür). */
  proof?: ContractProof;
  progressNote: string;
  report?: ContractReport;
  error?: string;
};

export type ContractReviewRequest = {
  text: string;
  role: ContractRole;
  roleNote?: string;
  sector: "ozel" | "kamu";
  contractValue?: string;
  playbook?: string;
  concerns?: string;
  /** Ön taramanın kimliği (harita yeniden kullanılır) ve sorulara verilen cevaplar. */
  /** quick = hızlı tarama (varsayılan değil); full = detaylı denetim. */
  mode?: ContractMode;
  /** Kullanıcının bedeli ve koşulları açıkça onayladığı bilgi — sunucu bunsuz işlem başlatmaz. */
  consent?: { accepted: boolean; version: string; units: number };
  prescanId?: string;
  answers?: Array<{ question: string; answer: string }>;
};

export type PrescanQuestion = { id: string; question: string; why: string; options: string[] };
export type PrescanView = {
  prescanId: string;
  docType: string;
  parties: Array<{ name: string; role: string }>;
  sectorGuess: "ozel" | "kamu";
  valueInDoc: string;
  pageCount: number;
  questions: PrescanQuestion[];
  /** Detaylı denetimin kredi bedeli. */
  units: number;
  /** Hızlı taramanın hak/kredi bedeli. */
  quickUnits?: number;
  /** Sunucunun geçerli onay metni sürümü. */
  consentVersion?: string;
};

export { estimateContractCredits, estimateQuickScanCredits } from "../lib/aiCredits";

function headers(token: string | null): Record<string, string> {
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function handle<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error((data?.message as string) || "Sözleşme analizi başlatılamadı.") as AiError;
    err.status = res.status;
    err.code = data?.error as string | undefined;
    if (data?.quota) err.quota = data.quota as AiQuota;
    if (typeof data?.units === "number") (err as AiError & { units?: number }).units = data.units;
    throw err;
  }
  return data as T;
}

/** Belgeyi tanır ve analizden ÖNCE sorulacak soruları getirir (hak düşmez). */
export async function prescanContract(text: string, token: string | null): Promise<PrescanView> {
  const res = await fetch(`${getSaasApiBase()}/api/ai/contract-review/prescan`, {
    method: "POST",
    headers: headers(token),
    credentials: "include",
    body: JSON.stringify({ text }),
  });
  return handle(res);
}

/** Analizi başlatır; iş kimliğini döner. */
export async function startContractReview(
  body: ContractReviewRequest,
  token: string | null,
): Promise<{ jobId: string; units: number; mode?: ContractMode; quota?: AiQuota }> {
  const res = await fetch(`${getSaasApiBase()}/api/ai/contract-review`, {
    method: "POST",
    headers: headers(token),
    credentials: "include",
    body: JSON.stringify(body),
  });
  return handle(res);
}

/** İş durumunu (bitince raporu) getirir. */
export async function getContractReview(id: string, token: string | null): Promise<ContractJobView> {
  const res = await fetch(`${getSaasApiBase()}/api/ai/contract-review/${encodeURIComponent(id)}`, {
    headers: headers(token),
    credentials: "include",
  });
  return handle(res);
}

/**
 * Kullanıcının raporu/boyalı PDF'i indirdiğini sunucu defterine bildirir (zaman + dosyanın SHA-256 özeti).
 * En iyi çaba: bildirim başarısız olsa da indirme engellenmez.
 */
export async function reportDownload(id: string, kind: "annotated" | "report", sha256: string, token: string | null): Promise<void> {
  try {
    await fetch(`${getSaasApiBase()}/api/ai/contract-review/${encodeURIComponent(id)}/download`, {
      method: "POST",
      headers: headers(token),
      credentials: "include",
      body: JSON.stringify({ kind, sha256 }),
    });
  } catch {
    /* sessiz */
  }
}

/** Raporu sunucu belleğinden hemen siler. */
export async function deleteContractReview(id: string, token: string | null): Promise<void> {
  try {
    await fetch(`${getSaasApiBase()}/api/ai/contract-review/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers(token),
      credentials: "include",
    });
  } catch {
    /* sessiz: kayıt zaten 30 dk içinde silinir */
  }
}
