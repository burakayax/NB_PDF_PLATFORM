import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Share2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import {
  mergePdfs,
  imagesToPdf,
  pdfBytesToBlob,
  PdfEncryptedError,
} from "../../lib/clientPdf";

export type GuestToolId = "merge" | "image-to-pdf";

const MAX_BYTES = 80 * 1024 * 1024; // 80 MB

type Picked = { id: string; file: File };
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
function humanSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

type Props = {
  /** Başlangıç aracı. */
  tool: GuestToolId;
  language: Language;
  /** true → bırakılan dosya türüne göre araç otomatik seçilir (PDF→birleştir, görsel→PDF). */
  autoDetect?: boolean;
  /** Sonuç sonrası "üye ol" nazik yönlendirmesi (verilmezse gizlenir). */
  onRegister?: () => void;
};

/**
 * Çalışan misafir araç ÇEKİRDEĞİ — dropzone + dosya listesi + işleme + sonuç.
 * Dosyalar SUNUCUYA GİTMEDEN cihazda işlenir (pdf-lib). Hem ana sayfa hero'sunda
 * hem tam araç sayfasında (GuestPdfTool) kullanılır → kod tekrarı yok.
 */
export function GuestToolCore({ tool, language, autoDetect, onRegister }: Props) {
  const tr = language === "tr";
  const [activeTool, setActiveTool] = useState<GuestToolId>(tool);
  const [files, setFiles] = useState<Picked[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isImages = activeTool === "image-to-pdf";
  const accept = autoDetect
    ? "application/pdf,image/png,image/jpeg,image/jpg,image/webp"
    : isImages
      ? "image/png,image/jpeg,image/jpg,image/webp"
      : "application/pdf";
  const minFiles = isImages ? 1 : 2;
  const ctaLabel = isImages
    ? tr ? "PDF'e Çevir" : "Convert to PDF"
    : tr ? "Birleştir" : "Merge";
  const outName = isImages ? "gorseller.pdf" : "birlestirilmis.pdf";

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      setError(null);
      const list = Array.from(incoming);
      const imgs = list.filter((f) => f.type.startsWith("image/"));
      const pdfs = list.filter((f) => f.type === "application/pdf");

      let next = activeTool;
      if (autoDetect && files.length === 0) {
        // İlk parti: türe göre aracı seç (görsel ağırlıklıysa görsel→PDF).
        next = imgs.length > pdfs.length ? "image-to-pdf" : "merge";
        setActiveTool(next);
      }
      const wantImages = next === "image-to-pdf";
      const accepted = wantImages ? imgs : pdfs;
      if (accepted.length === 0) {
        setError(
          tr
            ? wantImages
              ? "Lütfen görsel (JPG/PNG) ekleyin."
              : "Lütfen PDF dosyası ekleyin."
            : wantImages
              ? "Please add image files."
              : "Please add PDF files.",
        );
        return;
      }
      setFiles((prev) => [...prev, ...accepted.map((file) => ({ id: uid(), file }))]);
    },
    [activeTool, autoDetect, files.length, tr],
  );

  const move = (i: number, dir: -1 | 1) =>
    setFiles((prev) => {
      const n = [...prev];
      const j = i + dir;
      if (j < 0 || j >= n.length) return prev;
      [n[i]!, n[j]!] = [n[j]!, n[i]!];
      return n;
    });
  const remove = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const reset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
    if (autoDetect) setActiveTool(tool);
  };

  const run = async () => {
    setError(null);
    if (files.length < minFiles) {
      setError(
        tr
          ? isImages ? "En az 1 görsel ekleyin." : "Birleştirmek için en az 2 PDF ekleyin."
          : isImages ? "Add at least 1 image." : "Add at least 2 PDFs to merge.",
      );
      return;
    }
    if (files.reduce((s, f) => s + f.file.size, 0) > MAX_BYTES) {
      setError(
        tr
          ? "Toplam boyut 80 MB'ı aşıyor. Daha büyüğü için ücretsiz üye olun."
          : "Total exceeds 80 MB. Sign up free for larger files.",
      );
      return;
    }
    // Kaydetme yerini SOR (Dashboard'daki gibi) — kullanıcı aktivasyonu hâlâ
    // geçerliyken, ağır işlemden ÖNCE. Desteklenmiyorsa indirmeye düşülür.
    let saveHandle: FileSystemFileHandle | null = null;
    const win = window as unknown as {
      showSaveFilePicker?: (o: {
        suggestedName?: string;
        types?: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<FileSystemFileHandle>;
    };
    if (typeof win.showSaveFilePicker === "function") {
      try {
        saveHandle = await win.showSaveFilePicker({
          suggestedName: outName,
          types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // vazgeçti
        // desteklenmiyor / güvenli bağlam değil → indirmeye düşülür
      }
    }
    try {
      setBusy(true);
      let bytes: Uint8Array;
      if (isImages) {
        const imgs = await Promise.all(
          files.map(async (f) => ({ bytes: await f.file.arrayBuffer(), mime: f.file.type })),
        );
        bytes = await imagesToPdf(imgs);
      } else {
        bytes = await mergePdfs(await Promise.all(files.map((f) => f.file.arrayBuffer())));
      }
      const blob = pdfBytesToBlob(bytes);
      if (saveHandle) {
        const w = await saveHandle.createWritable();
        await w.write(blob);
        await w.close();
      } else {
        downloadBlob(blob, outName);
      }
      setResult({ blob, filename: outName });
    } catch (e) {
      setError(
        e instanceof PdfEncryptedError
          ? tr
            ? "Bu PDF şifre korumalı. Şifreli dosyalar için giriş yapın."
            : "This PDF is password-protected. Log in to process it."
          : tr
            ? "İşlem sırasında bir hata oluştu."
            : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  };

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

  // Web Share API — tarayıcı özelliği, LOGIN GEREKTİRMEZ (çoğunlukla mobil).
  const canShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === "function";

  async function shareResult() {
    if (!result) return;
    const file = new File([result.blob], result.filename, { type: "application/pdf" });
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
    };
    try {
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: result.filename });
      }
    } catch {
      /* iptal / desteklenmiyor */
    }
  }

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
          <Check className="h-8 w-8" />
        </div>
        <p className="mt-4 text-xl font-bold text-white">
          {tr ? "Hazır! Dosyan kaydedildi 🎉" : "Done! Your file is ready 🎉"}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {tr
            ? "Dosyan cihazından hiç çıkmadı — tamamen gizli."
            : "Your file never left your device — fully private."}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => downloadBlob(result.blob, result.filename)}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(79,70,229,0.6)] transition hover:from-blue-500 hover:to-indigo-500"
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
            {tr ? "Yeni işlem" : "New task"}
          </button>
        </div>
        {onRegister && (
          <div className="mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left">
            <p className="text-sm font-semibold text-white">
              {tr ? "Daha fazlası ister misin?" : "Want more?"}
            </p>
            <p className="mt-0.5 text-[13px] text-slate-400">
              {tr
                ? "Ücretsiz üye ol: Word/Excel/PowerPoint'e dönüştür, sıkıştır, şifrele — tüm araçlara eriş ve daha büyük dosyalar işle."
                : "Sign up free: convert to Word/Excel/PowerPoint, compress, encrypt — unlock all tools and larger files."}
            </p>
            <button
              type="button"
              onClick={onRegister}
              className="mt-3 text-[13px] font-semibold text-cyan-300 transition hover:text-cyan-200"
            >
              {tr ? "Ücretsiz üye ol →" : "Sign up free →"}
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group relative cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition ${
          dragOver
            ? "border-cyan-400/70 bg-cyan-400/[0.06]"
            : "border-white/15 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-white/[0.04]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 text-cyan-300 ring-1 ring-white/10 transition group-hover:scale-105">
          <UploadCloud className="h-7 w-7" />
        </div>
        <p className="mt-4 text-base font-semibold text-white">
          {tr ? "Dosyaları buraya sürükle" : "Drag your files here"}
        </p>
        <p className="mt-1 text-[13px] text-slate-400">
          {tr ? "ya da tıklayıp seç" : "or click to choose"} ·{" "}
          {autoDetect ? "PDF, JPG, PNG" : isImages ? "JPG, PNG" : "PDF"} ·{" "}
          {tr ? "80 MB'a kadar" : "up to 80 MB"}
        </p>
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f, i) => (
            <motion.li
              key={f.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-cyan-300">
                {isImages ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-100">{f.file.name}</p>
                <p className="text-[11px] text-slate-500">{humanSize(f.file.size)}</p>
              </div>
              {!isImages && files.length > 1 && (
                <span className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="rounded-md p-1 text-slate-500 transition hover:text-white disabled:opacity-30"
                    aria-label={tr ? "Yukarı" : "Up"}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === files.length - 1}
                    className="rounded-md p-1 text-slate-500 transition hover:text-white disabled:opacity-30"
                    aria-label={tr ? "Aşağı" : "Down"}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(f.id)}
                className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                aria-label={tr ? "Kaldır" : "Remove"}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || files.length < minFiles}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.7)] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-40"
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {tr ? "İşleniyor…" : "Processing…"}
          </>
        ) : (
          <>{ctaLabel} →</>
        )}
      </button>
    </div>
  );
}
