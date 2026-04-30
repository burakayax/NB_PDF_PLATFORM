import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as pdfjsLib from "pdfjs-dist";
import type { Language } from "../i18n/landing";
import {
  fetchMergeJobPdfBlobUrl,
  fetchResultHeroPreviewBlobUrl,
  fetchResultPdfBlobUrl,
} from "../api";

// eslint-disable-next-line import/no-unresolved -- Vite resolves ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const WATERMARK_LABEL = "NB GLOBAL STUDIO";
/** Performans + ürün kararı: tam önizlemede en fazla bu kadar sayfa rasterlenir. */
export const FULL_PREVIEW_MAX_PAGES = 10;

function pdfPreviewLoadMessage(err: unknown, language: Language): string {
  const name =
    err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  if (name === "PasswordException") {
    return language === "tr"
      ? "Bu PDF şifre korumalı; önizleme açılamıyor."
      : "This PDF is password-protected; preview cannot be opened.";
  }
  if (name === "InvalidPDFException") {
    return language === "tr"
      ? "PDF dosyası geçersiz veya bozuk görünüyor."
      : "The file does not look like a valid PDF.";
  }
  if (name === "UnexpectedResponseException") {
    return language === "tr"
      ? "PDF verisi okunurken hata oluştu."
      : "Could not read PDF data.";
  }
  const msg = err instanceof Error ? err.message : "";
  if (/worker|loading/i.test(msg)) {
    return language === "tr"
      ? "Önizleme bileşeni yüklenemedi; sayfayı yenileyip tekrar deneyin."
      : "Preview engine failed to load; refresh and try again.";
  }
  return language === "tr" ? "Önizleme yüklenemedi." : "Could not load preview.";
}

type Props = {
  open: boolean;
  onClose: () => void;
  resultId: string | null;
  mergeJobId: string | null;
  accessToken: string | null;
  filename: string;
  language: Language;
};

function FullPdfWatermarkLayer() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-lg"
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-32deg, transparent 0 96px, rgba(255,255,255,0.5) 96px 97px)",
        }}
      />
      <div className="absolute inset-0 flex flex-wrap content-center justify-center gap-x-10 gap-y-12 p-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-[clamp(0.85rem,2.2vw,1.35rem)] font-bold uppercase tracking-[0.2em] text-white/22"
            style={{ transform: "rotate(-26deg)" }}
          >
            {WATERMARK_LABEL}
          </span>
        ))}
      </div>
    </div>
  );
}

function PdfPageCanvas({
  pdf,
  pageNumber,
  widthCssPx,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  widthCssPx: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = widthCssPx / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) {
        return;
      }
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      await page.render({ canvasContext: ctx, viewport }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber, widthCssPx]);

  return (
    <canvas
      ref={canvasRef}
      className="h-auto max-w-full rounded-md border border-white/10 bg-slate-950/35"
      style={{ width: widthCssPx }}
    />
  );
}

function WatermarkedPdfJsPreview({
  blobUrl,
  language,
  maxPages,
}: {
  blobUrl: string;
  language: Language;
  maxPages: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [viewW, setViewW] = useState(520);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: pdfjsLib.PDFDocumentProxy | null = null;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    void (async () => {
      setErr(null);
      try {
        const res = await fetch(blobUrl);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const buf = await res.arrayBuffer();
        if (cancelled) {
          return;
        }
        loadingTask = pdfjsLib.getDocument({
          data: buf,
          useSystemFonts: true,
          verbosity: 0,
        });
        const doc = await loadingTask.promise;
        if (cancelled) {
          void doc.destroy().catch(() => null);
          return;
        }
        loaded = doc;
        setPdf(doc);
        setNumPages(doc.numPages);
      } catch (e) {
        if (!cancelled) {
          setErr(pdfPreviewLoadMessage(e, language));
        }
      }
    })();

    return () => {
      cancelled = true;
      void loadingTask?.destroy?.();
      void loaded?.destroy().catch(() => null);
    };
  }, [blobUrl, language]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const raw = el.clientWidth;
      setViewW(Math.min(Math.max(260, raw - 24), 720));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (err) {
    return <p className="text-center text-sm text-amber-200">{err}</p>;
  }

  if (!pdf || numPages < 1) {
    return (
      <div className="flex flex-col items-center gap-3 text-slate-300">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/35 border-t-cyan-200" />
        <span className="text-sm">{language === "tr" ? "Yükleniyor…" : "Loading…"}</span>
      </div>
    );
  }

  const shown = Math.min(maxPages, numPages);

  return (
    <div ref={wrapRef} className="relative mx-auto w-full max-w-5xl">
      <FullPdfWatermarkLayer />
      <div className="relative z-[5] flex flex-col items-center gap-4 py-2">
        {numPages > maxPages ? (
          <div
            role="status"
            className="w-full max-w-3xl rounded-xl border border-amber-500/25 bg-amber-950/35 px-4 py-3 text-center text-sm leading-relaxed text-amber-50/95"
          >
            {language === "tr" ? (
              <>
                Bu PDF <strong>{numPages}</strong> sayfa. Önizlemede yalnızca{" "}
                <strong>1–{shown}</strong>. sayfalar gösterilir; tam dosya için indirin.
              </>
            ) : (
              <>
                This PDF has <strong>{numPages}</strong> pages. Preview shows pages{" "}
                <strong>1–{shown}</strong> only; download for the full file.
              </>
            )}
          </div>
        ) : null}
        {Array.from({ length: shown }, (_, i) => i + 1).map((pn) => (
          <div key={pn} className="relative flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {language === "tr" ? `Sayfa ${pn}` : `Page ${pn}`}
            </span>
            <PdfPageCanvas pdf={pdf} pageNumber={pn} widthCssPx={viewW} />
          </div>
        ))}
      </div>
    </div>
  );
}

