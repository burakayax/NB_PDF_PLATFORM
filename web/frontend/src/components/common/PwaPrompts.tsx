import { useEffect, useState } from "react";
import { Download, RefreshCw, Share, X } from "lucide-react";
import { usePwaInstall } from "../../pwa/usePwaInstall";
import { usePwaUpdate } from "../../pwa/usePwaUpdate";

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
    installBody: "PDF PLATFORM'u cihazına ekle — daha hızlı erişim, tam ekran.",
    install: "Yükle",
    later: "Daha sonra",
    iosTitle: "Ana ekrana ekle",
    iosBody: "Paylaş menüsünü açıp “Ana Ekrana Ekle”yi seçerek uygulamayı yükle.",
    close: "Kapat",
    updateTitle: "Yeni sürüm hazır",
    updateBody: "Güncellemeyi uygulamak için yenile.",
    refresh: "Yenile",
  },
  en: {
    installTitle: "Install the app",
    installBody: "Add PDF PLATFORM to your device — faster access, full screen.",
    install: "Install",
    later: "Later",
    iosTitle: "Add to Home Screen",
    iosBody: "Open the Share menu and choose “Add to Home Screen” to install.",
    close: "Close",
    updateTitle: "New version available",
    updateBody: "Refresh to apply the update.",
    refresh: "Refresh",
  },
} as const;

function InstallBanner({ lang }: { lang: "tr" | "en" }) {
  const { canShow, iosManual, promptInstall, dismiss } = usePwaInstall();
  const t = COPY[lang];
  if (!canShow) {
    return null;
  }
  return (
    <div
      role="dialog"
      aria-label={t.installTitle}
      className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-2xl border border-white/[0.12] bg-gradient-to-br from-nb-panel/95 to-nb-bg/95 p-4 shadow-[0_28px_56px_-16px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.05)_inset] backdrop-blur-xl sm:inset-x-auto sm:right-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-nb-primary/35 bg-gradient-to-br from-nb-primary/20 to-nb-primary/8 shadow-[0_0_28px_rgba(34,211,238,0.28)]">
          <img src="/icons/icon-192.png" alt="" className="h-6 w-6 rounded-md" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {iosManual ? t.iosTitle : t.installTitle}
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-nb-muted">
            {iosManual ? t.iosBody : t.installBody}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {iosManual ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-nb-primary/35 bg-nb-primary/10 px-3 py-1.5 text-[13px] font-semibold text-nb-accent">
                <Share className="h-4 w-4" aria-hidden /> Paylaş
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void promptInstall()}
                className="nb-transition inline-flex items-center gap-1.5 rounded-xl bg-nb-primary px-3.5 py-1.5 text-[13px] font-bold text-[#0b1220] hover:bg-nb-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-nb-primary/50"
              >
                <Download className="h-4 w-4" aria-hidden /> {t.install}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="nb-transition rounded-xl border border-white/[0.1] px-3 py-1.5 text-[13px] font-semibold text-nb-muted hover:bg-white/[0.06] hover:text-nb-text"
            >
              {t.later}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.close}
          className="nb-transition -mr-1 -mt-1 shrink-0 rounded-lg p-1 text-nb-muted hover:bg-white/[0.06] hover:text-nb-text"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
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
