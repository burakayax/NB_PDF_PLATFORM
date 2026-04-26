import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
};

/**
 * Sağdan açılan panel (Cruip / Tailwind UI slide-over deseni).
 */
export function SlideOver({ open, title, description, onClose, children, widthClassName = "max-w-md" }: Props) {
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

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="slideover-title">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        className={`relative flex h-full w-full ${widthClassName} flex-col border-l border-slate-700/50 bg-slate-900/98 shadow-2xl shadow-slate-950/50 ring-1 ring-white/[0.06]`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <h2 id="slideover-title" className="text-base font-semibold tracking-tight text-slate-100">
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
      </div>
    </div>
  );
}
