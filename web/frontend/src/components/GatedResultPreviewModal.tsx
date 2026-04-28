import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Language } from "../i18n/landing";
import { fetchResultHeroPreviewBlobUrl } from "../api";

type Props = {
  open: boolean;
  onClose: () => void;
  resultId: string | null;
  accessToken: string | null;
  filename: string;
  language: Language;
};

/**
 * Full-screen modal with high-resolution watermarked first-page preview (server-generated).
 */
export function GatedResultPreviewModal({ open, onClose, resultId, accessToken, filename, language }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !resultId || !accessToken?.trim()) {
      setObjectUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setErr(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErr(null);
    void fetchResultHeroPreviewBlobUrl(resultId, accessToken)
      .then((url) => {
        if (!cancelled) {
          setObjectUrl((prev) => {
            if (prev) {
              URL.revokeObjectURL(prev);
            }
            return url;
          });
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr(language === "tr" ? "Önizleme yüklenemedi." : "Could not load preview.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, resultId, accessToken, language]);

  const close = () => {
    setObjectUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[12000] flex flex-col bg-slate-950/92 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300/90">
                {language === "tr" ? "Filigranlı önizleme" : "Watermarked preview"}
              </p>
              <p className="truncate text-sm font-medium text-slate-100">{filename}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              {language === "tr" ? "Kapat" : "Close"}
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-slate-300">
                <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/35 border-t-cyan-200" />
                <span className="text-sm">{language === "tr" ? "Yükleniyor…" : "Loading…"}</span>
              </div>
            ) : err ? (
              <p className="text-center text-sm text-amber-200">{err}</p>
            ) : objectUrl ? (
              <motion.img
                src={objectUrl}
                alt=""
                className="max-h-[calc(100vh-8rem)] w-auto max-w-full rounded-lg border border-white/10 shadow-2xl shadow-black/40"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              />
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
