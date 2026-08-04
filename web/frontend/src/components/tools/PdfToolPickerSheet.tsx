import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Lock, Wrench, X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { TOOL_CATEGORIES, CAT_ACCENT, type ToolItem, type AccentKey } from "./pdfToolCatalog";

/**
 * Hafif araç seçici — ayrı sayfa AÇMADAN, aynı ekranda kategorize + renkli bir menü
 * (PWA launcher hissi) gösterir. Bir araca dokununca `onPick(toolId)` ile o araca gidilir
 * (üst bileşen PDF'i IndexedDB'ye koyup yönlendirir). PdfHub'ın tam-ekran önizlemesine
 * ihtiyaç olmayan yerlerde (Taramalarım) kullanılır.
 */
export function PdfToolPickerSheet({
  language,
  fileName,
  lockedFeatures,
  onPick,
  onClose,
}: {
  language: Language;
  fileName?: string;
  lockedFeatures?: Set<string>;
  onPick: (toolId: string) => void;
  onClose: () => void;
}) {
  const tr = language === "tr";
  const isLocked = (id: string) => lockedFeatures?.has(id) ?? false;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const toolBtn = (t: ToolItem, accent: AccentKey) => {
    const locked = isLocked(t.id);
    const a = CAT_ACCENT[accent];
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onPick(t.id)}
        className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition active:scale-[0.97] ${a.btn}`}
      >
        {locked && (
          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-200">
            <Lock className="h-2.5 w-2.5" />Pro
          </span>
        )}
        <span className={`${a.icon} ${locked ? "opacity-70" : ""}`}>{t.icon}</span>
        <span className="text-[11px] font-semibold leading-tight text-slate-100">{tr ? t.tr : t.en}</span>
      </button>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b1020] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <Wrench className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-white">{tr ? "Araçta aç" : "Open in a tool"}</p>
              {fileName && <p className="truncate text-[11px] leading-tight text-slate-400">{fileName}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={tr ? "Kapat" : "Close"} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-[12px] text-slate-400">
            {tr ? "Bir araç seç — taraman oraya aktarılır ve işlem yapabilirsin." : "Pick a tool — your scan transfers there to process."}
          </p>
          {TOOL_CATEGORIES.map((cat, ci) => (
            <div key={cat.id} className={ci === 0 ? "" : "mt-5"}>
              <p className={`mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${CAT_ACCENT[cat.accent].text}`}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CAT_ACCENT[cat.accent].dot}`} aria-hidden />
                {tr ? cat.tr : cat.en}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {cat.tools.map((t) => toolBtn(t, cat.accent))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
