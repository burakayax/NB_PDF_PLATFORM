import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Check } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { VirtualItem } from "@tanstack/virtual-core";
import type { Language } from "../../i18n/landing";
import { expandPagesString, formatPageSelection, ws } from "../../i18n/workspace";

// eslint-disable-next-line import/no-unresolved -- Vite resolves ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/** Zoom %25 = küçük galeri (dar min hücre → çok sütun), %100 = büyük detay (geniş min hücre → az sütun). */
const ZOOM_SLIDER_MIN = 25;
const ZOOM_SLIDER_MAX = 100;
/** Hedef minimum kart genişliği (px); auto-fill ile sütun sayısı buna göre belirlenir. */
const GRID_CELL_MIN_AT_SMALL = 96;
const GRID_CELL_MIN_AT_LARGE = 188;
/** Tailwind gap-6 / satır arası ~gap-7 — rubber-band için nötr alan */
const GAP_PX = 24;
const ROW_GAP_PX = 28;
const GRID_PAD_X = 6;
const GRID_PAD_Y = 6;
const RUBBER_MIN_PX = 5;
const RENDER_OVERSAMPLE = 1.35;
/** Sanal satır overscan; hızlı kaydırmada komşu satırların hazır kalması için yüksek tutulur. */
const VIRTUAL_ROW_OVERSCAN = 22;
/** Görünür + overscan dışındaki thumb’ları silmeden önce ek sayfa tamponu (satır ≈ overscan ile uyumlu). */
const EVICT_BUFFER_ROWS = VIRTUAL_ROW_OVERSCAN;
/** Aynı oturumda PDF raster’ı bellekte tutar; dosya değişince oturum anahtarı yenilenir. */
type PersistentThumbEntry = { dataUrl: string; cssW: number };
const persistentThumbByKey = new Map<string, PersistentThumbEntry>();

function thumbCacheKey(sessionId: string, page1: number): string {
  return `${sessionId}::p${page1}`;
}

function purgeThumbSession(sessionId: string): void {
  const prefix = `${sessionId}::`;
  for (const k of persistentThumbByKey.keys()) {
    if (k.startsWith(prefix)) {
      persistentThumbByKey.delete(k);
    }
  }
}

/** Bu oranın altında mevcut raster aynı hücrede yeniden kullanılır (PDF’e tekrar çizilmez). */
const THUMB_REUSE_MAX_RATIO = 1.38;
/** İstenen genişlik önbellekten bundan fazlaysa yeni raster alınır; eski görüntü placeholder kalır. */
const THUMB_UPGRADE_MIN_RATIO = 1.42;
/** Raster veya <img> hatası sonrası yeniden deneme aralığı */
const THUMB_RETRY_DELAY_MS = 2000;
const THUMB_RETRY_MAX_ATTEMPTS = 40;

export type PdfPageVisualMode = "split" | "delete" | "rotate" | "organize";

export type PdfPageVisualGridHandle = {
  scrollToPage: (page1: number) => void;
};

export type VisualPickerStats = {
  selectedCount: number;
  readyPreviews: number;
  totalPages: number;
};

export type PdfPageVisualGridProps = {
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
  zoomPercent: number;
  onStatsChange?: (s: VisualPickerStats) => void;
  /** Rubber-band sürüklemesi sırasında üst modalın user-select kapatması için. */
  onRubberBandActiveChange?: (active: boolean) => void;
};

function intersectsAabb(
  bx0: number,
  by0: number,
  bx1: number,
  by1: number,
  ax: number,
  ay: number,
  aw: number,
  ah: number,
): boolean {
  return bx0 < ax + aw && bx1 > ax && by0 < ay + ah && by1 > ay;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return target.isContentEditable;
}

/**
 * Sanal satırda hücre mount olduğunda tek sayfa raster tetikler (virtualizer ile güvenilir yükleme).
 */
function PageThumbMountTrigger({
  pageIndex,
  cellWidth,
  requestThumb,
}: {
  pageIndex: number;
  cellWidth: number;
  requestThumb: (page: number, cssW: number, opts?: { force?: boolean }) => void;
}) {
  useEffect(() => {
    requestThumb(pageIndex, cellWidth);
  }, [pageIndex, cellWidth, requestThumb]);
  return null;
}

function PdfPageCardImage({
  page1,
  url,
  rot,
  language,
  onImageFailed,
  lowResPlaceholder,
}: {
  page1: number;
  url: string;
  rot: number;
  language: Language;
  onImageFailed: (page: number) => void;
  lowResPlaceholder?: boolean;
}) {
  return (
    <div className="relative min-h-0 flex-1 w-full overflow-hidden bg-slate-950/60">
      <img
        src={url}
        alt=""
        className={`h-full w-full object-contain object-top transition-[filter] duration-150 ${lowResPlaceholder ? "blur-[0.6px]" : ""}`}
        style={{ transform: rot ? `rotate(${rot}deg)` : undefined }}
        onError={() => onImageFailed(page1)}
      />
      <span className="sr-only" role="status">
        {language === "tr" ? `Sayfa ${page1} önizlemesi` : `Page ${page1} preview`}
      </span>
    </div>
  );
}

