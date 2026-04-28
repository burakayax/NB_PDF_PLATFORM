/**
 * Shown until public runtime JSON is fetched — avoids mounting landing/workspace before maintenance flag is known.
 */
export function RuntimeBootstrapSplash() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col items-center justify-center bg-[#05080f] font-sans text-slate-300 antialiased"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"
        aria-hidden
      />
      <p className="mt-5 max-w-xs text-center text-sm text-slate-500">Yükleniyor…</p>
    </div>
  );
}
