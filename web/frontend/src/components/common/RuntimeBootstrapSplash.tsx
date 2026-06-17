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
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col items-center justify-center gap-7 bg-[#05080f] font-sans text-slate-300 antialiased"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      {/* Soft brand glow behind the mark */}
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span
          className="absolute -inset-6 rounded-full bg-cyan-500/10 blur-2xl"
          aria-hidden="true"
        />
        <span
          className="absolute inset-0 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400 [animation-duration:0.9s]"
          aria-hidden="true"
        />
        <span
          className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-sky-600 text-[12px] font-black tracking-tight text-slate-950 shadow-lg shadow-cyan-500/25"
          aria-hidden="true"
        >
          PDF
        </span>
      </div>
      <div className="flex flex-col items-center gap-2.5">
        <span className="text-base font-bold tracking-tight text-slate-100">
          PDF Platform
        </span>
        <span className="text-xs font-medium tracking-wide text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
}
