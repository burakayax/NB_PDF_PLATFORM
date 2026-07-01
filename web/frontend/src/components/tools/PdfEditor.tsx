import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved -- Vite ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Highlighter,
  Loader2,
  MousePointer2,
  Pencil,
  Square,
  Type,
  Undo2,
  UploadCloud,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { exportEditedPdf, type EditAnno } from "../../lib/pdfEditor";
import { pdfBytesToBlob } from "../../lib/summaryPdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type Tool = "select" | "text" | "whiteout" | "highlight" | "pen";
type Draft = { x: number; y: number; w: number; h: number } | null;
type PenDraft = { x: number; y: number }[] | null;

const uid = () => Math.random().toString(36).slice(2, 9);

export function PdfEditor({ language }: { language: Language }) {
  const tr = language === "tr";
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [annos, setAnnos] = useState<EditAnno[]>([]);
  const [tool, setTool] = useState<Tool>("text");
  const [color, setColor] = useState("#e11d48");
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [penDraft, setPenDraft] = useState<PenDraft>(null);
  const [dragOver, setDragOver] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const pageAnnos = annos.filter((a) => a.page === pageIndex);

  async function pickFile(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError(tr ? "Lütfen bir PDF seçin." : "Please choose a PDF.");
      return;
    }
    try {
      const buf = await f.arrayBuffer();
      setBytes(buf);
      const d = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise;
      setDoc(d);
      setPageCount(d.numPages);
      setPageIndex(0);
      setAnnos([]);
    } catch {
      setError(tr ? "PDF açılamadı (şifreli olabilir)." : "Couldn't open the PDF (may be encrypted).");
    }
  }

  // Aktif sayfayı canvas'a çiz.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const page = await doc.getPage(pageIndex + 1);
        const container = overlayRef.current?.parentElement;
        const targetW = Math.min(container?.clientWidth ?? 760, 900);
        const base = page.getViewport({ scale: 1 });
        const scale = targetW / base.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        renderTaskRef.current?.cancel();
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) setDims({ w: canvas.width, h: canvas.height });
      } catch {
        /* iptal edilen render → yoksay */
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageIndex]);

  const norm = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }, []);

  function onOverlayClick(e: React.MouseEvent) {
    if (tool !== "text") return;
    if ((e.target as HTMLElement).dataset.anno) return; // mevcut kutuya tıklama
    const { x, y } = norm(e);
    const id = uid();
    setAnnos((a) => [...a, { id, page: pageIndex, type: "text", x, y, text: "", size: 0.022, color }]);
    setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(`[data-annoid="${id}"]`);
      el?.focus();
    }, 20);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (tool === "select" || tool === "text") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = norm(e);
    if (tool === "pen") setPenDraft([p]);
    else setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (tool === "pen" && penDraft) {
      const p = norm(e);
      setPenDraft((pd) => (pd ? [...pd, p] : pd));
    } else if (draft && (tool === "whiteout" || tool === "highlight")) {
      const p = norm(e);
      setDraft((d) => (d ? { ...d, w: p.x - d.x, h: p.y - d.y } : d));
    }
  }
  function onPointerUp() {
    if (tool === "pen" && penDraft) {
      if (penDraft.length > 1)
        setAnnos((a) => [...a, { id: uid(), page: pageIndex, type: "pen", points: penDraft, color, width: 0.004 }]);
      setPenDraft(null);
    } else if (draft && (tool === "whiteout" || tool === "highlight")) {
      const x = Math.min(draft.x, draft.x + draft.w);
      const y = Math.min(draft.y, draft.y + draft.h);
      const w = Math.abs(draft.w);
      const h = Math.abs(draft.h);
      if (w > 0.005 && h > 0.005) {
        setAnnos((a) =>
          tool === "whiteout"
            ? [...a, { id: uid(), page: pageIndex, type: "whiteout", x, y, w, h }]
            : [...a, { id: uid(), page: pageIndex, type: "highlight", x, y, w, h, color }],
        );
      }
      setDraft(null);
    }
  }

  const undo = () => setAnnos((a) => a.slice(0, -1));
  const updateText = (id: string, text: string) =>
    setAnnos((a) => a.map((x) => (x.id === id && x.type === "text" ? { ...x, text } : x)));

  async function exportPdf() {
    if (!bytes) return;
    try {
      setBusy(true);
      const clean = annos.filter((a) => a.type !== "text" || a.text.trim().length > 0);
      const out = await exportEditedPdf(bytes.slice(0), clean);
      const url = URL.createObjectURL(pdfBytesToBlob(out));
      const a = document.createElement("a");
      a.href = url;
      a.download = "duzenlenmis.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    } catch {
      setError(tr ? "PDF dışa aktarılamadı." : "Couldn't export the PDF.");
    } finally {
      setBusy(false);
    }
  }

  // ── Dosya yok: yükleme ──
  if (!doc) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void pickFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition ${
            dragOver ? "border-cyan-400/70 bg-cyan-400/[0.06]" : "border-white/15 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-white/[0.04]"
          }`}
        >
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-300 ring-1 ring-white/10">
            <UploadCloud className="h-8 w-8" />
          </div>
          <p className="mt-4 text-lg font-bold text-white">{tr ? "Düzenlemek için PDF sürükle veya seç" : "Drag or choose a PDF to edit"}</p>
          <p className="mt-1.5 text-[13px] text-slate-400">
            {tr ? "Metin ekle, yazıları kapat/sil, vurgula, çiz — hepsi cihazında." : "Add text, cover/erase, highlight, draw — all on your device."}
          </p>
        </div>
        {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}
      </div>
    );
  }

  const tools: { id: Tool; icon: typeof Type; label: string }[] = [
    { id: "select", icon: MousePointer2, label: tr ? "Seç" : "Select" },
    { id: "text", icon: Type, label: tr ? "Metin" : "Text" },
    { id: "whiteout", icon: Square, label: tr ? "Kapat/Sil" : "Cover" },
    { id: "highlight", icon: Highlighter, label: tr ? "Vurgu" : "Highlight" },
    { id: "pen", icon: Pencil, label: tr ? "Kalem" : "Pen" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Araç çubuğu */}
      <div className="sticky top-16 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-nb-bg-elevated/95 p-2 backdrop-blur">
        <div className="flex items-center gap-1">
          {tools.map((t) => (
            <button key={t.id} type="button" onClick={() => setTool(t.id)} title={t.label}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold transition ${
                tool === t.id ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40" : "text-slate-300 hover:bg-white/[0.06]"
              }`}>
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title={tr ? "Renk" : "Color"}
          className="h-8 w-8 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
        <button type="button" onClick={undo} disabled={annos.length === 0} title={tr ? "Geri al" : "Undo"}
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-40">
          <Undo2 className="h-4 w-4" /><span className="hidden sm:inline">{tr ? "Geri Al" : "Undo"}</span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 text-[12px] text-slate-400">
            <button type="button" onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0}
              className="rounded-lg p-1.5 hover:bg-white/[0.06] disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span className="tabular-nums">{pageIndex + 1}/{pageCount}</span>
            <button type="button" onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))} disabled={pageIndex >= pageCount - 1}
              className="rounded-lg p-1.5 hover:bg-white/[0.06] disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={() => void exportPdf()} disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {tr ? "PDF İndir" : "Download"}
          </button>
        </div>
      </div>

      {/* Sayfa + düzenleme katmanı */}
      <div className="relative mx-auto w-fit rounded-lg bg-white shadow-2xl">
        <canvas ref={canvasRef} className="block rounded-lg" />
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
          </div>
        )}
        <div
          ref={overlayRef}
          onClick={onOverlayClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="absolute inset-0"
          style={{
            cursor: tool === "text" ? "text" : tool === "select" ? "default" : "crosshair",
            touchAction: "none",
          }}
        >
          {/* Kalıcı annotasyonlar */}
          {pageAnnos.map((a) => {
            if (a.type === "whiteout")
              return <div key={a.id} className="absolute" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%`, background: "#fff" }} />;
            if (a.type === "highlight")
              return <div key={a.id} className="absolute" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%`, background: a.color, opacity: 0.35 }} />;
            if (a.type === "text")
              return (
                <textarea
                  key={a.id}
                  data-anno="1"
                  data-annoid={a.id}
                  value={a.text}
                  onChange={(e) => updateText(a.id, e.target.value)}
                  placeholder={tr ? "yaz…" : "type…"}
                  className="absolute resize-none overflow-hidden border border-dashed border-cyan-400/50 bg-transparent leading-tight outline-none placeholder:text-slate-400/60"
                  style={{
                    left: `${a.x * 100}%`,
                    top: `${a.y * 100}%`,
                    color: a.color,
                    fontSize: `${a.size * dims.h}px`,
                    minWidth: "40px",
                    width: "auto",
                    fontFamily: "Roboto, system-ui, sans-serif",
                  }}
                  rows={1}
                />
              );
            return null;
          })}
          {/* Kalem SVG (kalıcı + çizim taslağı) */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {pageAnnos.filter((a) => a.type === "pen").map((a) =>
              a.type === "pen" ? (
                <polyline key={a.id} points={a.points.map((p) => `${p.x * dims.w},${p.y * dims.h}`).join(" ")}
                  fill="none" stroke={a.color} strokeWidth={a.width * dims.w} strokeLinecap="round" strokeLinejoin="round" />
              ) : null,
            )}
            {penDraft && penDraft.length > 1 && (
              <polyline points={penDraft.map((p) => `${p.x * dims.w},${p.y * dims.h}`).join(" ")}
                fill="none" stroke={color} strokeWidth={0.004 * dims.w} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
          {/* Çizilen dikdörtgen taslağı */}
          {draft && (tool === "whiteout" || tool === "highlight") && (
            <div className="absolute border border-cyan-400/70"
              style={{
                left: `${Math.min(draft.x, draft.x + draft.w) * 100}%`,
                top: `${Math.min(draft.y, draft.y + draft.h) * 100}%`,
                width: `${Math.abs(draft.w) * 100}%`,
                height: `${Math.abs(draft.h) * 100}%`,
                background: tool === "whiteout" ? "#ffffffcc" : `${color}55`,
              }} />
          )}
        </div>
      </div>

      <p className="mt-3 text-center text-[12px] text-slate-500">
        {tr
          ? "İpucu: “Kapat/Sil” ile mevcut yazının üstünü beyazla, sonra “Metin” ile yenisini yaz. Değişiklikler yalnızca cihazında."
          : "Tip: use “Cover” to white out existing text, then “Text” to write new. Everything stays on your device."}
      </p>
      {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-center text-[13px] text-red-300">{error}</p>}
    </div>
  );
}
