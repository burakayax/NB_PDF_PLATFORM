import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ToolDropzone } from "./ToolDropzone";
import { getToolSeo } from "../../seo/seoContent.mjs";
import { expandPagesString } from "../../i18n/workspace";
import {
  rotatePdf,
  deletePages,
  reorderPages,
  splitPagesToZip,
  getPdfPageCount,
  pdfBytesToBlob,
  zipBytesToBlob,
  PdfEncryptedError,
} from "../../lib/clientPdf";
import type { PdfPageVisualMode } from "../split/PdfPageVisualGrid";

// Dashboard'ın görsel seçici modalının BİREBİR aynısı.
const SplitPagePickerModal = lazy(() =>
  import("../split/SplitPagePickerModal").then((m) => ({
    default: m.SplitPagePickerModal,
  })),
);

export type PageToolId = "rotate-pdf" | "delete-pages" | "organize-pdf" | "split";

const MAX_BYTES = 80 * 1024 * 1024;

function canShare(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === "function"
  );
}

/**
 * Sayfa aracı ÇEKİRDEĞİ. Akış (dashboard mantığı):
 * 1) PDF yüklenir → SplitPagePickerModal (dashboard'ın aynısı) açılır.
 * 2) Kullanıcı işlemi yapar → «Tamam» → modal kapanır (seçim state'te).
 * 3) «PDF'i Hazırla» → cihazda işlenir → sonuç: İndir / Paylaş / Aç / Kapat.
 * Görsel seçicinin indirmeyle ilişkisi YOK; kaydetme yeri SORULMAZ.
 */
