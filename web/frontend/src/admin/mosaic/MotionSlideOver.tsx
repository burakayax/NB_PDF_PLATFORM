import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
};

/**
 * Framer Motion ile sağ panel — Cruip / Mosaic slide-over hareketi.
 */
export function MotionSlideOver({
  open,
  title,
  description,
  onClose,
  children,
  widthClassName = "max-w-lg",
}: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence mode="sync">
      {open ? (
        <div
          key="admin-slideover"
          className="fixed inset-0 z-[200]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mosaic-slideover-title"
        >
          <motion.button
            type="button"
            className="absolute inset-0 cursor-default bg-slate-950/65 backdrop-blur-sm"
            aria-label="Kapat"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <div className="absolute inset-0 flex justify-end">
            <motion.aside
              className={`flex h-full w-full ${widthClassName} flex-col border-l border-slate-700/50 bg-slate-900/98 shadow-2xl ring-1 ring-white/[0.06]`}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
                <div className="min-w-0">
                  <h2 id="mosaic-slideover-title" className="text-base font-semibold tracking-tight text-slate-100">
                    {title}
                  </h2>
                  {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
                  aria-label="Kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">{children}</div>
            </motion.aside>
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
