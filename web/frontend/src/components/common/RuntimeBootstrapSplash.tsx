function getBootstrapLang(): "tr" | "en" {
  try {
    const stored = window.localStorage.getItem("nbpdf-language");
    if (stored === "tr" || stored === "en") return stored;
  } catch {
    // ignore
  }
  return navigator.language?.startsWith("tr") ? "tr" : "en";
}

const LOADING_TEXT = { tr: "Yükleniyor…", en: "Loading…" } as const;

/** Shown until public runtime JSON is fetched — avoids mounting landing/workspace before maintenance flag is known. */
export function RuntimeBootstrapSplash() {
  const label = LOADING_TEXT[getBootstrapLang()];
  return (
    <div
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-[#05080f] font-sans text-slate-300 antialiased"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      {/* Soft brand glow behind the logo */}
      <div className="relative flex items-center justify-center">
        <span
          className="absolute -inset-8 rounded-full bg-cyan-500/10 blur-2xl"
          aria-hidden="true"
        />
        <img
          src="/navbar-logo.png"
          alt="PDF PLATFORM"
          className="relative h-16 w-auto object-contain drop-shadow-lg"
        />
      </div>
      <div className="flex flex-col items-center gap-3.5">
        <span
          className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400 [animation-duration:0.9s]"
          aria-hidden="true"
        />
        <span className="text-xs font-medium tracking-wide text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
}
