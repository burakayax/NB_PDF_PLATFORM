import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved -- Vite ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Highlighter,
  Image as ImageIcon,
  Loader2,
  MousePointer2,
  Pencil,
  Share2,
  Sparkles,
  Type,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { exportEditedPdf, type EditAnno } from "../../lib/pdfEditor";
import { pdfBytesToBlob } from "../../lib/summaryPdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type Tool = "select" | "text" | "highlight" | "pen" | "image";
type Draft = { x: number; y: number; w: number; h: number } | null;
type PenDraft = { x: number; y: number }[] | null;

const uid = () => Math.random().toString(36).slice(2, 9);

export function PdfEditor({ language }: { language: Language }) {
  const tr = language === "tr";
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [annos, setAnnos] = useState<EditAnno[]>([]);
  const [tool, setTool] = useState<Tool>("text");
  const [color, setColor] = useState("#e11d48");
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [penDraft, setPenDraft] = useState<PenDraft>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [shared, setShared] = useState(false);
  const pendingImage = useRef<{ dataUrl: string; aspect: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const pageAnnos = annos.filter((a) => a.page === pageIndex);
  const hasEdits = annos.some((a) => a.type !== "text" || a.text.trim().length > 0);

  async function pickFile(f: File | undefined) {
    setError(null);
    setResult(null);
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError(tr ? "Lütfen bir PDF seçin." : "Please choose a PDF.");
      return;
    }
    try {
      const buf = await f.arrayBuffer();
      setBytes(buf);
      setFileName(f.name);
      const d = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise;
      setDoc(d);
      setPageCount(d.numPages);
      setPageIndex(0);
      setAnnos([]);
      setEditorOpen(true); // düzenleme tam ekran popup'ta açılır
    } catch {
      setError(tr ? "PDF açılamadı (şifreli olabilir)." : "Couldn't open the PDF (may be encrypted).");
    }
  }

  // Aktif sayfayı canvas'a çiz (popup açıkken).
  useEffect(() => {
    if (!doc || !editorOpen) return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const page = await doc.getPage(pageIndex + 1);
        const container = overlayRef.current?.parentElement;
        const targetW = Math.min(container?.clientWidth ?? 760, 860);
        const base = page.getViewport({ scale: 1 });
        const scale = targetW / base.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setDims({ w: canvas.width, h: canvas.height });
      } catch {
        /* iptal → yoksay */
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [doc, pageIndex, editorOpen]);

  const norm = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }, []);

  function onOverlayClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).dataset.anno) return;
    const { x, y } = norm(e);
    if (tool === "text") {
      const id = uid();
      setAnnos((a) => [...a, { id, page: pageIndex, type: "text", x, y, text: "", size: 0.022, color }]);
      setTimeout(() => document.querySelector<HTMLTextAreaElement>(`[data-annoid="${id}"]`)?.focus(), 20);
    } else if (tool === "image" && pendingImage.current) {
      const wNorm = 0.28;
      const hNorm = (wNorm * dims.w) / pendingImage.current.aspect / dims.h;
      setAnnos((a) => [...a, { id: uid(), page: pageIndex, type: "image", x, y, w: wNorm, h: hNorm, dataUrl: pendingImage.current!.dataUrl }]);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (tool === "select" || tool === "text" || tool === "image") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = norm(e);
    if (tool === "pen") setPenDraft([p]);
    else setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (tool === "pen" && penDraft) {
      const p = norm(e);
      setPenDraft((pd) => (pd ? [...pd, p] : pd));
    } else if (draft && tool === "highlight") {
      const p = norm(e);
      setDraft((d) => (d ? { ...d, w: p.x - d.x, h: p.y - d.y } : d));
    }
  }
  function onPointerUp() {
    if (tool === "pen" && penDraft) {
      if (penDraft.length > 1) setAnnos((a) => [...a, { id: uid(), page: pageIndex, type: "pen", points: penDraft, color, width: 0.004 }]);
      setPenDraft(null);
    } else if (draft && tool === "highlight") {
      const x = Math.min(draft.x, draft.x + draft.w);
      const y = Math.min(draft.y, draft.y + draft.h);
      const w = Math.abs(draft.w);
      const h = Math.abs(draft.h);
      if (w > 0.005 && h > 0.005) setAnnos((a) => [...a, { id: uid(), page: pageIndex, type: "highlight", x, y, w, h, color }]);
      setDraft(null);
    }
  }

  function pickImage(f: File | undefined) {
    if (!f || !/^image\/(png|jpe?g)$/.test(f.type)) {
      setError(tr ? "PNG veya JPG görsel seçin." : "Choose a PNG or JPG image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        pendingImage.current = { dataUrl, aspect: img.width / img.height };
        setTool("image");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(f);
  }

  const undo = () => setAnnos((a) => a.slice(0, -1));
  const updateText = (id: string, text: string) =>
    setAnnos((a) => a.map((x) => (x.id === id && x.type === "text" ? { ...x, text } : x)));

  async function preparePdf() {
    if (!bytes) return;
    try {
      setBusy(true);
      const clean = annos.filter((a) => a.type !== "text" || a.text.trim().length > 0);
      const out = await exportEditedPdf(bytes.slice(0), clean);
      const filename = `${(fileName || "duzenlenmis").replace(/\.pdf$/i, "")}-duzenlenmis.pdf`;
      setResult({ blob: pdfBytesToBlob(out), filename });
    } catch {
      setError(tr ? "PDF hazırlanamadı." : "Couldn't prepare the PDF.");
    } finally {
      setBusy(false);
    }
  }

  function downloadResult() {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  async function shareResult() {
    if (!result) return;
    const file = new File([result.blob], result.filename, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d?: unknown) => boolean };
    if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: result.filename });
        setShared(true);
        setTimeout(() => setShared(false), 1600);
        return;
      } catch {
        /* iptal → indir */
      }
    }
    downloadResult();
  }

  function reset() {
    setBytes(null);
    setFileName(null);
    setDoc(null);
    setAnnos([]);
    setResult(null);
    setError(null);
    setEditorOpen(false);
  }

  const tools: { id: Tool; icon: typeof Type; label: string }[] = [
    { id: "select", icon: MousePointer2, label: tr ? "Taşı" : "Move" },
    { id: "text", icon: Type, label: tr ? "Metin" : "Text" },
    { id: "highlight", icon: Highlighter, label: tr ? "Vurgu" : "Highlight" },
    { id: "pen", icon: Pencil, label: tr ? "Kalem" : "Pen" },
    { id: "image", icon: ImageIcon, label: tr ? "Görsel" : "Image" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl text-left">
      {/* Premium başlık */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/25 via-sky-500/20 to-blue-600/20 text-cyan-200 ring-1 ring-cyan-400/30 shadow-[0_0_30px_-8px_rgba(6,182,212,0.6)]">
          <Pencil className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "PDF Düzenle" : "Edit PDF"}</h1>
            <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">
              {tr ? "Ücretsiz" : "Free"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {tr ? "PDF'e metin, vurgu, çizim ve görsel/imza ekleyin — tarayıcıda, cihazınızda." : "Add text, highlights, drawings and images/signatures to your PDF — in your browser."}
          </p>
        </div>
      </div>

      {result ? (
        /* ── Sonuç: İndir / Paylaş / Yeni ── */
        <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <Check className="h-8 w-8" />
          </div>
          <p className="mt-4 text-xl font-bold text-white">{tr ? "PDF hazır 🎉" : "Your PDF is ready 🎉"}</p>
          <p className="mt-1 text-sm text-slate-400">{tr ? "Dosyan cihazından hiç çıkmadı." : "Your file never left your device."}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={downloadResult}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:brightness-110">
              <Download className="h-4 w-4" />{tr ? "İndir" : "Download"}
            </button>
            <button type="button" onClick={() => void shareResult()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]">
              {shared ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}{tr ? "Paylaş" : "Share"}
            </button>
            <button type="button" onClick={() => setEditorOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]">
              <Pencil className="h-4 w-4" />{tr ? "Düzenlemeye Dön" : "Back to Editor"}
            </button>
            <button type="button" onClick={reset}
              className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]">
              {tr ? "Yeni PDF" : "New PDF"}
            </button>
          </div>
        </div>
      ) : !fileName ? (
        /* ── Dropzone (AI aracı stili) ── */
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void pickFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          className={`group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed p-12 text-center transition ${
            dragOver ? "border-cyan-400/70 bg-cyan-400/[0.07]" : "border-white/15 bg-gradient-to-b from-white/[0.03] to-transparent hover:border-cyan-400/40 hover:bg-white/[0.04]"
          }`}
        >
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-200 ring-1 ring-white/10 transition group-hover:scale-105">
            <UploadCloud className="h-9 w-9" />
          </div>
          <p className="relative mt-5 text-lg font-bold text-white">{tr ? "Düzenlemek için PDF'i sürükle veya seç" : "Drag or choose a PDF to edit"}</p>
          <p className="relative mt-1.5 text-[13px] text-slate-400">{tr ? "Editör tam ekran açılır; dosyan cihazından çıkmaz." : "The editor opens full-screen; your file never leaves your device."}</p>
          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-slate-400">
            {[tr ? "⚡ Anında" : "⚡ Instant", tr ? "🔒 Gizli" : "🔒 Private", tr ? "♾️ Sınırsız" : "♾️ Unlimited"].map((c) => (
              <span key={c} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{c}</span>
            ))}
          </div>
        </div>
      ) : (
        /* ── Dosya yüklendi, popup kapalı → Hazırla ── */
        <div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-300"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-100">{fileName}</p>
              <p className="text-[11px] text-slate-500">
                {hasEdits ? (tr ? `${annos.length} düzenleme · hazır` : `${annos.length} edits · ready`) : (tr ? "Henüz düzenleme yok" : "No edits yet")}
              </p>
            </div>
            <button type="button" onClick={() => setEditorOpen(true)}
              className="shrink-0 rounded-lg border border-cyan-400/30 px-3 py-1.5 text-[12px] font-semibold text-cyan-200 transition hover:bg-cyan-500/10">
              {tr ? "Düzenle" : "Edit"}
            </button>
            <button type="button" onClick={reset} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
              {tr ? "Yeni" : "New"}
            </button>
          </div>
          <button type="button" onClick={() => void preparePdf()} disabled={busy || !hasEdits}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(6,182,212,0.7)] transition hover:brightness-110 disabled:opacity-40">
            {busy ? <><Loader2 className="h-5 w-5 animate-spin" />{tr ? "Hazırlanıyor…" : "Preparing…"}</> : <><Sparkles className="h-5 w-5" />{tr ? "PDF'i Hazırla" : "Prepare PDF"} →</>}
          </button>
          {!hasEdits && <p className="mt-2 text-center text-[12px] text-slate-500">{tr ? "«Düzenle» ile düzenlemeler ekleyin, sonra hazırlayın." : "Add edits via “Edit”, then prepare."}</p>}
        </div>
      )}

      {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}

      {/* ── Tam ekran düzenleme popup'ı ── */}
      {editorOpen && doc &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col bg-[#0b1020]/95 backdrop-blur-sm">
            {/* Üst çubuk: araçlar + Tamam */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] bg-nb-bg-elevated/80 px-3 py-2.5">
              <div className="flex items-center gap-1">
                {tools.map((t) => (
                  <button key={t.id} type="button"
                    onClick={() => { if (t.id === "image") imgInputRef.current?.click(); else setTool(t.id); }}
                    title={t.label}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold transition ${
                      tool === t.id ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40" : "text-slate-300 hover:bg-white/[0.06]"
                    }`}>
                    <t.icon className="h-4 w-4" /><span className="hidden sm:inline">{t.label}</span>
                  </button>
                ))}
              </div>
              <input ref={imgInputRef} type="file" accept="image/png,image/jpeg" className="hidden"
                onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title={tr ? "Renk" : "Color"}
                className="h-8 w-8 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
              <button type="button" onClick={undo} disabled={annos.length === 0} title={tr ? "Geri al" : "Undo"}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-40">
                <Undo2 className="h-4 w-4" /><span className="hidden sm:inline">{tr ? "Geri Al" : "Undo"}</span>
              </button>
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-1 text-[12px] text-slate-400">
                  <button type="button" onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0} className="rounded-lg p-1.5 hover:bg-white/[0.06] disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="tabular-nums">{pageIndex + 1}/{pageCount}</span>
                  <button type="button" onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))} disabled={pageIndex >= pageCount - 1} className="rounded-lg p-1.5 hover:bg-white/[0.06] disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </div>
                <button type="button" onClick={() => setEditorOpen(false)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-[13px] font-bold text-white transition hover:brightness-110">
                  <Check className="h-4 w-4" />{tr ? "Tamam" : "Done"}
                </button>
                <button type="button" onClick={() => setEditorOpen(false)} aria-label={tr ? "Kapat" : "Close"}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
            </div>

            {/* Sayfa + düzenleme katmanı */}
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <div className="relative mx-auto w-fit rounded-lg bg-white shadow-2xl">
                <canvas ref={canvasRef} className="block rounded-lg" />
                {rendering && <div className="absolute inset-0 flex items-center justify-center bg-black/10"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>}
                <div ref={overlayRef} onClick={onOverlayClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                  className="absolute inset-0"
                  style={{ cursor: tool === "text" ? "text" : tool === "select" ? "default" : "crosshair", touchAction: "none" }}>
                  {pageAnnos.map((a) => {
                    if (a.type === "highlight")
                      return <div key={a.id} className="absolute" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%`, background: a.color, opacity: 0.35 }} />;
                    if (a.type === "image")
                      return <img key={a.id} src={a.dataUrl} alt="" className="absolute object-contain" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }} />;
                    if (a.type === "text")
                      return (
                        <textarea key={a.id} data-anno="1" data-annoid={a.id} value={a.text} onChange={(e) => updateText(a.id, e.target.value)}
                          placeholder={tr ? "yaz…" : "type…"} rows={1}
                          className="absolute resize-none overflow-hidden border border-dashed border-cyan-400/50 bg-transparent leading-tight outline-none placeholder:text-slate-400/60"
                          style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, color: a.color, fontSize: `${a.size * dims.h}px`, minWidth: "40px", width: "auto", fontFamily: "Roboto, system-ui, sans-serif" }} />
                      );
                    return null;
                  })}
                  <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    {pageAnnos.filter((a) => a.type === "pen").map((a) => a.type === "pen" ? (
                      <polyline key={a.id} points={a.points.map((p) => `${p.x * dims.w},${p.y * dims.h}`).join(" ")} fill="none" stroke={a.color} strokeWidth={a.width * dims.w} strokeLinecap="round" strokeLinejoin="round" />
                    ) : null)}
                    {penDraft && penDraft.length > 1 && (
                      <polyline points={penDraft.map((p) => `${p.x * dims.w},${p.y * dims.h}`).join(" ")} fill="none" stroke={color} strokeWidth={0.004 * dims.w} strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                  {draft && tool === "highlight" && (
                    <div className="absolute" style={{ left: `${Math.min(draft.x, draft.x + draft.w) * 100}%`, top: `${Math.min(draft.y, draft.y + draft.h) * 100}%`, width: `${Math.abs(draft.w) * 100}%`, height: `${Math.abs(draft.h) * 100}%`, background: `${color}55` }} />
                  )}
                </div>
              </div>
              <p className="mx-auto mt-3 max-w-md text-center text-[12px] text-slate-500">
                {tr ? "Metin/vurgu/kalem/görsel ekleyin. Bitince «Tamam» deyin, sonra «PDF'i Hazırla»." : "Add text/highlight/pen/image. Click “Done”, then “Prepare PDF”."}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
