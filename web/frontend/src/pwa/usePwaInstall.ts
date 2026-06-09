import { useCallback, useEffect, useState } from "react";
import type { BeforeInstallPromptEvent } from "./types";

const DISMISS_KEY = "nbpdf-pwa-install-dismissed";
// Kapatma sonrası tekrar gösterme penceresi (ms). Kalıcı değil; bir süre sonra yeniden nazikçe sorar.
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 gün

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

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) {
      return false;
    }
    const ts = Number(raw);
    if (!Number.isFinite(ts)) {
      return true;
    }
    return Date.now() - ts < DISMISS_TTL_MS;
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
  /** Banner'ı kapatır ve süreli olarak hatırlar. */
  dismiss: () => void;
}

export function usePwaInstall(): PwaInstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(recentlyDismissed);

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
        localStorage.removeItem(DISMISS_KEY);
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
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* yoksay */
      }
      setDismissed(true);
    }
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* yoksay */
    }
  }, []);

  const canShow =
    !installed && !dismissed && (Boolean(deferred) || iosManual);

  return { canShow, iosManual, promptInstall, dismiss };
}
