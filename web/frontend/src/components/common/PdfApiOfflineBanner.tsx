import { useEffect, useState } from "react";

/**
 * Yalnızca geliştirme: Vite tek başına çalışırken `/api` → FastAPI (:8000) proxy’si hedefsiz kalır;
 * PDF istekleri bitmez; kullanıcıya nedeni tek blokta gösterilir.
 */
export function PdfApiOfflineBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    let cancelled = false;

    const probe = () => {
      const ac = new AbortController();
      const tid = window.setTimeout(() => ac.abort(), 8000);
      fetch("/api/health", { cache: "no-store", signal: ac.signal })
        .then((res) => {
          clearTimeout(tid);
          if (!cancelled && res.ok) {
            setVisible(false);
          } else if (!cancelled && !res.ok) {
            setVisible(true);
          }
        })
        .catch(() => {
          clearTimeout(tid);
          if (!cancelled) {
            setVisible(true);
          }
        });
    };

    let intervalId: ReturnType<typeof window.setInterval> | undefined;

    /** Kök `npm run dev` ile uvicorn birlikte başlatıldığında ilk saniyelerde hazır olmayabilir; erken uyarıyı önler. */
    const firstWait = window.setTimeout(() => {
      probe();
      intervalId = window.setInterval(probe, 12000);
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(firstWait);
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  if (!import.meta.env.DEV || !visible) {
    return null;
  }

  return (
    <div
      className="border-b border-amber-500/40 bg-amber-950/80 px-3 py-2 text-center text-[11px] leading-snug font-medium text-amber-50 md:text-xs"
      role="alert"
    >
      <strong className="font-semibold text-amber-100">PDF API kapalı görünüyor.</strong>{" "}
      Tarayıcı <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px]">/api</code> isteklerini{" "}
      <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px]">127.0.0.1:8000</code>
      adresine iletir; FastAPI çalışmıyorsa yükleme &quot;PDF kontrol ediliyor&quot;da takılı kalır. Çözüm: proje kökünde{" "}
      <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px]">npm run dev</code>{" "}
      veya{" "}
      <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px]">npm run dev:with-pdf-api</code>{" "}
      (<span className="text-amber-200/90">web/frontend</span>), ya da ayrı terminalde{" "}
      <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px]">node scripts/run-pdf-api.mjs</code>.
    </div>
  );
}
