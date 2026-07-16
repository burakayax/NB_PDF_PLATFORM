import { useEffect, useState } from "react";
import type { Language } from "../i18n/landing";

const STORAGE_KEY = "nbpdf-language";

/** `/en` veya `/en/...` yolu mu? (İngilizce alt dizin) */
export function isEnglishPath(pathname: string): boolean {
  return pathname === "/en" || pathname.startsWith("/en/");
}

/** Yoldan `/en` önekini soyar → route eşleştirme için dil-öneksiz yol. */
export function stripLangPrefix(pathname: string): string {
  if (isEnglishPath(pathname)) {
    const rest = pathname.slice("/en".length);
    return rest === "" ? "/" : rest;
  }
  return pathname;
}

/** Bir yolu hedef dile göre önekle (tr = öneksiz, en = /en önekli). */
export function withLangPrefix(pathname: string, lang: Language): string {
  const bare = stripLangPrefix(pathname) || "/";
  if (lang === "en") {
    return bare === "/" ? "/en" : `/en${bare}`;
  }
  return bare;
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

