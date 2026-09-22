import { useMemo } from "react";
import type { FeatureKey } from "../../../api/subscription";
import type { Language } from "../../../i18n/landing";
import { SIDEBAR_TOOL_ORDER, sidebarToolLabel, featureCopy } from "../../../i18n/workspace";

export interface ToolItem {
  id: FeatureKey;
  label: string;
  description: string;
  isPro: boolean;
}

const PRO_TOOLS: Set<FeatureKey> = new Set([
  "pdf-to-word",
  "word-to-pdf",
  "excel-to-pdf",
  "pdf-to-excel",
  "pdf-to-ppt",
  "ppt-to-pdf",
  "html-to-pdf",
  "flatten-pdf",
  // NOT: form-doldur, ustveri-temizle ve sayfa-duzeni ücretsizdir (cihazda
  // çalışırlar). İlk ikisi üye girişi ister ama bu bir Pro kapısı DEĞİLDİR;
  // burada "Pro" rozeti verilirse kullanıcıya tutmadığımız bir söz verilmiş olur.
  "pdf-to-pdfa",
  "imza-iste",
  "extract-images",
]);

export function useToolsData(language: Language): ToolItem[] {
  return useMemo(() => {
    return SIDEBAR_TOOL_ORDER.map((id) => {
      const copy = featureCopy(id, language);
      return {
        id,
        label: sidebarToolLabel(id, language),
        description: copy?.description ?? "",
        isPro: PRO_TOOLS.has(id),
      };
    });
  }, [language]);
}
