import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ADMIN_TOAST_EVENT, type AdminToastDetail } from "./lib/adminToast";

type ToastItem = AdminToastDetail & { id: number };

/**
 * Admin paneli geneli bildirim katmanı. `emitAdminToast` ile gönderilen
 * başarı/hata mesajlarını sağ altta yığın halinde gösterir ve otomatik kapatır.
 */
export function AdminToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<AdminToastDetail>).detail;
      if (!detail || !detail.message) {
        return;
      }
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-3), { id, ...detail }]);
      const ttl = detail.type === "error" ? 6000 : 3000;
      const timer = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ttl);
      timersRef.current.push(timer);
    };

    window.addEventListener(ADMIN_TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(ADMIN_TOAST_EVENT, onToast);
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[200] flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const isError = t.type === "error";
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md ${
                isError
                  ? "border-red-500/40 bg-red-950/80 text-red-100"
                  : "border-emerald-500/40 bg-emerald-950/80 text-emerald-100"
              }`}
              role={isError ? "alert" : "status"}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isError ? "bg-red-500/25 text-red-200" : "bg-emerald-500/25 text-emerald-200"
                }`}
              >
                {isError ? "!" : "✓"}
              </span>
              <p className="text-sm font-medium leading-snug break-words">{t.message}</p>
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="ml-auto flex-shrink-0 text-lg leading-none text-white/40 hover:text-white/80"
              >
                ×
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
