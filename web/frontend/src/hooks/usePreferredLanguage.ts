import { useEffect, useState } from "react";
import type { Language } from "../i18n/landing";

const STORAGE_KEY = "nbpdf-language";

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

