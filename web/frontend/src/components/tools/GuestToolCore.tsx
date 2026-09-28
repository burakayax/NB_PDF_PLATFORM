import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Lock,
  Trash2,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ToolUploadPanel } from "../common/ToolUploadPanel";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { savePendingTool } from "../../lib/appNavigation";
import {
  mergePdfs,
  imagesToPdf,
  pdfBytesToBlob,
  getPdfPageCount,
  PdfEncryptedError,
} from "../../lib/clientPdfWorker";

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
 * Dosya satırı — framer-motion'ın `Reorder.Item`'ı üzerine kurulu.
 *
 * Önceki sürüm `document.elementFromPoint` ile satır sırasını elle hesaplıyordu;
 * sürüklenen kart imleci TAKİP ETMİYORDU, yalnız üstünden geçilen satırla yer
 * değiştiriyordu — bu da "kaydırma" hissi yerine sıçramalı bir animasyona
 * yol açıyordu. `Reorder.Group`/`Reorder.Item` framer-motion'ın kendi drag
 * motoru üzerinde çalışır: kart parmağı/imleci gerçekten takip eder, listenin
 * geri kalanı spring ile kayar, dokunmatikte de native gibi akar.
 * https://motion.dev/docs/react-reorder
 */
function FileRow({
  f,
  i,
  isImages,
  filesLength,
  tr,
  onMove,
  onRemove,
}: {
  f: Picked;
  i: number;
  isImages: boolean;
  filesLength: number;
  tr: boolean;
  onMove: (i: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const controls = useDragControls();
  const bad = f.status !== "ok" && f.status !== "checking";
  const statusText =
    f.status === "checking" ? (tr ? "Denetleniyor…" : "Checking…")
    : f.status === "ok" ? (f.pages ? `${f.pages} ${tr ? "sayfa" : "pages"} · ${humanSize(f.file.size)}` : humanSize(f.file.size))
    : f.status === "empty" ? (tr ? "Boş dosya (0 KB) — kullanılamaz" : "Empty file (0 KB) — unusable")
    : f.status === "corrupt" ? (tr ? "Bozuk/okunamayan PDF" : "Corrupt/unreadable PDF")
    : f.status === "toobig" ? (tr ? "80 MB sınırını aşıyor" : "Exceeds 80 MB limit")
    : (tr ? "Şifre korumalı — cihazda açılamıyor" : "Password-protected — can't open on device");

  return (
    <Reorder.Item
      as="li"
      value={f}
      dragListener={false}
      dragControls={controls}
      style={{ position: "relative" }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileDrag={{
        boxShadow: "0 10px 30px -12px rgba(34,211,238,0.6)",
        cursor: "grabbing",
      }}
      className={`flex items-center gap-2 rounded-xl border bg-white/[0.03] px-3 py-2.5 ${bad ? "border-amber-400/30 bg-amber-500/[0.06]" : "border-white/[0.08]"}`}
    >
      {!isImages && filesLength > 1 && (
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          className="shrink-0 cursor-grab touch-none rounded-md p-1 text-slate-400 transition hover:text-white active:cursor-grabbing"
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
        <p className={`text-[11px] ${bad ? "text-amber-300 font-medium" : "text-slate-400"}`}>
          {f.status === "locked" ? (
            <>
              {tr ? "Şifre korumalı — " : "Password-protected — "}
              <button
                type="button"
                onClick={() => {
                  // Doğrudan tanıtım sayfasına değil, üyelik/giriş akışına gönder —
                  // oturum açılınca/üye olunca kullanıcı "PDF Kilidini Aç" aracına
                  // otomatik düşsün (bkz. lib/appNavigation savePendingTool).
                  savePendingTool("unlock-pdf");
                  window.location.assign("/register");
                }}
                className="underline decoration-amber-400/50 underline-offset-2 hover:text-amber-100"
              >
                {tr ? "«PDF Kilidini Aç» aracını kullanın" : "use the «Unlock PDF» tool"}
              </button>
            </>
          ) : statusText}
        </p>
      </div>
      {!isImages && filesLength > 1 && (
        <span className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onMove(i, -1)}
            disabled={i === 0}
            className="rounded-md p-1 text-slate-400 transition hover:text-white disabled:opacity-30"
            aria-label={tr ? "Yukarı" : "Up"}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(i, 1)}
            disabled={i === filesLength - 1}
            className="rounded-md p-1 text-slate-400 transition hover:text-white disabled:opacity-30"
            aria-label={tr ? "Aşağı" : "Down"}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </span>
      )}
      <button
        type="button"
        onClick={() => onRemove(f.id)}
        className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
        aria-label={tr ? "Kaldır" : "Remove"}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </Reorder.Item>
  );
}

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
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Son kaydetme yeri — "Tekrar indir" aynı konuma yazsın (yeni işleme dek hafızada).

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

  const remove = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const clearAll = () => { setFiles([]); setError(null); };
  const reset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
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
    // NOT: Kaydetme yeri burada SORULMAZ. Kullanıcı "hazırla" dediğinde daha
    // sonucu görmeden bir "Farklı kaydet" penceresiyle karşılaşıyordu. Dosya
    // önce hazırlanır ve ekranda gösterilir; kaydetme yeri yalnızca "İndir"e
    // basıldığında sorulur.
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


  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <ToolResultPanel
          blob={result.blob}
          filename={result.filename}
          language={language}
          processedOnDevice
          onClose={reset}
          ratingToolSlug={activeTool === "merge" ? "merge-pdf" : "image-to-pdf"}
        >
          <ValueMomentNudge
            language={language}
            source={activeTool === "merge" ? "merge_success" : "image_to_pdf_success"}
          />
        </ToolResultPanel>
      </motion.div>
    );
  }

  return (
    <div>
      <ToolUploadPanel
        toolId={activeTool}
        language={language}
        accept={accept}
        multiple
        busy={busy}
        compact={files.length > 0}
        showHeader={false}
        showBenefits={files.length === 0}
        onFiles={(fl) => addFiles(fl)}
        title={
          tr
            ? isImages ? "Görselleri buraya sürükle" : "PDF'leri buraya sürükle"
            : isImages ? "Drag your images here" : "Drag your PDFs here"
        }
        hint={
          tr
            ? `ya da tıklayıp seç · ${autoDetect ? "PDF, JPG, PNG" : isImages ? "JPG, PNG" : "PDF"} · 80 MB'a kadar`
            : `or click to choose · ${autoDetect ? "PDF, JPG, PNG" : isImages ? "JPG, PNG" : "PDF"} · up to 80 MB`
        }
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
        <Reorder.Group
          as="ul"
          ref={listRef}
          axis="y"
          values={files}
          onReorder={setFiles}
          className="space-y-2"
        >
          {files.map((f, i) => (
            <FileRow
              key={f.id}
              f={f}
              i={i}
              isImages={isImages}
              filesLength={files.length}
              tr={tr}
              onMove={move}
              onRemove={remove}
            />
          ))}
        </Reorder.Group>
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