export function GuestPageToolCore({
  tool,
  language,
  initialFile,
}: {
  tool: PageToolId;
  language: Language;
  /** Dışarıdan (ör. Belge Tarayıcı) gelen başlangıç PDF'i — otomatik yüklenir. */
  initialFile?: File | null;
}) {
  const tr = language === "tr";
  const mode: PdfPageVisualMode =
    tool === "rotate-pdf"
      ? "rotate"
      : tool === "delete-pages"
        ? "delete"
        : tool === "split"
          ? "split"
          : "organize";

  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [pagesText, setPagesText] = useState("");
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  // AYIR modu: "single" = seçili sayfalar tek PDF; "separate" = her sayfa ayrı, ZIP.
  const [splitMode, setSplitMode] = useState<"single" | "separate">("single");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bilgilendirici (hata değil) bildirim — ör. "PDF zaten tek sayfa".
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  // «PDF'i Hazırla» butonu — «Tamam» sonrası odak buraya kaysın.
  const prepareBtnRef = useRef<HTMLButtonElement | null>(null);

  const outName =
    mode === "rotate"
      ? "dondurulmus.pdf"
      : mode === "delete"
        ? "silinmis.pdf"
        : mode === "split"
          ? splitMode === "separate"
            ? "sayfalar.zip"
            : "secili-sayfalar.pdf"
          : "duzenlenmis.pdf";
  const resultIsZip = result?.filename.endsWith(".zip") ?? false;

  async function pickFile(f: File | undefined) {
    setError(null);
    setNotice(null);
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError(tr ? "Lütfen bir PDF dosyası seçin." : "Please choose a PDF file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(
        tr
          ? "Dosya 80 MB'ı aşıyor. Daha büyüğü için ücretsiz üye olun."
          : "File exceeds 80 MB. Sign up free for larger files.",
      );
      return;
    }
    try {
      const n = await getPdfPageCount(await f.arrayBuffer());
      // Sayfa Ayır tek sayfalık PDF'te anlamsız — dosyayı yükleme, nazikçe bilgilendir.
      if (mode === "split" && n <= 1) {
        setNotice(
          tr
            ? "Yüklediğiniz PDF zaten tek sayfadan oluşuyor — ayrılacak bir şey yok. Birden fazla sayfalı bir PDF seçin."
            : "This PDF already has just a single page — there's nothing to split. Please choose a PDF with more than one page.",
        );
        return;
      }
      setFile(f);
      setPageCount(n);
      setPagesText("");
      setPageRotations({});
      setPageOrder(mode === "organize" ? Array.from({ length: n }, (_, i) => i + 1) : []);
      setResult(null);
      setModalOpen(true); // dosya yüklenince görsel seçici açılır
    } catch (e) {
      setError(
        e instanceof PdfEncryptedError
          ? tr
            ? "Bu PDF şifre korumalı. Şifreli dosyalar için giriş yapın."
            : "This PDF is password-protected. Log in to process it."
          : tr
            ? "PDF okunamadı."
            : "Could not read the PDF.",
      );
    }
  }

  function reset() {
    setFile(null);
    setPageCount(0);
    setModalOpen(false);
    setResult(null);
    setError(null);
    setNotice(null);
    setPagesText("");
    setPageRotations({});
    setPageOrder([]);
  }

  // Görsel seçici kapanınca (Tamam/kapat): bir seçim yapıldıysa odağı «PDF'i Hazırla»
  // butonuna kaydır — kullanıcı bir sonraki adımı hemen görsün ve tıklasın.
  function closeModalAndFocus() {
    setModalOpen(false);
    setTimeout(() => {
      const btn = prepareBtnRef.current;
      if (btn && !btn.disabled) {
        btn.scrollIntoView({ behavior: "smooth", block: "center" });
        btn.focus({ preventScroll: true });
      }
    }, 140);
  }

  // Dışarıdan başlangıç PDF'i (Belge Tarayıcı → "PDF Araçlarında aç") geldiğinde
  // otomatik yükle — kullanıcı taradığı belgeyle doğrudan araca düşsün.
  useEffect(() => {
    if (initialFile) void pickFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

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

  // "İndir": dashboard'daki gibi KAYDETME YERİNİ SORAR (File System Access).
  // İndir tıklaması kullanıcı aktivasyonudur; blob hazır olduğundan picker direkt
  // çağrılır. Desteklemeyen tarayıcıda (Firefox/Safari/mobil) İndirilenler'e iner.
  async function saveResult() {
    if (!result) return;
    const win = window as unknown as {
      showSaveFilePicker?: (o: {
        suggestedName?: string;
        types?: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<FileSystemFileHandle>;
    };
    if (typeof win.showSaveFilePicker === "function") {
      try {
        const handle = await win.showSaveFilePicker({
          suggestedName: result.filename,
          types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        });
        const w = await handle.createWritable();
        await w.write(result.blob);
        await w.close();
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // vazgeçti
        // desteklenmiyor / hata → indirmeye düş
      }
    }
    downloadBlob(result.blob, result.filename);
  }

  function openResult() {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function shareResult() {
    if (!result) return;
    const f = new File([result.blob], result.filename, { type: "application/pdf" });
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
    };
    try {
      if (nav.canShare?.({ files: [f] }) && nav.share)
        await nav.share({ files: [f], title: result.filename });
    } catch {
      /* iptal */
    }
  }

  // «PDF'i Hazırla» — görsel seçicideki seçimi cihazda uygular (indirme DEĞİL).
  const prepare = async () => {
    if (!file || pageCount === 0) return;
    setError(null);
    const rot0: Record<number, number> = {};
    let del0: number[] = [];
    let order0: number[] = [];
    let split0: number[] = [];
    if (mode === "rotate") {
      for (const [p1, deg] of Object.entries(pageRotations)) {
        const d = Number(deg);
        if (d % 360 !== 0) rot0[Number(p1) - 1] = d;
      }
      if (Object.keys(rot0).length === 0) {
        setError(tr ? "Önce görsel seçicide en az bir sayfayı döndür." : "Rotate at least one page first.");
        return;
      }
    } else if (mode === "delete") {
      const pages1 = expandPagesString(pagesText, pageCount, language) ?? [];
      if (pages1.length === 0) {
        setError(tr ? "Önce görsel seçicide silinecek sayfaları seç." : "Select pages to delete first.");
        return;
      }
      if (pages1.length >= pageCount) {
        setError(tr ? "Tüm sayfalar silinemez." : "Cannot delete every page.");
        return;
      }
      del0 = pages1.map((p) => p - 1);
    } else if (mode === "split") {
      const pages1 = expandPagesString(pagesText, pageCount, language) ?? [];
      if (pages1.length === 0) {
        setError(tr ? "Önce görsel seçicide ayrılacak sayfaları seç." : "Select pages to split first.");
        return;
      }
      split0 = pages1.map((p) => p - 1);
    } else {
      const order1 = pageOrder.length ? pageOrder : Array.from({ length: pageCount }, (_, i) => i + 1);
      order0 = order1.map((p) => p - 1);
    }
    try {
      setBusy(true);
      const src = new Uint8Array(await file.arrayBuffer());
      let blob: Blob;
      if (mode === "rotate") blob = pdfBytesToBlob(await rotatePdf(src, rot0));
      else if (mode === "delete") blob = pdfBytesToBlob(await deletePages(src, del0));
      else if (mode === "split")
        blob =
          splitMode === "separate"
            ? zipBytesToBlob(await splitPagesToZip(src, split0, "sayfa"))
            : pdfBytesToBlob(await reorderPages(src, split0));
      else blob = pdfBytesToBlob(await reorderPages(src, order0));
      setResult({ blob, filename: outName });
    } catch (e) {
      setError(
        e instanceof PdfEncryptedError
          ? tr
            ? "Bu PDF şifre korumalı."
            : "This PDF is password-protected."
          : tr
            ? "İşlem sırasında bir hata oluştu."
            : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  };

  // ── Sonuç: İndir / Paylaş / Aç / Kapat ──
  if (result) {
    return (
      <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
          <Check className="h-8 w-8" />
        </div>
        <p className="mt-4 text-xl font-bold">
          {resultIsZip
            ? tr ? "Dosyaların hazır 🎉 (ZIP)" : "Your files are ready 🎉 (ZIP)"
            : tr ? "PDF hazır 🎉" : "Your PDF is ready 🎉"}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {tr ? "Dosyan cihazından hiç çıkmadı." : "Your file never left your device."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void saveResult()}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:from-blue-500 hover:to-indigo-500"
          >
            <Download className="h-4 w-4" />
            {tr ? "İndir" : "Download"}
          </button>
          {canShare() && (
            <button
              type="button"
              onClick={() => void shareResult()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"
            >
              <Share2 className="h-4 w-4" />
              {tr ? "Paylaş" : "Share"}
            </button>
          )}
          {!resultIsZip && (
            <button
              type="button"
              onClick={openResult}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"
            >
              <ExternalLink className="h-4 w-4" />
              {tr ? "Aç" : "Open"}
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" />
            {tr ? "Kapat" : "Close"}
          </button>
        </div>
      </div>
    );
  }

  // ── Sonuç yok: dropzone + (dosya satırı) + butonlar HER ZAMAN altta (merge gibi) ──
  const selectorLabel =
    mode === "rotate"
      ? tr ? "Sayfaları Döndür" : "Rotate pages"
      : mode === "delete"
        ? tr ? "Sayfaları Sil" : "Delete pages"
        : mode === "split"
          ? tr ? "Ayrılacak Sayfalar" : "Select pages"
          : tr ? "Sayfaları Düzenle" : "Reorder pages";
  // Görsel seçicide işlem yapıldı mı → "PDF'i Hazırla" o zaman aktif olur.
  const hasSelection =
    mode === "rotate"
      ? Object.values(pageRotations).some((d) => d % 360 !== 0)
      : mode === "delete" || mode === "split"
        ? (expandPagesString(pagesText, pageCount, language) ?? []).length > 0
        : pageOrder.length === pageCount && pageOrder.some((p, i) => p !== i + 1);

  return (
    <>
      {/* Dropzone — her zaman görünür (premium, AI aracıyla aynı dil) */}
      <ToolDropzone
        toolId={tool}
        tr={tr}
        accept="application/pdf"
        showBenefits={!file}
        onFiles={(fl) => void pickFile(fl[0])}
        titleTr="PDF'i buraya sürükle"
        titleEn="Drag your PDF here"
        hintTr="ya da tıklayıp seç · 80 MB'a kadar"
        hintEn="or click to choose · up to 80 MB"
      />

      {/* Seçili dosya satırı (merge'deki dosya listesi gibi) */}
      {file && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-cyan-300">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-100">{file.name}</p>
            <p className="text-[11px] text-slate-500">
              {pageCount} {tr ? "sayfa" : "pages"}
              {hasSelection ? (tr ? " · düzenlendi ✓" : " · edited ✓") : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
            aria-label={tr ? "Kaldır" : "Remove"}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">
          {error}
        </p>
      )}

      {notice && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.07] px-4 py-3.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-cyan-100">
              {tr ? "Bu PDF tek sayfalık" : "This PDF has a single page"}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-cyan-200/70">{notice}</p>
          </div>
        </div>
      )}

      {/* AYIR modu seçici (yalnız split): tek PDF mi, ayrı dosyalar (ZIP) mı */}
      {mode === "split" && (
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setSplitMode("single")}
              className={`rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                splitMode === "single"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                  : "text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              {tr ? "Tek PDF" : "Single PDF"}
            </button>
            <button
              type="button"
              onClick={() => setSplitMode("separate")}
              className={`rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                splitMode === "separate"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                  : "text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              {tr ? "Ayrı dosyalar (ZIP)" : "Separate files (ZIP)"}
            </button>
          </div>
          <p className="px-2 py-1.5 text-center text-[11px] text-slate-500">
            {splitMode === "single"
              ? tr ? "Seçili sayfalar tek bir PDF'te birleşir." : "Selected pages merged into one PDF."
              : tr ? "Her seçili sayfa ayrı PDF olur, ZIP ile iner." : "Each selected page becomes a separate PDF in a ZIP."}
          </p>
        </div>
      )}

      {/* Butonlar — HER ZAMAN altta, tam genişlik (merge gibi). Hazırla seçim olana dek pasif. */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={!file}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:pointer-events-none disabled:opacity-40"
        >
          <Sliders className="h-4 w-4" />
          {selectorLabel}
        </button>
        <button
          ref={prepareBtnRef}
          type="button"
          onClick={() => void prepare()}
          disabled={busy || !hasSelection}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.7)] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 focus-visible:ring-2 focus-visible:ring-cyan-300/70 disabled:pointer-events-none disabled:opacity-40"
        >
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {tr ? "Hazırlanıyor…" : "Preparing…"}
            </>
          ) : (
            <>{tr ? "PDF'i Hazırla" : "Prepare PDF"} →</>
          )}
        </button>
      </div>

      {/* Dashboard'ın BİREBİR görsel seçici modalı — createPortal ile body'ye
          (Hero'nun transform'u 'fixed'i bozmasın → tam ekran kaplasın). */}
      {file &&
        createPortal(
          <Suspense fallback={null}>
            <SplitPagePickerModal
              open={modalOpen}
            onClose={closeModalAndFocus}
          onReset={() => {
            setPagesText("");
            setPageRotations({});
            setPageOrder(
              mode === "organize" ? Array.from({ length: pageCount }, (_, i) => i + 1) : [],
            );
          }}
          file={file}
          password=""
          maxPage={pageCount}
          language={language}
          mode={mode}
          pagesText={pagesText}
          onPagesTextChange={setPagesText}
          onPagesErrorClear={() => setError(null)}
          pageRotations={pageRotations}
          onPageRotationsChange={setPageRotations}
          pageOrder={pageOrder}
          onPageOrderChange={setPageOrder}
            strictTurkishForDeleteUi={mode === "delete"}
          />
        </Suspense>,
        document.body,
      )}
    </>
  );
}

type Props = {
  slug: string;
  tool: PageToolId;
  language: Language;
  onLogin: () => void;
  onRegister: () => void;
};

/** Tam sayfa misafir aracı (SEO için /tools/<slug>). Çekirdek + sayfa çerçevesi. */
export function GuestPageTool({ slug, tool, language, onLogin, onRegister }: Props) {
  const tr = language === "tr";
  const seo = getToolSeo(slug, language);

  return (
    <div className="min-h-dvh bg-[radial-gradient(125%_125%_at_50%_-10%,#16213e_0%,#0b1020_42%,#070b14_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0b1020]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <button type="button" onClick={onLogin} className="flex items-center gap-2">
            <img src="/emblem.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold tracking-tight">PDF Platform</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLogin}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:text-white"
            >
              {tr ? "Giriş yap" : "Log in"}
            </button>
            <button
              type="button"
              onClick={onRegister}
              className="rounded-lg bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              {tr ? "Üye Ol" : "Sign up"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-10 sm:pt-14">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[12px] font-semibold text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            {tr ? "Ücretsiz · Gizli · Kurulum yok" : "Free · Private · No install"}
          </span>
          <h1 className="mt-4 bg-gradient-to-b from-white to-slate-300 bg-clip-text text-3xl font-extrabold leading-tight tracking-tight text-transparent sm:text-4xl">
            {seo?.h1 ?? slug}
          </h1>
        </div>

        <div className="mt-8">
          <GuestPageToolCore tool={tool} language={language} />
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: <ShieldCheck className="h-4 w-4" />, t: tr ? "Dosyan cihazından çıkmaz" : "Files never leave your device" },
            { icon: <Zap className="h-4 w-4" />, t: tr ? "Anında işlem" : "Instant processing" },
            { icon: <Lock className="h-4 w-4" />, t: tr ? "Sınırsız & ücretsiz" : "Unlimited & free" },
          ].map((b, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[12px] text-slate-300"
            >
              <span className="text-cyan-300">{b.icon}</span>
              {b.t}
            </div>
          ))}
        </div>

        {seo?.faq && seo.faq.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-4 text-center text-lg font-bold text-slate-200">
              {tr ? "Sık Sorulan Sorular" : "Frequently Asked Questions"}
            </h2>
            <div className="space-y-3">
              {seo.faq.map((item, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-slate-200">
                    {item.q}
                    <span className="text-slate-500 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-400">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