type PreviewMode = "idle" | "pdf" | "hero";

/**
 * Tam ekran önizleme: PDF çıktılarda pdf.js + filigran (en fazla FULL_PREVIEW_MAX_PAGES sayfa);
 * PDF olmayan sonuçlarda sunucu kahraman PNG’sine düşer.
 */
export function GatedResultPreviewModal({
  open,
  onClose,
  resultId,
  mergeJobId,
  accessToken,
  filename,
  language,
}: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<PreviewMode>("idle");

  useEffect(() => {
    if (!open || !accessToken?.trim()) {
      setObjectUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setErr(null);
      setLoading(false);
      setMode("idle");
      return;
    }

    const rid = resultId?.trim() || null;
    const mid = mergeJobId?.trim() || null;
    if (!rid && !mid) {
      setObjectUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setErr(null);
      setLoading(false);
      setMode("idle");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErr(null);
    setMode("idle");

    const run = async () => {
      try {
        if (mid) {
          const url = await fetchMergeJobPdfBlobUrl(mid, accessToken);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          setObjectUrl((prev) => {
            if (prev) {
              URL.revokeObjectURL(prev);
            }
            return url;
          });
          setMode("pdf");
          return;
        }
        if (rid) {
          try {
            const url = await fetchResultPdfBlobUrl(rid, accessToken);
            if (cancelled) {
              URL.revokeObjectURL(url);
              return;
            }
            setObjectUrl((prev) => {
              if (prev) {
                URL.revokeObjectURL(prev);
              }
              return url;
            });
            setMode("pdf");
            return;
          } catch {
            /* Word/Excel vb. — kahraman PNG */
          }
          const url = await fetchResultHeroPreviewBlobUrl(rid, accessToken);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          setObjectUrl((prev) => {
            if (prev) {
              URL.revokeObjectURL(prev);
            }
            return url;
          });
          setMode("hero");
        }
      } catch {
        if (!cancelled) {
          setErr(
            language === "tr"
              ? "Önizleme yüklenemedi."
              : "Could not load preview.",
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
    };
  }, [open, resultId, mergeJobId, accessToken, language]);

  const close = () => {
    setObjectUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setMode("idle");
    onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[12000] flex flex-col bg-[#030712]/96 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-7">
            <div className="min-w-0 flex gap-4">
              <div className="hidden h-12 w-12 shrink-0 rounded-2xl border border-emerald-400/35 bg-gradient-to-br from-emerald-400/20 to-cyan-500/10 sm:flex sm:items-center sm:justify-center">
                <svg
                  className="h-6 w-6 text-emerald-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300/90">
                  {language === "tr" ? "Filigranlı önizleme" : "Watermarked preview"}
                </p>
                <p className="mt-1 truncate text-[15px] font-semibold text-slate-50">{filename}</p>
                {mode === "hero" ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {language === "tr"
                      ? "Bu çıktı türünde yalnızca ilk sayfa görseli gösterilir."
                      : "For this output type only the first-page image is available."}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="shrink-0 rounded-xl border border-white/12 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/12"
            >
              {language === "tr" ? "Kapat" : "Close"}
            </button>
          </header>
          <div className="relative flex min-h-0 flex-1 overflow-auto px-3 py-5 sm:px-8 sm:py-7">
            {!accessToken?.trim() ? (
              <p className="mx-auto max-w-md self-center text-center text-sm text-slate-400">
                {language === "tr" ? "Önizleme için oturum gerekli." : "Sign in to preview."}
              </p>
            ) : loading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-300">
                <span className="inline-block h-11 w-11 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-100" />
                <span className="text-sm">{language === "tr" ? "Yükleniyor…" : "Loading…"}</span>
              </div>
            ) : err ? (
              <p className="mx-auto max-w-md self-center text-center text-sm text-amber-200">{err}</p>
            ) : objectUrl && mode === "pdf" ? (
              <WatermarkedPdfJsPreview
                blobUrl={objectUrl}
                language={language}
                maxPages={FULL_PREVIEW_MAX_PAGES}
              />
            ) : objectUrl && mode === "hero" ? (
              <motion.div
                className="mx-auto flex max-w-full flex-1 justify-center"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <img
                  src={objectUrl}
                  alt=""
                  className="max-h-[calc(100vh-10rem)] w-auto max-w-full rounded-2xl border border-white/[0.06] shadow-[0_32px_80px_-28px_rgba(0,0,0,0.85)]"
                />
              </motion.div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
