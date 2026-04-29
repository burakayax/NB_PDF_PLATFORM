import { useEffect } from "react";

const MAINTENANCE_TAB_TITLE = "Bakım Çalışması | NB PDF Platform";

/** Tab title during maintenance block; restores previous title on unmount (e.g. admin bypass → normal page titles). */
export function MaintenanceTabTitle() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = MAINTENANCE_TAB_TITLE;
    return () => {
      document.title = previousTitle;
    };
  }, []);
  return null;
}

/**
 * Full-screen maintenance layer — opaque, above all app chrome (z-[9999]).
 * No navigation, auth, or admin hints.
 */
export function MaintenancePage() {
  return (
    <>
      <MaintenanceTabTitle />
      <div
        className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#05080f] px-6 py-16 font-sans text-slate-100 antialiased shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
        role="status"
        aria-live="polite"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34,211,238,0.16), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(99,102,241,0.09), transparent 50%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent"
          aria-hidden
        />

        <div className="relative z-10 flex max-w-lg flex-col items-center text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-cyan-300/95">NB PDF PLARTFORM</p>

          <div className="mt-10 flex h-36 w-36 items-center justify-center rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.14] to-indigo-600/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_24px_80px_-28px_rgba(34,211,238,0.35)] ring-1 ring-white/[0.06]">
            <svg viewBox="0 0 96 96" className="h-24 w-24 text-cyan-200/90" fill="none" aria-hidden>
              <path
                d="M28 22h28l14 14v38a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6Z"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinejoin="round"
                className="opacity-95"
              />
              <path
                d="M54 22v14h14"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinejoin="round"
                className="opacity-85"
              />
              <path
                d="M34 46h22M34 54h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.55"
              />
              <circle cx="72" cy="68" r="14" stroke="currentColor" strokeWidth="2" className="text-cyan-400/50" />
              <path
                d="M66 68h12M72 62v12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-cyan-300/80"
              />
            </svg>
          </div>

          <p className="mt-10 max-w-md text-lg font-medium leading-relaxed tracking-tight text-slate-100 sm:text-xl">
            Daha iyi bir deneyim için kısa bir mola verdik. Çok yakında buradayız!
          </p>
        </div>
      </div>
    </>
  );
}
