import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  ChevronLeft,
  ChevronRight,
  Crop,
  Download,
  FileArchive,
  FileText,
  FileType2,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { zipStore } from "../../lib/zipStore";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * PDF'TEN KESİT AL — sayfanın bir bölgesini seçip yüksek çözünürlüklü görsel
 * olarak dışarı aktarır. Seçilen kesitler bir "sepette" birikir; hepsi birden
 * ZIP ya da tek PDF olarak indirilebilir.
 *
 * BELLEK NOTU: kesit alınırken sayfanın tamamı büyük ölçekte çizilmez; pdf.js'e
 * `transform` verilerek YALNIZCA seçilen bölge, seçilen çözünürlükte çizilir.
 * Böylece 3x çözünürlükte bile tuval yalnızca kesit kadar yer kaplar.
 */

type Rect = { x: number; y: number; w: number; h: number }; // 0..1, sol-üst köşe
type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "new";
type Snip = {
  id: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  page: number;
  mime: string;
};

const DEFAULT_RECT: Rect = { x: 0.12, y: 0.12, w: 0.76, h: 0.3 };
const MAX_SNIPS = 60;
/** Tek bir kesitin en fazla kaç piksel olabileceği (bellek emniyeti). */
const MAX_SNIP_PIXELS = 24_000_000;

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function humanSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const L = {
  tr: {
    hint: "Dosyanız cihazınızda işlenir, sunucuya yüklenmez.",
    page: "Sayfa",
    newFile: "Yeni PDF",
    dragHint: "Sayfada sürükleyerek alan seçin · kutuyu taşıyın, köşelerden boyutlandırın",
    add: "Kesiti Ekle",
    adding: "Alınıyor…",
    basket: "Kesitler",
    empty: "Henüz kesit yok. Sayfada bir alan seçip «Kesiti Ekle» deyin.",
    clear: "Tümünü sil",
    downloadZip: "Tümünü ZIP indir",
    downloadPdf: "Tek PDF yap",
    downloadOne: "İndir",
    quality: "Çözünürlük",
    format: "Biçim",
    failed: "İşlem başarısız oldu. Lütfen tekrar deneyin.",
    encrypted: "Bu PDF şifre korumalı; önce kilidini kaldırın.",
    tooMany: (n: number) => `En fazla ${n} kesit ekleyebilirsiniz.`,
    fmtPng: "PNG (keskin, metin/grafik için)",
    fmtJpeg: "JPEG (küçük dosya, fotoğraf için)",
    qLow: "1x — ekran",
    qMid: "2x — baskı (önerilen)",
    qHigh: "3x — en yüksek",
  },
  en: {
    hint: "Your file is processed on your device, never uploaded.",
    page: "Page",
    newFile: "New PDF",
    dragHint: "Drag on the page to select an area · move the box, resize from the corners",
    add: "Add snip",
    adding: "Capturing…",
    basket: "Snips",
    empty: "No snips yet. Select an area on the page and click «Add snip».",
    clear: "Clear all",
    downloadZip: "Download all as ZIP",
    downloadPdf: "Make one PDF",
    downloadOne: "Download",
    quality: "Resolution",
    format: "Format",
    failed: "Something went wrong. Please try again.",
    encrypted: "This PDF is password-protected; unlock it first.",
    tooMany: (n: number) => `You can add up to ${n} snips.`,
    fmtPng: "PNG (sharp, for text/graphics)",
    fmtJpeg: "JPEG (smaller file, for photos)",
    qLow: "1x — screen",
    qMid: "2x — print (recommended)",
    qHigh: "3x — highest",
  },
};

