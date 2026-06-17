import { useEffect, useId, useState } from "react";
import type { Language } from "../../i18n/landing";
import { sanitizeDownloadBasename } from "../../lib/sanitizeDownloadBasename";

export type ShareResultDialogProps = {
  open: boolean;
  /** Suggested file name (with extension) shown by default in the input. */
  defaultName: string;
  language: Language;
  /** Disables inputs + shows progress while the parent fetches & shares. */
  busy?: boolean;
  onCancel: () => void;
  /** Receives the sanitized file name the user chose for the shared file. */
  onShare: (filename: string) => void;
};

/**
 * Lets the user name the file before it is handed to the OS share sheet
 * (WhatsApp, e-mail, …). The marketing line + site link are appended
 * automatically by the share helper; shown here as a read-only preview.
 */
export function ShareResultDialog({
  open,
  defaultName,
  language,
  busy = false,
  onCancel,
  onShare,
}: ShareResultDialogProps) {
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

  const tr = language === "tr";

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) {
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
          {tr ? "Dosyayı paylaş" : "Share file"}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {tr
            ? "Karşı tarafa gönderilecek dosyanın adını belirleyin."
            : "Set the name of the file you'll send."}
        </p>
        <input
          className="mt-4 w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) {
              onShare(sanitizeDownloadBasename(value, defaultName));
            }
          }}
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
            onClick={onCancel}
            disabled={busy}
          >
            {tr ? "Kapat" : "Close"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/30 disabled:opacity-60"
            onClick={() => onShare(sanitizeDownloadBasename(value, defaultName))}
            disabled={busy}
          >
            {busy
              ? tr
                ? "Hazırlanıyor…"
                : "Preparing…"
              : tr
                ? "Paylaş"
                : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}
