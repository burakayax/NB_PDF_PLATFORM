import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  Check,
  Download,
  FileText,
  Hash,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Maximize2,
  MousePointerClick,
  Pencil,
  Presentation,
  RotateCcw,
  Share2,
  Sliders,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { getPdfPageCount, renderPdfToCanvases } from "../../lib/ocr";

const PREVIEW_PAGES = 12; // önizlemede render edilen sayfa sınırı (perf)

type ToolItem = { id: string; icon: React.ReactNode; tr: string; en: string };

// Düzenleme araçları (cihazda / üyeliksiz kullanılabilir).
const DEVICE_TOOLS: ToolItem[] = [
  { id: "pdf-duzenle", icon: <Pencil className="h-5 w-5" />, tr: "PDF Düzenle", en: "Edit PDF" },
  { id: "organize-pdf", icon: <Sliders className="h-5 w-5" />, tr: "Sayfa Sırala", en: "Reorder pages" },
  { id: "split", icon: <Layers className="h-5 w-5" />, tr: "Sayfalara Böl", en: "Split" },
  { id: "rotate-pdf", icon: <RotateCcw className="h-5 w-5" />, tr: "Döndür", en: "Rotate" },
  { id: "delete-pages", icon: <Trash2 className="h-5 w-5" />, tr: "Sayfa Sil", en: "Delete pages" },
];

// Dönüştür & çıkar — sunucu + üyelik (Pro vurgusu).
const CONVERT_TOOLS: ToolItem[] = [
  { id: "pdf-to-word", icon: <FileText className="h-5 w-5" />, tr: "Word'e Çevir", en: "To Word" },
  { id: "pdf-to-excel", icon: <Layers className="h-5 w-5" />, tr: "Excel'e Çevir", en: "To Excel" },
  { id: "pdf-to-image", icon: <ImageIcon className="h-5 w-5" />, tr: "Resme Çevir", en: "To Image" },
  { id: "pdf-to-ppt", icon: <Presentation className="h-5 w-5" />, tr: "PPT'ye Çevir", en: "To PPT" },
  { id: "extract-images", icon: <ImageIcon className="h-5 w-5" />, tr: "Görsel Çıkar", en: "Extract images" },
  { id: "compress", icon: <ArrowLeftRight className="h-5 w-5" />, tr: "Sıkıştır", en: "Compress" },
  { id: "page-numbers", icon: <Hash className="h-5 w-5" />, tr: "Sayfa No", en: "Page numbers" },
];

const ZOOM_MIN = 40;
const ZOOM_MAX = 400;
const ZOOM_STEP = 20;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z)));

type Props = {
  file: File;
  language: Language;
  isPro?: boolean;
  onClose: () => void;
  /** Bir araç onaylandı — üst bileşen PDF'i o araca aktarır (IndexedDB + yönlendirme). */
  onPickTool: (toolId: string, isConvert: boolean) => void;
};

/**
 * PDF MERKEZİ — taranan/açılan bir PDF'i önce GÖSTERİR (sayfaya sığacak şekilde, yakınlaştırma
 * destekli), yanında (masaüstü) / altında (mobil) araçları sunar. Bir araca dokununca, PDF'in o
 * araca aktarılacağı ONAYLANIR ve araç açılır. Uyarlanır düzen.
 */
