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
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col items-center justify-center bg-[#05080f] font-sans text-slate-300 antialiased"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <span
        className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"
        aria-hidden="true"
      />
      <p className="mt-5 max-w-xs text-center text-sm text-slate-500">{label}</p>
    </div>
  );
}
