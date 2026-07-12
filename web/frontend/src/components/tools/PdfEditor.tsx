import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved -- Vite ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  Check,
  Download,
  FileText,
  Loader2,
  Move,
  Pencil,
  Share2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Type,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import {
  analyzePdf,
  editPdfText,
  saveBlobToUser,
  type PdfAnalysis,
  type PdfElement,
  type PdfTextEdit,
} from "../../api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const uid = () => Math.random().toString(36).slice(2, 9);
type FontKey = "sans" | "serif" | "mono" | "lato" | "montserrat" | "merriweather" | "oswald";
type Edit = { text?: string; deleted?: boolean; size?: number; color?: string; font?: FontKey };
type Added = { id: string; page: number; bbox: [number, number, number, number]; text: string; size: number; color: string; font: FontKey };

const FONT_CSS: Record<FontKey, string> = {
  sans: "Roboto, system-ui, sans-serif",
  serif: "'Noto Serif', Georgia, serif",
  mono: "'Roboto Mono', ui-monospace, monospace",
  lato: "Lato, system-ui, sans-serif",
  montserrat: "Montserrat, system-ui, sans-serif",
  merriweather: "Merriweather, Georgia, serif",
  oswald: "Oswald, 'Arial Narrow', sans-serif",
};
const FONT_LABEL: Record<FontKey, string> = {
  sans: "Roboto", serif: "Noto Serif", mono: "Roboto Mono",
  lato: "Lato", montserrat: "Montserrat", merriweather: "Merriweather", oswald: "Oswald",
};
// Baseline'ı orijinaline oturtmak için: bir metin öğesinin taban çizgisi (origin.y)
// bilinmiyorsa yaklaşık ascent oranı (Roboto ~0.80). Font-family bazında ufak farklar
// olsa da göze batmaz; asıl hiza gerçek "by" değeriyle sağlanır.
const ASCENT_RATIO = 0.8;
// Hazır renk paleti — hızlı seçim.
const PRESET_COLORS = ["#111111", "#ffffff", "#e11d48", "#f59e0b", "#16a34a", "#2563eb", "#7c3aed", "#0891b2", "#6b7280", "#000000"];

/** Otomatik-genişleyen düzenlenebilir metin (contentEditable) — orijinal boyutu korur,
 * kutu içeriğe göre büyür (kırpmaz). Kontrolsüz: metin bir kez ayarlanır. */
