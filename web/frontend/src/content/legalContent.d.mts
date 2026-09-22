// Tip deklarasyonu: legalContent.mjs (yasal metinlerin tek kaynağı) için.
// tsc bu .mjs'i derlemez; tipleri buradan alır. Üretim betiği aynı .mjs'i okur.

export interface LegalSectionData {
  title: string;
  paragraphs: string[];
}

export interface LegalDocumentData {
  title: string;
  summary: string;
  effectiveDateLabel: string;
  effectiveDate: string;
  sections: LegalSectionData[];
}

export interface CookieNoticeData {
  title: string;
  description: string;
  accept: string;
  learnMore: string;
}

export interface LegalDocumentsByLang {
  terms: LegalDocumentData;
  privacy: LegalDocumentData;
  kvkk: LegalDocumentData;
  "on-bilgilendirme": LegalDocumentData;
  "mesafeli-satis": LegalDocumentData;
  cookieNotice: CookieNoticeData;
}

export declare const legalDocuments: Record<"tr" | "en", LegalDocumentsByLang>;
