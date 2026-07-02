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
  Loader2,
  Pencil,
  Share2,
  ShieldAlert,
  Sparkles,
  Type,
  UploadCloud,
  X,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { editPdfText, type PdfTextEdit } from "../../api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type Tool = "edit" | "add";
type Box = { x: number; y: number; w: number; h: number }; // device px
type TextItem = { x0: number; y0: number; x1: number; y1: number; str: string; size: number }; // PDF pt, top-left
type EditOp = PdfTextEdit & { id: string; original: string };

const uid = () => Math.random().toString(36).slice(2, 9);

export function PdfEditor({ language, accessToken }: { language: Language; accessToken?: string | null }) {
  const tr = language === "tr";
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [scale, setScale] = useState(1); // device px / PDF pt
  const [pageHpt, setPageHpt] = useState(842);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [items, setItems] = useState<TextItem[]>([]);
  const [ops, setOps] = useState<EditOp[]>([]);
  const [tool, setTool] = useState<Tool>("edit");
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [draft, setDraft] = useState<Box | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [shared, setShared] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pageOps = ops.filter((o) => o.page === pageIndex);

  async function pickFile(f: File | undefined) {
    setError(null);
    setResult(null);
    if (!f) return;
    if (f.type !== "application/pdf") { setError(tr ? "Lütfen bir PDF seçin." : "Please choose a PDF."); return; }
    try {
      setFile(f);
      const buf = await f.arrayBuffer();
      const d = await pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
      setDoc(d);
      setPageCount(d.numPages);
      setPageIndex(0);
      setOps([]);
      setEditorOpen(true);
    } catch { setError(tr ? "PDF açılamadı (şifreli olabilir)." : "Couldn't open the PDF (may be encrypted)."); }
  }

  // Sayfayı çiz + metin öğelerini (PDF-nokta, üst-sol) çıkar.
  useEffect(() => {
    if (!doc || !editorOpen) return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const page = await doc.getPage(pageIndex + 1);
        const base = page.getViewport({ scale: 1 });
        const container = overlayRef.current?.parentElement;
        const targetW = Math.min(container?.clientWidth ?? 820, 900);
        const s = targetW / base.width;
        const viewport = page.getViewport({ scale: s });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) return;
        setScale(s);
        setPageHpt(base.height);
        setDims({ w: canvas.width, h: canvas.height });
        // Metin öğeleri
        const content = await page.getTextContent();
        const its: TextItem[] = [];
        for (const it of content.items) {
          const item = it as { str?: string; transform?: number[]; width?: number; height?: number };
          if (typeof item.str !== "string" || !item.str.trim() || !item.transform) continue;
          const e = item.transform[4];
          const f = item.transform[5];
          const h = item.height || Math.hypot(item.transform[1], item.transform[3]) || 10;
          const w = item.width || item.str.length * h * 0.5;
          const topY = base.height - f; // üst-sol origin, baseline
          its.push({ x0: e, y0: topY - h, x1: e + w, y1: topY, str: item.str, size: h });
        }
        if (!cancelled) setItems(its);
      } catch { /* iptal → yoksay */ }
      finally { if (!cancelled) setRendering(false); }
    })();
    return () => { cancelled = true; };
  }, [doc, pageIndex, editorOpen]);

  const norm = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  function extractInBox(boxPt: [number, number, number, number]): { text: string; size: number } {
    const [bx0, by0, bx1, by1] = boxPt;
    const hits = items.filter((it) => {
      const cx = (it.x0 + it.x1) / 2, cy = (it.y0 + it.y1) / 2;
      return cx >= bx0 && cx <= bx1 && cy >= by0 && cy <= by1;
    });
    hits.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    const size = hits.length ? Math.round(hits.reduce((s, h) => s + h.size, 0) / hits.length) : Math.round((by1 - by0) * 0.7);
    return { text: hits.map((h) => h.str).join(" ").replace(/\s+/g, " ").trim(), size: Math.max(8, Math.min(40, size)) };
  }

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).dataset.op) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = norm(e);
    if (tool === "add") {
      // Tıkla → yeni metin kutusu (varsayılan boyut)
      const wPx = 160, hPx = 26;
      const bbox: [number, number, number, number] = [p.x / scale, p.y / scale, (p.x + wPx) / scale, (p.y + hPx) / scale];
      const id = uid();
      setOps((o) => [...o, { id, page: pageIndex, bbox, text: "", size: 14, original: "" }]);
      setTimeout(() => document.querySelector<HTMLTextAreaElement>(`[data-opid="${id}"]`)?.focus(), 20);
    } else {
      setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draft || tool !== "edit") return;
    const p = norm(e);
    setDraft((d) => (d ? { ...d, w: p.x - d.x, h: p.y - d.y } : d));
  }
  function onPointerUp() {
    if (!draft || tool !== "edit") return;
    const x = Math.min(draft.x, draft.x + draft.w), y = Math.min(draft.y, draft.y + draft.h);
    const w = Math.abs(draft.w), h = Math.abs(draft.h);
    setDraft(null);
    if (w < 6 || h < 6) return;
    const bbox: [number, number, number, number] = [x / scale, y / scale, (x + w) / scale, (y + h) / scale];
    const { text, size } = extractInBox(bbox);
    const id = uid();
    setOps((o) => [...o, { id, page: pageIndex, bbox, text, size, original: text }]);
    setTimeout(() => document.querySelector<HTMLTextAreaElement>(`[data-opid="${id}"]`)?.focus(), 20);
  }

  const updateOp = (id: string, text: string) => setOps((o) => o.map((x) => (x.id === id ? { ...x, text } : x)));
  const removeOp = (id: string) => setOps((o) => o.filter((x) => x.id !== id));

  async function preparePdf() {
    if (!file || ops.length === 0) return;
    try {
      setBusy(true);
      const payload: PdfTextEdit[] = ops.map(({ page, bbox, text, size }) => ({ page, bbox, text, size }));
      const blob = await editPdfText(file, payload, accessToken ?? null);
      const filename = `${file.name.replace(/\.pdf$/i, "")}-duzenlenmis.pdf`;
      setResult({ blob, filename });
    } catch (e) {
      setError(e instanceof Error ? e.message : tr ? "PDF hazırlanamadı." : "Couldn't prepare the PDF.");
    } finally { setBusy(false); }
  }

  function downloadResult() {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a"); a.href = url; a.download = result.filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }
  async function shareResult() {
    if (!result) return;
    const f = new File([result.blob], result.filename, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d?: unknown) => boolean };
    if (typeof nav.share === "function" && nav.canShare?.({ files: [f] })) {
      try { await nav.share({ files: [f], title: result.filename }); setShared(true); setTimeout(() => setShared(false), 1600); return; } catch { /* iptal */ }
    }
    downloadResult();
  }
  function reset() { setFile(null); setDoc(null); setOps([]); setResult(null); setError(null); setEditorOpen(false); }

  return (
    <div className="mx-auto w-full max-w-3xl text-left">
      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/25 via-sky-500/20 to-blue-600/20 text-cyan-200 ring-1 ring-cyan-400/30 shadow-[0_0_30px_-8px_rgba(6,182,212,0.6)]"><Pencil className="h-7 w-7" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "PDF Düzenle" : "Edit PDF"}</h1>
            <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">{tr ? "Gerçek metin düzenleme" : "Real text editing"}</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{tr ? "PDF'teki mevcut yazının üstünü seçin, gerçekten silip yerine yenisini yazın." : "Select existing text in the PDF, truly delete it and type a replacement."}</p>
        </div>
      </div>

      {/* Gizlilik uyarısı — bu araç dosyayı sunucuya yükler */}
      <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-[13px] text-amber-200">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p><b>{tr ? "Bu araç farklı:" : "This tool is different:"}</b> {tr ? "Gerçek metin düzenleme için dosyanız güvenli sunucumuzda işlenir (diğer araçlarımız cihazınızda çalışır). Dosya işlem biter bitmez silinir, saklanmaz." : "For real text editing, your file is processed on our secure server (our other tools run on your device). The file is deleted right after processing and never stored."}</p>
      </div>

      {result ? (
        <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"><Check className="h-8 w-8" /></div>
          <p className="mt-4 text-xl font-bold text-white">{tr ? "PDF hazır 🎉" : "Your PDF is ready 🎉"}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={downloadResult} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"><Download className="h-4 w-4" />{tr ? "İndir" : "Download"}</button>
            <button type="button" onClick={() => void shareResult()} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]">{shared ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}{tr ? "Paylaş" : "Share"}</button>
            <button type="button" onClick={() => setEditorOpen(true)} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"><Pencil className="h-4 w-4" />{tr ? "Düzenlemeye Dön" : "Back to Editor"}</button>
            <button type="button" onClick={reset} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]">{tr ? "Yeni PDF" : "New PDF"}</button>
          </div>
        </div>
      ) : !file ? (
        <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); void pickFile(e.dataTransfer.files[0]); }} onClick={() => inputRef.current?.click()}
          className={`group cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed p-12 text-center transition ${dragOver ? "border-cyan-400/70 bg-cyan-400/[0.07]" : "border-white/15 bg-gradient-to-b from-white/[0.03] to-transparent hover:border-cyan-400/40 hover:bg-white/[0.04]"}`}>
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-200 ring-1 ring-white/10 transition group-hover:scale-105"><UploadCloud className="h-9 w-9" /></div>
          <p className="mt-5 text-lg font-bold text-white">{tr ? "Düzenlemek için PDF'i sürükle veya seç" : "Drag or choose a PDF to edit"}</p>
          <p className="mt-1.5 text-[13px] text-slate-400">{tr ? "Editör tam ekran açılır." : "The editor opens full-screen."}</p>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-300"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-100">{file.name}</p><p className="text-[11px] text-slate-500">{ops.length > 0 ? (tr ? `${ops.length} düzenleme · hazır` : `${ops.length} edits · ready`) : (tr ? "Henüz düzenleme yok" : "No edits yet")}</p></div>
            <button type="button" onClick={() => setEditorOpen(true)} className="shrink-0 rounded-lg border border-cyan-400/30 px-3 py-1.5 text-[12px] font-semibold text-cyan-200 transition hover:bg-cyan-500/10">{tr ? "Düzenle" : "Edit"}</button>
            <button type="button" onClick={reset} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white">{tr ? "Yeni" : "New"}</button>
          </div>
          <button type="button" onClick={() => void preparePdf()} disabled={busy || ops.length === 0} className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(6,182,212,0.7)] transition hover:brightness-110 disabled:opacity-40">
            {busy ? <><Loader2 className="h-5 w-5 animate-spin" />{tr ? "Hazırlanıyor…" : "Preparing…"}</> : <><Sparkles className="h-5 w-5" />{tr ? "PDF'i Hazırla" : "Prepare PDF"} →</>}
          </button>
        </div>
      )}

      {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}

      {editorOpen && doc && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#0b1020]/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] bg-nb-bg-elevated/80 px-3 py-2.5">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setTool("edit")} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold transition ${tool === "edit" ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40" : "text-slate-300 hover:bg-white/[0.06]"}`}><Pencil className="h-4 w-4" /><span className="hidden sm:inline">{tr ? "Metni Değiştir" : "Replace Text"}</span></button>
              <button type="button" onClick={() => setTool("add")} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold transition ${tool === "add" ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40" : "text-slate-300 hover:bg-white/[0.06]"}`}><Type className="h-4 w-4" /><span className="hidden sm:inline">{tr ? "Metin Ekle" : "Add Text"}</span></button>
            </div>
            <span className="hidden text-[11px] text-slate-500 sm:inline">{tool === "edit" ? (tr ? "· Değiştirmek istediğin yazının üstüne kutu çiz" : "· Draw a box over the text to replace") : (tr ? "· Metin eklemek için tıkla" : "· Click to add text")}</span>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1 text-[12px] text-slate-400">
                <button type="button" onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0} className="rounded-lg p-1.5 hover:bg-white/[0.06] disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <span className="tabular-nums">{pageIndex + 1}/{pageCount}</span>
                <button type="button" onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))} disabled={pageIndex >= pageCount - 1} className="rounded-lg p-1.5 hover:bg-white/[0.06] disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-[13px] font-bold text-white transition hover:brightness-110"><Check className="h-4 w-4" />{tr ? "Tamam" : "Done"}</button>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label={tr ? "Kapat" : "Close"} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="relative mx-auto w-fit rounded-lg bg-white shadow-2xl">
              <canvas ref={canvasRef} className="block rounded-lg" />
              {rendering && <div className="absolute inset-0 flex items-center justify-center bg-black/10"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>}
              <div ref={overlayRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="absolute inset-0" style={{ cursor: tool === "add" ? "text" : "crosshair", touchAction: "none" }}>
                {pageOps.map((o) => {
                  const left = o.bbox[0] * scale, top = o.bbox[1] * scale, w = (o.bbox[2] - o.bbox[0]) * scale, h = (o.bbox[3] - o.bbox[1]) * scale;
                  return (
                    <div key={o.id} data-op="1" className="absolute" style={{ left, top, width: Math.max(w, 40), height: Math.max(h, 20) }}>
                      <div className="absolute inset-0 rounded-sm border border-cyan-500/70 bg-white" />
                      <textarea data-opid={o.id} data-op="1" value={o.text} onChange={(e) => updateOp(o.id, e.target.value)} placeholder={tr ? "(silmek için boş bırak)" : "(leave empty to delete)"}
                        className="absolute inset-0 resize-none bg-transparent leading-tight text-black outline-none placeholder:text-slate-400"
                        style={{ fontSize: `${o.size * scale}px`, fontFamily: "Roboto, system-ui, sans-serif", padding: "1px 2px" }} />
                      <button type="button" data-op="1" onClick={() => removeOp(o.id)} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow"><X className="h-3 w-3" /></button>
                    </div>
                  );
                })}
                {draft && tool === "edit" && (
                  <div className="absolute border-2 border-cyan-400 bg-cyan-400/20" style={{ left: Math.min(draft.x, draft.x + draft.w), top: Math.min(draft.y, draft.y + draft.h), width: Math.abs(draft.w), height: Math.abs(draft.h) }} />
                )}
              </div>
            </div>
            <p className="mx-auto mt-3 max-w-md text-center text-[12px] text-slate-500">{tr ? "Yazının üstüne kutu çiz → kutu içindeki metin gelir → değiştir. Boş bırakırsan silinir. «Tamam» → «PDF'i Hazırla»." : "Draw a box over text → it's captured → edit it. Leave empty to delete. “Done” → “Prepare PDF”."}</p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