function AutoText({ id, initial, className, style, onInput, onClick, onFocus, autoFocus }: {
  id: string; initial: string; className?: string; style?: React.CSSProperties;
  onInput: (t: string) => void; onClick: (e: React.MouseEvent) => void; onFocus: () => void; autoFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = initial;
    if (autoFocus) {
      el.focus();
      // İmleci metnin sonuna taşı
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selc = window.getSelection();
      selc?.removeAllRanges();
      selc?.addRange(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} data-tid={id} data-op="1" contentEditable suppressContentEditableWarning role="textbox"
      onInput={() => onInput(ref.current?.textContent ?? "")}
      onClick={onClick} onFocus={onFocus}
      className={className}
      style={{ whiteSpace: "pre", display: "inline-block", minWidth: "6px", ...style }} />
  );
}

export function PdfEditor({ language, accessToken }: { language: Language; accessToken?: string | null }) {
  const tr = language === "tr";
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [analysis, setAnalysis] = useState<PdfAnalysis | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [current, setCurrent] = useState(0);
  const [scale, setScale] = useState(1);
  // Kullanıcı yakınlaştırma faktörü — 1 = sayfayı genişliğe sığdır ("100%").
  const [zoom, setZoom] = useState(1);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [edits, setEdits] = useState<Map<string, Edit>>(new Map());
  const [added, setAdded] = useState<Added[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(14);
  const [font, setFont] = useState<FontKey>("sans");
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [shared, setShared] = useState(false);
  // Öğe id → örneklenen arka plan rengi (#RRGGBB). Silgi/redaction bu renkle doldurulur
  // (beyaz varsayım yerine) → kırmızı/siyah/resimli zeminde beyaz kutu kalmaz.
  const [bgMap, setBgMap] = useState<Map<string, string>>(new Map());
  // Eklenen metni serbest sürükleme (taşıma tutamacı).
  const [drag, setDrag] = useState<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);

  // Editör font seçenekleri — önizleme gömülü TTF'lerle birebir olsun diye webfont'ları
  // yükle (yalnız editör açılınca, glyph kullanılınca iner). Her rotada çalışır.
  useEffect(() => {
    const id = "pdf-editor-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&family=Noto+Serif:wght@400;600&family=Lato:wght@400;700&family=Montserrat:wght@400;600;700&family=Merriweather:wght@400;700&family=Oswald:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pageEls = analysis?.pages[current]?.elements ?? [];
  const pageAdded = added.filter((a) => a.page === current);
  const editCount = edits.size + added.length;
  // Taranmış PDF: hiç metin katmanı yok (yalnız görsel) → var olan yazı düzenlenemez.
  const scanned = !!analysis && !analysis.pages.some((p) => p.elements.some((e) => e.type === "text"));

  async function pickFile(f: File | undefined) {
    setError(null);
    setResult(null);
    if (!f) return;
    if (f.type !== "application/pdf") { setError(tr ? "Lütfen bir PDF seçin." : "Please choose a PDF."); return; }
    try {
      setFile(f);
      setLoadingMsg(tr ? "Belge analiz ediliyor…" : "Analyzing document…");
      const buf = await f.arrayBuffer();
      const [d, a] = await Promise.all([
        pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise,
        analyzePdf(f, accessToken ?? null),
      ]);
      setDoc(d);
      setAnalysis(a);
      setPageCount(d.numPages);
      setCurrent(0);
      setEdits(new Map());
      setAdded([]);
      setEditorOpen(true);
    } catch (e) {
      setFile(null);
      setError(e instanceof Error ? e.message : tr ? "PDF açılamadı." : "Couldn't open the PDF.");
    } finally { setLoadingMsg(null); }
  }

  // Thumbnail'ler (küçük render).
  useEffect(() => {
    if (!doc || !editorOpen) return;
    let alive = true;
    (async () => {
      const out: string[] = [];
      for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
        if (!alive) return;
        try {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 0.2 });
          const c = document.createElement("canvas");
          c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
          const ctx = c.getContext("2d");
          if (ctx) { await page.render({ canvasContext: ctx, viewport: vp }).promise; out[i - 1] = c.toDataURL("image/jpeg", 0.6); }
          if (alive) setThumbs([...out]);
        } catch { /* atla */ }
      }
    })();
    return () => { alive = false; };
  }, [doc, editorOpen]);

  // Aktif sayfayı büyük çiz.
  useEffect(() => {
    if (!doc || !editorOpen) return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const page = await doc.getPage(current + 1);
        const base = page.getViewport({ scale: 1 });
        const container = overlayRef.current?.parentElement?.parentElement;
        const availW = Math.min((container?.clientWidth ?? 700) - 24, 820);
        // Sayfayı genişliğe sığdır (fit) × kullanıcı zoom faktörü.
        const fit = Math.max(0.4, availW / base.width);
        const s = fit * zoom;
        const vp = page.getViewport({ scale: s });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (!cancelled) { setScale(s); setDims({ w: canvas.width, h: canvas.height }); }
      } catch { /* iptal */ }
      finally { if (!cancelled) setRendering(false); }
    })();
    return () => { cancelled = true; };
  }, [doc, current, editorOpen, zoom]);

  const setEdit = useCallback((id: string, patch: Edit) => {
    setEdits((m) => { const n = new Map(m); n.set(id, { ...n.get(id), ...patch }); return n; });
  }, []);
  const clearEdit = (id: string) => setEdits((m) => { const n = new Map(m); n.delete(id); return n; });

  function elText(el: PdfElement): string { return edits.get(el.id)?.text ?? el.text ?? ""; }
  function elColor(el: PdfElement): string { return edits.get(el.id)?.color ?? el.color ?? "#111111"; }
  function elSize(el: PdfElement): number { return edits.get(el.id)?.size ?? el.size ?? 12; }
  function elFont(el: PdfElement): FontKey { return edits.get(el.id)?.font ?? "sans"; }
  const isDeleted = (id: string) => edits.get(id)?.deleted === true;
  const bgFor = (id: string) => bgMap.get(id) ?? "#ffffff";

  /** Canvas'tan öğe bbox'ının çevresindeki baskın rengi örnekle → silgi/redaction fill.
   * Metin gövdesi yerine kenar/dış-halka noktalarından örnekler (glyph'e denk gelmesin),
   * en sık görülen rengi (mode) döndürür → düz zeminde birebir, resimde en iyi tahmin. */
  function sampleBgColor(x0: number, y0: number, x1: number, y1: number): string {
    const cv = canvasRef.current;
    if (!cv) return "#ffffff";
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "#ffffff";
    const L = Math.round(x0 * scale), T = Math.round(y0 * scale);
    const R = Math.round(x1 * scale), B = Math.round(y1 * scale);
    const m = 2;
    const pts: Array<[number, number]> = [];
    for (let i = 1; i <= 3; i++) { const fx = L + ((R - L) * i) / 4; pts.push([fx, T - m], [fx, B + m]); }
    for (let i = 1; i <= 3; i++) { const fy = T + ((B - T) * i) / 4; pts.push([L - m, fy], [R + m, fy]); }
    pts.push([L, T], [R, T], [L, B], [R, B]);
    const counts = new Map<string, number>();
    for (const [px, py] of pts) {
      if (px < 0 || py < 0 || px >= cv.width || py >= cv.height) continue;
      const d = ctx.getImageData(px, py, 1, 1).data;
      const key = `${d[0]},${d[1]},${d[2]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best = "255,255,255", bc = 0;
    for (const [k, c] of counts) if (c > bc) { bc = c; best = k; }
    const [r, g, b] = best.split(",").map(Number);
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  // Sürükleme sürerken pencere düzeyinde takip et → eklenen metin serbestçe konumlanır.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - drag.sx) / scale;
      const dy = (e.clientY - drag.sy) / scale;
      setAdded((arr) => arr.map((x) => {
        if (x.id !== drag.id) return x;
        const w = x.bbox[2] - x.bbox[0], h = x.bbox[3] - x.bbox[1];
        const nx = Math.max(0, drag.ox + dx), ny = Math.max(0, drag.oy + dy);
        return { ...x, bbox: [nx, ny, nx + w, ny + h] };
      }));
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [drag, scale]);

  function ensureBg(el: PdfElement) {
    if (bgMap.has(el.id)) return;
    const c = sampleBgColor(el.bbox[0], el.bbox[1], el.bbox[2], el.bbox[3]);
    setBgMap((mp) => { const n = new Map(mp); n.set(el.id, c); return n; });
  }

  function selectEl(el: PdfElement) {
    setSelected(el.id);
    setAddMode(false);
    ensureBg(el);
    if (el.type === "text") { setColor(elColor(el)); setSize(Math.round(elSize(el))); setFont(elFont(el)); }
  }
  function applyFont(fk: FontKey) {
    setFont(fk);
    if (!selected) return;
    if (pageAdded.find((a) => a.id === selected)) setAdded((a) => a.map((x) => (x.id === selected ? { ...x, font: fk } : x)));
    else setEdit(selected, { font: fk });
  }

  // Klavye ile silme: bir GÖRSEL seçiliyken Delete/Backspace → hemen sil (beyazla kapat).
  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const editing = tag === "textarea" || tag === "input" || (document.activeElement as HTMLElement)?.isContentEditable;
      if (editing || !selected) return;
      const el = analysis?.pages[current]?.elements.find((x) => x.id === selected);
      if (el?.type === "image") { e.preventDefault(); setEdit(el.id, { deleted: true }); setSelected(null); }
      else if (pageAdded.find((a) => a.id === selected)) { e.preventDefault(); setAdded((a) => a.filter((x) => x.id !== selected)); setSelected(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, selected, current, analysis, pageAdded]);

  function onCanvasClick(e: React.MouseEvent) {
    if (!addMode) return;
    const r = overlayRef.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
    const id = uid();
    setAdded((a) => [...a, { id, page: current, bbox: [x, y, x + 140, y + size + 4], text: "", size, color, font }]);
    setSelected(id);
    setTimeout(() => document.querySelector<HTMLTextAreaElement>(`[data-tid="${id}"]`)?.focus(), 20);
  }

  const selInfo = (() => {
    if (!selected) return null;
    const el = pageEls.find((x) => x.id === selected);
    if (el) return { kind: el.type, isAdded: false };
    if (pageAdded.find((a) => a.id === selected)) return { kind: "text" as const, isAdded: true };
    return null;
  })();

  function applyColor(c: string) {
    setColor(c);
    if (!selected) return;
    if (pageAdded.find((a) => a.id === selected)) setAdded((a) => a.map((x) => (x.id === selected ? { ...x, color: c } : x)));
    else setEdit(selected, { color: c });
  }
  function applySize(s: number) {
    setSize(s);
    if (!selected) return;
    if (pageAdded.find((a) => a.id === selected)) setAdded((a) => a.map((x) => (x.id === selected ? { ...x, size: s } : x)));
    else setEdit(selected, { size: s });
  }
  async function preparePdf() {
    if (!file) return;
    const ops: PdfTextEdit[] = [];
    // Sayfa numarasını element id'sinden çöz (t{page}_{i} / i{page}_{i}).
    const pageOf = (id: string) => { const m = /^[ti](\d+)_/.exec(id); return m ? parseInt(m[1], 10) : 0; };
    for (const [id, ed] of edits) {
      const p = pageOf(id);
      const el = analysis?.pages[p]?.elements.find((x) => x.id === id);
      if (!el) continue;
      const bg = bgMap.get(id);
      const by = el.by;
      if (ed.deleted) ops.push({ page: p, bbox: el.bbox, text: "", size: ed.size ?? el.size ?? 12, color: ed.color ?? el.color, font: ed.font ?? "sans", bg, by });
      else if (ed.text !== undefined && ed.text !== el.text)
        ops.push({ page: p, bbox: el.bbox, text: ed.text, size: ed.size ?? el.size ?? 12, color: ed.color ?? el.color, font: ed.font ?? "sans", bg, by });
      else if (ed.color || ed.size || ed.font)
        ops.push({ page: p, bbox: el.bbox, text: el.text ?? "", size: ed.size ?? el.size ?? 12, color: ed.color ?? el.color, font: ed.font ?? "sans", bg, by });
    }
    for (const a of added) if (a.text.trim()) ops.push({ page: a.page, bbox: a.bbox, text: a.text, size: a.size, color: a.color, font: a.font });
    if (ops.length === 0) { setError(tr ? "Henüz bir düzenleme yapmadınız." : "No edits yet."); return; }
    try {
      setBusy(true);
      const blob = await editPdfText(file, ops, accessToken ?? null);
      setResult({ blob, filename: `${file.name.replace(/\.pdf$/i, "")}-duzenlenmis.pdf` });
    } catch (e) { setError(e instanceof Error ? e.message : tr ? "Hazırlanamadı." : "Failed."); }
    finally { setBusy(false); }
  }

  function downloadResult() {
    if (!result) return;
    // İndirme konumunu sorar (destekleyen tarayıcıda); değilse klasik indirmeye düşer.
    void saveBlobToUser(result.blob, result.filename).catch(() => {});
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
  function reset() { setFile(null); setDoc(null); setAnalysis(null); setEdits(new Map()); setAdded([]); setResult(null); setError(null); setEditorOpen(false); setThumbs([]); setZoom(1); }

  return (
    <div className="mx-auto w-full max-w-3xl text-left">
      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/25 via-sky-500/20 to-blue-600/20 text-cyan-200 ring-1 ring-cyan-400/30 shadow-[0_0_30px_-8px_rgba(6,182,212,0.6)]"><Pencil className="h-7 w-7" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "PDF Düzenle" : "Edit PDF"}</h1>
            <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">{tr ? "Tam düzenleme" : "Full editing"}</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{tr ? "Her yazıya ve görsele tıklayıp düzenleyin, silin, renk/boyut değiştirin — gerçek düzenleme." : "Click any text or image to edit, delete, or change color/size — real editing."}</p>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-[13px] text-amber-200">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p><b>{tr ? "Bu araç farklı:" : "Different tool:"}</b> {tr ? "Gerçek düzenleme için dosyanız güvenli sunucumuzda işlenir (diğer araçlar cihazınızda), işlem biter bitmez silinir." : "For real editing, your file is processed on our secure server (other tools run on your device) and deleted right after."}</p>
      </div>

      {scanned && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-orange-400/30 bg-orange-500/[0.08] px-4 py-3 text-[13px] text-orange-200">
          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{tr
            ? "Bu PDF taranmış görünüyor: sayfalar resim, düzenlenecek metin katmanı yok. Mevcut yazılar resmin parçası olduğu için metin olarak düzeltilemez. Yine de görselleri silebilir ve «Metin Ekle» ile üzerine yeni yazı ekleyebilirsiniz."
            : "This PDF looks scanned: pages are images with no text layer. Existing words are part of the image and can't be edited as text. You can still delete images and add new text with «Add Text»."}</p>
        </div>
      )}

      {result ? (
        <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"><Check className="h-8 w-8" /></div>
          <p className="mt-4 text-xl font-bold text-white">{tr ? "PDF hazır 🎉" : "Ready 🎉"}</p>
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
          <p className="mt-1.5 text-[13px] text-slate-400">{tr ? "Tam ekran editör açılır — sol sayfalar, sağ düzenleme." : "A full-screen editor opens — pages on the left, editing on the right."}</p>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-300"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-100">{file.name}</p><p className="text-[11px] text-slate-500">{editCount > 0 ? (tr ? `${editCount} düzenleme · hazır` : `${editCount} edits · ready`) : (tr ? "Henüz düzenleme yok" : "No edits yet")}</p></div>
            <button type="button" onClick={() => setEditorOpen(true)} className="shrink-0 rounded-lg border border-cyan-400/30 px-3 py-1.5 text-[12px] font-semibold text-cyan-200 transition hover:bg-cyan-500/10">{tr ? "Düzenle" : "Edit"}</button>
            <button type="button" onClick={reset} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white">{tr ? "Yeni" : "New"}</button>
          </div>
          <button type="button" onClick={() => void preparePdf()} disabled={busy || editCount === 0} className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(6,182,212,0.7)] transition hover:brightness-110 disabled:opacity-40">
            {busy ? <><Loader2 className="h-5 w-5 animate-spin" />{tr ? "Hazırlanıyor…" : "Preparing…"}</> : <><Sparkles className="h-5 w-5" />{tr ? "PDF'i Hazırla" : "Prepare PDF"} →</>}
          </button>
        </div>
      )}

      {loadingMsg && <p className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] px-4 py-2.5 text-[13px] text-cyan-200"><Loader2 className="h-4 w-4 animate-spin" />{loadingMsg}</p>}
      {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}

      {editorOpen && doc && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#0b1020]/97 backdrop-blur-sm">
          {/* Üst araç çubuğu */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] bg-nb-bg-elevated/80 px-3 py-2.5">
            <button type="button" onClick={() => { setAddMode((v) => !v); setSelected(null); }} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold transition ${addMode ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40" : "text-slate-300 hover:bg-white/[0.06]"}`}><Type className="h-4 w-4" /><span className="hidden sm:inline">{tr ? "Metin Ekle" : "Add Text"}</span></button>
            {selInfo?.kind === "text" && (
              <>
                <span className="mx-1 h-5 w-px bg-white/10" />
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-300">
                  {tr ? "Renk" : "Color"}
                  <span className="flex items-center gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => applyColor(c)} title={c}
                        className={`h-5 w-5 rounded-md border transition hover:scale-110 ${color.toLowerCase() === c.toLowerCase() ? "border-white ring-2 ring-cyan-400" : "border-white/20"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </span>
                  <input type="color" value={color} onChange={(e) => applyColor(e.target.value)} className="h-7 w-7 cursor-pointer rounded-lg border border-white/10 bg-transparent" title={tr ? "Özel renk" : "Custom color"} />
                </label>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-300">
                  {tr ? "Font" : "Font"}
                  <select value={font} onChange={(e) => applyFont(e.target.value as FontKey)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-white">
                    {(["sans", "serif", "mono", "lato", "montserrat", "merriweather", "oswald"] as FontKey[]).map((f) => <option key={f} value={f} className="text-black" style={{ fontFamily: FONT_CSS[f] }}>{FONT_LABEL[f]}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-300">
                  {tr ? "Boyut" : "Size"}
                  <input type="number" min={6} max={72} value={size} onChange={(e) => applySize(Math.max(6, Math.min(72, +e.target.value || 12)))} className="w-14 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-white" />
                </label>
              </>
            )}
            <div className="ml-auto flex items-center gap-3">
              {/* Yakınlaştırma — görsel seçicideki gibi */}
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-1.5 py-1">
                <button type="button" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.2) * 100) / 100))} title={tr ? "Uzaklaştır" : "Zoom out"} aria-label={tr ? "Uzaklaştır" : "Zoom out"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"><ZoomOut className="h-4 w-4" /></button>
                <input type="range" min={50} max={300} step={10} value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} className="hidden w-24 accent-cyan-400 sm:block" aria-label={tr ? "Yakınlaştırma" : "Zoom"} />
                <button type="button" onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.2) * 100) / 100))} title={tr ? "Yakınlaştır" : "Zoom in"} aria-label={tr ? "Yakınlaştır" : "Zoom in"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"><ZoomIn className="h-4 w-4" /></button>
                <button type="button" onClick={() => setZoom(1)} title={tr ? "Genişliğe sığdır" : "Fit to width"} className="min-w-[3rem] rounded-lg px-1.5 py-1 text-center text-[12px] font-semibold tabular-nums text-slate-200 transition hover:bg-white/10">{Math.round(zoom * 100)}%</button>
              </div>
              <span className="hidden text-[12px] font-semibold text-slate-300 md:inline">{tr ? "Öğeye tıkla → düzenle. Görsel/amblem seçip Delete → sil" : "Click to edit. Select image + Delete key → remove"} · <span className="text-cyan-300">{editCount} {tr ? "değişiklik" : "edits"}</span></span>
              <button type="button" onClick={() => setEditorOpen(false)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-[13px] font-bold text-white transition hover:brightness-110"><Check className="h-4 w-4" />{tr ? "Tamam" : "Done"}</button>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label={tr ? "Kapat" : "Close"} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Sol: sayfa thumbnail'leri */}
            <div className="w-28 shrink-0 overflow-y-auto border-r border-white/[0.08] bg-black/20 p-2 sm:w-32">
              {Array.from({ length: pageCount }).map((_, i) => (
                <button key={i} type="button" onClick={() => { setCurrent(i); setSelected(null); }}
                  className={`mb-2 block w-full overflow-hidden rounded-lg border-2 transition ${current === i ? "border-cyan-400" : "border-transparent hover:border-white/20"}`}>
                  {thumbs[i] ? <img src={thumbs[i]} alt={`${i + 1}`} className="w-full bg-white" /> : <div className="flex h-24 w-full items-center justify-center bg-white/5 text-[10px] text-slate-500">{i + 1}</div>}
                  <span className={`block py-0.5 text-center text-[10px] ${current === i ? "text-cyan-300" : "text-slate-500"}`}>{i + 1}</span>
                </button>
              ))}
            </div>

            {/* Sağ: büyük düzenleme alanı */}
            <div className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">
              <div className="relative mx-auto w-fit rounded-lg bg-white shadow-2xl">
                <canvas ref={canvasRef} className="block rounded-lg" />
                {rendering && <div className="absolute inset-0 flex items-center justify-center bg-black/10"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>}
                <div ref={overlayRef} onClick={onCanvasClick} className="absolute inset-0" style={{ cursor: addMode ? "text" : "default" }}>
                  {/* Mevcut öğeler */}
                  {pageEls.map((el) => {
                    const [x0, y0, x1, y1] = el.bbox;
                    const del = isDeleted(el.id);
                    const sel = selected === el.id;
                    if (el.type === "image") {
                      const style = { left: x0 * scale, top: y0 * scale, width: Math.max((x1 - x0) * scale, 8), height: Math.max((y1 - y0) * scale, 8) } as const;
                      // Silinmiş görsel → arka plan rengiyle kapat. Silgiyi bbox'tan ~3px taşır:
                      // amblem/logo kenarındaki ince hat çizgileri de örtülsün (indirmede zaten yok).
                      if (del) return <div key={el.id} onClick={(e) => { e.stopPropagation(); clearEdit(el.id); }} className="absolute cursor-pointer ring-1 ring-dashed ring-slate-300" style={{ left: style.left - 3, top: style.top - 3, width: style.width + 6, height: style.height + 6, backgroundColor: bgFor(el.id) }} title={tr ? "Silindi — geri almak için tıkla" : "Deleted — click to undo"} />;
                      return (
                        <div key={el.id} onClick={(e) => { e.stopPropagation(); selectEl(el); }} className={`absolute cursor-pointer rounded-sm ${sel ? "ring-2 ring-cyan-500 bg-cyan-500/10" : "hover:ring-2 hover:ring-cyan-400/70 hover:bg-cyan-400/5"}`} style={style} title={tr ? "Görsel — seç, sonra sil" : "Image — select, then delete"}>
                          {sel && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEdit(el.id, { deleted: true }); setSelected(null); }}
                              className="absolute -right-2.5 -top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                              title={tr ? "Sil" : "Delete"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    }
                    // Metin öğesi. Silgi kutusu = ORİJİNAL bbox (metin kısalıp temizlense de
                    // alttaki orijinal asla görünmesin). Boyut, içerikten BAĞIMSIZ.
                    const eb = { left: x0 * scale, top: y0 * scale, width: Math.max((x1 - x0) * scale, 4), height: Math.max((y1 - y0) * scale, 6) } as const;
                    if (del) {
                      // Silinmiş metin → orijinali arka plan rengiyle kapat, düzenleme yok (tıkla → geri al)
                      return <div key={el.id} onClick={(e) => { e.stopPropagation(); clearEdit(el.id); }} className="absolute cursor-pointer ring-1 ring-dashed ring-slate-300/70" style={{ ...eb, backgroundColor: bgFor(el.id) }} title={tr ? "Silindi — geri almak için tıkla" : "Deleted — click to undo"} />;
                    }
                    // Değişmemiş VE seçili değil → sadece şeffaf tıklama hedefi; canvas'taki
                    // NET orijinal metin görünür (üstüne HTML yazı basmıyoruz → çift görüntü yok).
                    const active = sel || edits.has(el.id);
                    if (!active) {
                      return <div key={el.id} onClick={(e) => { e.stopPropagation(); selectEl(el); }} className="absolute cursor-text rounded-[2px] transition hover:bg-cyan-400/10 hover:ring-1 hover:ring-cyan-400/50" style={eb} title={tr ? "Düzenlemek için tıkla" : "Click to edit"} />;
                    }
                    // Aktif (seçili ya da düzenlenmiş) → orijinali TAM kapla + düzenlenebilir katman üstte.
                    // Metni GERÇEK taban çizgisine (by) hizala → "bir tık aşağı" kayması biter,
                    // önizleme indirilen PDF ile birebir.
                    const fsPx = elSize(el) * scale;
                    const baselinePt = el.by ?? (y0 + (el.size ?? 12));
                    const textTop = (baselinePt - y0) * scale - ASCENT_RATIO * fsPx;
                    return (
                      <div key={el.id} className="absolute" style={{ left: eb.left, top: eb.top }}>
                        <div className="absolute" style={{ left: -1, top: -1, width: eb.width + 2, height: eb.height + 2, backgroundColor: bgFor(el.id) }} />
                        <AutoText id={el.id} initial={elText(el)} autoFocus={sel && !edits.has(el.id)}
                          onInput={(t) => setEdit(el.id, { text: t })}
                          onClick={(e) => { e.stopPropagation(); selectEl(el); }}
                          onFocus={() => selectEl(el)}
                          className={`outline-none ${sel ? "ring-2 ring-cyan-500" : ""}`}
                          style={{ position: "absolute", left: 0, top: textTop, color: elColor(el), fontSize: `${fsPx}px`, lineHeight: 1, fontFamily: FONT_CSS[elFont(el)], padding: 0, backgroundColor: bgFor(el.id) }} />
                      </div>
                    );
                  })}
                  {/* Eklenen metinler — serbest sürüklenebilir (taşıma tutamacı) */}
                  {pageAdded.map((a) => {
                    const [x0, y0] = a.bbox;
                    const sel = selected === a.id;
                    return (
                      <div key={a.id} className="absolute" style={{ left: x0 * scale, top: y0 * scale }}>
                        {sel && (
                          <>
                            <span
                              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); setDrag({ id: a.id, sx: e.clientX, sy: e.clientY, ox: x0, oy: y0 }); }}
                              style={{ touchAction: "none" }}
                              className="absolute -top-7 left-0 z-10 inline-flex cursor-move touch-none items-center gap-1 rounded-md bg-cyan-600 px-2 py-1 text-[11px] font-bold text-white shadow-lg select-none"
                              title={tr ? "Sürükleyerek taşı" : "Drag to move"}
                            >
                              <Move className="h-3.5 w-3.5" />{tr ? "Taşı" : "Move"}
                            </span>
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); setAdded((arr) => arr.filter((x) => x.id !== a.id)); setSelected(null); }}
                              className="absolute -top-7 left-[4.2rem] z-10 inline-flex h-[26px] w-[26px] items-center justify-center rounded-md bg-red-500 text-white shadow-lg"
                              title={tr ? "Sil" : "Delete"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <AutoText id={a.id} initial={a.text}
                          onInput={(t) => setAdded((arr) => arr.map((x) => (x.id === a.id ? { ...x, text: t } : x)))}
                          onClick={(e) => { e.stopPropagation(); setSelected(a.id); setColor(a.color); setSize(a.size); setFont(a.font); setAddMode(false); }}
                          onFocus={() => { setSelected(a.id); setColor(a.color); setSize(a.size); setFont(a.font); }}
                          className={`bg-white/90 leading-none outline-none ${sel ? "ring-2 ring-cyan-500" : "ring-1 ring-cyan-400/50"}`}
                          style={{ position: "absolute", left: 0, top: 0, color: a.color, fontSize: `${a.size * scale}px`, fontFamily: FONT_CSS[a.font], padding: 0 }} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mx-auto mt-3 max-w-lg text-center text-[12px] text-slate-500">{tr ? "Yazıya tıkla → değiştir; renk/boyut üstte. Görsele/amblem'e tıkla → «Sil» butonu. «Metin Ekle» ile yeni yazı. Bitince «Tamam» → «PDF'i Hazırla»." : "Click text → edit; color/size on top. Click an image → «Delete» button. «Add Text» for new text. «Done» → «Prepare PDF»."}</p>
              <p className="mx-auto mt-1.5 max-w-lg text-center text-[11px] text-amber-300/70">{tr ? "Not: Bir yazıyı düzenlerken beliren kapatma kutusu üst/alt çizgilere taşabilir — bu yalnızca önizlemedir; indirdiğiniz PDF'te o çizgiler korunur." : "Note: while editing a line, the cover box may overlap the lines above/below — this is preview only; those lines are kept in the downloaded PDF."}</p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
