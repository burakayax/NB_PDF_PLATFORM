import { AnimatePresence, motion } from "framer-motion";
import type { Language } from "../../i18n/landing";
import { ws } from "../../i18n/workspace";
import { SplitPdfPageGrid } from "./SplitPdfPageGrid";

export type SplitPagePickerModalProps = {
  open: boolean;
  onClose: () => void;
  file: File;
  password: string;
  maxPage: number | null;
  pagesText: string;
  onPagesTextChange: (value: string) => void;
  onPagesErrorClear: () => void;
  language: Language;
};

export function SplitPagePickerModal({
  open,
  onClose,
  file,
  password,
  maxPage,
  pagesText,
  onPagesTextChange,
  onPagesErrorClear,
  language,
}: SplitPagePickerModalProps) {
  const W = ws(language);
  const title = language === "tr" ? "Görsel sayfa seçici" : "Visual page picker";
  const done = language === "tr" ? "Tamam" : "Done";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="split-modal"
          className="fixed inset-0 z-[11000] flex items-center justify-center p-4 sm:p-6"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label={language === "tr" ? "Kapat" : "Close"}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="split-picker-title"
            className="relative z-10 flex max-h-[min(90vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/98 to-slate-950/98 shadow-2xl shadow-black/50"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <h2 id="split-picker-title" className="text-base font-semibold text-slate-50">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-white/10"
              >
                {done}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {file.type === "application/pdf" && (maxPage ?? 0) > 0 ? (
                <SplitPdfPageGrid
                  file={file}
                  password={password}
                  maxPage={maxPage}
                  pagesText={pagesText}
                  onPagesTextChange={onPagesTextChange}
                  onPagesErrorClear={onPagesErrorClear}
                  language={language}
                />
              ) : (
                <p className="text-sm text-slate-400">{W.splitPickerWaitHint}</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
