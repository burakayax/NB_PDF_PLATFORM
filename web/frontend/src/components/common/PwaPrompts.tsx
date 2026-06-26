import { useEffect, useState } from "react";
import {
  Download,
  Maximize2,
  RefreshCw,
  Share,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { usePwaInstall } from "../../pwa/usePwaInstall";
import { usePwaUpdate } from "../../pwa/usePwaUpdate";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  isCookieConsentDecided,
} from "../../hooks/useCookieConsent";

/**
 * Yükleme banner'ı yalnızca kullanıcı çerez tercihini verdikten SONRA çıkmalı:
 * aksi halde çerez bildirimi (App, alt-orta) ile aynı anda görünüp çakışıyordu.
 * Çerez kararı verilince kısa bir gecikmeyle hazır olur (iki banner'ın aynı karede
 * görünmesini önler). Geri dönen ziyaretçide karar kalıcı olduğundan hemen hazırdır.
 */
function useInstallBannerGate(): boolean {
  const [decided, setDecided] = useState<boolean>(() =>
    isCookieConsentDecided(),
  );
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    if (decided) {
      return;
    }
    const sync = () => {
      if (isCookieConsentDecided()) {
        setDecided(true);
      }
    };
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [decided]);

  useEffect(() => {
    if (!decided) {
      setReady(false);
      return;
    }
    const id = window.setTimeout(() => setReady(true), 600);
    return () => window.clearTimeout(id);
  }, [decided]);

  return ready;
}

// Global bileşenler (BackToTopButton gibi) Router/context dışında render edildiğinden
// dili i18n context yerine <html lang> üzerinden okur ve değişimini izler.
function useHtmlLang(): "tr" | "en" {
  const [lang, setLang] = useState<"tr" | "en">(() =>
    typeof document !== "undefined" && document.documentElement.lang === "en"
      ? "en"
      : "tr",
  );
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setLang(el.lang === "en" ? "en" : "tr");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);
  return lang;
}

const COPY = {
  tr: {
    installTitle: "Uygulamayı yükle",
    installBody:
      "PDF PLATFORM'u cihazına ekle; tarayıcı sekmesi açmadan tek dokunuşla aç.",
    install: "Yükle",
    later: "Daha sonra",
    iosTitle: "Ana ekrana ekle",
    iosBody: "Paylaş menüsünü açıp “Ana Ekrana Ekle”yi seçerek uygulamayı yükle.",
    close: "Kapat",
    benefitOffline: "Çevrimdışı erişim",
    benefitFast: "Anında açılış",
    benefitFullscreen: "Tam ekran",
    updateTitle: "Yeni sürüm hazır",
    updateBody: "Güncellemeyi uygulamak için yenile.",
    refresh: "Yenile",
  },
  en: {
    installTitle: "Install the app",
    installBody:
      "Add PDF PLATFORM to your device and open it in one tap — no browser tab.",
    install: "Install",
    later: "Later",
    iosTitle: "Add to Home Screen",
    iosBody: "Open the Share menu and choose “Add to Home Screen” to install.",
    close: "Close",
    benefitOffline: "Works offline",
    benefitFast: "Instant launch",
    benefitFullscreen: "Full screen",
    updateTitle: "New version available",
    updateBody: "Refresh to apply the update.",
    refresh: "Refresh",
  },
} as const;

