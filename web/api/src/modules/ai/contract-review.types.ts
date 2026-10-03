/** Sözleşme Denetçisi — paylaşılan tipler (frontend `api/contractReview.ts` ile aynı şekil). */

export type ContractRole =
  | "alici"
  | "satici"
  | "hizmet_alan"
  | "hizmet_veren"
  | "kiraci"
  | "kiraya_veren"
  | "isveren"
  | "isci"
  | "istekli"
  | "idare"
  | "diger";

export type ContractReviewInput = {
  /** Sayfa işaretli metin: her sayfa `<<<SAYFA n>>>` satırıyla başlar. */
  text: string;
  role: ContractRole;
  /** Kullanıcının kendi ifadesi (rol "diger" ise ya da ek açıklama). */
  roleNote?: string;
  /** "ozel" = özel hukuk sözleşmesi; "kamu" = kamu ihalesi/idari şartname. */
  sector: "ozel" | "kamu";
  /** Yaklaşık sözleşme bedeli (serbest metin: "2.400.000 TL"). Cezaların etkisini hesaplamak için. */
  contractValue?: string;
  /** Kullanıcının kendi standartları / kırmızı çizgileri (serbest metin, satır satır). */
  playbook?: string;
  /** "Özellikle şuna dikkat et" notu. */
  concerns?: string;
  /** Ön taramada sorulan soruların cevapları (cevaplanmayanlar boş answer ile gelir). */
  answers?: Array<{ question: string; answer: string }>;
};

export type Severity = "kritik" | "yuksek" | "orta" | "dusuk";

export type FindingCategory =
  | "ceza"
  | "fesih"
  | "odeme"
  | "sorumluluk"
  | "fikri_mulkiyet"
  | "gizlilik"
  | "uyusmazlik"
  | "teslim_sure"
  | "garanti"
  | "tek_tarafli_hak"
  | "celisme"
  | "hesaplama"
  | "belirsizlik"
  | "mevzuat"
  | "diger";

export type LegalReference = {
  law: string;
  article: string;
  /** Kaynaktan okunan, bulguyla ilgili kısa içerik özeti. */
  note: string;
  sourceUrl: string;
};

export type LegalStatus = "dayanak_var" | "mevzuata_aykiri" | "dogrulanamadi" | "ilgisiz";

export type Finding = {
  id: string;
  severity: Severity;
  category: FindingCategory;
  title: string;
  /** Madde numarası/başlığı ("Madde 12.3", "Ek-2 md. 4"). */
  clause: string;
  /** Alıntının bulunduğu sayfa (metinden hesaplanır; bulunamazsa null). */
  page: number | null;
  /** Belgeden birebir alıntı. Eksik-madde bulgularında boş. */
  quote: string;
  /** Alıntı belgede ne kadar doğrulandı. */
  quoteMatch: "exact" | "partial" | "none";
  whyRisky: string;
  /** Kullanıcının rolü açısından somut etki (rakamla). */
  impact: string;
  /** Ne yapılmalı. */
  recommendation: string;
  /** Maddenin önerilen yeni metni (varsa). */
  suggestedText: string;
  legalStatus: LegalStatus;
  legalReferences: LegalReference[];
  confidence: "yuksek" | "orta" | "dusuk";
};

export type MissingClause = { title: string; why: string; suggestedText: string };

export type ContractMode = "quick" | "full";

export type ContractReport = {
  meta: {
    /** quick = hızlı tarama (tek geçiş, mevzuatsız); full = detaylı denetim. */
    mode: ContractMode;
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
  /** Asistan ağzıyla, kullanıcıya doğrudan yazılmış yönetici özeti. */
  summary: string;
  /** Pazarlıkta ilk kapatılması gereken en önemli konular. */
  priorities: Array<{ title: string; why: string; findingId: string | null }>;
  findings: Finding[];
  missingClauses: MissingClause[];
  /** Kullanıcının kendi notlarına tek tek yanıt (not → ne bulundu / bulunmadı). */
  concernResponses: Array<{ note: string; response: string; findingIds: string[] }>;
  /** Kullanıcıya sorulması gerekenler — cevaplanırsa analiz kesinleşir. */
  questionsForUser: string[];
  /** Analizin dayandığı varsayımlar / bilinemeyenler. */
  assumptions: string[];
};

export type ContractJobStatus = "running" | "done" | "error";

export type ContractJobView = {
  id: string;
  status: ContractJobStatus;
  /** 0-tabanlı aşama sırası ve toplam. */
  mode: ContractMode;
  stageIndex: number;
  stageCount: number;
  stageLabel: string;
  /** Bu işin tüm aşama adları (ilerleme listesi için). */
  stageLabels: string[];
  /** Bitince: raporun imzalı kaydı (rapor no, SHA-256 özeti, imza). */
  proof?: { reportId: string; reportSha256: string; issuedAt: string; signature: string };
  /** Aşamalarda keşfedilenlerin canlı özeti ("38 madde okundu", "7 risk bulundu"). */
  progressNote: string;
  report?: ContractReport;
  error?: string;
};
