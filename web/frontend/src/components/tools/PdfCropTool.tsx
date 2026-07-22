import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved -- Vite ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { Crop, Download, Loader2, RotateCcw, UploadCloud } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { cropPdf, pdfBytesToBlob, PdfEncryptedError } from "../../lib/clientPdfWorker";
import type { CropRect } from "../../lib/clientPdf";
import { saveBlobToUser } from "../../api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type Props = {
  language: Language;
};

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Rect = { x: number; y: number; w: number; h: number }; // normalized 0..1, top-left origin

const L = {
  tr: {
    drop: "PDF'i buraya bırakın veya seçin",
    hint: "Dosyanız cihazınızda işlenir — sunucuya yüklenmez.",
    choose: "PDF Seç",
    page: "Sayfa",
    of: "/",
    scope: "Uygula",
    allPages: "Tüm sayfalar",
    thisPage: "Yalnız bu sayfa",
    reset: "Sıfırla",
    apply: "Kırp ve İndir",
    processing: "Kırpılıyor…",
    encrypted: "Bu PDF şifre korumalı; önce kilidini kaldırın.",
    failed: "İşlem başarısız oldu. Lütfen tekrar deneyin.",
    dragHint: "Kutuyu sürükleyin, köşelerden boyutlandırın.",
    newFile: "Başka PDF",
  },
  en: {
    drop: "Drop a PDF here or choose one",
    hint: "Your file is processed on your device — never uploaded.",
    choose: "Choose PDF",
    page: "Page",
    of: "of",
    scope: "Apply to",
    allPages: "All pages",
    thisPage: "This page only",
    reset: "Reset",
    apply: "Crop & Download",
    processing: "Cropping…",
    encrypted: "This PDF is password-protected; unlock it first.",
    failed: "Something went wrong. Please try again.",
    dragHint: "Drag the box, resize from the corners.",
    newFile: "Another PDF",
  },
};

