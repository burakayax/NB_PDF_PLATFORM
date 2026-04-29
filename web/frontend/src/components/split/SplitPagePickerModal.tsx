import { useCallback, useRef, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Language } from "../../i18n/landing";
import { ws } from "../../i18n/workspace";
import {
  PdfPageVisualGrid,
  type PdfPageVisualGridHandle,
  type PdfPageVisualMode,
  type VisualPickerStats,
} from "./PdfPageVisualGrid";

export type SplitPagePickerModalProps = {
  open: boolean;
  onClose: () => void;
  onReset?: () => void;
  file: File;
  password: string;
  maxPage: number | null;
  language: Language;
  mode: PdfPageVisualMode;
  pagesText: string;
  onPagesTextChange: (value: string) => void;
  onPagesErrorClear: () => void;
  pageRotations: Record<number, number>;
  onPageRotationsChange: (next: Record<number, number>) => void;
  pageOrder: number[];
  onPageOrderChange: (order: number[]) => void;
  /** Sayfa Sil araç seçiliyken ızgarada zorunlu Türkçe kopya. */
  strictTurkishForDeleteUi?: boolean;
  onDeleteWouldRemoveWholeDocument?: () => void;
};

function modalTitle(mode: PdfPageVisualMode, language: Language): string {
  if (language === "tr") {
    switch (mode) {
      case "split":
        return "Görsel sayfa seçici";
      case "delete":
        return "Silinecek sayfalar";
      case "rotate":
        return "Sayfa döndürme";
      case "organize":
        return "Sayfa sıralama";
      default:
        return "Görsel sayfa seçici";
    }
  }
  switch (mode) {
    case "split":
      return "Visual page picker";
    case "delete":
      return "Pages to delete";
    case "rotate":
      return "Rotate pages";
    case "organize":
      return "Reorder pages";
    default:
      return "Visual page picker";
  }
}

const ZOOM_LEVELS = [25, 50, 75, 100] as const;