export function PdfHub({ file, language, isPro, onClose, onPickTool }: Props) {
  const tr = language === "tr";
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);

  // Yakınlaştırma: 100 = sayfaya sığdır (kapsayıcı genişliği). Ctrl+tekerlek + butonlar.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fitWidth, setFitWidth] = useState(0);
  const [zoom, setZoom] = useState(100);
  const pageWidth = fitWidth > 0 ? Math.round((fitWidth * zoom) / 100) : 0;

  // Onaylı aktarım: bir araç seçilince önce onay göster, sonra eşitle.
  const [pending, setPending] = useState<{ tool: ToolItem; convert: boolean } | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Önizlemeyi yüksek çözünürlükte üret (yakınlaştırınca net kalsın).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const canvases = await renderPdfToCanvases(file, 2, PREVIEW_PAGES);
        if (cancelled) return;
        setThumbs(canvases.map((c) => c.toDataURL("image/jpeg", 0.85)));
      } catch {
        /* önizleme üretilemezse araçlar yine çalışır */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Toplam sayfa sayısı (önizleme sınırı aşılıyorsa kullanıcıya dürüst not için).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const n = await getPdfPageCount(file);
      if (!cancelled) setTotalPages(n);
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Kapsayıcı genişliğini ölç → "sığdır" temel genişliği (ultra-geniş ekranda üst sınır).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = el.clientWidth - 32; // yatay padding payı
      setFitWidth(Math.max(220, Math.min(w, 1000)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl + fare tekerleği ile yakınlaştır (pasif olmayan dinleyici → preventDefault çalışsın).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // düz tekerlek normal kaydırma yapsın
      e.preventDefault();
      setZoom((z) => clampZoom(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Klavye: + / - yakınlaştır, 0 sığdır, Esc kapat/onayı iptal et.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pending) setPending(null);
        else onClose();
        return;
      }
      if (e.ctrlKey && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom((z) => clampZoom(z + ZOOM_STEP));
      } else if (e.ctrlKey && e.key === "-") {
        e.preventDefault();
        setZoom((z) => clampZoom(z - ZOOM_STEP));
      } else if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        setZoom(100);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onClose]);

  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(z - ZOOM_STEP)), []);
  const zoomFit = useCallback(() => setZoom(100), []);

  function downloadBlob() {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name || "belge.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  async function saveResult() {
    const win = window as unknown as {
      showSaveFilePicker?: (o: {
        suggestedName?: string;
        types?: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<FileSystemFileHandle>;
    };
    if (typeof win.showSaveFilePicker === "function") {
      try {
        const h = await win.showSaveFilePicker({
          suggestedName: file.name || "belge.pdf",
          types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        });
        const w = await h.createWritable();
        await w.write(file);
        await w.close();
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    downloadBlob();
  }

  const canShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === "function";
  async function shareResult() {
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
    };
    try {
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: file.name });
      }
    } catch {
      /* iptal */
    }
  }

  const toolBtn = (t: ToolItem, convert: boolean) => (
    <button
      key={t.id}
      type="button"
      onClick={() => setPending({ tool: t, convert })}
      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition active:scale-[0.97] ${
        convert
          ? "border-violet-400/25 bg-violet-500/[0.06] hover:border-violet-400/45 hover:bg-violet-500/[0.12]"
          : "border-white/[0.1] bg-white/[0.03] hover:border-cyan-400/40 hover:bg-white/[0.06]"
      }`}
    >
      {convert && !isPro && (
        <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-200">
          <Lock className="h-2.5 w-2.5" />Pro
        </span>
      )}
      <span className={convert ? "text-violet-300" : "text-cyan-300"}>{t.icon}</span>
      <span className="text-[11px] font-semibold leading-tight text-slate-100">{tr ? t.tr : t.en}</span>
    </button>
  );

  const zoomBtnCls =
    "flex h-8 w-8 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-[#070b14] text-white"
    >
      {/* Başlık */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">{file.name || (tr ? "Belge" : "Document")}</p>
            {totalPages > 0 && (
              <p className="text-[11px] leading-tight text-slate-400">
                {totalPages} {tr ? "sayfa" : totalPages === 1 ? "page" : "pages"}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => void saveResult()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-white/[0.08]">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tr ? "Kaydet" : "Save"}</span>
          </button>
          {canShare && (
            <button type="button" onClick={() => void shareResult()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-white/[0.08]">
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tr ? "Paylaş" : "Share"}</span>
            </button>
          )}
          <button type="button" onClick={onClose} aria-label={tr ? "Kapat" : "Close"} className="rounded-lg p-2 text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Gövde — mobil: dikey (önizleme üstte); masaüstü: yan panel */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* PDF önizleme + yakınlaştırma çubuğu */}
        <div className="relative min-h-0 flex-1">
          <div ref={scrollRef} className="h-full overflow-auto bg-black/30 p-4">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : thumbs.length > 0 ? (
              <div className="mx-auto flex w-fit min-w-full flex-col items-center gap-3 pb-16">
                {totalPages > thumbs.length && (
                  <div className="w-full max-w-md rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2 text-center text-[12px] leading-relaxed text-amber-200/90">
                    {tr
                      ? `Önizlemede ilk ${thumbs.length} sayfa gösteriliyor. Seçtiğin araç belgenin tamamına (${totalPages} sayfa) uygulanır.`
                      : `Previewing the first ${thumbs.length} of ${totalPages} pages. The tool you pick applies to the full document.`}
                  </div>
                )}
                {thumbs.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`sayfa ${i + 1}`}
                    style={pageWidth ? { width: pageWidth } : undefined}
                    className="max-w-none rounded-lg border border-white/10 shadow-lg"
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                {tr ? "Önizleme yüklenemedi" : "Preview unavailable"}
              </div>
            )}
          </div>

          {/* Yakınlaştırma çubuğu — önizlemenin altında ortalı, sabit */}
          {!loading && thumbs.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
              <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/10 bg-[#0b1020]/95 px-1.5 py-1 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.7)] backdrop-blur">
                <button type="button" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label={tr ? "Uzaklaştır" : "Zoom out"} className={zoomBtnCls}>
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="min-w-[3rem] text-center text-[12px] font-bold tabular-nums text-slate-100">%{zoom}</span>
                <button type="button" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label={tr ? "Yakınlaştır" : "Zoom in"} className={zoomBtnCls}>
                  <ZoomIn className="h-4 w-4" />
                </button>
                <span className="mx-1 h-5 w-px bg-white/10" />
                <button type="button" onClick={zoomFit} aria-label={tr ? "Sayfaya sığdır" : "Fit to page"} className={`${zoomBtnCls} w-auto gap-1 px-2 text-[12px] font-semibold`}>
                  <Maximize2 className="h-3.5 w-3.5" />
                  {tr ? "Sığdır" : "Fit"}
                </button>
                <span className="ml-1 hidden items-center gap-1 pl-1 pr-1.5 text-[11px] text-slate-400 md:flex">
                  <MousePointerClick className="h-3 w-3" />
                  {tr ? "Ctrl + tekerlek" : "Ctrl + wheel"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Araç paneli */}
        <div className="shrink-0 border-t border-white/[0.08] bg-[#0b1020] p-4 lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
            {tr ? "Düzenle" : "Edit"}
          </p>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
            {DEVICE_TOOLS.map((t) => toolBtn(t, false))}
          </div>

          <p className="mb-2 mt-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-300">
            <Sparkles className="h-3 w-3" />
            {tr ? "Dönüştür & Çıkar" : "Convert & extract"}
          </p>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
            {CONVERT_TOOLS.map((t) => toolBtn(t, true))}
          </div>
          {!isPro && (
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
              {tr
                ? "Dönüştürme araçları üyelik gerektirir — belgen korunur, giriş sonrası orada açılır."
                : "Conversion tools need an account — your file is kept and opens there after sign-in."}
            </p>
          )}
        </div>
      </div>

      {/* Onaylı aktarım — "açık PDF bu araca aktarılacak" */}
      {pending && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={() => setPending(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b1020] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pending.convert ? "bg-violet-500/15 text-violet-300" : "bg-cyan-500/15 text-cyan-300"}`}>
                {pending.tool.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{tr ? (pending.tool as ToolItem).tr : (pending.tool as ToolItem).en}</p>
                <p className="truncate text-[12px] text-slate-400">{file.name || (tr ? "Belge.pdf" : "Document.pdf")}</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-300">
              {tr
                ? "Açık olan PDF bu araca aktarılıp orada açılacak. Devam edilsin mi?"
                : "The open PDF will be transferred to this tool and opened there. Continue?"}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg border border-white/12 px-3 py-2 text-[13px] font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                {tr ? "Vazgeç" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = pending;
                  setPending(null);
                  onPickTool(p.tool.id, p.convert);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-[13px] font-bold text-white shadow-[0_10px_28px_-10px_rgba(34,211,238,0.7)] transition hover:from-cyan-400 hover:to-blue-500"
              >
                <Check className="h-4 w-4" />
                {tr ? "Aktar ve Aç" : "Transfer & open"}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
