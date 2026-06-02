/** Tam ekran sayfa yüklenirken gösterilen iskelet (LandingPage, AuthPage, AdminPanel vb.) */
export function PageSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-[#05080f]">
      {/* Nav bar */}
      <div className="border-b border-white/[0.06] bg-nb-panel/40 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="h-5 w-32 rounded-md bg-white/[0.07]" />
          <div className="flex gap-3">
            <div className="h-8 w-20 rounded-lg bg-white/[0.06]" />
            <div className="h-8 w-24 rounded-lg bg-cyan-500/10" />
          </div>
        </div>
      </div>
      {/* Hero */}
      <div className="mx-auto mt-20 flex max-w-2xl flex-col items-center gap-5 px-6">
        <div className="h-3 w-24 rounded-full bg-cyan-500/20" />
        <div className="h-10 w-4/5 rounded-xl bg-white/[0.07]" />
        <div className="h-10 w-3/5 rounded-xl bg-white/[0.05]" />
        <div className="mt-2 h-5 w-2/3 rounded-lg bg-white/[0.04]" />
        <div className="mt-4 flex gap-3">
          <div className="h-11 w-36 rounded-xl bg-cyan-500/15" />
          <div className="h-11 w-28 rounded-xl bg-white/[0.06]" />
        </div>
      </div>
      {/* Cards row */}
      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-3 gap-4 px-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 rounded-2xl border border-white/[0.06] bg-nb-panel/40"
          />
        ))}
      </div>
    </div>
  );
}

/** Modal / overlay yüklenirken gösterilen küçük iskelet */
export function ModalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md animate-pulse rounded-[24px] border border-white/[0.08] bg-nb-panel/80 p-8 shadow-2xl">
        <div className="h-6 w-2/3 rounded-lg bg-white/[0.07]" />
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full rounded bg-white/[0.05]" />
          <div className="h-4 w-4/5 rounded bg-white/[0.04]" />
          <div className="h-4 w-3/4 rounded bg-white/[0.04]" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <div className="h-9 w-20 rounded-lg bg-white/[0.06]" />
          <div className="h-9 w-28 rounded-lg bg-cyan-500/15" />
        </div>
      </div>
    </div>
  );
}