export function PdfCropTool({ language }: Props) {
  const t = L[language] ?? L.tr;
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("belge.pdf");
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0); // 0-based
  const [crop, setCrop] = useState<Rect>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [applyAll, setApplyAll] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const dragRef = useRef<{ handle: Handle; sx: number; sy: number; start: Rect } | null>(null);

  const loadFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjsLib.getDocument({ data: buf.slice() }).promise;
      docRef.current = doc;
      setBytes(buf);
      setFileName(file.name.replace(/\.pdf$/i, "") + ".pdf");
      setPageCount(doc.numPages);
      setPageIndex(0);
      setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
    } catch {
      setError(t.failed);
    }
  }, [t.failed]);

  // Render current page onto the canvas, fitting the stage width.
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
      const maxW = Math.min(stage.clientWidth || 640, 760);
      const base = page.getViewport({ scale: 1 });
      const scale = maxW / base.width;
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

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { handle, sx: e.clientX, sy: e.clientY, start: { ...crop } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const canvas = canvasRef.current;
    if (!d || !canvas) return;
    const dxN = (e.clientX - d.sx) / canvas.clientWidth;
    const dyN = (e.clientY - d.sy) / canvas.clientHeight;
    let { x, y, w, h } = d.start;
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const MIN = 0.05;
    if (d.handle === "move") {
      x = clamp(x + dxN * 1);
      y = clamp(y + dyN * 1);
      x = Math.min(x, 1 - w);
      y = Math.min(y, 1 - h);
    } else {
      if (d.handle.includes("w")) {
        const nx = clamp(x + dxN);
        const right = x + w;
        x = Math.min(nx, right - MIN);
        w = right - x;
      }
      if (d.handle.includes("e")) {
        w = Math.max(MIN, Math.min(1 - x, w + dxN));
      }
      if (d.handle.includes("n")) {
        const ny = clamp(y + dyN);
        const bottom = y + h;
        y = Math.min(ny, bottom - MIN);
        h = bottom - y;
      }
      if (d.handle.includes("s")) {
        h = Math.max(MIN, Math.min(1 - y, h + dyN));
      }
    }
    setCrop({ x, y, w, h });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  const apply = async () => {
    if (!bytes) return;
    setBusy(true);
    setError(null);
    try {
      const rect: CropRect = { xNorm: crop.x, yNorm: crop.y, wNorm: crop.w, hNorm: crop.h };
      const pages = applyAll ? undefined : [pageIndex];
      const out = await cropPdf(bytes, rect, pages);
      const blob = pdfBytesToBlob(out);
      await saveBlobToUser(blob, fileName.replace(/\.pdf$/i, "") + "-kirpilmis.pdf");
    } catch (err) {
      setError(err instanceof PdfEncryptedError ? t.encrypted : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });

  if (!bytes) {
    return (
      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center transition hover:border-cyan-400/40 hover:bg-white/[0.05]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void loadFile(f);
        }}
      >
        <UploadCloud className="h-10 w-10 text-cyan-300" />
        <span className="text-base font-semibold text-white">{t.drop}</span>
        <span className="text-[13px] text-slate-400">{t.hint}</span>
        <span className="mt-1 rounded-lg bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/25">
          {t.choose}
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadFile(f);
          }}
        />
        {error && <span className="text-[13px] text-rose-300">{error}</span>}
      </label>
    );
  }

  const handleCls =
    "absolute h-3 w-3 rounded-sm border border-white bg-cyan-400 shadow";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <button
            type="button"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            className="rounded-lg bg-white/10 px-2.5 py-1 font-semibold text-white disabled:opacity-40"
          >
            ‹
          </button>
          <span>
            {t.page} {pageIndex + 1} {t.of} {pageCount}
          </span>
          <button
            type="button"
            disabled={pageIndex >= pageCount - 1}
            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
            className="rounded-lg bg-white/10 px-2.5 py-1 font-semibold text-white disabled:opacity-40"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setBytes(null);
            docRef.current = null;
          }}
          className="text-[13px] font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline"
        >
          {t.newFile}
        </button>
      </div>

      <div ref={stageRef} className="relative mx-auto w-full max-w-[760px] select-none">
        <div className="relative inline-block w-full">
          <canvas ref={canvasRef} className="w-full rounded-lg shadow-lg" />
          {/* Kırpma katmanı */}
          <div
            className="absolute inset-0"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* Karartma (kırpma dışı) */}
            <div className="pointer-events-none absolute inset-0 bg-black/40" style={{
              clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${crop.y * 100}%, ${crop.x * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${(crop.y + crop.h) * 100}%, ${(crop.x + crop.w) * 100}% ${(crop.y + crop.h) * 100}%, ${(crop.x + crop.w) * 100}% ${crop.y * 100}%, 0 ${crop.y * 100}%)`,
            }} />
            {/* Kırpma kutusu */}
            <div
              className="absolute cursor-move border-2 border-cyan-400"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
              }}
              onPointerDown={onPointerDown("move")}
            >
              {/* köşe + kenar tutamakları */}
              <div className={handleCls} style={{ left: -6, top: -6, cursor: "nwse-resize" }} onPointerDown={onPointerDown("nw")} />
              <div className={handleCls} style={{ right: -6, top: -6, cursor: "nesw-resize" }} onPointerDown={onPointerDown("ne")} />
              <div className={handleCls} style={{ left: -6, bottom: -6, cursor: "nesw-resize" }} onPointerDown={onPointerDown("sw")} />
              <div className={handleCls} style={{ right: -6, bottom: -6, cursor: "nwse-resize" }} onPointerDown={onPointerDown("se")} />
              <div className={handleCls} style={{ left: "calc(50% - 6px)", top: -6, cursor: "ns-resize" }} onPointerDown={onPointerDown("n")} />
              <div className={handleCls} style={{ left: "calc(50% - 6px)", bottom: -6, cursor: "ns-resize" }} onPointerDown={onPointerDown("s")} />
              <div className={handleCls} style={{ top: "calc(50% - 6px)", left: -6, cursor: "ew-resize" }} onPointerDown={onPointerDown("w")} />
              <div className={handleCls} style={{ top: "calc(50% - 6px)", right: -6, cursor: "ew-resize" }} onPointerDown={onPointerDown("e")} />
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[12px] text-slate-500">{t.dragHint}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1 text-[13px]">
          <button
            type="button"
            onClick={() => setApplyAll(true)}
            className={`rounded-md px-3 py-1.5 font-semibold transition ${applyAll ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-white"}`}
          >
            {t.allPages}
          </button>
          <button
            type="button"
            onClick={() => setApplyAll(false)}
            className={`rounded-md px-3 py-1.5 font-semibold transition ${!applyAll ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-white"}`}
          >
            {t.thisPage}
          </button>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          <RotateCcw className="h-4 w-4" /> {t.reset}
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
          {busy ? t.processing : t.apply}
        </button>
      </div>
      {error && <p className="text-center text-[13px] text-rose-300">{error}</p>}
    </div>
  );
}
