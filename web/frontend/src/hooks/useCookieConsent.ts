import { useEffect, useState } from "react";

const STORAGE_KEY = "nbpdf-cookie-consent-v3";

export type CookieConsentPreferences = {
  necessary: true;          // Her zaman true — zorunlu; reddedilemez
  analytics: boolean;       // Google Analytics GA4
  errorMonitoring: boolean; // Sentry hata izleme
  paymentProcessing: true;  // İyzico — ödeme için zorunlu; reddedilemez
  marketing: boolean;       // Pazarlama (gelecekte kullanım için)
};

const DEFAULT_PREFERENCES: CookieConsentPreferences = {
  necessary: true,
  analytics: false,
  errorMonitoring: false,
  paymentProcessing: true,
  marketing: false,
};

function readStored(): { decided: boolean; prefs: CookieConsentPreferences } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // v2'den taşıma: eski onay varsa analytics kabul edilmiş say
      const oldRaw = window.localStorage.getItem("nbpdf-cookie-consent-v2");
      if (oldRaw) {
        const old = JSON.parse(oldRaw) as { decided?: boolean; analytics?: boolean };
        if (old.decided) {
          return {
            decided: true,
            prefs: {
              necessary: true,
              analytics: old.analytics ?? false,
              errorMonitoring: false,
              paymentProcessing: true,
              marketing: false,
            },
          };
        }
      }
      return { decided: false, prefs: DEFAULT_PREFERENCES };
    }
    const parsed = JSON.parse(raw) as Partial<CookieConsentPreferences> & { decided?: boolean };
    return {
      decided: parsed.decided === true,
      prefs: {
        necessary: true,
        analytics: parsed.analytics ?? false,
        errorMonitoring: parsed.errorMonitoring ?? false,
        paymentProcessing: true,
        marketing: parsed.marketing ?? false,
      },
    };
  } catch {
    return { decided: false, prefs: DEFAULT_PREFERENCES };
  }
}

export function useCookieConsent() {
  const [isReady, setIsReady] = useState(false);
  const [decided, setDecided] = useState(false);
  const [prefs, setPrefs] = useState<CookieConsentPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    const stored = readStored();
    setDecided(stored.decided);
    setPrefs(stored.prefs);
    setIsReady(true);
  }, []);

  /** Tümünü kabul et (analytics + errorMonitoring + marketing dahil) */
  function acceptAll() {
    const p: CookieConsentPreferences = {
      necessary: true,
      analytics: true,
      errorMonitoring: true,
      paymentProcessing: true,
      marketing: true,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ decided: true, ...p }));
    setPrefs(p);
    setDecided(true);
  }

  /** Yalnızca zorunlu çerezleri kabul et */
  function acceptNecessaryOnly() {
    const p: CookieConsentPreferences = {
      necessary: true,
      analytics: false,
      errorMonitoring: false,
      paymentProcessing: true,
      marketing: false,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ decided: true, ...p }));
    setPrefs(p);
    setDecided(true);
  }

  /** Özel tercihlerle kaydet */
  function savePreferences(custom: Omit<CookieConsentPreferences, "necessary" | "paymentProcessing">) {
    const p: CookieConsentPreferences = { necessary: true, paymentProcessing: true, ...custom };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ decided: true, ...p }));
    setPrefs(p);
    setDecided(true);
  }

  const hasConsent = decided;

  return {
    hasConsent,
    decided,
    isReady,
    prefs,
    acceptAll,
    acceptNecessaryOnly,
    savePreferences,
    // geriye dönük uyumluluk
    acceptConsent: acceptAll,
  };
}
