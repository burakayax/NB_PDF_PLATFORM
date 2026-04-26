import { useEffect, useId, useState } from "react";
import type { Language } from "../../i18n/landing";
import { sanitizeDownloadBasename } from "../../lib/sanitizeDownloadBasename";
import { ws } from "../../i18n/workspace";

export type DownloadFilenameModalProps = {
  open: boolean;
  defaultName: string;
  language: Language;
  onCancel: () => void;
  onConfirm: (filename: string) => void;
};

/**
 * Shown before streaming a result download so the user can set the file name
 * in the browser’s Save dialog (the `download` attribute).
 */
export function DownloadFilenameModal({ open, defaultName, language, onCancel, onConfirm }: DownloadFilenameModalProps) {
  const W = ws(language);
  const titleId = useId();
  const [value, setValue] = useState(defaultName);
  useEffect(() => {
    if (open) {
      setValue(defaultName);
    }
  }, [open, defaultName]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/98 to-slate-950/98 p-6 shadow-2xl shadow-cyan-950/30"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-50">
          {language === "tr" ? "Dosya adı" : "File name"}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {language === "tr" ? "İndirmeden önce dosya adını düzenleyebilirsiniz." : "You can edit the name before the download starts."}
        </p>
        <input
          className="mt-4 w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
            onClick={onCancel}
          >
            {W.toolProgressDismiss}
          </button>
          <button
            type="button"
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/30"
            onClick={() => onConfirm(sanitizeDownloadBasename(value, defaultName))}
          >
            {language === "tr" ? "İndir" : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
