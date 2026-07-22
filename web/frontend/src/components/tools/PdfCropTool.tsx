import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved -- Vite ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Crop,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  RotateCcw,
  Share2,
  ShieldCheck,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { cropPdf, pdfBytesToBlob, PdfEncryptedError } from "../../lib/clientPdfWorker";
import type { CropRect } from "../../lib/clientPdf";
import { ValueMomentNudge } from "./ValueMomentNudge";

// Web Share API destegi (mobil "Paylas") — GuestPageTool ile ayni.
function canShareApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === "function"
  );
}

// Gerçek kaydırılan kapsayıcıyı bul (dashboard'da içerik `window` değil bir div'de
// kayar). Bulamazsa null → window kullanılır. Oto-kaydırmanın her yerde çalışması için.
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const s = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(s.overflowY) && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type Props = { language: Language };

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Rect = { x: number; y: number; w: number; h: number }; // normalized 0..1, top-left origin

// Varsayılan kutu: küçük ve ORTADA (kenar boşlukları simetrik). Kullanıcı buradan büyütür.
const DEFAULT_CROP: Rect = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };

const L = {
  tr: {
    drop: "PDF'i buraya sürükleyin",
    or: "veya",
    choose: "PDF Seç",
    hint: "Dosyanız cihazınızda işlenir, sunucuya yüklenmez.",
    chipDevice: "Cihazda işlenir",
    chipFree: "Ücretsiz & üyeliksiz",
    chipNoInstall: "Kurulum yok",
    page: "Sayfa",
    scope: "Uygula:",
    allPages: "Tüm sayfalar",
    thisPage: "Bu sayfa",
    eachPage: "Sayfa sayfa",
    hintAll: "Seçtiğin kırpma tüm sayfalara aynı yerden uygulanır.",
    hintThis: "Yalnızca şu an gördüğün sayfa kırpılır; diğerleri değişmeden kalır.",
    hintEach: "Her sayfaya AYRI kırpma. Sayfalar arasında gezin, her birinin kutusunu ayarla — yalnızca ayarladığın sayfalar kırpılır.",
    configured: (n: number) => `${n} sayfa ayarlandı`,
    reset: "Sıfırla",
    apply: "Kırp ve İndir",
    processing: "Kırpılıyor…",
    encrypted: "Bu PDF şifre korumalı; önce kilidini kaldırın.",
    failed: "İşlem başarısız oldu. Lütfen tekrar deneyin.",
    dragHint: "Kutuyu sürükleyin · köşelerden boyutlandırın",
    newFile: "Yeni PDF",
    ready: "PDF hazır 🎉",
    readySub: "Dosyan cihazından hiç çıkmadı.",
    download: "İndir",
    share: "Paylaş",
    open: "Aç",
    close: "Kapat",
  },
  en: {
    drop: "Drag a PDF here",
    or: "or",
    choose: "Choose PDF",
    hint: "Your file is processed on your device, never uploaded.",
    chipDevice: "Processed on device",
    chipFree: "Free & no sign-up",
    chipNoInstall: "No installation",
    page: "Page",
    scope: "Apply to:",
    allPages: "All pages",
    thisPage: "This page",
    eachPage: "Each page",
    hintAll: "Your crop is applied to every page at the same position.",
    hintThis: "Only the page you're viewing is cropped; the others stay unchanged.",
    hintEach: "A SEPARATE crop per page. Move between pages and set each one's box — only the pages you set get cropped.",
    configured: (n: number) => `${n} page(s) set`,
    reset: "Reset",
    apply: "Crop & Download",
    processing: "Cropping…",
    encrypted: "This PDF is password-protected; unlock it first.",
    failed: "Something went wrong. Please try again.",
    dragHint: "Drag the box · resize from the corners",
    newFile: "New PDF",
    ready: "Your PDF is ready 🎉",
    readySub: "Your file never left your device.",
    download: "Download",
    share: "Share",
    open: "Open",
    close: "Close",
  },
};

