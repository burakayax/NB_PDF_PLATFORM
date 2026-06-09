import { useEffect } from "react";

const MAINTENANCE_TAB_TITLE = "Bakım Çalışması | PDF PLATFORM";

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
          {/* Uygulama ikonu — yeni marka (yumuşak parıltılı hero) */}
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-cyan-400/20 blur-3xl"
              aria-hidden
            />
            <img
              src="/icons/maskable-512.png"
              alt="PDF PLATFORM"
              width={144}
              height={144}
              className="h-36 w-36 rounded-[28px] shadow-[0_24px_80px_-28px_rgba(34,211,238,0.45)] ring-1 ring-white/10"
            />
          </div>

          <p className="mt-9 text-[11px] font-semibold uppercase tracking-[0.42em] text-cyan-300/95">
            PDF PLATFORM
          </p>

          <p className="mt-6 max-w-md text-lg font-medium leading-relaxed tracking-tight text-slate-100 sm:text-xl">
            Daha iyi bir deneyim için kısa bir mola verdik. Çok yakında
            buradayız!
          </p>
        </div>
      </div>
    </>
  );
}
