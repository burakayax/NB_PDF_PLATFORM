import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
  Share2,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { renderPdfToCanvases } from "../../lib/ocr";

type ToolItem = { id: string; icon: React.ReactNode; tr: string; en: string };

// Düzenleme araçları (üyeliksiz kullanılabilir).
const DEVICE_TOOLS: ToolItem[] = [
  { id: "pdf-duzenle", icon: <Pencil className="h-5 w-5" />, tr: "PDF Düzenle", en: "Edit PDF" },
  { id: "organize-pdf", icon: <Sliders className="h-5 w-5" />, tr: "Sayfa Sırala", en: "Reorder pages" },
  { id: "split", icon: <Layers className="h-5 w-5" />, tr: "Sayfalara Böl", en: "Split" },
  { id: "rotate-pdf", icon: <RotateCcw className="h-5 w-5" />, tr: "Döndür", en: "Rotate" },
  { id: "delete-pages", icon: <Trash2 className="h-5 w-5" />, tr: "Sayfa Sil", en: "Delete pages" },
];

// Dönüştürme — sunucu + üyelik (Pro vurgusu). Faz 2'de tam aktarım.
const CONVERT_TOOLS: ToolItem[] = [
  { id: "pdf-to-word", icon: <FileText className="h-5 w-5" />, tr: "Word'e Çevir", en: "To Word" },
  { id: "pdf-to-excel", icon: <Layers className="h-5 w-5" />, tr: "Excel'e Çevir", en: "To Excel" },
  { id: "pdf-to-image", icon: <ImageIcon className="h-5 w-5" />, tr: "Resme Çevir", en: "To Image" },
  { id: "compress", icon: <ArrowLeftRight className="h-5 w-5" />, tr: "Sıkıştır", en: "Compress" },
];

type Props = {
  file: File;
  language: Language;
  isPro?: boolean;
  onClose: () => void;
  /** Bir araç seçildi — üst bileşen PDF'i o araca aktarır (cihazda: initialFile;
   *  dönüştürme: pending + yönlendirme). */
  onPickTool: (toolId: string, isConvert: boolean) => void;
};

/**
 * PDF MERKEZİ — taranan/açılan bir PDF'i önce GÖSTERİR, yanında (masaüstü) / altında
 * (mobil) araçları sunar. Kullanıcı bir araca dokununca PDF o araçta açılır; ya da
 * sadece bakıp kapatır. Uyarlanır düzen.
 */
export function PdfHub({ file, language, isPro, onClose, onPickTool }: Props) {
  const tr = language === "tr";
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const canvases = await renderPdfToCanvases(file, 1.1, 12);
        if (cancelled) return;
        setThumbs(canvases.map((c) => c.toDataURL("image/jpeg", 0.7)));
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
      onClick={() => onPickTool(t.id, convert)}
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
          <p className="truncate text-sm font-bold">{file.name || (tr ? "Belge" : "Document")}</p>
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
        {/* PDF önizleme */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-black/30 p-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : thumbs.length > 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3">
              {thumbs.map((src, i) => (
                <img key={i} src={src} alt={`sayfa ${i + 1}`} className="w-full rounded-lg border border-white/10 shadow-lg" />
              ))}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">
              {tr ? "Önizleme yüklenemedi" : "Preview unavailable"}
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
            {tr ? "Dönüştür" : "Convert"}
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
    </motion.div>,
    document.body,
  );
}
