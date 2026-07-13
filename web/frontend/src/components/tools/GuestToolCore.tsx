import { type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Lock,
  Share2,
  Trash2,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ToolDropzone } from "./ToolDropzone";
import {
  mergePdfs,
  imagesToPdf,
  pdfBytesToBlob,
  getPdfPageCount,
  PdfEncryptedError,
} from "../../lib/clientPdf";

export type GuestToolId = "merge" | "image-to-pdf";

const MAX_BYTES = 80 * 1024 * 1024; // 80 MB

/** Dosya durumu — kullanıcıya net geri bildirim için. */
type FileStatus = "checking" | "ok" | "empty" | "corrupt" | "locked" | "toobig";
export type Picked = { id: string; file: File; status: FileStatus; pages?: number };
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
function humanSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/** Bir PDF'i cihazda denetler: boş / bozuk / şifreli / kaç sayfa. */
async function inspectPdf(file: File): Promise<{ status: FileStatus; pages?: number }> {
  if (file.size === 0) return { status: "empty" };
  if (file.size > MAX_BYTES) return { status: "toobig" };
  try {
    const buf = await file.arrayBuffer();
    const pages = await getPdfPageCount(new Uint8Array(buf));
    if (!pages || pages < 1) return { status: "corrupt" };
    return { status: "ok", pages };
  } catch (e) {
    if (e instanceof PdfEncryptedError) return { status: "locked" };
    return { status: "corrupt" };
  }
}

type Props = {
  /** Başlangıç aracı. */
  tool: GuestToolId;
  language: Language;
  /** true → bırakılan dosya türüne göre araç otomatik seçilir (PDF→birleştir, görsel→PDF). */
  autoDetect?: boolean;
  /** Sonuç sonrası "üye ol" nazik yönlendirmesi (verilmezse gizlenir). */
  onRegister?: () => void;
  /** Dışarıdan kontrollü dosya durumu — araç değiştirince dosyalar korunsun diye
   *  (verilmezse bileşen kendi iç state'ini kullanır). */
  filesState?: [Picked[], Dispatch<SetStateAction<Picked[]>>];
};

/**
 * Çalışan misafir araç ÇEKİRDEĞİ — dropzone + dosya listesi + işleme + sonuç.
 * Dosyalar SUNUCUYA GİTMEDEN cihazda işlenir (pdf-lib). Hem ana sayfa hero'sunda
 * hem tam araç sayfasında (GuestPdfTool) kullanılır → kod tekrarı yok.
 */