export function SplitPagePickerModal({
  open,
  onClose,
  onReset,
  file,
  password,
  maxPage,
  language,
  mode,
  pagesText,
  onPagesTextChange,
  onPagesErrorClear,
  pageRotations,
  onPageRotationsChange,
  pageOrder,
  onPageOrderChange,
  strictTurkishForDeleteUi = false,
  onDeleteWouldRemoveWholeDocument,
}: SplitPagePickerModalProps) {
  const effectiveModalLang: Language =
    strictTurkishForDeleteUi && mode === "delete" ? "tr" : language;
  const W = ws(effectiveModalLang);
  const title = modalTitle(mode, effectiveModalLang);
  const done = effectiveModalLang === "tr" ? "Tamam" : "Done";
  const resetLabel = effectiveModalLang === "tr" ? "Sıfırla" : "Reset";

  const gridRef = useRef<PdfPageVisualGridHandle>(null);
  /** Rubber-band sürüklerken tüm diyalogda metin seçimini kapatır. */
  const [rubberBandActive, setRubberBandActive] = useState(false);
  /** Başlangıç: Standart (25) — çok sütunlu galeri; %100 büyük detay. */
  const [zoomPercent, setZoomPercent] = useState<number>(25);
  const [gitInput, setGitInput] = useState("");
  const [stats, setStats] = useState<VisualPickerStats>({
    selectedCount: 0,
    readyPreviews: 0,
    totalPages: 0,
  });

  const totalPages = maxPage ?? stats.totalPages ?? 0;

  const applyGit = useCallback(() => {
    const n = Number.parseInt(gitInput.trim(), 10);
    if (!Number.isFinite(n) || n < 1 || (totalPages > 0 && n > totalPages)) {
      return;
    }
    gridRef.current?.scrollToPage(n);
    setGitInput("");
  }, [gitInput, totalPages]);

  const handleReset = () => {
    onReset?.();
    setGitInput("");
  };

  useEffect(() => {
    if (!open) {
      setRubberBandActive(false);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="split-modal"
          className="fixed inset-0 z-[11000] flex items-center justify-center p-1 sm:p-1.5"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label={effectiveModalLang === "tr" ? "Kapat" : "Close"}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="split-picker-title"
            className={`relative z-10 flex h-[min(94vh,100dvh)] w-[min(96vw,100vw)] max-w-[96vw] flex-col overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-b from-slate-900/[0.98] via-slate-950/[0.99] to-[#070b12] shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_25px_80px_-20px_rgba(0,0,0,0.85)] ${rubberBandActive ? "select-none" : ""}`}
            style={rubberBandActive ? { WebkitUserSelect: "none", userSelect: "none" } : undefined}
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-cyan-500/15 bg-slate-950/50 px-2 py-1.5 sm:gap-x-3 sm:px-2.5 sm:py-2">
              <h2
                id="split-picker-title"
                className="max-w-[min(11rem,32vw)] shrink-0 truncate text-sm font-semibold tracking-tight text-slate-50 sm:max-w-[14rem] sm:text-base"
                title={title}
              >
                {title}
              </h2>

              <div className="flex flex-wrap items-center gap-1">
                <span className="hidden whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:inline">
                  {effectiveModalLang === "tr" ? "Yakınlaştır" : "Zoom"}
                </span>
                <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-white/10 bg-black/35 p-px">
                  {ZOOM_LEVELS.map((z) => {
                    const isStandard = z === 25;
                    const label = isStandard
                      ? effectiveModalLang === "tr"
                        ? "Std"
                        : "0"
                      : `%${z}`;
                    return (
                      <button
                        key={z}
                        type="button"
                        title={
                          effectiveModalLang === "tr"
                            ? z <= 25
                              ? "Standart görünüm (çok sütun)"
                              : z >= 100
                                ? "Büyük detay"
                                : "Ara yakınlaştırma"
                            : z <= 25
                              ? "Standard view (many columns)"
                              : z >= 100
                                ? "Large detail"
                                : "Medium zoom"
                        }
                        onClick={() => setZoomPercent(z)}
                        className={`rounded px-1.5 py-1 text-[10px] font-semibold tabular-nums transition sm:px-2 sm:text-xs ${
                          zoomPercent === z
                            ? "border border-cyan-400/45 bg-cyan-500/25 text-cyan-50 shadow-[0_0_12px_-6px_rgba(34,211,238,0.55)]"
                            : "border border-transparent text-slate-400 hover:border-cyan-500/25 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                <span className="whitespace-nowrap text-slate-500">{effectiveModalLang === "tr" ? "Git:" : "Go:"}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="—"
                  value={gitInput}
                  onChange={(e) => setGitInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      applyGit();
                    }
                  }}
                  className="w-11 rounded border border-cyan-500/25 bg-slate-950/80 px-1 py-0.5 text-center font-mono text-[11px] text-cyan-100 tabular-nums outline-none ring-0 focus:border-cyan-400/50 sm:w-14 sm:py-1"
                />
                <span className="tabular-nums text-slate-500">/ {totalPages > 0 ? totalPages : "—"}</span>
                <button
                  type="button"
                  onClick={applyGit}
                  className="rounded border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/20 sm:text-[11px]"
                >
                  OK
                </button>
              </div>

              <div className="min-w-0 shrink text-[10px] leading-tight whitespace-nowrap text-slate-500 tabular-nums">
                <span>
                  {effectiveModalLang === "tr" ? "Önizl.:" : "Prv:"}{" "}
                  {stats.readyPreviews}/{stats.totalPages || totalPages || "—"}
                </span>
                <span className="text-slate-600"> · </span>
                <span className="text-slate-400">
                  {strictTurkishForDeleteUi && mode === "delete"
                    ? `Sil: ${stats.selectedCount}`
                    : `Sel: ${stats.selectedCount}`}
                </span>
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {onReset ? (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-md border border-cyan-400/35 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-100 shadow-[0_0_16px_-8px_rgba(34,211,238,0.5)] transition hover:border-cyan-300/50 hover:bg-cyan-500/15 sm:px-2.5 sm:text-xs"
                  >
                    {resetLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-cyan-400/40 bg-cyan-500/15 px-2 py-1 text-[11px] font-semibold text-cyan-50 shadow-[0_0_20px_-6px_rgba(34,211,238,0.45)] transition hover:border-cyan-300/60 hover:bg-cyan-400/20 sm:px-3 sm:text-xs"
                >
                  {done}
                </button>
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden px-1 py-1 sm:px-1.5 sm:py-1.5">
              {file.type === "application/pdf" && (maxPage ?? 0) > 0 ? (
                <PdfPageVisualGrid
                  ref={gridRef}
                  file={file}
                  password={password}
                  maxPage={maxPage}
                  language={language}
                  mode={mode}
                  pagesText={pagesText}
                  onPagesTextChange={onPagesTextChange}
                  onPagesErrorClear={onPagesErrorClear}
                  pageRotations={pageRotations}
                  onPageRotationsChange={onPageRotationsChange}
                  pageOrder={pageOrder}
                  onPageOrderChange={onPageOrderChange}
                  zoomPercent={zoomPercent}
                  onStatsChange={setStats}
                  onRubberBandActiveChange={setRubberBandActive}
                  strictTurkishUi={strictTurkishForDeleteUi && mode === "delete"}
                  onDeleteWouldRemoveWholeDocument={onDeleteWouldRemoveWholeDocument}
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
