import { useCallback, useSyncExternalStore } from "react";
import type { BeforeInstallPromptEvent } from "./types";
import { trackGAEvent } from "../lib/analytics";

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

function computeIosManual(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  return isIOS && isSafari;
}

// ---------------------------------------------------------------------------
// Paylaşılan store
//
// `beforeinstallprompt` tek sefer global olarak fire eder ve `prompt()` yalnızca
// BİR kez çağrılabilir. Banner + header butonu gibi BİRDEN FAZLA tüketici aynı
// state'i görmeli; yoksa biri install'ı tüketince diğeri "yarı açık" kalır.
// Bu yüzden state'i modül seviyesinde tek kaynakta tutup useSyncExternalStore ile
// paylaşıyoruz.
// ---------------------------------------------------------------------------
type Snapshot = {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  dismissed: boolean;
};

let deferredEvent: BeforeInstallPromptEvent | null = null;
let installed = isStandalone();
let dismissed = dismissedThisSession();
let snapshot: Snapshot = { deferred: null, installed, dismissed };
const SERVER_SNAPSHOT: Snapshot = {
  deferred: null,
  installed: false,
  dismissed: false,
};

const listeners = new Set<() => void>();
let listenersBound = false;

function publish(): void {
  snapshot = { deferred: deferredEvent, installed, dismissed };
  listeners.forEach((l) => l());
}

function bindGlobalListeners(): void {
  if (listenersBound || typeof window === "undefined") {
    return;
  }
  listenersBound = true;
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredEvent = e as BeforeInstallPromptEvent;
    publish();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredEvent = null;
    dismissed = false;
    try {
      sessionStorage.removeItem(DISMISS_KEY);
    } catch {
      /* yoksay */
    }
    // GA4: kullanıcı siteyi "program olarak" kurdu (ana ekrana ekledi).
    trackGAEvent("pwa_installed");
    publish();
  });
}

function subscribe(cb: () => void): () => void {
  bindGlobalListeners();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export interface PwaInstallState {
  /** Banner gösterilebilir mi (yüklenebilir + standalone değil + oturumda kapatılmamış). */
  canShow: boolean;
  /** Header butonu için: yüklenebilir + standalone değil — kapatmadan BAĞIMSIZ. */
  canInstall: boolean;
  /** iOS gibi beforeinstallprompt'u desteklemeyen platform → manuel talimat göster. */
  iosManual: boolean;
  /** Tarayıcının yükleme penceresini açar. */
  promptInstall: () => Promise<void>;
  /** Banner'ı kapatır; yalnızca mevcut oturum için gizler (yeni ziyarette tekrar gösterilir). */
  dismiss: () => void;
  /** Kapatma tercihini geri alır — header butonundan iOS talimat banner'ını yeniden açmak için. */
  reopen: () => void;
}

export function usePwaInstall(): PwaInstallState {
  const snap = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_SNAPSHOT,
  );
  const iosManual = computeIosManual();

  const promptInstall = useCallback(async () => {
    const ev = deferredEvent;
    if (!ev) {
      return;
    }
    await ev.prompt();
    const choice = await ev.userChoice;
    deferredEvent = null;
    if (choice.outcome === "dismissed") {
      dismissed = true;
      try {
        sessionStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* yoksay */
      }
    }
    publish();
  }, []);

  const dismiss = useCallback(() => {
    dismissed = true;
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* yoksay */
    }
    publish();
  }, []);

  const reopen = useCallback(() => {
    dismissed = false;
    try {
      sessionStorage.removeItem(DISMISS_KEY);
    } catch {
      /* yoksay */
    }
    publish();
  }, []);

  const installable =
    !snap.installed && (Boolean(snap.deferred) || iosManual);

  return {
    canShow: installable && !snap.dismissed,
    canInstall: installable,
    iosManual,
    promptInstall,
    dismiss,
    reopen,
  };
}
