import type { PlanName } from "../api/entitlement";
import type { Language } from "./landing";

const DESCRIPTIONS: Record<PlanName, { tr: string; en: string }> = {
  FREE: {
    tr: "Temel belge iş akışlarını denemek için günlük limitli başlangıç erişimi.",
    en: "Starter access for trying core document workflows with a daily limit.",
  },
  STARTER: {
    tr: "Günlük 25 işlem hakkıyla temel araçlara erişim.",
    en: "Access to core tools with 25 daily operations.",
  },
  PLUS: {
    tr: "Tüm araçlara erişim; günlük sınır yok, aylık 600 işlem.",
    en: "Access to every tool with no daily cap and 600 operations a month.",
  },
  PRO: {
    tr: "Öncelikli işlem, tam araç seti; günlük kota yok, aylık 1000 işlem.",
    en: "Priority processing, the full toolkit, no daily cap and 1000 operations a month.",
  },
  BUSINESS: {
    tr: "Ekipler için tam araç seti: 5 kişi dahil, ayda 5.000 sunucu işlemi ortak havuzu (ek koltukla büyür).",
    en: "Full toolkit for teams: 5 seats included and a shared pool of 5,000 server operations a month (grows with extra seats).",
  },
};

const DISPLAY: Record<PlanName, { tr: string; en: string }> = {
  FREE: { tr: "Ücretsiz", en: "Free" },
  STARTER: { tr: "Başlangıç", en: "Starter" },
  PLUS: { tr: "Plus", en: "Plus" },
  PRO: { tr: "Pro", en: "Pro" },
  BUSINESS: { tr: "İşletme", en: "Business" },
};

export function localizedPlanDisplayName(name: PlanName, language: Language): string {
  return DISPLAY[name][language];
}

export function localizedPlanDescription(name: PlanName, language: Language): string {
  return DESCRIPTIONS[name][language];
}
