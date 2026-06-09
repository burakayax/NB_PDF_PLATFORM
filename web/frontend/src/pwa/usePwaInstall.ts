import { useCallback, useEffect, useState } from "react";
import type { BeforeInstallPromptEvent } from "./types";

const DISMISS_KEY = "nbpdf-pwa-install-dismissed";
// Kapatma yalnızca MEVCUT OTURUM için hatırlanır (sessionStorage).
// Kullanıcı sekmeyi/tarayıcıyı kapatıp yeniden ziyaret edince banner tekrar gösterilir.

function isStandalone(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function dismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export interface PwaInstallState {
  /** Banner gösterilebilir mi (yüklenebilir + standalone değil + yakında kapatılmamış). */
  canShow: boolean;
  /** iOS gibi beforeinstallprompt'u desteklemeyen platform → manuel talimat göster. */
  iosManual: boolean;
  /** Tarayıcının yükleme penceresini açar. */
  promptInstall: () => Promise<void>;
  /** Banner'ı kapatır; yalnızca mevcut oturum için gizler (yeni ziyarette tekrar gösterilir). */
  dismiss: () => void;
}

export function usePwaInstall(): PwaInstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(dismissedThisSession);

  const iosManual = (() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    return isIOS && isSafari;
  })();

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      try {
        sessionStorage.removeItem(DISMISS_KEY);
      } catch {
        /* yoksay */
      }
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) {
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "dismissed") {
      try {
        sessionStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* yoksay */
      }
      setDismissed(true);
    }
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* yoksay */
    }
  }, []);

  const canShow =
    !installed && !dismissed && (Boolean(deferred) || iosManual);

  return { canShow, iosManual, promptInstall, dismiss };
}
