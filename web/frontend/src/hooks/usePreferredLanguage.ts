import { useEffect, useState } from "react";
import type { Language } from "../i18n/landing";
import { canonicalBarePath, localizedPath } from "../seo/enSlugs.mjs";

const STORAGE_KEY = "nbpdf-language";
/**
 * Kullanıcı dili KENDİ SEÇTİ mi (dil düğmesi / hesap tercihi)? Otomatik algılanan dil
 * STORAGE_KEY'e de yazıldığı için tek başına "seçim" sayılamaz.
 */
const EXPLICIT_KEY = "nbpdf-language-explicit";

/**
 * Google'ın dizinlediği herkese açık sayfalar (öneksiz = Türkçe URL). Bu yollarda dil,
 * tarayıcı dilinden DEĞİL URL'den gelir: "/" Türkçe, "/en/..." İngilizce.
 *
 * NEDEN: Googlebot sayfayı en-US tarayıcı diliyle işler. Eskiden "/" adresi tarayıcı dili
 * Türkçe değilse React tarafından İngilizceye çevriliyordu; Google de Türkçe adresin
 * İngilizce halini dizinleyip Türkiye'deki aramada İngilizce açıklama gösteriyordu.
 * Google'ın çok dilli site kılavuzu da dili ziyaretçiye göre değiştirmek yerine her dile
 * ayrı URL vermeyi öneriyor.
 */
export function isPublicSeoPath(pathname: string): boolean {
  const bare = stripLangPrefix(pathname).replace(/\/$/, "") || "/";
  return /^\/(pricing|terms|privacy|kvkk|blog(\/.*)?|tools\/.*|pdf-api(\/.*)?)?$/.test(bare);
}

/** Kullanıcı dili elle seçtiyse seçimi döndürür; yoksa null. */
export function getExplicitLanguage(): Language | null {
  try {
    if (window.localStorage.getItem(EXPLICIT_KEY) !== "1") return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "tr" || stored === "en" ? stored : null;
  } catch {
    return null;
  }
}

/** `/en` veya `/en/...` yolu mu? (İngilizce alt dizin) */
export function isEnglishPath(pathname: string): boolean {
  return pathname === "/en" || pathname.startsWith("/en/");
}

/**
 * Yoldan `/en` önekini soyar VE İngilizce slug'ı kanonik TR slug'ına indirger
 * → route eşleştirme için tek biçimli yol.
 * Örn. /en/blog/convert-pdf-to-word → /blog/pdf-word-donusturme
 * (eski /en/blog/pdf-word-donusturme de aynı sonucu verir; kırık link olmaz.)
 */
export function stripLangPrefix(pathname: string): string {
  return canonicalBarePath(pathname);
}

/** Bir yolu hedef dile göre önekle + slug'ı o dile çevir (tr = öneksiz). */
export function withLangPrefix(pathname: string, lang: Language): string {
  return localizedPath(stripLangPrefix(pathname) || "/", lang);
}

export function detectInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  try {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("lang");
    if (fromQuery === "tr" || fromQuery === "en") {
      return fromQuery;
    }
    // /en (veya /en/...) yol öneki İngilizceyi zorlar — bu URL'ler canonical olarak
    // İngilizce yayınlanır, o yüzden localStorage/tarayıcı tercihinden ÖNCE gelir.
    // Böylece Google'ın gördüğü içerik ile hreflang/canonical her zaman tutarlıdır.
    if (isEnglishPath(url.pathname)) {
      return "en";
    }
  } catch {
    /* ignore */
  }

  // Herkese açık SEO sayfasında (öneksiz URL) otomatik algılama YOK: elle seçim yoksa Türkçe.
  if (isPublicSeoPath(window.location.pathname)) {
    return getExplicitLanguage() ?? "tr";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "tr" || stored === "en") {
    return stored;
  }

  const browserLanguage = navigator.language?.toLowerCase() ?? "";
  if (browserLanguage.startsWith("tr")) {
    return "tr";
  }

  return "en";
}

export function usePreferredLanguage() {
  const [language, setLanguageState] = useState<Language>(() => detectInitialLanguage());

  /** Dışarıdan çağrılan her dil değişikliği (dil düğmesi, hesap tercihi) elle seçim sayılır. */
  const setLanguage = (next: Language) => {
    try {
      window.localStorage.setItem(EXPLICIT_KEY, "1");
    } catch {
      /* ignore */
    }
    setLanguageState(next);
  };

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  return { language, setLanguage, detectInitialLanguage };
}

