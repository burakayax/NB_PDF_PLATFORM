import { useEffect, useState } from "react";
import type { Language } from "../i18n/landing";
import { canonicalBarePath, localizedPath } from "../seo/enSlugs.mjs";

const STORAGE_KEY = "nbpdf-language";

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

function detectInitialLanguage(): Language {
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
  const [language, setLanguage] = useState<Language>(() => detectInitialLanguage());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  return { language, setLanguage, detectInitialLanguage };
}

