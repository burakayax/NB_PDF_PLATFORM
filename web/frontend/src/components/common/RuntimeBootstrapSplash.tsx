function getBootstrapLang(): "tr" | "en" {
  try {
    const stored = window.localStorage.getItem("nbpdf-language");
    if (stored === "tr" || stored === "en") return stored;
  } catch {
    // ignore
  }
  return navigator.language?.startsWith("tr") ? "tr" : "en";
}

const COPY = {
  tr: { loading: "Yükleniyor", tagline: "Profesyonel PDF Araçları" },
  en: { loading: "Loading", tagline: "Professional PDF Tools" },
} as const;

/** Shown until public runtime JSON is fetched — avoids mounting landing/workspace before maintenance flag is known. */
export function RuntimeBootstrapSplash() {
  const t = COPY[getBootstrapLang()];
  return (
    <div
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col items-center justify-center gap-7 bg-gradient-to-b from-[#070b14] via-[#05080f] to-[#040609] font-sans text-slate-300 antialiased"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={t.loading}
    >
      {/* Marka logosu + yumuşak ışıma */}
      <div className="relative flex flex-col items-center">
        <span
          className="absolute -inset-10 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden="true"
        />
        <img
          src="/navbar-logo.png"
          alt="PDF PLATFORM"
          className="relative h-16 w-auto object-contain drop-shadow-[0_8px_28px_rgba(34,211,238,0.25)]"
        />
        <span className="relative mt-3 text-[11px] font-medium uppercase tracking-[0.32em] text-slate-500">
          {t.tagline}
        </span>
      </div>

      {/* İnce ilerleme şeridi (belirsiz/indeterminate) */}
      <div className="flex flex-col items-center gap-3">
        <span className="relative block h-[3px] w-40 overflow-hidden rounded-full bg-white/[0.06]">
          <span className="nb-splash-bar absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-cyan-400/30 via-cyan-300 to-cyan-400/30" />
        </span>
        <span className="text-[11px] font-medium tracking-wide text-slate-500">
          {t.loading}…
        </span>
      </div>

      <style>{`
        @keyframes nb-splash-slide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(420%); }
        }
        .nb-splash-bar { animation: nb-splash-slide 1.15s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .nb-splash-bar { animation: none; left: 0; width: 100%; opacity: .5; }
        }
      `}</style>
    </div>
  );
}