export const PdfPageVisualGrid = forwardRef<PdfPageVisualGridHandle, PdfPageVisualGridProps>(
  function PdfPageVisualGrid(
    {
      file,
      password,
      maxPage,
      language,
      mode,
      pagesText,
      onPagesTextChange,
      onPagesErrorClear,
      pageRotations,
      onPageRotationsChange: _unusedPageRotChange,
      pageOrder,
      onPageOrderChange,
      zoomPercent,
      onStatsChange,
      onRubberBandActiveChange,
    },
    ref,
  ) {
    void _unusedPageRotChange;
    const W = ws(language);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [numPages, setNumPages] = useState(0);
    const [thumbs, setThumbs] = useState<(string | null)[]>([]);
    const thumbsRef = useRef<(string | null)[]>([]);
    const selected = useRef<Set<number>>(new Set());
    const [selectionTick, setSelectionTick] = useState(0);
    const bumpSelection = () => setSelectionTick((t) => t + 1);
    const anchorRef = useRef<number | null>(null);
    const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
    const parentRef = useRef<HTMLDivElement | null>(null);
    /** Rubber / AABB ile aynı koordinat düzlemi: sanal liste kökü (satır `top` ile hizalı). */
    const gridContentRef = useRef<HTMLDivElement | null>(null);
    const selectionCanvasRef = useRef<HTMLDivElement | null>(null);
    const rubberCapturePointerIdRef = useRef<number | null>(null);
    /** PDF oturumu; dosya değişince yenilenir, önbellek anahtarı buna bağlıdır. */
    const thumbSessionIdRef = useRef("");
    const [containerWidth, setContainerWidth] = useState(800);
    const renderJobRef = useRef(0);
    const cellWidthIntRef = useRef(0);
    const pendingThumbRef = useRef<Set<number>>(new Set());
    const numPagesRef = useRef(0);
    numPagesRef.current = numPages;
    const thumbRetryTimersRef = useRef<Map<number, number>>(new Map());
    const thumbFailureCountRef = useRef<Map<number, number>>(new Map());
    const cellWidthRef = useRef(0);
    const requestSinglePageThumbRef = useRef<(p: number, w: number, o?: { force?: boolean }) => void>(() => {});
    /** Hızlı kaydırmada getVirtualItems() boş gelirse evict aralığını 1..16’ya düşürüp tüm thumb’ları silmeyi engeller. */
    const lastGoodVisiblePageRangeRef = useRef<{ low: number; high: number } | null>(null);
    const rubberSelectRafRef = useRef<number | null>(null);
    const rubberLatestContentRef = useRef({ x: 0, y: 0 });
    const scrollStepYRef = useRef(80);
    const scrollStepXRef = useRef(80);

    const maxP = maxPage && maxPage > 0 ? maxPage : null;
    const selectionMode = mode === "split" || mode === "delete";
    const organizeMode = mode === "organize";

    const innerWidth = Math.max(280, containerWidth - GRID_PAD_X * 2);

    const gridCellMinPx = useMemo(() => {
      const t =
        (Math.min(ZOOM_SLIDER_MAX, Math.max(ZOOM_SLIDER_MIN, zoomPercent)) - ZOOM_SLIDER_MIN) /
        (ZOOM_SLIDER_MAX - ZOOM_SLIDER_MIN);
      return GRID_CELL_MIN_AT_SMALL + (GRID_CELL_MIN_AT_LARGE - GRID_CELL_MIN_AT_SMALL) * t;
    }, [zoomPercent]);

    const { cols, cellWidth, cardHeight } = useMemo(() => {
      const c = Math.max(1, Math.floor((innerWidth + GAP_PX) / (gridCellMinPx + GAP_PX)));
      const cw = (innerWidth - (c - 1) * GAP_PX) / c;
      const ch = Math.round(cw * (4 / 3));
      return { cols: c, cellWidth: cw, cardHeight: ch };
    }, [innerWidth, gridCellMinPx]);

    cellWidthRef.current = cellWidth;
    scrollStepYRef.current = cardHeight + ROW_GAP_PX;
    scrollStepXRef.current = cellWidth + GAP_PX;

    const sequenceLength = organizeMode ? pageOrder.length : numPages;

    const virtualRowCount = useMemo(
      () => Math.max(1, Math.ceil(Math.max(1, sequenceLength) / cols)),
      [sequenceLength, cols],
    );

    const estimateRowSize = useCallback(() => cardHeight + ROW_GAP_PX, [cardHeight]);

    const rowVirtualizer = useVirtualizer({
      count: virtualRowCount,
      getScrollElement: () => parentRef.current,
      estimateSize: estimateRowSize,
      overscan: VIRTUAL_ROW_OVERSCAN,
      paddingStart: GRID_PAD_Y,
      paddingEnd: GRID_PAD_Y,
      isScrollingResetDelay: 0,
      useScrollendEvent: true,
      onChange: () => {
        setRangeRevision((r) => r + 1);
      },
    });

    const colsRef = useRef(cols);
    colsRef.current = cols;

    const rowVirtualizerRef = useRef(rowVirtualizer);
    rowVirtualizerRef.current = rowVirtualizer;

    const [rangeRevision, setRangeRevision] = useState(0);
    const [rubberLiveSelection, setRubberLiveSelection] = useState<Set<number> | null>(null);
    /** Modal animasyonu bittikten sonra sanallaştırıcıyı uyandırmak için (500ms gecikme). */
    const [hasForceRendered, setHasForceRendered] = useState(false);
    /** İlk 2 saniye içinde getVirtualItems() boşsa ilk satırları zorla çizer. */
    const [virtualFallbackActive, setVirtualFallbackActive] = useState(false);

    const fallbackVirtualRows = useMemo((): VirtualItem[] => {
      const rowStride = cardHeight + ROW_GAP_PX;
      const n = Math.min(10, virtualRowCount);
      return Array.from({ length: n }, (_, i) => {
        const start = GRID_PAD_Y + i * rowStride;
        return {
          key: `__vf-fallback-${i}`,
          index: i,
          start,
          end: start + rowStride,
          size: rowStride,
          lane: 0,
        };
      });
    }, [virtualRowCount, cardHeight]);

    useLayoutEffect(() => {
      rowVirtualizer.measure();
    }, [rowVirtualizer, cardHeight, cols, virtualRowCount]);

    /** parentRef = overflow-auto kaydırıcı; boyut değişince (modal açılışı) measure + calculateRange. */
    useLayoutEffect(() => {
      const el = parentRef.current;
      if (!el) {
        return;
      }
      const ro = new ResizeObserver(() => {
        setContainerWidth(el.clientWidth);
        requestAnimationFrame(() => {
          const v = rowVirtualizerRef.current;
          v.measure();
          v.calculateRange();
          setRangeRevision((r) => r + 1);
        });
      });
      ro.observe(el);
      setContainerWidth(el.clientWidth);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      if (loading || loadError || numPages === 0) {
        setVirtualFallbackActive(false);
        return;
      }
      setVirtualFallbackActive(true);
      const endFallback = window.setTimeout(() => setVirtualFallbackActive(false), 2000);
      return () => window.clearTimeout(endFallback);
    }, [loading, loadError, numPages]);

    useEffect(() => {
      if (loading || loadError || numPages === 0) {
        setHasForceRendered(false);
        return;
      }
      const t = window.setTimeout(() => {
        const v = rowVirtualizerRef.current;
        v.scrollToIndex(0, { align: "start" });
        v.measure();
        v.calculateRange();
        setHasForceRendered(true);
        setRangeRevision((r) => r + 1);
      }, 500);
      return () => window.clearTimeout(t);
    }, [loading, loadError, numPages, zoomPercent, cols, virtualRowCount]);

    const applySelection = useCallback(
      (next: Set<number>) => {
        selected.current = next;
        onPagesTextChange(formatPageSelection([...next]));
        onPagesErrorClear();
        bumpSelection();
      },
      [onPagesErrorClear, onPagesTextChange],
    );

    useEffect(() => {
      if (loading || loadError) {
        return;
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (isTypingTarget(e.target)) {
          return;
        }
        const mod = e.ctrlKey || e.metaKey;
        if (mod && selectionMode) {
          const k = e.key.toLowerCase();
          if (k === "a") {
            e.preventDefault();
            const cap = maxP ?? numPages;
            const next = new Set<number>();
            for (let p = 1; p <= cap; p++) {
              next.add(p);
            }
            applySelection(next);
            return;
          }
          if (k === "d") {
            e.preventDefault();
            applySelection(new Set());
            return;
          }
        }
        const scrollEl = parentRef.current;
        if (!scrollEl) {
          return;
        }
        const stepY = scrollStepYRef.current;
        if (e.key === "ArrowUp") {
          e.preventDefault();
          scrollEl.scrollTop -= stepY;
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          scrollEl.scrollTop += stepY;
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          scrollEl.scrollLeft -= scrollStepXRef.current;
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          scrollEl.scrollLeft += scrollStepXRef.current;
        }
      };
      window.addEventListener("keydown", onKeyDown, true);
      return () => window.removeEventListener("keydown", onKeyDown, true);
    }, [loading, loadError, selectionMode, applySelection, maxP, numPages]);

    useEffect(() => {
      if (!selectionMode || !maxP || numPages === 0) {
        return;
      }
      const exp = expandPagesString(pagesText, maxP, language);
      if (exp === null) {
        return;
      }
      const next = new Set(exp);
      const a = Array.from(selected.current)
        .sort((x, y) => x - y)
        .join(",");
      const b = Array.from(next)
        .sort((x, y) => x - y)
        .join(",");
      if (a !== b) {
        selected.current = next;
        bumpSelection();
      }
    }, [pagesText, maxP, numPages, language, selectionMode]);

    useEffect(() => {
      let cancelled = false;
      const run = async () => {
        lastGoodVisiblePageRangeRef.current = null;
        const prevSid = thumbSessionIdRef.current;
        if (prevSid) {
          purgeThumbSession(prevSid);
        }
        thumbSessionIdRef.current = "";
        setLoadError(null);
        setLoading(true);
        setThumbs([]);
        thumbsRef.current = [];
        setNumPages(0);
        selected.current = new Set();
        docRef.current = null;
        cellWidthIntRef.current = 0;
        pendingThumbRef.current.clear();
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
          thumbSessionIdRef.current = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
          setNumPages(n);
          const empty = Array.from({ length: n }, () => null);
          thumbsRef.current = empty;
          setThumbs(empty);
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
        thumbRetryTimersRef.current.forEach((tid) => clearTimeout(tid));
        thumbRetryTimersRef.current.clear();
        thumbFailureCountRef.current.clear();
        if (docRef.current) {
          void docRef.current.destroy().catch(() => {});
          docRef.current = null;
        }
      };
    }, [file, password, language]);

    const clearThumbRetryTimer = useCallback((page1: number) => {
      const existing = thumbRetryTimersRef.current.get(page1);
      if (existing != null) {
        clearTimeout(existing);
        thumbRetryTimersRef.current.delete(page1);
      }
    }, []);

    const rasterPageToDataUrl = useCallback(
      async (page1: number, cssW: number, jobAtStart: number): Promise<string | null> => {
        const doc = docRef.current;
        if (!doc || page1 < 1 || page1 > numPagesRef.current) {
          return null;
        }
        if (jobAtStart !== renderJobRef.current) {
          return null;
        }
        try {
          const page = await doc.getPage(page1);
          const baseVp = page.getViewport({ scale: 1 });
          const scale = (cssW / baseVp.width) * RENDER_OVERSAMPLE;
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return null;
          }
          canvas.width = Math.max(1, Math.floor(vp.width));
          canvas.height = Math.max(1, Math.floor(vp.height));
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          if (jobAtStart !== renderJobRef.current) {
            return null;
          }
          return canvas.toDataURL("image/png");
        } catch {
          return null;
        }
      },
      [],
    );

    const requestSinglePageThumb = useCallback(
      (page1: number, cssW: number, opts?: { force?: boolean }) => {
        const doc = docRef.current;
        const n = numPagesRef.current;
        if (!doc || page1 < 1 || page1 > n) {
          return;
        }
        const sid = thumbSessionIdRef.current;
        const ck = sid ? thumbCacheKey(sid, page1) : null;

        if (opts?.force) {
          clearThumbRetryTimer(page1);
          if (ck) {
            persistentThumbByKey.delete(ck);
          }
          thumbsRef.current[page1 - 1] = null;
          setThumbs([...thumbsRef.current]);
          thumbFailureCountRef.current.delete(page1);
        }

        const cached = ck ? persistentThumbByKey.get(ck) : undefined;

        if (!opts?.force && cached && cssW <= cached.cssW * THUMB_REUSE_MAX_RATIO) {
          if (!thumbsRef.current[page1 - 1]) {
            thumbsRef.current[page1 - 1] = cached.dataUrl;
            setThumbs([...thumbsRef.current]);
          }
          return;
        }

        if (!opts?.force && cached && cssW > cached.cssW * THUMB_UPGRADE_MIN_RATIO) {
          if (!thumbsRef.current[page1 - 1]) {
            thumbsRef.current[page1 - 1] = cached.dataUrl;
            setThumbs([...thumbsRef.current]);
          }
        }

        if (pendingThumbRef.current.has(page1)) {
          return;
        }
        pendingThumbRef.current.add(page1);
        const jobAtStart = renderJobRef.current;
        void (async () => {
          try {
            const url = await rasterPageToDataUrl(page1, cssW, jobAtStart);
            if (jobAtStart !== renderJobRef.current) {
              return;
            }
            if (url) {
              clearThumbRetryTimer(page1);
              const sidNow = thumbSessionIdRef.current;
              const ckNow = sidNow ? thumbCacheKey(sidNow, page1) : null;
              if (ckNow) {
                persistentThumbByKey.set(ckNow, { dataUrl: url, cssW });
              }
              thumbsRef.current[page1 - 1] = url;
              setThumbs([...thumbsRef.current]);
              thumbFailureCountRef.current.delete(page1);
            } else {
              const fails = (thumbFailureCountRef.current.get(page1) ?? 0) + 1;
              thumbFailureCountRef.current.set(page1, fails);
              if (fails <= THUMB_RETRY_MAX_ATTEMPTS) {
                clearThumbRetryTimer(page1);
                const timer = window.setTimeout(() => {
                  thumbRetryTimersRef.current.delete(page1);
                  pendingThumbRef.current.delete(page1);
                  const w = cellWidthRef.current;
                  requestSinglePageThumbRef.current(page1, w);
                }, THUMB_RETRY_DELAY_MS);
                thumbRetryTimersRef.current.set(page1, timer);
              }
            }
          } finally {
            pendingThumbRef.current.delete(page1);
          }
        })();
      },
      [clearThumbRetryTimer, rasterPageToDataUrl],
    );

    useLayoutEffect(() => {
      requestSinglePageThumbRef.current = requestSinglePageThumb;
    });

    const onThumbImageDecodeFailed = useCallback(
      (page1: number) => {
        clearThumbRetryTimer(page1);
        const sid = thumbSessionIdRef.current;
        const ck = sid ? thumbCacheKey(sid, page1) : null;
        if (ck) {
          persistentThumbByKey.delete(ck);
        }
        thumbsRef.current[page1 - 1] = null;
        setThumbs([...thumbsRef.current]);
        pendingThumbRef.current.delete(page1);
        thumbFailureCountRef.current.delete(page1);
        window.setTimeout(() => {
          const w = cellWidthRef.current;
          requestSinglePageThumbRef.current(page1, w, { force: true });
        }, THUMB_RETRY_DELAY_MS);
      },
      [clearThumbRetryTimer],
    );

    const computeVisiblePageRange = useCallback(() => {
      if (numPages === 0) {
        return { low: 1, high: 0 };
      }
      const items = rowVirtualizer.getVirtualItems();
      let minP = numPages + 1;
      let maxP = 0;

      if (items.length === 0) {
        const prev = lastGoodVisiblePageRangeRef.current;
        if (prev != null && prev.low <= prev.high) {
          return prev;
        }
        const fallback = Math.min(numPages, Math.max(cols * 4, 16));
        return { low: 1, high: fallback };
      }

      for (const vi of items) {
        const row = vi.index;
        for (let c = 0; c < cols; c++) {
          const flat = row * cols + c;
          if (flat >= sequenceLength) {
            continue;
          }
          const pageNum = organizeMode ? pageOrder[flat]! : flat + 1;
          if (pageNum >= 1 && pageNum <= numPages) {
            minP = Math.min(minP, pageNum);
            maxP = Math.max(maxP, pageNum);
          }
        }
      }

      if (minP > maxP) {
        const next = { low: 1, high: Math.min(numPages, cols * 4) };
        lastGoodVisiblePageRangeRef.current = next;
        return next;
      }

      const buf = EVICT_BUFFER_ROWS * Math.max(1, cols);
      const low = Math.max(1, minP - buf);
      const high = Math.min(numPages, maxP + buf);
      const next = { low, high };
      lastGoodVisiblePageRangeRef.current = next;
      return next;
    }, [rowVirtualizer, numPages, cols, organizeMode, pageOrder, sequenceLength]);

    const scrollMemRef = useRef({ top: 0, scrollHeight: 1, clientH: 400 });
    const prevZoomColsRef = useRef({ z: zoomPercent, c: cols });

    useEffect(() => {
      const el = parentRef.current;
      if (!el) {
        return;
      }
      const onScroll = () => {
        setRangeRevision((r) => r + 1);
        scrollMemRef.current = {
          top: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientH: el.clientHeight,
        };
      };
      el.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      return () => el.removeEventListener("scroll", onScroll);
    }, []);

    useLayoutEffect(() => {
      const prev = prevZoomColsRef.current;
      const changed = prev.z !== zoomPercent || prev.c !== cols;
      prevZoomColsRef.current = { z: zoomPercent, c: cols };
      if (!changed) {
        return;
      }
      const el = parentRef.current;
      if (!el) {
        return;
      }
      const { top, scrollHeight: sh, clientH } = scrollMemRef.current;
      const oldMax = Math.max(1, sh - clientH);
      const ratio = oldMax > 0 ? top / oldMax : 0;
      requestAnimationFrame(() => {
        const el2 = parentRef.current;
        if (!el2) {
          return;
        }
        const nh = el2.clientHeight;
        const nsh = el2.scrollHeight;
        const newMax = Math.max(0, nsh - nh);
        el2.scrollTop = newMax > 0 ? Math.min(newMax, ratio * newMax) : 0;
        scrollMemRef.current = {
          top: el2.scrollTop,
          scrollHeight: nsh,
          clientH: nh,
        };
      });
    }, [zoomPercent, cols]);

    useEffect(() => {
      lastGoodVisiblePageRangeRef.current = null;
      setRangeRevision((r) => r + 1);
    }, [zoomPercent, cols, numPages, virtualRowCount]);

    /** Kalıcı önbellek kullanıldığı için görünür dışına taşan thumb’lar silinmez. */
    const evictOutsideRange = useCallback((_low: number, _high: number) => {}, []);

    const flatIndexToPageNum = (flat: number): number => {
      if (organizeMode) {
        const v = pageOrder[flat];
        return v != null && v >= 1 ? v : flat + 1;
      }
      return flat + 1;
    };

    const getVisiblePagesInViewportOrder = useCallback((): number[] => {
      const out: number[] = [];
      const items = [...rowVirtualizer.getVirtualItems()].sort((a, b) => a.index - b.index);
      for (const vi of items) {
        const row = vi.index;
        for (let cidx = 0; cidx < cols; cidx++) {
          const flat = row * cols + cidx;
          if (flat >= sequenceLength) {
            continue;
          }
          const page1 = flatIndexToPageNum(flat);
          if (page1 >= 1 && page1 <= numPages) {
            out.push(page1);
          }
        }
      }
      return out;
    }, [rowVirtualizer, organizeMode, pageOrder, numPages, cols, sequenceLength]);

    const buildThumbLoadQueue = useCallback(
      (low: number, high: number): number[] => {
        const inRange = (p: number) => p >= low && p <= high;
        const ordered: number[] = [];
        const seen = new Set<number>();
        const push = (p: number) => {
          if (!inRange(p) || seen.has(p)) {
            return;
          }
          ordered.push(p);
          seen.add(p);
        };
        push(1);
        for (const p of getVisiblePagesInViewportOrder()) {
          push(p);
        }
        for (let p = low; p <= high; p++) {
          push(p);
        }
        return ordered;
      },
      [getVisiblePagesInViewportOrder],
    );

    useEffect(() => {
      if (!docRef.current || numPages === 0) {
        return;
      }
      const { low, high } = computeVisiblePageRange();
      if (high < low) {
        return;
      }
      evictOutsideRange(low, high);
      const cssW = cellWidth;
      const job = ++renderJobRef.current;
      void (async () => {
        const doc = docRef.current;
        if (!doc) {
          return;
        }
        const queue = buildThumbLoadQueue(low, high);
        for (const i of queue) {
          if (job !== renderJobRef.current) {
            return;
          }
          const sid = thumbSessionIdRef.current;
          const ck = sid ? thumbCacheKey(sid, i) : null;
          const cached = ck ? persistentThumbByKey.get(ck) : undefined;
          if (!thumbsRef.current[i - 1] && cached && cssW <= cached.cssW * THUMB_REUSE_MAX_RATIO) {
            thumbsRef.current[i - 1] = cached.dataUrl;
            setThumbs([...thumbsRef.current]);
            continue;
          }
          if (
            !thumbsRef.current[i - 1] &&
            cached &&
            cssW > cached.cssW * THUMB_UPGRADE_MIN_RATIO
          ) {
            thumbsRef.current[i - 1] = cached.dataUrl;
            setThumbs([...thumbsRef.current]);
          }
          if (thumbsRef.current[i - 1] && cached && cssW <= cached.cssW * THUMB_REUSE_MAX_RATIO) {
            continue;
          }
          if (pendingThumbRef.current.has(i)) {
            continue;
          }
          const url = await rasterPageToDataUrl(i, cssW, job);
          if (job !== renderJobRef.current) {
            return;
          }
          if (url) {
            const sidNow = thumbSessionIdRef.current;
            const ckNow = sidNow ? thumbCacheKey(sidNow, i) : null;
            if (ckNow) {
              persistentThumbByKey.set(ckNow, { dataUrl: url, cssW });
            }
            thumbsRef.current[i - 1] = url;
            setThumbs([...thumbsRef.current]);
            thumbFailureCountRef.current.delete(i);
          } else {
            const fails = (thumbFailureCountRef.current.get(i) ?? 0) + 1;
            thumbFailureCountRef.current.set(i, fails);
            if (fails <= THUMB_RETRY_MAX_ATTEMPTS) {
              clearThumbRetryTimer(i);
              const timer = window.setTimeout(() => {
                thumbRetryTimersRef.current.delete(i);
                pendingThumbRef.current.delete(i);
                const w = cellWidthRef.current;
                requestSinglePageThumbRef.current(i, w);
              }, THUMB_RETRY_DELAY_MS);
              thumbRetryTimersRef.current.set(i, timer);
            }
          }
        }
      })();
    }, [
      numPages,
      computeVisiblePageRange,
      evictOutsideRange,
      cellWidth,
      rangeRevision,
      rasterPageToDataUrl,
      clearThumbRetryTimer,
      buildThumbLoadQueue,
    ]);

    const readyPreviews = useMemo(() => {
      if (numPages === 0) {
        return 0;
      }
      const sid = thumbSessionIdRef.current;
      let n = 0;
      for (let p = 1; p <= numPages; p++) {
        if (thumbs[p - 1]) {
          n++;
        } else if (sid && persistentThumbByKey.has(thumbCacheKey(sid, p))) {
          n++;
        }
      }
      return n;
    }, [thumbs, numPages]);

    useEffect(() => {
      onStatsChange?.({
        selectedCount: selected.current.size,
        readyPreviews,
        totalPages: numPages,
      });
    }, [onStatsChange, readyPreviews, numPages, selectionTick]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToPage: (page1: number) => {
          if (page1 < 1 || page1 > numPages) {
            return;
          }
          const c = colsRef.current;
          let flat0: number;
          if (organizeMode) {
            const idx = pageOrder.indexOf(page1);
            flat0 = idx >= 0 ? idx : 0;
          } else {
            flat0 = page1 - 1;
          }
          const row = Math.floor(flat0 / c);
          rowVirtualizer.scrollToIndex(row, { align: "center" });
          setRangeRevision((r) => r + 1);
        },
      }),
      [rowVirtualizer, numPages, organizeMode, pageOrder],
    );

    const onThumbClick = (page1: number, e: React.MouseEvent) => {
      if (!selectionMode) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey && anchorRef.current != null) {
        const a = Math.min(anchorRef.current, page1);
        const b = Math.max(anchorRef.current, page1);
        const next = new Set<number>();
        for (let p = a; p <= b; p++) {
          next.add(p);
        }
        applySelection(next);
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
      applySelection(next);
    };

    const moveOrder = (index: number, dir: -1 | 1) => {
      const arr = [...pageOrder];
      const j = index + dir;
      if (j < 0 || j >= arr.length) {
        return;
      }
      const t = arr[index]!;
      arr[index] = arr[j]!;
      arr[j] = t;
      onPageOrderChange(arr);
      onPagesTextChange(arr.join(","));
      onPagesErrorClear();
    };

    const collectPagesInBand = useCallback(
      (x0: number, y0: number, x1: number, y1: number) => {
        const hits = new Set<number>();
        if (numPages === 0) {
          return hits;
        }
        const bx0 = Math.min(x0, x1);
        const by0 = Math.min(y0, y1);
        const bx1 = Math.max(x0, x1);
        const by1 = Math.max(y0, y1);
        const rowH = cardHeight + ROW_GAP_PX;
        const padTop = GRID_PAD_Y;
        const rowCount = Math.max(1, Math.ceil(sequenceLength / cols));
        const r0 = Math.max(0, Math.floor((by0 - padTop) / rowH));
        const r1 = Math.min(rowCount - 1, Math.floor((by1 - padTop) / rowH));

        for (let r = r0; r <= r1; r++) {
          for (let c = 0; c < cols; c++) {
            const flat = r * cols + c;
            if (flat >= sequenceLength) {
              continue;
            }
            let page1: number;
            if (organizeMode) {
              const v = pageOrder[flat];
              page1 = v != null && v >= 1 ? v : flat + 1;
            } else {
              page1 = flat + 1;
            }
            if (page1 < 1 || page1 > numPages) {
              continue;
            }
            const cl = c * (cellWidth + GAP_PX);
            const ct = padTop + r * rowH;
            if (intersectsAabb(bx0, by0, bx1, by1, cl, ct, cellWidth, cardHeight)) {
              hits.add(page1);
            }
          }
        }
        return hits;
      },
      [numPages, cardHeight, sequenceLength, cols, cellWidth, organizeMode, pageOrder],
    );

    const [rubberRect, setRubberRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [rubberActive, setRubberActive] = useState(false);

    useEffect(() => {
      onRubberBandActiveChange?.(rubberActive && selectionMode);
    }, [rubberActive, selectionMode, onRubberBandActiveChange]);

    const rubberPointerRef = useRef<{
      startX: number;
      startY: number;
      additive: boolean;
      dragApplied: boolean;
      initialSelection: Set<number>;
    } | null>(null);

    /**
     * Tek referans: parentRef containerRect + scrollLeft/scrollTop; ızgara köşesi aynı formülle,
     * grid içi yerel koordinat = fark (mousedown ile mousemove birebir aynı eksen).
     */
    const contentXY = useCallback((e: { clientX: number; clientY: number }) => {
      const container = parentRef.current;
      const gridRoot = gridContentRef.current;
      if (!container || !gridRoot) {
        return { x: 0, y: 0 };
      }
      const containerRect = container.getBoundingClientRect();
      const sl = container.scrollLeft;
      const st = container.scrollTop;
      const currentX = e.clientX - containerRect.left + sl;
      const currentY = e.clientY - containerRect.top + st;
      const gr = gridRoot.getBoundingClientRect();
      const grid0X = gr.left - containerRect.left + sl;
      const grid0Y = gr.top - containerRect.top + st;
      return { x: currentX - grid0X, y: currentY - grid0Y };
    }, []);

    const mergeRubberSelection = useCallback(
      (hits: Set<number>, additive: boolean, initial: Set<number>) => {
        if (additive) {
          const next = new Set(initial);
          for (const p of hits) {
            next.add(p);
          }
          return next;
        }
        return new Set(hits);
      },
      [],
    );

    useEffect(() => {
      if (!rubberActive || !selectionMode) {
        return;
      }

      const flushRubberSelection = (
        ptr: NonNullable<typeof rubberPointerRef.current>,
        x: number,
        y: number,
        opts: { preview: boolean },
      ) => {
        const bw = Math.abs(x - ptr.startX);
        const bh = Math.abs(y - ptr.startY);
        if (opts.preview && bw < RUBBER_MIN_PX && bh < RUBBER_MIN_PX) {
          setRubberLiveSelection(null);
          return;
        }
        const hits = collectPagesInBand(ptr.startX, ptr.startY, x, y);
        const merged = mergeRubberSelection(hits, ptr.additive, ptr.initialSelection);
        if (opts.preview) {
          setRubberLiveSelection(new Set(merged));
        }
        const w = bw;
        const h = bh;
        if (w >= RUBBER_MIN_PX || h >= RUBBER_MIN_PX) {
          ptr.dragApplied = true;
          const a = Array.from(selected.current)
            .sort((n1, n2) => n1 - n2)
            .join(",");
          const b = Array.from(merged)
            .sort((n1, n2) => n1 - n2)
            .join(",");
          if (a !== b) {
            applySelection(merged);
          }
        }
      };

      const scheduleSelectionRaf = () => {
        if (rubberSelectRafRef.current != null) {
          return;
        }
        rubberSelectRafRef.current = requestAnimationFrame(() => {
          rubberSelectRafRef.current = null;
          const ptr = rubberPointerRef.current;
          if (!ptr) {
            return;
          }
          const { x, y } = rubberLatestContentRef.current;
          flushRubberSelection(ptr, x, y, { preview: true });
        });
      };

      const onMove = (e: MouseEvent) => {
        const ptr = rubberPointerRef.current;
        if (!ptr) {
          return;
        }
        const { x, y } = contentXY({ clientX: e.clientX, clientY: e.clientY });
        rubberLatestContentRef.current = { x, y };
        const x0 = Math.min(ptr.startX, x);
        const y0 = Math.min(ptr.startY, y);
        const w = Math.abs(x - ptr.startX);
        const h = Math.abs(y - ptr.startY);
        setRubberRect({ x: x0, y: y0, w, h });
        scheduleSelectionRaf();
      };

      const onUp = (e: MouseEvent) => {
        if (rubberSelectRafRef.current != null) {
          cancelAnimationFrame(rubberSelectRafRef.current);
          rubberSelectRafRef.current = null;
        }
        const canvas = selectionCanvasRef.current;
        const capId = rubberCapturePointerIdRef.current;
        if (canvas != null && capId != null) {
          try {
            canvas.releasePointerCapture(capId);
          } catch {
            /* zaten serbest */
          }
          rubberCapturePointerIdRef.current = null;
        }
        const ptr = rubberPointerRef.current;
        rubberPointerRef.current = null;
        setRubberActive(false);
        setRubberRect(null);
        setRubberLiveSelection(null);

        if (!ptr || !selectionMode) {
          return;
        }

        const { x, y } = contentXY({ clientX: e.clientX, clientY: e.clientY });
        rubberLatestContentRef.current = { x, y };
        const dist = Math.max(Math.abs(x - ptr.startX), Math.abs(y - ptr.startY));

        if (!ptr.dragApplied && dist < RUBBER_MIN_PX) {
          return;
        }

        flushRubberSelection(ptr, x, y, { preview: false });
        if (ptr.dragApplied) {
          const hits = collectPagesInBand(ptr.startX, ptr.startY, x, y);
          if (hits.size > 0) {
            anchorRef.current = Math.min(...hits);
          }
        }
      };

      const capOpts = { capture: true } as const;
      document.addEventListener("mousemove", onMove, capOpts);
      document.addEventListener("mouseup", onUp, capOpts);
      return () => {
        if (rubberSelectRafRef.current != null) {
          cancelAnimationFrame(rubberSelectRafRef.current);
          rubberSelectRafRef.current = null;
        }
        const canvasEl = selectionCanvasRef.current;
        const capIdCleanup = rubberCapturePointerIdRef.current;
        if (canvasEl != null && capIdCleanup != null) {
          try {
            canvasEl.releasePointerCapture(capIdCleanup);
          } catch {
            /* */
          }
          rubberCapturePointerIdRef.current = null;
        }
        document.removeEventListener("mousemove", onMove, capOpts);
        document.removeEventListener("mouseup", onUp, capOpts);
      };
    }, [rubberActive, selectionMode, contentXY, collectPagesInBand, mergeRubberSelection, applySelection]);

    const onRubberMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0 || !selectionMode) {
        return;
      }
      if ((e.target as HTMLElement).closest("[data-page-thumb]")) {
        return;
      }
      e.preventDefault();
      const ne = e.nativeEvent;
      if (typeof PointerEvent !== "undefined" && ne instanceof PointerEvent && selectionCanvasRef.current) {
        try {
          selectionCanvasRef.current.setPointerCapture(ne.pointerId);
          rubberCapturePointerIdRef.current = ne.pointerId;
        } catch {
          rubberCapturePointerIdRef.current = null;
        }
      }
      setRubberLiveSelection(null);
      const { x, y } = contentXY(e);
      rubberLatestContentRef.current = { x, y };
      const additive = e.ctrlKey || e.metaKey || e.shiftKey;
      rubberPointerRef.current = {
        startX: x,
        startY: y,
        additive,
        dragApplied: false,
        initialSelection: additive ? new Set(selected.current) : new Set(),
      };
      setRubberRect({ x, y, w: 0, h: 0 });
      setRubberActive(true);
    };

    const onSelectionCanvasMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0 || !selectionMode) {
        return;
      }
      if ((e.target as HTMLElement).closest("[data-page-thumb]")) {
        return;
      }
      if ((e.target as HTMLElement).closest("button")) {
        return;
      }
      onRubberMouseDown(e);
    };

    const renderPremiumCard = (page1: number) => {
      const sid = thumbSessionIdRef.current;
      const ck = sid ? thumbCacheKey(sid, page1) : null;
      const ent = ck ? persistentThumbByKey.get(ck) : undefined;
      const url = thumbs[page1 - 1] ?? ent?.dataUrl ?? null;
      const targetW = cellWidth;
      const lowResPlaceholder = !!(url && ent?.dataUrl === url && ent.cssW < targetW * 0.92);
      const inLiveRubber = rubberLiveSelection?.has(page1) ?? false;
      const isOn = selectionMode && (selected.current.has(page1) || inLiveRubber);
      const rot = pageRotations[page1] ?? 0;
      const perPageProgress = numPages > 0 ? Math.min(100, Math.round((page1 / numPages) * 100)) : 0;

      const cardInner = (
        <div
          className={`relative flex min-h-0 w-full flex-col overflow-hidden rounded-md border bg-gradient-to-b from-slate-900/95 to-slate-950/95 text-left shadow-[0_4px_18px_-8px_rgba(0,0,0,0.75)] transition-[border-color,box-shadow] duration-75 ${
            selectionMode && isOn
              ? "border-cyan-400/85 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_8px_24px_-10px_rgba(34,211,238,0.25)]"
              : "border-white/10 hover:border-cyan-500/30"
          }`}
          style={{ width: "100%", height: cardHeight, minHeight: 0 }}
        >
          {url ? (
            <PdfPageCardImage
              page1={page1}
              url={url}
              rot={mode === "rotate" ? rot : 0}
              language={language}
              onImageFailed={onThumbImageDecodeFailed}
              lowResPlaceholder={lowResPlaceholder}
            />
          ) : (
            <div
              className="flex min-h-[120px] flex-1 w-full flex-col items-center justify-center gap-1.5 bg-slate-900/95 px-1 py-2"
              role="status"
              aria-busy="true"
              aria-live="polite"
            >
              <span
                className="inline-block h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300"
                aria-hidden
              />
              <p className="shrink-0 text-center text-[11px] font-medium text-slate-300">
                {language === "tr" ? "Yükleniyor…" : "Loading…"}
              </p>
              <div className="h-0.5 w-[88%] max-w-[140px] shrink-0 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-600/50 to-cyan-300/70 transition-[width] duration-300"
                  style={{ width: `${perPageProgress}%` }}
                />
              </div>
            </div>
          )}

          {selectionMode && isOn ? (
            <div
              className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-cyan-500/[0.12]"
              aria-hidden
            >
              <Check
                className="h-8 w-8 text-cyan-200 drop-shadow-[0_0_12px_rgba(34,211,238,0.65)] sm:h-9 sm:w-9"
                strokeWidth={2.1}
              />
            </div>
          ) : null}

          <div
            className={`pointer-events-none absolute bottom-0 left-0 right-0 z-[2] py-0.5 text-center text-[10px] font-bold tabular-nums leading-tight ${
              selectionMode && isOn ? "bg-cyan-950/95 text-cyan-100" : "bg-black/60 text-slate-100"
            }`}
          >
            {page1}
          </div>
        </div>
      );

      if (selectionMode) {
        return (
          <button
            type="button"
            data-page-thumb=""
            title={`${W.pagesLabel} ${page1}`}
            onClick={(ev) => onThumbClick(page1, ev)}
            className="block h-full min-h-0 w-full min-w-0 p-0 text-left"
          >
            {cardInner}
          </button>
        );
      }

      return cardInner;
    };

    const hint =
      mode === "delete"
        ? language === "tr"
          ? "Sayfaya tıklayın veya boş alanda sürükleyerek seçin. Seçimi kaldırmak için «Seçimi temizle» veya Ctrl+D. Ctrl+A tümü; ok tuşları kaydırır."
          : "Click pages or drag on empty space to select. Use Clear selection or Ctrl+D to deselect. Ctrl+A all; arrow keys scroll."
        : mode === "rotate"
          ? language === "tr"
            ? "Önizleme; döndürme ana ekrandan yapılır. Ok tuşları kaydırır."
            : "Preview only; rotation is done in the main workflow. Arrow keys scroll."
          : mode === "organize"
            ? language === "tr"
              ? "Kart üzerindeki ↑ ↓ ile sırayı değiştirin. Ok tuşları ızgarayı kaydırır."
              : "Use ↑ ↓ on each card to reorder. Arrow keys scroll the grid."
            : language === "tr"
              ? "Sayfaya tıklayın veya boş alanda sürükleyerek seçin. Seçimi kaldırmak için «Seçimi temizle» veya Ctrl+D. Ctrl+A tümü; ok tuşları kaydırır."
              : "Click pages or drag on empty space to select. Use Clear selection or Ctrl+D. Ctrl+A all; arrow keys scroll.";

    const progressLabel =
      readyPreviews < numPages
        ? language === "tr"
          ? `Önizleme: ${readyPreviews} / ${numPages} sayfa hazır — Kalanı yükleniyor...`
          : `Preview: ${readyPreviews} / ${numPages} pages ready — loading the rest...`
        : null;

    const selectedCountDisplay = useMemo(() => selected.current.size, [selectionTick]);

    const selectedLabel =
      language === "tr"
        ? `Seçilen: ${selectedCountDisplay} sayfa`
        : `Selected: ${selectedCountDisplay} page(s)`;

    const previewPlaceholderGhost =
      language === "tr"
        ? "Önizleme: 0000 / 0000 sayfa hazır — Kalanı yükleniyor..."
        : "Preview: 0000 / 0000 pages ready — loading the rest...";

    if (loadError) {
      return (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/90"
          role="alert"
        >
          {loadError}
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex items-center gap-3 py-8 text-sm text-slate-400" role="status">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-cyan-400/40 border-t-cyan-200" />
          {language === "tr" ? "Belge açılıyor…" : "Opening document…"}
        </div>
      );
    }

    const rawVirtualItems = rowVirtualizer.getVirtualItems();
    const virtualItems =
      rawVirtualItems.length > 0 || !virtualFallbackActive || virtualRowCount === 0
        ? rawVirtualItems
        : fallbackVirtualRows;

    return (
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-2">
        <p className="text-[11px] leading-relaxed text-slate-500">{hint}</p>
        <div className="flex w-full min-w-0 flex-nowrap items-center gap-0 border-b border-white/[0.07] pb-2.5 text-[12px] text-slate-400">
          <div
            className="w-72 min-w-[18rem] max-w-[40vw] shrink-0 border-r border-white/15 pr-4 [font-variant-numeric:tabular-nums]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {progressLabel ? (
              <span className="block font-medium whitespace-nowrap text-cyan-200/90 tabular-nums">
                {progressLabel}
              </span>
            ) : (
              <span
                className="block whitespace-nowrap tabular-nums text-transparent select-none"
                aria-hidden
              >
                {previewPlaceholderGhost}
              </span>
            )}
          </div>
          <div
            className="min-w-0 flex-1 px-4 text-center text-slate-300 sm:text-left [font-variant-numeric:tabular-nums]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            <span className="tabular-nums">{selectedLabel}</span>
          </div>
          <div className="flex shrink-0 items-center pl-1">
            {selectionMode ? (
              <button
                type="button"
                onClick={() => applySelection(new Set())}
                className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-500/35 hover:bg-white/10 hover:text-cyan-100"
              >
                {language === "tr" ? "Seçimi temizle" : "Clear selection"}
              </button>
            ) : null}
          </div>
        </div>

        <div
          className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col rounded-xl border-2 border-cyan-500/35 bg-slate-950/30 p-1 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.14)] ring-1 ring-cyan-400/25 sm:p-1.5"
          aria-label={language === "tr" ? "Aktif seçim alanı" : "Active selection area"}
        >
          {/* Kaydırma burada; getScrollElement parentRef bu div’e bağlı */}
          <div
            ref={parentRef}
            className="min-h-0 min-w-0 w-full flex-1 overflow-auto bg-transparent"
          >
            <div
              ref={selectionCanvasRef}
              style={{
                padding: `0 ${GRID_PAD_X}px`,
                boxSizing: "border-box",
                minHeight: "100%",
                width: "100%",
              }}
              className={rubberActive ? "select-none" : undefined}
              onMouseDown={selectionMode ? onSelectionCanvasMouseDown : undefined}
            >
            <div
              ref={gridContentRef}
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                minWidth: 0,
                position: "relative",
              }}
            >
              {rubberRect && rubberRect.w >= 0 && rubberRect.h >= 0 ? (
                <div
                  className="pointer-events-none absolute z-[25] rounded-md border border-cyan-400/55 bg-cyan-400/20 shadow-[0_0_22px_-8px_rgba(34,211,238,0.45)]"
                  style={{
                    left: rubberRect.x,
                    top: rubberRect.y,
                    width: Math.max(rubberRect.w, 1),
                    height: Math.max(rubberRect.h, 1),
                  }}
                />
              ) : null}
              {virtualRowCount > 0 && virtualItems.length === 0 ? (
                <div
                  className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex flex-col items-center justify-start gap-3 px-4 pt-16"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <span
                    className="inline-block h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-cyan-400/35 border-t-cyan-300"
                    aria-hidden
                  />
                  <p className="text-center text-sm font-medium text-slate-300">
                    {language === "tr" ? "Yükleniyor…" : "Loading…"}
                  </p>
                </div>
              ) : null}
              {virtualItems.map((vRow) => {
                const top = vRow.start;
                const rowStart = vRow.index * cols;
                const rowEnd = Math.min(rowStart + cols, sequenceLength);
                const cellsInRow = Math.max(0, rowEnd - rowStart);

                return (
                  <div
                    key={`row-${vRow.index}`}
                    className="absolute left-0 w-full min-w-0"
                    style={{
                      top,
                      height: cardHeight + ROW_GAP_PX,
                      display: "grid",
                      gridTemplateColumns: `repeat(${cellsInRow}, minmax(0, 1fr))`,
                      columnGap: GAP_PX,
                    }}
                  >
                    {Array.from({ length: cellsInRow }, (_, k) => {
                      const flat = rowStart + k;
                      const page1 = flatIndexToPageNum(flat);
                      if (page1 < 1 || page1 > numPages) {
                        return null;
                      }
                      return (
                        <div key={`p-${page1}`} className="relative min-w-0">
                          {organizeMode ? (
                            <div className="absolute right-0 top-0 z-[15] flex flex-col gap-0.5 p-0.5">
                              <button
                                type="button"
                                disabled={flat === 0}
                                title={language === "tr" ? "Önceki sıraya taşı" : "Move earlier"}
                                className="rounded border border-white/15 bg-slate-950/90 px-1 py-0.5 text-[10px] font-semibold text-slate-200 shadow-sm disabled:opacity-25"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveOrder(flat, -1);
                                }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={flat >= sequenceLength - 1}
                                title={language === "tr" ? "Sonraki sıraya taşı" : "Move later"}
                                className="rounded border border-white/15 bg-slate-950/90 px-1 py-0.5 text-[10px] font-semibold text-slate-200 shadow-sm disabled:opacity-25"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveOrder(flat, 1);
                                }}
                              >
                                ↓
                              </button>
                            </div>
                          ) : null}
                          <PageThumbMountTrigger
                            pageIndex={page1}
                            cellWidth={cellWidth}
                            requestThumb={requestSinglePageThumb}
                          />
                          {renderPremiumCard(page1)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

PdfPageVisualGrid.displayName = "PdfPageVisualGrid";