export function GuestToolCore({ tool, language, autoDetect, onRegister, filesState }: Props) {
  const tr = language === "tr";
  const [activeTool, setActiveTool] = useState<GuestToolId>(tool);
  const internalFiles = useState<Picked[]>([]);
  const [files, setFiles] = filesState ?? internalFiles;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string; saved: "picker" | "download" } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Son kaydetme yeri — "Tekrar indir" aynı konuma yazsın (yeni işleme dek hafızada).
  const saveHandleRef = useRef<FileSystemFileHandle | null>(null);

  // Dosya eklenince listeyi görünüme kaydır — kullanıcı "bir şey olmadı" sanmasın
  // (liste dropzone'un altında kaldığı için ekran dışında kalabiliyordu).
  useEffect(() => {
    if (files.length > 0) listRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [files.length]);

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

  // Zengin özet — kullanıcıya her şeyi anlat: kaç dosya, kaçı geçerli, toplam sayfa/boyut,
  // sonuçta ne oluşacak.
  const okList = files.filter((f) => f.status === "ok");
  const badCount = files.filter((f) => f.status !== "ok" && f.status !== "checking").length;
  const checkingCount = files.filter((f) => f.status === "checking").length;
  const totalPages = okList.reduce((s, f) => s + (f.pages ?? 0), 0);
  const totalSize = okList.reduce((s, f) => s + f.file.size, 0);

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
      // Reddedilen türler hakkında bilgilendir (sessizce yutma).
      const rejected = list.filter((f) => !imgs.includes(f) && !pdfs.includes(f));
      const wantImages = next === "image-to-pdf";
      const accepted = wantImages ? imgs : pdfs;
      const wrongType = wantImages ? pdfs : imgs; // aracın istemediği ama bilinen tür
      if (accepted.length === 0) {
        setError(
          tr
            ? wantImages
              ? "Lütfen görsel (JPG/PNG) ekleyin — PDF bu araca uymaz."
              : "Lütfen PDF dosyası ekleyin — görseller «Görsel → PDF» aracına uyar."
            : wantImages
              ? "Please add image files."
              : "Please add PDF files.",
        );
        return;
      }
      if (rejected.length || wrongType.length) {
        setError(tr
          ? `${rejected.length + wrongType.length} dosya atlandı — bu araç yalnız ${wantImages ? "görsel (JPG/PNG)" : "PDF"} kabul eder.`
          : `${rejected.length + wrongType.length} file(s) skipped — this tool only accepts ${wantImages ? "images (JPG/PNG)" : "PDF"}.`);
      }
      // Görseller: hafif kontrol (0 bayt engelle). PDF'ler: cihazda denetle (boş/bozuk/şifreli/sayfa).
      const fresh: Picked[] = accepted.map((file) => ({
        id: uid(), file, status: (file.size === 0 ? "empty" : wantImages ? "ok" : "checking") as FileStatus,
      }));
      setFiles((prev) => [...prev, ...fresh]);
      if (!wantImages) {
        for (const p of fresh) {
          if (p.status !== "checking") continue;
          void inspectPdf(p.file).then((res) => {
            setFiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: res.status, pages: res.pages } : x)));
          });
        }
      }
    },
    [activeTool, autoDetect, files.length, tr, setFiles],
  );

  const move = (i: number, dir: -1 | 1) =>
    setFiles((prev) => {
      const n = [...prev];
      const j = i + dir;
      if (j < 0 || j >= n.length) return prev;
      [n[i]!, n[j]!] = [n[j]!, n[i]!];
      return n;
    });

  // ── Dokunmatik + fare ile sürükle-bırak sıralama (mobilde HTML5 drag çalışmaz) ──
  // Grip tutamacından pointer ile başlar; parmak hangi satırın üstündeyse dizide
  // oraya taşır. framer-motion `layout` sayesinde canlı animasyonla akar.
  const [dragId, setDragId] = useState<string | null>(null);
  const reorderTo = (overId: string) =>
    setFiles((prev) => {
      const from = prev.findIndex((f) => f.id === dragId);
      const to = prev.findIndex((f) => f.id === overId);
      if (from < 0 || to < 0 || from === to) return prev;
      const n = [...prev];
      const [m] = n.splice(from, 1);
      n.splice(to, 0, m!);
      return n;
    });
  const onGripPointerDown = (e: ReactPointerEvent, id: string) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDragId(id);
  };
  const onGripPointerMove = (e: ReactPointerEvent) => {
    if (!dragId) return;
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el?.closest<HTMLElement>("[data-file-row]");
    const overId = row?.dataset.fileRow;
    if (overId && overId !== dragId) reorderTo(overId);
  };
  const endDrag = () => setDragId(null);
  const remove = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const clearAll = () => { setFiles([]); setError(null); };
  const reset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
    saveHandleRef.current = null;
    if (autoDetect) setActiveTool(tool);
  };

  const run = async () => {
    setError(null);
    // Yalnız GEÇERLİ (ok) dosyalarla işle; kusurluları net anlat.
    const okFiles = files.filter((f) => f.status === "ok");
    const bad = files.filter((f) => f.status !== "ok" && f.status !== "checking");
    if (files.some((f) => f.status === "checking")) {
      setError(tr ? "Dosyalar denetleniyor, birkaç saniye…" : "Checking files, a moment…");
      return;
    }
    if (bad.length) {
      setError(tr
        ? `${bad.length} dosya kullanılamıyor (boş/bozuk/şifreli). Listeden çıkarın ya da düzeltin.`
        : `${bad.length} file(s) can't be used (empty/corrupt/locked). Remove or fix them.`);
      return;
    }
    if (okFiles.length < minFiles) {
      setError(
        tr
          ? isImages ? "En az 1 görsel ekleyin." : "Birleştirmek için en az 2 geçerli PDF gerekli."
          : isImages ? "Add at least 1 image." : "Add at least 2 valid PDFs to merge.",
      );
      return;
    }
    if (okFiles.reduce((s, f) => s + f.file.size, 0) > MAX_BYTES) {
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
          okFiles.map(async (f) => ({ bytes: await f.file.arrayBuffer(), mime: f.file.type })),
        );
        bytes = await imagesToPdf(imgs);
      } else {
        bytes = await mergePdfs(await Promise.all(okFiles.map((f) => f.file.arrayBuffer())));
      }
      const blob = pdfBytesToBlob(bytes);
      if (saveHandle) {
        const w = await saveHandle.createWritable();
        await w.write(blob);
        await w.close();
        saveHandleRef.current = saveHandle; // "Tekrar indir" aynı yere yazsın
        // Bildirimde KULLANICININ girdiği gerçek isim gösterilsin.
        setResult({ blob, filename: saveHandle.name || outName, saved: "picker" });
      } else {
        downloadBlob(blob, outName);
        setResult({ blob, filename: outName, saved: "download" });
      }
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

  const [reSaved, setReSaved] = useState(false);
  // "Tekrar indir": önce SON kaydetme konumuna yaz (hafızada). Konum yoksa yeniden SOR —
  // sessizce İndirilenler'e atma.
  async function redownload() {
    if (!result) return;
    const h = saveHandleRef.current;
    if (h) {
      try {
        const w = await h.createWritable();
        await w.write(result.blob);
        await w.close();
        setReSaved(true);
        setTimeout(() => setReSaved(false), 2500);
        return;
      } catch { /* izin düştü → yeniden sor */ }
    }
    const win = window as unknown as {
      showSaveFilePicker?: (o: { suggestedName?: string; types?: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<FileSystemFileHandle>;
    };
    if (typeof win.showSaveFilePicker === "function") {
      try {
        const nh = await win.showSaveFilePicker({ suggestedName: result.filename, types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }] });
        const w = await nh.createWritable(); await w.write(result.blob); await w.close();
        saveHandleRef.current = nh;
        setReSaved(true);
        setTimeout(() => setReSaved(false), 2500);
        return;
      } catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; }
    }
    downloadBlob(result.blob, result.filename);
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
          {tr
            ? result.saved === "picker" ? "Kaydedildi! 🎉" : "İndirildi! 🎉"
            : result.saved === "picker" ? "Saved! 🎉" : "Downloaded! 🎉"}
        </p>
        {/* Net "indi/kaydedildi" işareti — kullanıcı tekrar indirmeye gerek olmadığını görsün */}
        <div className="mx-auto mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3.5 py-2 text-[13px] font-medium text-emerald-200">
          <Check className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {tr
              ? result.saved === "picker"
                ? `«${result.filename}» seçtiğin konuma kaydedildi`
                : `«${result.filename}» İndirilenler klasörüne indirildi`
              : result.saved === "picker"
                ? `«${result.filename}» saved to your chosen location`
                : `«${result.filename}» saved to your Downloads folder`}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {tr
            ? "Dosyan cihazından hiç çıkmadı — tamamen gizli."
            : "Your file never left your device — fully private."}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void redownload()}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]"
          >
            {reSaved ? <Check className="h-4 w-4 text-emerald-400" /> : <Download className="h-4 w-4" />}
            {reSaved ? (tr ? "Tekrar kaydedildi ✓" : "Saved again ✓") : (tr ? "Tekrar indir" : "Download again")}
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
      <ToolDropzone
        toolId={activeTool}
        tr={tr}
        accept={accept}
        multiple
        busy={busy}
        showBenefits={files.length === 0}
        onFiles={(fl) => addFiles(fl)}
        titleTr={isImages ? "Görselleri buraya sürükle" : "PDF'leri buraya sürükle"}
        titleEn={isImages ? "Drag your images here" : "Drag your PDFs here"}
        hintTr={`ya da tıklayıp seç · ${autoDetect ? "PDF, JPG, PNG" : isImages ? "JPG, PNG" : "PDF"} · 80 MB'a kadar`}
        hintEn={`or click to choose · ${autoDetect ? "PDF, JPG, PNG" : isImages ? "JPG, PNG" : "PDF"} · up to 80 MB`}
      />

      {files.length > 0 && (
        <>
        <div className="mt-4 mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              <span className="font-bold text-white">{files.length} {tr ? "dosya" : "files"}</span>
              {okList.length > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-300"><Check className="h-3.5 w-3.5" />{okList.length} {tr ? "geçerli" : "valid"}</span>
              )}
              {badCount > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-300"><AlertTriangle className="h-3.5 w-3.5" />{badCount} {tr ? "sorunlu" : "with issues"}</span>
              )}
              {checkingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-cyan-300"><Loader2 className="h-3.5 w-3.5 animate-spin" />{tr ? "denetleniyor" : "checking"}</span>
              )}
              {!isImages && totalPages > 0 && (
                <span className="text-slate-400">{totalPages} {tr ? "sayfa" : "pages"}</span>
              )}
              {totalSize > 0 && <span className="text-slate-400">{humanSize(totalSize)}</span>}
            </div>
            <button type="button" onClick={clearAll}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300">
              <Trash2 className="h-3.5 w-3.5" />{tr ? "Tümünü sil" : "Clear all"}
            </button>
          </div>
          {/* Sonuç önizlemesi — ne oluşacağını önceden söyle */}
          {okList.length >= minFiles && (
            <p className="mt-1.5 flex items-center gap-1.5 border-t border-white/[0.05] pt-1.5 text-[12px] text-slate-400">
              <ArrowDown className="h-3.5 w-3.5 -rotate-90 text-cyan-400" />
              {isImages
                ? tr ? `${okList.length} görsel tek PDF'e dönüşecek (${okList.length} sayfa)` : `${okList.length} images → one PDF (${okList.length} pages)`
                : tr ? `Birleşince ${totalPages || "?"} sayfalık tek PDF oluşacak · cihazında işlenir, gizli` : `Merges into one ${totalPages || "?"}-page PDF · processed on-device, private`}
            </p>
          )}
        </div>
        <ul ref={listRef} className="space-y-2">
          {files.map((f, i) => {
            const bad = f.status !== "ok" && f.status !== "checking";
            const statusText =
              f.status === "checking" ? (tr ? "Denetleniyor…" : "Checking…")
              : f.status === "ok" ? (f.pages ? `${f.pages} ${tr ? "sayfa" : "pages"} · ${humanSize(f.file.size)}` : humanSize(f.file.size))
              : f.status === "empty" ? (tr ? "Boş dosya (0 KB) — kullanılamaz" : "Empty file (0 KB) — unusable")
              : f.status === "corrupt" ? (tr ? "Bozuk/okunamayan PDF" : "Corrupt/unreadable PDF")
              : f.status === "toobig" ? (tr ? "80 MB sınırını aşıyor" : "Exceeds 80 MB limit")
              : (tr ? "Şifre korumalı — cihazda açılamıyor" : "Password-protected — can't open on device");
            return (
            <motion.li
              key={f.id}
              layout
              data-file-row={f.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: dragId === f.id ? 0.85 : 1, y: 0 }}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${dragId === f.id ? "border-cyan-400/50 bg-cyan-500/[0.08] shadow-[0_10px_30px_-12px_rgba(34,211,238,0.6)]" : bad ? "border-amber-400/30 bg-amber-500/[0.06]" : "border-white/[0.08] bg-white/[0.03]"}`}
            >
              {!isImages && files.length > 1 && (
                <button
                  type="button"
                  onPointerDown={(e) => onGripPointerDown(e, f.id)}
                  onPointerMove={onGripPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className="shrink-0 cursor-grab touch-none rounded-md p-1 text-slate-500 transition hover:text-white active:cursor-grabbing"
                  aria-label={tr ? "Sürükleyip sırala" : "Drag to reorder"}
                  title={tr ? "Sürükleyip sırala" : "Drag to reorder"}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              )}
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${f.status === "locked" ? "bg-amber-500/10 text-amber-300" : bad ? "bg-red-500/10 text-red-300" : "bg-white/[0.06] text-cyan-300"}`}>
                {f.status === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : f.status === "locked" ? <Lock className="h-4 w-4" /> : bad ? <AlertTriangle className="h-4 w-4" /> : isImages ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-100">{f.file.name}</p>
                <p className={`text-[11px] ${bad ? "text-amber-300 font-medium" : "text-slate-500"}`}>
                  {f.status === "locked" ? (
                    <>
                      {tr ? "Şifre korumalı — " : "Password-protected — "}
                      <a href="/tools/unlock-pdf" className="underline decoration-amber-400/50 underline-offset-2 hover:text-amber-100">
                        {tr ? "«PDF Kilidini Aç» aracını kullanın" : "use the «Unlock PDF» tool"}
                      </a>
                    </>
                  ) : statusText}
                </p>
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
            );
          })}
        </ul>
        </>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || files.filter((f) => f.status === "ok").length < minFiles}
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
