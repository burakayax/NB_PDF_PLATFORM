import type { Language } from "../i18n/landing";
// İçerik legalContent.mjs'te; üretim betiği de aynı dosyayı okur (bkz. oradaki not).
import { legalDocuments as ham } from "./legalContent.mjs";

type LegalSection = {
  title: string;
  paragraphs: string[];
};

type LegalDocument = {
  title: string;
  summary: string;
  effectiveDateLabel: string;
  effectiveDate: string;
  sections: LegalSection[];
};

type CookieNoticeCopy = {
  title: string;
  description: string;
  accept: string;
  learnMore: string;
};

export const legalDocuments: Record<
  Language,
  {
    terms: LegalDocument;
    privacy: LegalDocument;
    kvkk: LegalDocument;
    "on-bilgilendirme": LegalDocument;
    "mesafeli-satis": LegalDocument;
    cookieNotice: CookieNoticeCopy;
  }
> = ham;
