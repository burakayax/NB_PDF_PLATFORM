import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { Language } from "../../i18n/landing";
import { expandPagesString, formatPageSelection, ws } from "../../i18n/workspace";

// eslint-disable-next-line import/no-unresolved -- Vite resolves ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const RENDER_SCALE = 0.22;
const MAX_GRID_PAGES = 200;

export type SplitPdfPageGridProps = {
  file: File;
  password: string;
  maxPage: number | null;
  pagesText: string;
  onPagesTextChange: (value: string) => void;
  onPagesErrorClear: () => void;
  language: Language;
};

/**
 * Renders a thumbnail grid using pdf.js; selection syncs to the page-range string.
 * Shift+click: range from last anchor. Ctrl/Cmd+click: toggle. Plain click: toggle.
 */
export function SplitPdfPageGrid({
  file,
  password,
  maxPage,
  pagesText,
  onPagesTextChange,
  onPagesErrorClear,
  language,
}: SplitPdfPageGridProps) {
  const W = ws(language);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const selected = useRef<Set<number>>(new Set());
  const [, bump] = useState(0);
  const force = () => bump((x) => x + 1);
  const anchorRef = useRef<number | null>(null);
  const lastToggleRef = useRef<number | null>(null);
  const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  const maxP = maxPage && maxPage > 0 ? maxPage : null;
  const overflow = numPages > MAX_GRID_PAGES;

  const applySelection = useCallback(
    (next: Set<number>) => {
      selected.current = next;
      onPagesTextChange(formatPageSelection([...next]));
      onPagesErrorClear();
      force();
    },
    [onPagesErrorClear, onPagesTextChange],
  );

  // Sync from text → grid when user edits the input
  useEffect(() => {
    if (!maxP || numPages === 0) {
      return;
    }
    const exp = expandPagesString(pagesText, maxP, language);
    if (exp === null) {
      return;
    }
    const next = new Set(exp);
    const a = Array.from(selected.current).sort((x, y) => x - y).join(",");
    const b = Array.from(next).sort((x, y) => x - y).join(",");
    if (a !== b) {
      selected.current = next;
      force();
    }
  }, [pagesText, maxP, numPages, language]);

  // Load document + render thumbnails
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadError(null);
      setLoading(true);
      setThumbs([]);
      setNumPages(0);
      selected.current = new Set();
      docRef.current = null;
      const buf = await file.arrayBuffer();
      try {
        const task = pdfjsLib.getDocument({
          data: buf,
          password: password.trim() || undefined,
        });
        const pdf = await task.promise;
        if (cancelled) {
          await pdf.destroy().catch(() => {});
          return;
        }
        docRef.current = pdf;
        const n = pdf.numPages;
        setNumPages(n);
        const limit = Math.min(n, MAX_GRID_PAGES);
        const urls: string[] = [];
        for (let i = 1; i <= limit; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: RENDER_SCALE });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            continue;
          }
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          urls.push(canvas.toDataURL("image/png"));
          if (cancelled) {
            return;
          }
        }
        if (!cancelled) {
          setThumbs(urls);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : language === "tr" ? "PDF açılamadı." : "Could not open PDF.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (docRef.current) {
        void docRef.current.destroy().catch(() => {});
        docRef.current = null;
      }
    };
  }, [file, password, language]);

  const onThumbClick = (page1: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (e.shiftKey && anchorRef.current != null) {
      const a = Math.min(anchorRef.current, page1);
      const b = Math.max(anchorRef.current, page1);
      const next = new Set<number>();
      for (let p = a; p <= b; p++) {
        next.add(p);
      }
      applySelection(next);
      lastToggleRef.current = page1;
      return;
    }
    const next = new Set(selected.current);
    if (e.ctrlKey || e.metaKey) {
      if (next.has(page1)) {
        next.delete(page1);
      } else {
        next.add(page1);
      }
    } else {
      if (next.has(page1)) {
        next.delete(page1);
      } else {
        next.add(page1);
      }
    }
    anchorRef.current = page1;
    lastToggleRef.current = page1;
    applySelection(next);
  };

  if (loadError) {
    return (
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/90" role="alert">
        {loadError}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2 text-sm text-nb-muted" role="status">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cyan-400/40 border-t-cyan-200" />
        {language === "tr" ? "Sayfalar yükleniyor…" : "Loading pages…"}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-nb-muted">
        {language === "tr" ? "Görsel seçim" : "Visual selection"}
      </p>
      <p className="mt-1 text-xs leading-snug text-slate-400">
        {language === "tr"
          ? "Tıklayarak seçin. Shift ile aralık, Ctrl/Cmd ile tekil ekle/çıkar."
          : "Click to select. Shift+click for a range, Ctrl/Cmd+click to add/remove one page."}
      </p>
      {overflow ? (
        <p className="mt-2 text-xs text-amber-200/90">
          {language === "tr"
            ? `Yalnızca ilk ${MAX_GRID_PAGES} sayfa önizleniyor. Metin alanına diğer sayfaları ekleyebilirsiniz.`
            : `Only the first ${MAX_GRID_PAGES} pages are shown; add others via the text field.`}
        </p>
      ) : null}
      <div className="mt-3 flex max-h-[min(52vh,480px)] flex-wrap content-start gap-2 overflow-y-auto rounded-xl border border-white/10 bg-nb-bg/40 p-3">
        {thumbs.map((url, idx) => {
          const page = idx + 1;
          const isOn = selected.current.has(page);
          return (
            <button
              key={page}
              type="button"
              title={`${W.pagesLabel} ${page}`}
              onClick={(ev) => onThumbClick(page, ev)}
              className={`relative w-[92px] shrink-0 overflow-hidden rounded-lg border-2 text-left transition-colors ${
                isOn
                  ? "border-cyan-400/80 ring-1 ring-cyan-300/50"
                  : "border-white/10 hover:border-white/25"
              } `}
            >
              <img src={url} alt="" className="block h-[118px] w-full object-contain object-top bg-slate-900/50" />
              <span
                className={`absolute bottom-0 left-0 right-0 py-0.5 text-center text-[10px] font-semibold ${
                  isOn ? "bg-cyan-950/90 text-cyan-50" : "bg-black/55 text-slate-200"
                }`}
              >
                {page}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