export function PdfSnipTool({ language, initialFile }: { language: Language; initialFile?: File | null }) {
  const t = L[language] ?? L.tr;
  const tr = language === "tr";

  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("belge.pdf");
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [rect, setRect] = useState<Rect>(DEFAULT_RECT);
  const [dragging, setDragging] = useState(false);
  const [snips, setSnips] = useState<Snip[]>([]);
  const [scaleMul, setScaleMul] = useState(2);
  const [mime, setMime] = useState<"image/png" | "image/jpeg">("image/png");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"zip" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const dragRef = useRef<{ handle: Handle; start: Rect; px: number; py: number } | null>(null);
  const snipsRef = useRef<Snip[]>([]);

  useEffect(() => {
    snipsRef.current = snips;
  }, [snips]);

  // Bileşen kaldırılırken önizleme adreslerini serbest bırak.
  useEffect(
    () => () => {
      for (const s of snipsRef.current) URL.revokeObjectURL(s.url);
    },
    [],
  );

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
        setRect(DEFAULT_RECT);
        setThumbs([]);
      } catch (err) {
        setError(err instanceof Error && /password/i.test(err.message) ? t.encrypted : t.failed);
      }
    },
    [t.failed, t.encrypted],
  );

  // Araçlar arası aktarım: dışarıdan gelen PDF'i bir kez yükle.
  const loadedInitialRef = useRef<File | null>(null);
  useEffect(() => {
    if (initialFile && loadedInitialRef.current !== initialFile) {
      loadedInitialRef.current = initialFile;
      void loadFile(initialFile);
    }
  }, [initialFile, loadFile]);

  // Sol şerit önizlemeleri.
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || !bytes) return;
    let alive = true;
    (async () => {
      const out: string[] = [];
      for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
        if (!alive) return;
        try {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 0.2 });
          const c = document.createElement("canvas");
          c.width = Math.ceil(vp.width);
          c.height = Math.ceil(vp.height);
          const ctx = c.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            out[i - 1] = c.toDataURL("image/jpeg", 0.6);
          }
          if (alive) setThumbs([...out]);
        } catch { /* atla */ }
      }
    })();
    return () => { alive = false; };
  }, [bytes]);

  // Aktif sayfayı ekrana çiz.
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
      const maxH = Math.max(380, window.innerHeight - 260);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(maxW / base.width, maxH / base.height);
      const vp = page.getViewport({ scale });
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    })();
    return () => { cancelled = true; };
  }, [bytes, pageIndex]);

  // ── Seçim kutusu etkileşimi ────────────────────────────────────────────────
  const pointFromEvent = (e: React.PointerEvent) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { px: 0, py: 0 };
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    return { px: clamp((e.clientX - r.left) / r.width), py: clamp((e.clientY - r.top) / r.height) };
  };

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const { px, py } = pointFromEvent(e);
    if (handle === "new") {
      // Boş alandan başlayan sürükleme: sıfırdan yeni kutu çiz.
      dragRef.current = { handle: "se", start: { x: px, y: py, w: 0, h: 0 }, px, py };
      setRect({ x: px, y: py, w: 0, h: 0 });
    } else {
      dragRef.current = { handle, start: { ...rect }, px, py };
    }
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const { px, py } = pointFromEvent(e);
    const MIN = 0.02;
    let { x, y, w, h } = d.start;
    if (d.handle === "move") {
      x = Math.max(0, Math.min(1 - w, d.start.x + (px - d.px)));
      y = Math.max(0, Math.min(1 - h, d.start.y + (py - d.py)));
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
    setRect({ x, y, w, h });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    setDragging(false);
    // Kazara tıklamada kutu kaybolmasın.
    setRect((r) => (r.w < 0.02 || r.h < 0.02 ? DEFAULT_RECT : r));
  };

  const goToPage = (next: number) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, next));
    if (clamped !== pageIndex) setPageIndex(clamped);
  };

  // ── Kesit alma ─────────────────────────────────────────────────────────────
  const addSnip = async () => {
    const doc = docRef.current;
    if (!doc) return;
    if (snips.length >= MAX_SNIPS) {
      setError(t.tooMany(MAX_SNIPS));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const page = await doc.getPage(pageIndex + 1);
      // Ölçek PENCERE BOYUTUNDAN BAĞIMSIZ: belgenin kendi ölçüsü esas alınır, böylece
      // aynı seçim her ekranda aynı piksel ölçüsünü verir. 1x≈108, 2x≈216, 3x≈324 DPI.
      let scale = scaleMul * 1.5;
      const vpFull = page.getViewport({ scale });
      let w = Math.round(rect.w * vpFull.width);
      let h = Math.round(rect.h * vpFull.height);
      // Bellek emniyeti: çok büyük kesitte ölçeği geri çek.
      if (w * h > MAX_SNIP_PIXELS) {
        const f = Math.sqrt(MAX_SNIP_PIXELS / (w * h));
        scale *= f;
        w = Math.max(1, Math.round(w * f));
        h = Math.max(1, Math.round(h * f));
      }
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context yok");
      if (mime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      // YALNIZCA seçilen bölgeyi çiz — sayfanın tamamı için dev tuval açılmaz.
      const offsetX = rect.x * vp.width;
      const offsetY = rect.y * vp.height;
      await page.render({
        canvasContext: ctx,
        viewport: vp,
        transform: [1, 0, 0, 1, -offsetX, -offsetY],
        intent: "print",
      }).promise;

      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, mime, mime === "image/jpeg" ? 0.92 : undefined),
      );
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) throw new Error("toBlob null");
      setSnips((prev) => [
        ...prev,
        {
          id: uid(),
          blob,
          url: URL.createObjectURL(blob),
          width: w,
          height: h,
          page: pageIndex + 1,
          mime,
        },
      ]);
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const removeSnip = (id: string) =>
    setSnips((prev) => {
      const it = prev.find((s) => s.id === id);
      if (it) URL.revokeObjectURL(it.url);
      return prev.filter((s) => s.id !== id);
    });

  const clearSnips = () =>
    setSnips((prev) => {
      for (const s of prev) URL.revokeObjectURL(s.url);
      return [];
    });

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

  const baseName = fileName.replace(/\.pdf$/i, "");
  const snipName = (s: Snip, i: number) =>
    `${baseName}-s${s.page}-kesit${i + 1}.${s.mime === "image/png" ? "png" : "jpg"}`;

  const downloadZip = async () => {
    if (snips.length === 0) return;
    setExporting("zip");
    try {
      const entries = await Promise.all(
        snips.map(async (s, i) => ({
          name: snipName(s, i),
          data: new Uint8Array(await s.blob.arrayBuffer()),
        })),
      );
      downloadBlob(new Blob([zipStore(entries) as BlobPart], { type: "application/zip" }), `${baseName}-kesitler.zip`);
    } catch {
      setError(t.failed);
    } finally {
      setExporting(null);
    }
  };

  const downloadPdf = async () => {
    if (snips.length === 0) return;
    setExporting("pdf");
    try {
      // pdf-lib yalnızca burada yüklenir (ana paket şişmesin).
      const { imagesToPdf, pdfBytesToBlob } = await import("../../lib/clientPdfWorker");
      const images = await Promise.all(
        snips.map(async (s) => ({ bytes: await s.blob.arrayBuffer(), mime: s.mime })),
      );
      const out = await imagesToPdf(images);
      downloadBlob(pdfBytesToBlob(out), `${baseName}-kesitler.pdf`);
    } catch {
      setError(t.failed);
    } finally {
      setExporting(null);
    }
  };

  // ── Yükleme durumu ─────────────────────────────────────────────────────────
  if (!bytes) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="tool-form">
          <WorkspaceUploadField
            language={language}
            accept="application/pdf,.pdf"
            note={t.hint}
            onFiles={(files) => { void loadFile(files[0]!); }}
          />
        </div>
        {error && <p className="mt-3 text-[13px] text-rose-300">{error}</p>}
      </div>
    );
  }

  const pct = (v: number) => Math.round(v * 100);
  const bracket = "absolute h-6 w-6 border-cyan-400";
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
            clearSnips();
            setBytes(null);
            docRef.current = null;
          }}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          {t.newFile}
        </button>
      </div>

      {/* Sayfa şeridi + seçim sahnesi */}
      <div className="flex min-h-0 items-start gap-3">
        {pageCount > 1 ? (
          <div className="sticky top-2 max-h-[72vh] w-24 shrink-0 overflow-y-auto rounded-2xl border border-white/[0.07] bg-black/20 p-2 sm:w-28">
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToPage(i)}
                aria-current={pageIndex === i}
                className={`relative mb-2 block w-full overflow-hidden rounded-lg border-2 transition ${
                  pageIndex === i ? "border-cyan-400" : "border-transparent hover:border-white/20"
                }`}
              >
                {thumbs[i] ? (
                  <img src={thumbs[i]} alt={`${i + 1}`} className="w-full bg-white" />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center bg-white/5 text-[10px] text-slate-500">{i + 1}</div>
                )}
                {snips.some((s) => s.page === i + 1) ? (
                  <span className="absolute right-1 top-1 rounded-md bg-cyan-500/90 px-1 py-px text-[9px] font-bold text-white shadow" aria-hidden>
                    {snips.filter((s) => s.page === i + 1).length}
                  </span>
                ) : null}
                <span className={`block py-0.5 text-center text-[10px] ${pageIndex === i ? "text-cyan-300" : "text-slate-500"}`}>{i + 1}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div ref={stageRef} className="mx-auto w-full min-w-0 max-w-[820px] select-none">
          <div className="relative inline-block w-full overflow-hidden rounded-xl bg-slate-950/40 shadow-2xl ring-1 ring-white/10">
            <canvas ref={canvasRef} className="block w-full" />
            <div
              className="absolute inset-0 cursor-crosshair"
              onPointerDown={onPointerDown("new")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {/* dışarısı karartma */}
              <div
                className="pointer-events-none absolute inset-0 bg-slate-950/55 transition-opacity"
                style={{
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${pct(rect.y)}%, ${pct(rect.x)}% ${pct(rect.y)}%, ${pct(rect.x)}% ${pct(rect.y + rect.h)}%, ${pct(rect.x + rect.w)}% ${pct(rect.y + rect.h)}%, ${pct(rect.x + rect.w)}% ${pct(rect.y)}%, 0 ${pct(rect.y)}%)`,
                }}
              />
              {/* seçim kutusu */}
              <div
                className="absolute cursor-move ring-1 ring-white/70"
                style={{
                  left: `${pct(rect.x)}%`,
                  top: `${pct(rect.y)}%`,
                  width: `${pct(rect.w)}%`,
                  height: `${pct(rect.h)}%`,
                }}
                onPointerDown={onPointerDown("move")}
              >
                <div className="pointer-events-none absolute -top-7 left-0 rounded-md bg-slate-900/85 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 ring-1 ring-white/10">
                  {pct(rect.w)}% × {pct(rect.h)}%
                </div>
                <div className={`${bracket} rounded-tl-md border-l-[3px] border-t-[3px]`} style={{ left: -2, top: -2, cursor: "nwse-resize" }} onPointerDown={onPointerDown("nw")} />
                <div className={`${bracket} rounded-tr-md border-r-[3px] border-t-[3px]`} style={{ right: -2, top: -2, cursor: "nesw-resize" }} onPointerDown={onPointerDown("ne")} />
                <div className={`${bracket} rounded-bl-md border-l-[3px] border-b-[3px]`} style={{ left: -2, bottom: -2, cursor: "nesw-resize" }} onPointerDown={onPointerDown("sw")} />
                <div className={`${bracket} rounded-br-md border-r-[3px] border-b-[3px]`} style={{ right: -2, bottom: -2, cursor: "nwse-resize" }} onPointerDown={onPointerDown("se")} />
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
      </div>

      {/* Kontrol çubuğu */}
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
        <label className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-slate-400">{t.quality}</span>
          <select
            value={scaleMul}
            onChange={(e) => setScaleMul(Number(e.target.value))}
            className="rounded-lg border border-white/12 bg-[#0b1020] px-2 py-1.5 text-[13px] text-slate-100"
          >
            <option value={1}>{t.qLow}</option>
            <option value={2}>{t.qMid}</option>
            <option value={3}>{t.qHigh}</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-slate-400">{t.format}</span>
          <select
            value={mime}
            onChange={(e) => setMime(e.target.value as "image/png" | "image/jpeg")}
            className="rounded-lg border border-white/12 bg-[#0b1020] px-2 py-1.5 text-[13px] text-slate-100"
          >
            <option value="image/png">{t.fmtPng}</option>
            <option value="image/jpeg">{t.fmtJpeg}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void addSnip()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {busy ? t.adding : t.add}
        </button>
      </div>

      {/* Kesit sepeti */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-white">
            {t.basket} {snips.length > 0 ? `(${snips.length})` : ""}
          </span>
          {snips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void downloadZip()}
                disabled={exporting !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
              >
                {exporting === "zip" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileArchive className="h-3.5 w-3.5" />}
                {t.downloadZip}
              </button>
              <button
                type="button"
                onClick={() => void downloadPdf()}
                disabled={exporting !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/[0.12] px-3 py-1.5 text-[12px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType2 className="h-3.5 w-3.5" />}
                {t.downloadPdf}
              </button>
              <button
                type="button"
                onClick={clearSnips}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.clear}
              </button>
            </div>
          )}
        </div>

        {snips.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-slate-500">{t.empty}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {snips.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                <img src={s.url} alt="" className="h-10 w-14 shrink-0 rounded-lg bg-white object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-slate-100">
                    {t.page} {s.page} · {s.width} × {s.height} px
                  </p>
                  <p className="text-[11px] text-slate-500">{humanSize(s.blob.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadBlob(s.blob, snipName(s, i))}
                  aria-label={t.downloadOne}
                  title={t.downloadOne}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-white/[0.08] hover:text-cyan-300"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeSnip(s.id)}
                  aria-label={tr ? "Kaldır" : "Remove"}
                  className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-center text-[13px] text-rose-300">{error}</p>}

      {snips.length > 0 && <ValueMomentNudge language={language} source="snip_success" />}

      <p className="text-center text-[11px] text-slate-500">
        <Crop className="mr-1 inline h-3 w-3" aria-hidden />
        {tr
          ? "Kesitler yalnızca seçtiğiniz bölge çizilerek alınır — belgeniz cihazınızdan çıkmaz."
          : "Only the area you select is rendered — your document never leaves your device."}
      </p>
    </div>
  );
}
