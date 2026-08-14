import { useEffect, useRef, useState } from "react";
import { Check, Download, FileText, Loader2, Lock, Search, Share2, Sparkles, Trash2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ToolDropzone } from "./ToolDropzone";
import { imagesToSearchablePdf, pdfBytesToBlob } from "../../lib/clientPdf";
import {
  imageFileToCanvas,
  ocrImagesToWords,
  renderPdfToCanvases,
} from "../../lib/ocr";
import { canvasToJpegBlob } from "../../lib/documentScan";

const MAX_BYTES = 80 * 1024 * 1024;

/**
 * ARANABİLİR PDF aracı (SEO araç sayfası çekirdeği). Taranmış PDF veya görselleri
 * cihazda OCR'lar (Türkçe + İngilizce) ve görüntünün üzerine görünmez metin katmanı
 * gömerek aranabilir/kopyalanabilir PDF üretir. Aranabilir PDF üretimi Pro özelliğidir.
 */
export function SearchablePdfTool({
  language,
  isPro,
  onUpgrade,
  onLogin,
  initialFile,
}: {
  language: Language;
  isPro?: boolean;
  onUpgrade?: () => void;
  onLogin?: () => void;
  /** Araçlar arası aktarım (Taramalarım / PDF Merkezi) ile gelen dosya. */
  initialFile?: File | null;
}) {
  const tr = language === "tr";
  const [files, setFiles] = useState<File[]>([]);
  const [ocrPct, setOcrPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPro, setShowPro] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  function addFiles(list: FileList | File[]) {
    setError(null);
    const arr = Array.from(list).filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/"),
    );
    if (arr.length === 0) {
      setError(tr ? "Lütfen PDF veya görsel ekleyin." : "Please add a PDF or images.");
      return;
    }
    const total = arr.reduce((s, f) => s + f.size, 0);
    if (total > MAX_BYTES) {
      setError(tr ? "Toplam boyut 80 MB'ı aşıyor." : "Total exceeds 80 MB.");
      return;
    }
    setFiles((prev) => [...prev, ...arr]);
    setResult(null);
  }

  // Araçlar arası aktarım: dışarıdan gelen PDF/görseli bir kez listeye ekle.
  const loadedInitialRef = useRef<File | null>(null);
  useEffect(() => {
    if (initialFile && loadedInitialRef.current !== initialFile) {
      loadedInitialRef.current = initialFile;
      addFiles([initialFile]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addFiles güncel closure'dan alınır
  }, [initialFile]);

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, k) => k !== i));
  const reset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
    setOcrPct(null);
  };

  async function run() {
    if (files.length === 0) return;
    if (!isPro) {
      setShowPro(true);
      return;
    }
    setError(null);
    setOcrPct(0);
    try {
      // Kaynakları sayfa görüntülerine çevir: PDF → render, görsel → canvas.
      const canvases: HTMLCanvasElement[] = [];
      for (const f of files) {
        if (f.type === "application/pdf") {
          canvases.push(...(await renderPdfToCanvases(f)));
        } else {
          canvases.push(await imageFileToCanvas(f));
        }
      }
      if (canvases.length === 0) throw new Error("no pages");

      const [fontBytes, jpegBlobs] = await Promise.all([
        fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer()),
        Promise.all(canvases.map((c) => canvasToJpegBlob(c, 0.9))),
      ]);
      const wordsPerPage = await ocrImagesToWords(canvases, (p) => setOcrPct(p.ratio));
      const pageBufs = await Promise.all(jpegBlobs.map((b) => b.arrayBuffer()));
      const pages = pageBufs.map((bytes, i) => ({
        bytes,
        mime: "image/jpeg",
        words: wordsPerPage[i] ?? [],
      }));
      const outBytes = await imagesToSearchablePdf(pages, fontBytes);
      setResult({ blob: pdfBytesToBlob(outBytes), filename: "aranabilir.pdf" });
    } catch {
      setError(tr ? "Aranabilir PDF oluşturulamadı." : "Could not create the searchable PDF.");
    } finally {
      setOcrPct(null);
    }
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  async function shareResult() {
    if (!result) return;
    const f = new File([result.blob], result.filename, { type: "application/pdf" });
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
    };
    try {
      if (nav.canShare?.({ files: [f] }) && nav.share) await nav.share({ files: [f], title: result.filename });
    } catch {
      /* iptal */
    }
  }
  const canShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === "function";

  if (result) {
    return (
      <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
          <Check className="h-8 w-8" />
        </div>
        <p className="mt-4 text-xl font-bold text-white">
          {tr ? "Aranabilir PDF hazır 🎉" : "Searchable PDF ready 🎉"}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {tr ? "Artık Ctrl+F ile arayabilir, metni kopyalayabilirsiniz." : "You can now search with Ctrl+F and copy text."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => downloadBlob(result.blob, result.filename)}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:from-blue-500 hover:to-indigo-500"
          >
            <Download className="h-4 w-4" />
            {tr ? "İndir" : "Download"}
          </button>
          {canShare && (
            <button
              type="button"
              onClick={() => void shareResult()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"
            >
              <Share2 className="h-4 w-4" />
              {tr ? "Paylaş" : "Share"}
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
          >
            {tr ? "Yeni belge" : "New file"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ToolDropzone
        toolId="image-to-pdf"
        tr={tr}
        accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
        multiple
        showBenefits={files.length === 0}
        onFiles={(fl) => addFiles(fl)}
        titleTr="PDF veya görselleri buraya sürükle"
        titleEn="Drag a PDF or images here"
        hintTr="ya da tıklayıp seç · taranmış PDF, JPG, PNG · 80 MB'a kadar"
        hintEn="or click to choose · scanned PDF, JPG, PNG · up to 80 MB"
      />

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-cyan-300">
                <FileText className="h-4 w-4" />
              </span>
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-100">{f.name}</p>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                aria-label={tr ? "Kaldır" : "Remove"}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">
          {error}
        </p>
      )}

      {ocrPct !== null && (
        <div className="mt-4 rounded-2xl border border-violet-400/25 bg-violet-500/[0.08] px-5 py-3.5">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-violet-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr ? "Metin taranıyor (OCR)…" : "Recognizing text (OCR)…"}
            <span className="ml-auto tabular-nums">{Math.round(ocrPct * 100)}%</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-violet-400 transition-[width] duration-300" style={{ width: `${Math.round(ocrPct * 100)}%` }} />
          </div>
        </div>
      )}

      {!isPro && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-medium text-violet-300/90">
          <Sparkles className="h-3.5 w-3.5" />
          {tr ? "Aranabilir PDF (OCR) bir Pro özelliğidir" : "Searchable PDF (OCR) is a Pro feature"}
        </p>
      )}

      <button
        type="button"
        onClick={() => void run()}
        disabled={ocrPct !== null || files.length === 0}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(124,58,237,0.7)] ring-1 ring-white/10 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:pointer-events-none disabled:opacity-40"
      >
        {ocrPct !== null ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {tr ? "İşleniyor…" : "Processing…"}
          </>
        ) : (
          <>
            {isPro ? <Search className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            {tr ? "Aranabilir PDF Yap" : "Make searchable PDF"}
          </>
        )}
      </button>

      {/* Pro duvarı */}
      {showPro && !isPro && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-4 sm:items-center" onClick={() => setShowPro(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl border border-violet-400/30 bg-[#0f1424] p-6 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 text-fuchsia-300 ring-1 ring-fuchsia-400/30">
              <Search className="h-7 w-7" />
            </div>
            <p className="mt-4 text-center text-lg font-bold text-white">
              {tr ? "Aranabilir PDF — Pro" : "Searchable PDF — Pro"}
            </p>
            <p className="mt-1 text-center text-[13px] text-slate-400">
              {tr
                ? "Belgelerinizi Ctrl+F ile aranabilir, kopyalanabilir yapın — metin cihazınızda tanınır, dosyanız yüklenmez."
                : "Make documents searchable and copyable with Ctrl+F — text is recognized on your device, your file is not uploaded."}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowPro(false);
                onUpgrade?.();
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3.5 text-sm font-bold text-white transition hover:from-violet-500 hover:to-fuchsia-500"
            >
              <Sparkles className="h-4 w-4" />
              {tr ? "Pro'ya Geç" : "Upgrade to Pro"}
            </button>
            {onLogin && (
              <button
                type="button"
                onClick={() => {
                  setShowPro(false);
                  onLogin();
                }}
                className="mt-2 w-full py-1 text-[13px] font-medium text-slate-400 transition hover:text-slate-200"
              >
                {tr ? "Zaten Pro üyesiyim — giriş yap" : "I already have Pro — log in"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