export function PdfCropTool({ language }: Props) {
  const t = L[language] ?? L.tr;
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("belge.pdf");
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [crop, setCrop] = useState<Rect>(DEFAULT_CROP);
  const [scope, setScope] = useState<"all" | "this" | "each">("all");
  // "each" modunda her sayfanın kendi kırpma dikdörtgeni.
  const [pageCrops, setPageCrops] = useState<Record<number, Rect>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const dragRef = useRef<{ handle: Handle; start: Rect; startPx: number; startPy: number } | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const autoScrollRef = useRef<number | null>(null);
  const scrollElRef = useRef<HTMLElement | null>(null); // gerçek kaydırma kapsayıcısı (null=window)

  const loadFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const doc = await pdfjsLib.getDocument({ data: buf.slice() }).promise;
        docRef.current = doc;
        setBytes(buf);
        setFileName(file.name.replace(/\.pdf$/i, "") + ".pdf");
        setPageCount(doc.numPages);
        setPageIndex(0);
        setCrop(DEFAULT_CROP);
      } catch {
        setError(t.failed);
      }
    },
    [t.failed],
  );

  useEffect(() => {
    let cancelled = false;
    const doc = docRef.current;
    if (!doc || !bytes) return;
    (async () => {
      const page = await doc.getPage(pageIndex + 1);
      if (cancelled) return;
      const stage = stageRef.current;
      const canvas = canvasRef.current;
      if (!stage || !canvas) return;
      const maxW = Math.min(stage.clientWidth || 680, 820);
      // Ekran YÜKSEKLİĞİNE de sığdır → uzun sayfa taşmaz, ortadaki kutu tümüyle görünür.
      const maxH = Math.max(380, window.innerHeight - 240);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(maxW / base.width, maxH / base.height);
      const vp = page.getViewport({ scale });
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, pageIndex]);

  // Bileşen kaldırılırken oto-kaydırma döngüsünü durdur.
  useEffect(
    () => () => {
      if (autoScrollRef.current != null) cancelAnimationFrame(autoScrollRef.current);
    },
    [],
  );

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const rect = canvasRef.current?.getBoundingClientRect();
    const startPx = rect ? (e.clientX - rect.left) / rect.width : 0;
    const startPy = rect ? (e.clientY - rect.top) / rect.height : 0;
    dragRef.current = { handle, start: { ...crop }, startPx, startPy };
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    scrollElRef.current = getScrollParent(stageRef.current); // hangi kapsayıcı kayacak?
    setDragging(true);
  };

  // Kırpmayı pointer'ın kanvasa göre MUTLAK konumundan hesapla — scroll'a dayanıklı:
  // getBoundingClientRect anlık scroll'u yansıtır, sayfa kayarken de doğru çalışır.
  const applyCropFromPointer = (clientX: number, clientY: number) => {
    const d = dragRef.current;
    const canvas = canvasRef.current;
    if (!d || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const px = clamp((clientX - rect.left) / rect.width);
    const py = clamp((clientY - rect.top) / rect.height);
    const MIN = 0.05;
    let { x, y, w, h } = d.start;
    if (d.handle === "move") {
      x = clamp(d.start.x + (px - d.startPx));
      y = clamp(d.start.y + (py - d.startPy));
      x = Math.min(x, 1 - w);
      y = Math.min(y, 1 - h);
    } else {
      if (d.handle.includes("w")) {
        const right = d.start.x + d.start.w;
        x = Math.min(px, right - MIN);
        w = right - x;
      }
      if (d.handle.includes("e")) w = Math.max(MIN, Math.min(1 - x, px - x));
      if (d.handle.includes("n")) {
        const bottom = d.start.y + d.start.h;
        y = Math.min(py, bottom - MIN);
        h = bottom - y;
      }
      if (d.handle.includes("s")) h = Math.max(MIN, Math.min(1 - y, py - y));
    }
    setCrop({ x, y, w, h });
  };

  // Sürüklerken viewport kenarına gelince sayfayı KONTROLLÜ (yavaş) otomatik kaydır —
  // ekrana sığmayan uzun sayfalarda altta kalan yerleri de seçebilmek için.
  const stopAutoScroll = () => {
    if (autoScrollRef.current != null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  };
  const maybeAutoScroll = (clientY: number) => {
    const EDGE = 90; // kenardan bu kadar px içerideyken kaydırmaya başla
    const el = scrollElRef.current;
    // Kaydırma kapsayıcısının görünür üst/alt sınırı (window ise tüm viewport).
    let top: number;
    let bottom: number;
    if (el) {
      const r = el.getBoundingClientRect();
      top = r.top;
      bottom = r.bottom;
    } else {
      top = 0;
      bottom = window.innerHeight;
    }
    const dir = clientY > bottom - EDGE ? 1 : clientY < top + EDGE ? -1 : 0;
    if (dir === 0) {
      stopAutoScroll();
      return;
    }
    if (autoScrollRef.current != null) return; // zaten kayıyor
    const step = () => {
      if (!dragRef.current) {
        stopAutoScroll();
        return;
      }
      if (el) el.scrollTop += dir * 7;
      else window.scrollBy(0, dir * 7); // ~7px/kare → kontrollü, hızlı değil
      applyCropFromPointer(lastPointerRef.current.x, lastPointerRef.current.y);
      autoScrollRef.current = requestAnimationFrame(step);
    };
    autoScrollRef.current = requestAnimationFrame(step);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    applyCropFromPointer(e.clientX, e.clientY);
    maybeAutoScroll(e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    setDragging(false);
    stopAutoScroll();
    // "each" modunda: bu sayfanın kutusunu kaydet → kırpılacak sayfalar arasına girer.
    if (scope === "each") setPageCrops((m) => ({ ...m, [pageIndex]: crop }));
  };

  // Sayfa değiştir — kutu SIFIRLANIR (ortada gelir); önceki sayfayla aynı yerde kalıp
  // kafa karıştırmasın. "each"te o sayfanın kayıtlı kutusu varsa onu yükler.
  const goToPage = (next: number) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, next));
    if (clamped === pageIndex) return;
    if (scope === "each") setCrop(pageCrops[clamped] ?? DEFAULT_CROP);
    else if (scope === "this") setCrop(DEFAULT_CROP);
    // "all": aynı kırpma tüm sayfalara — kutu korunur (yoksa apply'da tutarsız olur).
    setPageIndex(clamped);
  };

  const apply = async () => {
    if (!bytes) return;
    setBusy(true);
    setError(null);
    try {
      const toCropRect = (r: Rect): CropRect => ({ xNorm: r.x, yNorm: r.y, wNorm: r.w, hNorm: r.h });
      let out: Uint8Array;
      if (scope === "each") {
        // Yalnızca AYARLANAN sayfalar (pageCrops) kırpılır — gerisi TAM kalır. Hiç
        // ayarlanmadıysa en azından mevcut sayfayı uygula.
        const src = Object.keys(pageCrops).length ? pageCrops : { [pageIndex]: crop };
        const record: Record<number, CropRect> = {};
        for (const [k, r] of Object.entries(src)) record[Number(k)] = toCropRect(r);
        out = await cropPdf(bytes, record);
      } else {
        out = await cropPdf(bytes, toCropRect(crop), scope === "this" ? [pageIndex] : undefined);
      }
      setResult({
        blob: pdfBytesToBlob(out),
        filename: fileName.replace(/\.pdf$/i, "") + "-kirpilmis.pdf",
      });
    } catch (err) {
      setError(err instanceof PdfEncryptedError ? t.encrypted : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => setCrop(DEFAULT_CROP);

  // Sonuç işlemleri — mevcut araçlarla (GuestPageTool) birebir aynı davranış.
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
        if (e instanceof DOMException && e.name === "AbortError") return;
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

  // ─── Yükleme durumu ────────────────────────────────────────────────────────
  if (!bytes) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setHover(true);
          }}
          onDragLeave={() => setHover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setHover(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void loadFile(f);
          }}
          className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-all duration-300 ${
            hover
              ? "border-cyan-400/70 bg-cyan-400/[0.07] scale-[1.01]"
              : "border-white/15 bg-gradient-to-b from-white/[0.04] to-white/[0.015] hover:border-cyan-400/40 hover:bg-white/[0.05]"
          }`}
        >
          {/* arka plan parıltısı */}
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl transition-opacity duration-300 group-hover:opacity-100 opacity-60" />
          <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-blue-500/25 ring-1 ring-cyan-300/30 shadow-lg shadow-cyan-500/10">
            <Crop className="h-8 w-8 text-cyan-200" />
          </div>
          <span className="relative text-lg font-bold text-white">{t.drop}</span>
          <span className="relative mt-1 text-sm text-slate-400">{t.or}</span>
          <span className="relative mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition group-hover:brightness-110">
            <UploadCloud className="h-4 w-4" /> {t.choose}
          </span>
          <span className="relative mt-4 text-[13px] text-slate-500">{t.hint}</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
            }}
          />
          {error && <span className="relative mt-3 text-[13px] text-rose-300">{error}</span>}
        </label>
        {/* güven çipleri */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { icon: <ShieldCheck className="h-4 w-4" />, t: t.chipDevice },
            { icon: <Zap className="h-4 w-4" />, t: t.chipFree },
            { icon: <Lock className="h-4 w-4" />, t: t.chipNoInstall },
          ].map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-[12px] font-medium text-slate-300"
            >
              <span className="text-cyan-300">{c.icon}</span>
              {c.t}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Sonuç durumu (İndir / Paylaş / Aç / Kapat) — diğer araçlarla aynı ──────
  if (result) {
    return (
      <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
          <Check className="h-8 w-8" />
        </div>
        <p className="mt-4 text-xl font-bold text-white">{t.ready}</p>
        <p className="mt-1 text-sm text-slate-400">{t.readySub}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void saveResult()}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:from-blue-500 hover:to-indigo-500"
          >
            <Download className="h-4 w-4" /> {t.download}
          </button>
          {canShareApi() && (
            <button
              type="button"
              onClick={() => void shareResult()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"
            >
              <Share2 className="h-4 w-4" /> {t.share}
            </button>
          )}
          <button
            type="button"
            onClick={openResult}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"
          >
            <ExternalLink className="h-4 w-4" /> {t.open}
          </button>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" /> {t.close}
          </button>
        </div>
        <ValueMomentNudge language={language} />
      </div>
    );
  }

  // ─── Editör durumu ─────────────────────────────────────────────────────────
  const pct = (v: number) => Math.round(v * 100);
  const bracket = "absolute h-6 w-6 border-cyan-400"; // köşe braketi
  const edgeBar = "absolute rounded-full bg-cyan-400 shadow ring-2 ring-slate-900/40";

  return (
    <div className="flex flex-col gap-4">
      {/* Üst bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-1.5">
          <FileText className="h-4 w-4 shrink-0 text-cyan-300" />
          <span className="truncate text-[13px] font-medium text-slate-200">{fileName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={pageIndex === 0}
            onClick={() => goToPage(pageIndex - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white transition hover:bg-white/[0.12] disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[74px] text-center text-[13px] font-semibold text-slate-300">
            {t.page} {pageIndex + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={pageIndex >= pageCount - 1}
            onClick={() => goToPage(pageIndex + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white transition hover:bg-white/[0.12] disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setBytes(null);
            docRef.current = null;
          }}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          {t.newFile}
        </button>
      </div>

      {/* Kırpma sahnesi */}
      <div ref={stageRef} className="mx-auto w-full max-w-[820px] select-none">
        <div className="relative inline-block w-full overflow-hidden rounded-xl bg-slate-950/40 shadow-2xl ring-1 ring-white/10">
          <canvas ref={canvasRef} className="block w-full" />
          <div className="absolute inset-0" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
            {/* dışarısı karartma */}
            <div
              className="pointer-events-none absolute inset-0 bg-slate-950/55 transition-opacity"
              style={{
                clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${pct(crop.y)}%, ${pct(crop.x)}% ${pct(crop.y)}%, ${pct(crop.x)}% ${pct(crop.y + crop.h)}%, ${pct(crop.x + crop.w)}% ${pct(crop.y + crop.h)}%, ${pct(crop.x + crop.w)}% ${pct(crop.y)}%, 0 ${pct(crop.y)}%)`,
              }}
            />
            {/* kırpma kutusu */}
            <div
              className="absolute cursor-move ring-1 ring-white/70"
              style={{
                left: `${pct(crop.x)}%`,
                top: `${pct(crop.y)}%`,
                width: `${pct(crop.w)}%`,
                height: `${pct(crop.h)}%`,
              }}
              onPointerDown={onPointerDown("move")}
            >
              {/* rule-of-thirds grid */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/25" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/25" />
                <div className="absolute top-1/3 left-0 h-px w-full bg-white/25" />
                <div className="absolute top-2/3 left-0 h-px w-full bg-white/25" />
              </div>

              {/* boyut rozeti */}
              <div className="pointer-events-none absolute -top-7 left-0 rounded-md bg-slate-900/85 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 ring-1 ring-white/10">
                {pct(crop.w)}% × {pct(crop.h)}%
              </div>

              {/* köşe braketleri (resize) */}
              <div className={`${bracket} rounded-tl-md border-l-[3px] border-t-[3px]`} style={{ left: -2, top: -2, cursor: "nwse-resize" }} onPointerDown={onPointerDown("nw")} />
              <div className={`${bracket} rounded-tr-md border-r-[3px] border-t-[3px]`} style={{ right: -2, top: -2, cursor: "nesw-resize" }} onPointerDown={onPointerDown("ne")} />
              <div className={`${bracket} rounded-bl-md border-l-[3px] border-b-[3px]`} style={{ left: -2, bottom: -2, cursor: "nesw-resize" }} onPointerDown={onPointerDown("sw")} />
              <div className={`${bracket} rounded-br-md border-r-[3px] border-b-[3px]`} style={{ right: -2, bottom: -2, cursor: "nwse-resize" }} onPointerDown={onPointerDown("se")} />

              {/* kenar tutamakları (resize) */}
              <div className={`${edgeBar} h-1.5 w-7`} style={{ top: -3, left: "calc(50% - 14px)", cursor: "ns-resize" }} onPointerDown={onPointerDown("n")} />
              <div className={`${edgeBar} h-1.5 w-7`} style={{ bottom: -3, left: "calc(50% - 14px)", cursor: "ns-resize" }} onPointerDown={onPointerDown("s")} />
              <div className={`${edgeBar} h-7 w-1.5`} style={{ left: -3, top: "calc(50% - 14px)", cursor: "ew-resize" }} onPointerDown={onPointerDown("w")} />
              <div className={`${edgeBar} h-7 w-1.5`} style={{ right: -3, top: "calc(50% - 14px)", cursor: "ew-resize" }} onPointerDown={onPointerDown("e")} />
            </div>
          </div>
        </div>
        <p className={`mt-2.5 text-center text-[12px] transition-colors ${dragging ? "text-cyan-300" : "text-slate-500"}`}>
          {t.dragHint}
        </p>
      </div>

      {/* Kontrol çubuğu */}
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
        <span className="text-[13px] font-medium text-slate-400">{t.scope}</span>
        <div className="flex items-center gap-1 rounded-xl bg-slate-950/40 p-1 ring-1 ring-white/[0.06]">
          {(
            [
              ["all", t.allPages],
              ["this", t.thisPage],
              ["each", t.eachPage],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setScope(val)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${scope === val ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/30" : "text-slate-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3.5 py-2 text-[13px] font-semibold text-slate-200 transition hover:bg-white/[0.12]"
        >
          <RotateCcw className="h-4 w-4" /> {t.reset}
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
          {busy ? t.processing : t.apply}
        </button>
      </div>
      {/* Mod açıklaması + "Sayfa sayfa" sayacı */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-center text-[12px] text-slate-400">
        <span>{scope === "all" ? t.hintAll : scope === "this" ? t.hintThis : t.hintEach}</span>
        {scope === "each" && Object.keys(pageCrops).length > 0 && (
          <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 font-semibold text-cyan-200 ring-1 ring-cyan-400/25">
            {t.configured(Object.keys(pageCrops).length)}
          </span>
        )}
      </div>
      {error && <p className="text-center text-[13px] text-rose-300">{error}</p>}
    </div>
  );
}
