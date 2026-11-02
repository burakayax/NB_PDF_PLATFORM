import { useCallback, useEffect, useState } from "react";
import { EMPTY_CV, normalizeCv, type CvData } from "./cvModel";

/**
 * CV TASLAĞI — yalnızca bellekte (sayfa açıkken) tutulur.
 * Sunucuya gönderilmez, tarayıcıya (localStorage vb.) YAZILMAZ: sayfa kapanınca bilgiler gider.
 * Devam etmek için kullanıcı CV'yi PDF olarak indirir; aynı PDF'i sonra "Önceki CV'mi yükle" ile açar.
 */

/** Eski sürümlerin tarayıcıya yazdığı CV taslaklarını siler (artık hiçbir yerde saklamıyoruz). */
export function purgeLegacyCvStorage(): void {
  try {
    const dead: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("nb_cv_store_v2") || k === "nb_cv_draft_v1" || k === "cv-form-mode")) dead.push(k);
    }
    for (const k of dead) localStorage.removeItem(k);
  } catch {
    /* depolama kapalıysa yapacak bir şey yok */
  }
}

export function useCvDraft(lang: "tr" | "en") {
  const [data, setDataState] = useState<CvData>(() => normalizeCv({ ...EMPTY_CV, settings: { ...EMPTY_CV.settings, lang } }));
  const [templateId, setTemplateId] = useState("sade");

  useEffect(() => { purgeLegacyCvStorage(); }, []);

  const setData = useCallback((d: CvData) => setDataState(d), []);
  /** Tüm içeriği (ve istenirse şablonu) değiştirir. */
  const replace = useCallback((d: CvData, t?: string | null) => {
    setDataState(normalizeCv(d));
    if (t) setTemplateId(t);
  }, []);

  return { data, templateId, setData, setTemplateId, replace };
}