function InstallBanner({ lang }: { lang: "tr" | "en" }) {
  const { canShow, iosManual, promptInstall, dismiss } = usePwaInstall();
  const consentReady = useInstallBannerGate();
  const t = COPY[lang];
  // Çerez onayı verilene (ve kısa gecikme geçene) kadar gösterme — çakışmayı önler.
  if (!canShow || !consentReady) {
    return null;
  }
  const benefits = [
    { icon: WifiOff, label: t.benefitOffline },
    { icon: Zap, label: t.benefitFast },
    { icon: Maximize2, label: t.benefitFullscreen },
  ];
  return (
    <div
      role="dialog"
      aria-label={iosManual ? t.iosTitle : t.installTitle}
      className="pwa-install-banner fixed inset-x-0 bottom-0 z-[60] sm:inset-x-auto sm:bottom-6 sm:right-6"
    >
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl border border-white/[0.12] border-b-0 bg-gradient-to-br from-nb-panel/97 to-nb-bg/97 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_56px_-16px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)_inset] backdrop-blur-xl sm:rounded-2xl sm:border-b sm:px-5 sm:pb-5 sm:pt-5 sm:shadow-[0_28px_56px_-16px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.05)_inset]">
        {/* Mobil bottom-sheet tutamacı */}
        <span
          className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/15 sm:hidden"
          aria-hidden
        />
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.close}
          className="nb-transition absolute right-3 top-3 shrink-0 rounded-lg p-1 text-nb-muted hover:bg-white/[0.06] hover:text-nb-text sm:right-4 sm:top-4"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <img
            src="/emblem.png"
            alt=""
            className="h-12 w-12 shrink-0 object-contain"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-white">
              {iosManual ? t.iosTitle : t.installTitle}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-nb-muted">
              {iosManual ? t.iosBody : t.installBody}
            </p>
          </div>
        </div>

        {!iosManual ? (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {benefits.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-medium text-nb-muted"
              >
                <Icon className="h-3.5 w-3.5 text-nb-primary/80" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2.5">
          {iosManual ? (
            <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-nb-primary/35 bg-nb-primary/10 px-3 py-2.5 text-[13px] font-semibold text-nb-accent">
              <Share className="h-4 w-4" aria-hidden /> Paylaş → Ana Ekrana Ekle
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="nb-transition inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-nb-primary to-nb-primary-hover px-4 py-2.5 text-[14px] font-bold text-[#0b1220] shadow-[0_8px_20px_-8px_rgba(34,211,238,0.6)] hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-nb-primary/50"
            >
              <Download className="h-4 w-4" aria-hidden /> {t.install}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="nb-transition rounded-xl border border-white/[0.1] px-4 py-2.5 text-[13px] font-semibold text-nb-muted hover:bg-white/[0.06] hover:text-nb-text"
          >
            {t.later}
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateToast({ lang }: { lang: "tr" | "en" }) {
  const { updateReady, applyUpdate } = usePwaUpdate();
  const [hidden, setHidden] = useState(false);
  const t = COPY[lang];
  if (!updateReady || hidden) {
    return null;
  }
  return (
    <div
      role="status"
      className="fixed inset-x-3 top-[max(1rem,env(safe-area-inset-top))] z-[70] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-nb-primary/30 bg-gradient-to-br from-nb-panel/95 to-nb-bg/95 p-3 pl-4 shadow-[0_18px_44px_-10px_rgba(34,211,238,0.35)] backdrop-blur-xl sm:inset-x-auto sm:right-6"
    >
      <RefreshCw className="h-5 w-5 shrink-0 text-nb-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{t.updateTitle}</p>
        <p className="text-[12px] leading-snug text-nb-muted">{t.updateBody}</p>
      </div>
      <button
        type="button"
        onClick={applyUpdate}
        className="nb-transition shrink-0 rounded-xl bg-nb-primary px-3 py-1.5 text-[13px] font-bold text-[#0b1220] hover:bg-nb-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-nb-primary/50"
      >
        {t.refresh}
      </button>
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label={t.close}
        className="nb-transition shrink-0 rounded-lg p-1 text-nb-muted hover:bg-white/[0.06] hover:text-nb-text"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/** PWA yükleme banner'ı + güncelleme bildirimi. main.tsx'te tek kez render edilir. */
export function PwaPrompts() {
  const lang = useHtmlLang();
  return (
    <>
      <InstallBanner lang={lang} />
      <UpdateToast lang={lang} />
    </>
  );
}
