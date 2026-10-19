import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY, setCaptchaToken } from "../../lib/loginCaptcha";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("turnstile script failed"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * "Robot değilim" kutusu. `resetKey` değişince kutu yenilenir (jeton tek kullanımlıktır;
 * her başarısız girişten sonra yenisi gerekir).
 */
export function TurnstileBox({ language, resetKey }: { language: "tr" | "en"; resetKey: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !hostRef.current) return;
    let widgetId: string | undefined;
    let cancelled = false;
    setCaptchaToken(null);
    loadScript()
      .then(() => {
        if (cancelled || !hostRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(hostRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          language,
          callback: (t: string) => setCaptchaToken(t),
          "expired-callback": () => setCaptchaToken(null),
          "error-callback": () => setCaptchaToken(null),
        });
      })
      .catch(() => {
        /* Betik yüklenemezse kutu görünmez; sunucu isteği reddetmeye devam eder. */
      });
    return () => {
      cancelled = true;
      setCaptchaToken(null);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [language, resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={hostRef} className="flex justify-center" data-testid="turnstile-box" />;
}
