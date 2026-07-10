import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved -- Vite ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  Calendar,
  Download,
  Layers,
  Loader2,
  PenLine,
  RotateCw,
  Trash2,
  Type as TypeIcon,
  Upload,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { applySignatures, pdfBytesToBlob, type SignatureItem } from "../../lib/clientPdf";
import { saveBlobToUser } from "../../api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type SigSource = { dataUrl: string; bytes: Uint8Array; aspect: number };
type Placement = SigSource & {
  id: string;
  page: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  /** Metin/tarih alanı ise dolu; imza görselinde undefined. Düzenlenebilir. */
  text?: string;
  color?: string;
  opacity?: number; // 0..1 (varsayılan 1)
  rotation?: number; // ekran saat yönü derece (varsayılan 0)
};
type Drag =
  | { id: string; mode: "move"; sx: number; sy: number; ox: number; oy: number }
  | { id: string; mode: "resize"; sx: number; ow: number }
  | { id: string; mode: "rotate"; cx: number; cy: number }
  | null;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Metin/tarih alanını yüksek çözünürlüklü şeffaf PNG'ye çizer (Türkçe tam destekli). */
function renderTextToPng(text: string, color = "#0b2447"): SigSource {
  const t = text && text.trim() ? text : " ";
  const scale = 3;
  const fontPx = 40;
  const font = `600 ${fontPx}px "Segoe UI", Arial, "Helvetica Neue", sans-serif`;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const w = Math.ceil(measure.measureText(t).width) + 24;
  const h = Math.ceil(fontPx * 1.5);
  const c = document.createElement("canvas");
  c.width = Math.max(1, w * scale);
  c.height = Math.max(1, h * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillText(t, 12, h / 2);
  const dataUrl = c.toDataURL("image/png");
  return { dataUrl, bytes: dataUrlToBytes(dataUrl), aspect: w / h };
}

function todayStr(): string {
  return new Date().toLocaleDateString();
}

/** Metin/tarih alanı renk seçenekleri (lacivert, siyah, kırmızı, mavi, yeşil, beyaz). */
const TEXT_COLORS = ["#0b2447", "#111827", "#dc2626", "#2563eb", "#16a34a", "#ffffff"];

export function PdfSign({ language }: { language: Language; accessToken?: string | null }) {
  const tr = language === "tr";
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [srcBytes, setSrcBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [current, setCurrent] = useState(0);
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [rendering, setRendering] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [activeSig, setActiveSig] = useState<SigSource | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [textColor, setTextColor] = useState("#0b2447"); // metin/tarih rengi

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clipboardRef = useRef<Placement | null>(null); // Ctrl+C ile kopyalanan imza

  const openFile = useCallback(async (f: File) => {
    setError(null);
    // Cihazda işlenen araçta çok büyük dosya tarayıcıyı kilitleyebilir → nazik uyarı.
    if (f.size > 150 * 1024 * 1024) {
      setError(
        tr
          ? "Dosya çok büyük (150 MB üzeri). Cihazda işlemek için daha küçük bir PDF deneyin."
          : "File too large (over 150 MB). Try a smaller PDF for on-device processing.",
      );
      return;
    }
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      setSrcBytes(bytes);
      setFile(f);
      const d = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      setDoc(d);
      setPageCount(d.numPages);
      setCurrent(0);
      setPlacements([]);
      setEditorOpen(true);
    } catch {
      setError(tr ? "PDF okunamadı. Şifreli dosyalar desteklenmez." : "Couldn't read the PDF. Encrypted files aren't supported.");
    }
  }, [tr]);

  // Thumbnails
  useEffect(() => {
    if (!doc || !editorOpen) return;
    let cancelled = false;
    (async () => {
      const out: string[] = [];
      for (let i = 1; i <= Math.min(doc.numPages, 80); i++) {
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
          if (cancelled) return;
          setThumbs([...out]);
        } catch {
          /* atla */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, editorOpen]);

  // Aktif sayfayı büyük çiz (fit × zoom).
  useEffect(() => {
    if (!doc || !editorOpen) return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const page = await doc.getPage(current + 1);
        const base = page.getViewport({ scale: 1 });
        const container = overlayRef.current?.parentElement?.parentElement;
        const availW = Math.min((container?.clientWidth ?? 700) - 24, 900);
        const fit = Math.max(0.4, availW / base.width);
        const s = fit * zoom;
        const vp = page.getViewport({ scale: s });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (!cancelled) {
          setScale(s);
          setDims({ w: canvas.width, h: canvas.height });
        }
      } catch {
        /* iptal */
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, current, editorOpen, zoom]);

  // İmza oluşturulur oluşturulmaz sayfanın ORTASINA yerleştirilir (tıklama beklenmez);
  // kullanıcı sürükleyerek konumlandırır. "Tekrar ekle" ile aynı imzadan bir kopya daha.
  function placeSignature(sig: SigSource) {
    const wNorm = 0.28;
    const hNorm = (wNorm * (dims.w || 1)) / (sig.aspect || 1) / (dims.h || 1);
    const xNorm = Math.max(0, Math.min(1 - wNorm, 0.5 - wNorm / 2));
    const yNorm = Math.max(0, Math.min(1 - hNorm, 0.5 - hNorm / 2));
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlacements((ps) => [...ps, { ...sig, id, page: current, xNorm, yNorm, wNorm }]);
    setSelected(id);
  }

  function updatePlacement(id: string, patch: Partial<Placement>) {
    setPlacements((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  // MEVCUT sayfadaki TÜM öğeleri (imza + metin + tarih) diğer tüm sayfalara
  // aynı konum/boyut/açı/saydamlıkla kopyalar. Mükerrer eklemeyi önler.
  function applyCurrentPageToAll() {
    const pageItems = placements.filter((p) => p.page === current);
    if (pageItems.length === 0) return;
    setPlacements((ps) => {
      const additions: Placement[] = [];
      for (let i = 0; i < pageCount; i++) {
        if (i === current) continue;
        for (const p of pageItems) {
          const dup = ps.some(
            (x) =>
              x.page === i &&
              x.bytes === p.bytes &&
              x.text === p.text &&
              Math.abs(x.xNorm - p.xNorm) < 0.01 &&
              Math.abs(x.yNorm - p.yNorm) < 0.01,
          );
          if (dup) continue;
          additions.push({
            ...p,
            id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            page: i,
          });
        }
      }
      return [...ps, ...additions];
    });
  }

  // Tüm sayfalardaki TÜM öğeleri temizler (baştan başla).
  function clearAllPlacements() {
    setPlacements([]);
    setSelected(null);
  }

  // Sürükleme / boyutlandırma.
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const r = overlayRef.current?.getBoundingClientRect();
      if (!r) return;
      setPlacements((ps) =>
        ps.map((p) => {
          if (p.id !== drag.id) return p;
          if (drag.mode === "move") {
            const dx = (e.clientX - drag.sx) / r.width;
            const dy = (e.clientY - drag.sy) / r.height;
            const hNorm = (p.wNorm * dims.w) / (p.aspect || 1) / (dims.h || 1);
            return {
              ...p,
              xNorm: Math.max(0, Math.min(1 - p.wNorm, drag.ox + dx)),
              yNorm: Math.max(0, Math.min(1 - hNorm, drag.oy + dy)),
            };
          }
          if (drag.mode === "rotate") {
            // Kol imzanın üstünde başlar; merkeze göre imleç açısı → rotation.
            const ang = (Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) * 180) / Math.PI + 90;
            let deg = Math.round(ang);
            if (e.shiftKey) deg = Math.round(deg / 15) * 15; // Shift → 15° adım
            return { ...p, rotation: deg };
          }
          const dw = (e.clientX - drag.sx) / r.width;
          return { ...p, wNorm: Math.max(0.06, Math.min(0.95, drag.ow + dw)) };
        }),
      );
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, dims]);

  // Klavye kısayolları: Delete=sil, Ctrl/⌘+C=kopyala, Ctrl/⌘+V=yapıştır.
  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const inField = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      if (inField) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        setPlacements((ps) => ps.filter((p) => p.id !== selected));
        setSelected(null);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "c" || e.key === "C") && selected) {
        const p = placements.find((x) => x.id === selected);
        if (p) clipboardRef.current = p;
        e.preventDefault();
        return;
      }
      if (mod && (e.key === "v" || e.key === "V") && clipboardRef.current) {
        const src = clipboardRef.current;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const wNorm = src.wNorm;
        const hNorm = (wNorm * (dims.w || 1)) / (src.aspect || 1) / (dims.h || 1);
        // Aktif sayfaya, hafif kaydırılmış konuma yapıştır.
        const xNorm = Math.max(0, Math.min(1 - wNorm, src.xNorm + 0.03));
        const yNorm = Math.max(0, Math.min(1 - hNorm, src.yNorm + 0.03));
        setPlacements((ps) => [...ps, { ...src, id, page: current, xNorm, yNorm }]);
        setSelected(id);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editorOpen, selected, placements, current, dims]);

  async function apply() {
    if (!srcBytes || placements.length === 0) {
      setError(tr ? "Önce bir imza yerleştirin." : "Place a signature first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const items: SignatureItem[] = placements.map((p) => ({
        pngBytes: p.bytes,
        aspect: p.aspect,
        page: p.page,
        xNorm: p.xNorm,
        yNorm: p.yNorm,
        wNorm: p.wNorm,
        opacity: p.opacity,
        rotationDeg: p.rotation,
      }));
      const outBytes = await applySignatures(srcBytes.slice(), items);
      const name = `${(file?.name || "belge").replace(/\.pdf$/i, "")}-imzali.pdf`;
      await saveBlobToUser(pdfBytesToBlob(outBytes), name).catch(() => {});
      setEditorOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr ? "İmzalama başarısız." : "Signing failed.");
    } finally {
      setBusy(false);
    }
  }

  // Metin/tarih alanı ekle — sayfanın ortasına, seçili renkte, düzenlenebilir.
  function addTextField(defaultText: string) {
    const r = renderTextToPng(defaultText, textColor);
    const wNorm = 0.3;
    const hNorm = (wNorm * (dims.w || 1)) / (r.aspect || 1) / (dims.h || 1);
    const xNorm = Math.max(0, Math.min(1 - wNorm, 0.5 - wNorm / 2));
    const yNorm = Math.max(0, Math.min(1 - hNorm, 0.5 - hNorm / 2));
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlacements((ps) => [...ps, { ...r, id, page: current, xNorm, yNorm, wNorm, text: defaultText, color: textColor }]);
    setSelected(id);
  }

  function updateTextField(id: string, newText: string) {
    setPlacements((ps) =>
      ps.map((p) => {
        if (p.id !== id || p.text === undefined) return p;
        const r = renderTextToPng(newText, p.color);
        return { ...p, text: newText, dataUrl: r.dataUrl, bytes: r.bytes, aspect: r.aspect };
      }),
    );
  }

  // Metin/tarih rengini değiştir — PNG'yi yeni renkle yeniden üretir.
  function updateTextColor(id: string, color: string) {
    setPlacements((ps) =>
      ps.map((p) => {
        if (p.id !== id || p.text === undefined) return p;
        const r = renderTextToPng(p.text, color);
        return { ...p, color, dataUrl: r.dataUrl, bytes: r.bytes, aspect: r.aspect };
      }),
    );
  }

  const selectedPlacement = placements.find((p) => p.id === selected) ?? null;
  const pagePlacements = placements.filter((p) => p.page === current);

  return (
    <div className="mx-auto w-full max-w-3xl text-left">
      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/25 to-blue-600/20 text-cyan-200 ring-1 ring-cyan-400/30">
          <PenLine className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "PDF İmzala" : "Sign PDF"}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {tr
              ? "İmzanı çiz, yaz ya da görsel yükle; PDF'e yerleştir. İmzan cihazından çıkmaz — %100 gizli, üyeliksiz."
              : "Draw, type or upload your signature and place it on the PDF. Your signature never leaves your device — 100% private, no sign-up."}
          </p>
        </div>
      </div>

      {!editorOpen && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void openFile(f);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`group cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition sm:p-12 ${
            dragOver ? "border-cyan-400/70 bg-cyan-400/[0.06]" : "border-white/15 hover:border-cyan-400/40 hover:bg-white/[0.02]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void openFile(f);
              e.target.value = "";
            }}
          />
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-200 ring-1 ring-white/10 transition group-hover:scale-105">
            <UploadCloud className="h-9 w-9" />
          </div>
          <p className="mt-5 text-lg font-bold text-white">{tr ? "İmzalanacak PDF'i sürükle veya seç" : "Drag or choose a PDF to sign"}</p>
          <p className="mt-1.5 text-[13px] text-slate-400">{tr ? "Dosyan cihazında işlenir, sunucuya gitmez." : "Processed on your device, never uploaded."}</p>
        </div>
      )}

      {error && !editorOpen && (
        <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-300">{error}</p>
      )}

      {editorOpen && doc &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col bg-[#0b1020]/97 backdrop-blur-sm">
            {/* Üst araç çubuğu */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] bg-nb-bg-elevated/80 px-3 py-2.5">
              <button
                type="button"
                onClick={() => setSigModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-3.5 py-2 text-[13px] font-bold text-white transition hover:brightness-110"
              >
                <PenLine className="h-4 w-4" />
                {tr ? "İmza Ekle" : "Add signature"}
              </button>

              <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
              <button
                type="button"
                onClick={() => addTextField(tr ? "Metin" : "Text")}
                className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-slate-200 transition hover:bg-white/[0.08]"
              >
                <TypeIcon className="h-4 w-4" />
                {tr ? "Metin" : "Text"}
              </button>
              <button
                type="button"
                onClick={() => addTextField(todayStr())}
                className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-slate-200 transition hover:bg-white/[0.08]"
              >
                <Calendar className="h-4 w-4" />
                {tr ? "Tarih" : "Date"}
              </button>
              {/* Metin rengi skalası + özel renk seçici — yeni metni ve seçili metni etkiler */}
              <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-1" title={tr ? "Metin rengi" : "Text color"}>
                {TEXT_COLORS.map((c) => {
                  const activeColor = selectedPlacement?.text !== undefined ? selectedPlacement.color : textColor;
                  const active = activeColor === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setTextColor(c);
                        if (selectedPlacement?.text !== undefined) updateTextColor(selectedPlacement.id, c);
                      }}
                      title={c}
                      className={`h-5 w-5 rounded-full border transition ${active ? "border-cyan-300 ring-2 ring-cyan-400/50 scale-110" : "border-white/25 hover:border-white/60"}`}
                      style={{ backgroundColor: c }}
                    />
                  );
                })}
                <label
                  className="relative flex h-5 w-5 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/25 hover:border-white/60"
                  title={tr ? "Özel renk seç" : "Pick a custom color"}
                  style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
                >
                  <input
                    type="color"
                    value={(selectedPlacement?.text !== undefined ? selectedPlacement.color : textColor) ?? "#0b2447"}
                    onChange={(e) => {
                      setTextColor(e.target.value);
                      if (selectedPlacement?.text !== undefined) updateTextColor(selectedPlacement.id, e.target.value);
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </span>
              <span className="ml-0.5 hidden items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-1 text-[11px] font-medium text-slate-300 lg:inline-flex">
                {tr ? "Kopyala/Yapıştır:" : "Copy/paste:"}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-100">Ctrl+C</kbd>
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-100">Ctrl+V</kbd>
              </span>
              {selectedPlacement?.text !== undefined && (
                <input
                  autoFocus
                  value={selectedPlacement.text}
                  onChange={(e) => updateTextField(selectedPlacement.id, e.target.value)}
                  placeholder={tr ? "Metni düzenle…" : "Edit text…"}
                  className="w-40 rounded-lg border border-cyan-400/40 bg-white/[0.06] px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-slate-500"
                />
              )}
              {selectedPlacement && (
                <span className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5">
                  <span className="text-[12px] font-semibold text-slate-100">{tr ? "Saydamlık" : "Opacity"}</span>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={selectedPlacement.opacity ?? 1}
                    onChange={(e) => updatePlacement(selectedPlacement.id, { opacity: Number(e.target.value) })}
                    className="w-20 accent-cyan-400"
                    title={tr ? "Saydamlık" : "Opacity"}
                  />
                  <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-slate-200">{Math.round((selectedPlacement.opacity ?? 1) * 100)}%</span>
                </span>
              )}
              {pagePlacements.length > 0 && pageCount > 1 && (
                <button
                  type="button"
                  onClick={applyCurrentPageToAll}
                  title={tr ? "Bu sayfadaki tüm öğeleri (imza, metin, tarih) aynı yere tüm sayfalara koy" : "Copy every item on this page to all pages at the same position"}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-2 text-[12px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  <Layers className="h-4 w-4" />
                  {tr ? "Tüm sayfalara uygula" : "Apply to all pages"}
                </button>
              )}
              {placements.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllPlacements}
                  title={tr ? "Tüm sayfalardaki tüm öğeleri temizle" : "Clear every item on all pages"}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-2 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08]"
                >
                  <Trash2 className="h-4 w-4" />
                  {tr ? "Tümünü temizle" : "Clear all"}
                </button>
              )}

              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-1.5 py-1">
                  <button type="button" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.2) * 100) / 100))} title={tr ? "Uzaklaştır" : "Zoom out"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white">
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setZoom(1)} title={tr ? "Sığdır" : "Fit"} className="min-w-[3rem] rounded-lg px-1.5 py-1 text-center text-[12px] font-semibold tabular-nums text-slate-200 hover:bg-white/10">{Math.round(zoom * 100)}%</button>
                  <button type="button" onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.2) * 100) / 100))} title={tr ? "Yakınlaştır" : "Zoom in"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white">
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
                <span className="hidden text-[12px] font-semibold text-cyan-300 md:inline">{placements.length} {tr ? "öğe" : "items"}</span>
                <button
                  type="button"
                  disabled={busy || placements.length === 0}
                  onClick={() => void apply()}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {tr ? "Uygula ve İndir" : "Apply & download"}
                </button>
                <button type="button" onClick={() => setEditorOpen(false)} aria-label={tr ? "Kapat" : "Close"} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {error && <div className="border-b border-red-500/20 bg-red-500/[0.08] px-4 py-2 text-[13px] text-red-300">{error}</div>}

            <div className="flex min-h-0 flex-1">
              {/* Sol: thumbnail'ler */}
              <div className="w-24 shrink-0 overflow-y-auto border-r border-white/[0.08] bg-black/20 p-2 sm:w-28">
                {Array.from({ length: pageCount }).map((_, i) => {
                  const has = placements.some((p) => p.page === i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCurrent(i);
                        setSelected(null);
                      }}
                      className={`relative mb-2 block w-full overflow-hidden rounded-lg border-2 transition ${current === i ? "border-cyan-400" : "border-transparent hover:border-white/20"}`}
                    >
                      {thumbs[i] ? <img src={thumbs[i]} alt={`${i + 1}`} className="w-full bg-white" /> : <div className="flex h-24 w-full items-center justify-center bg-white/5 text-[10px] text-slate-500">{i + 1}</div>}
                      {has && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-black/40" />}
                      <span className={`block py-0.5 text-center text-[10px] ${current === i ? "text-cyan-300" : "text-slate-500"}`}>{i + 1}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sağ: imzalama alanı */}
              <div className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">
                <div className="relative mx-auto w-fit rounded-lg bg-white shadow-2xl">
                  <canvas ref={canvasRef} className="block rounded-lg" />
                  {rendering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
                    </div>
                  )}
                  <div
                    ref={overlayRef}
                    className="absolute inset-0 touch-none"
                    style={{ cursor: "default" }}
                  >
                    {pagePlacements.map((p) => {
                      const left = p.xNorm * dims.w;
                      const top = p.yNorm * dims.h;
                      const width = p.wNorm * dims.w;
                      const height = width / (p.aspect || 1);
                      const isSel = selected === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(p.id);
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setSelected(p.id);
                            setDrag({ id: p.id, mode: "move", sx: e.clientX, sy: e.clientY, ox: p.xNorm, oy: p.yNorm });
                          }}
                          className={`absolute select-none ${isSel ? "ring-2 ring-cyan-400" : "ring-1 ring-cyan-400/30"}`}
                          style={{
                            left,
                            top,
                            width,
                            height,
                            cursor: "move",
                            opacity: p.opacity ?? 1,
                            transform: p.rotation ? `rotate(${p.rotation}deg)` : undefined,
                          }}
                        >
                          <img src={p.dataUrl} alt="signature" className="pointer-events-none h-full w-full object-contain" draggable={false} />
                          {isSel && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPlacements((ps) => ps.filter((x) => x.id !== p.id));
                                  setSelected(null);
                                }}
                                className="absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                                title={tr ? "Sil" : "Delete"}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                              <span
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  setDrag({ id: p.id, mode: "resize", sx: e.clientX, ow: p.wNorm });
                                }}
                                className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-cyan-400"
                                title={tr ? "Boyutlandır" : "Resize"}
                              />
                              {/* Döndürme tutamağı — imzanın üstünde, çekince merkez etrafında döner */}
                              <span
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  const r = overlayRef.current!.getBoundingClientRect();
                                  setDrag({
                                    id: p.id,
                                    mode: "rotate",
                                    cx: r.left + left + width / 2,
                                    cy: r.top + top + height / 2,
                                  });
                                }}
                                className="absolute -top-8 left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-white bg-cyan-400 text-white active:cursor-grabbing"
                                title={tr ? "Döndür (Shift: 15° adım)" : "Rotate (Shift: 15° steps)"}
                              >
                                <RotateCw className="h-3 w-3" />
                              </span>
                              <span className="absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-cyan-400/60" />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {sigModalOpen &&
              createPortal(
                <SignatureModal
                  tr={tr}
                  onClose={() => setSigModalOpen(false)}
                  onDone={(dataUrl, aspect) => {
                    const sig = { dataUrl, bytes: dataUrlToBytes(dataUrl), aspect };
                    setActiveSig(sig);
                    placeSignature(sig); // tıklama bekleme — direkt ortaya yerleştir
                    setSigModalOpen(false);
                  }}
                />,
                document.body,
              )}
          </div>,
          document.body,
        )}
    </div>
  );
}

// ── İmza oluşturma penceresi: Çiz / Yaz / Yükle ─────────────────────────────
function SignatureModal({ tr, onClose, onDone }: { tr: boolean; onClose: () => void; onDone: (dataUrl: string, aspect: number) => void }) {
  const [tab, setTab] = useState<"draw" | "type" | "upload">("draw");
  const [typed, setTyped] = useState("");
  const drawRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const c = drawRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b2447";
  }, [tab]);

  function pos(e: React.PointerEvent) {
    const c = drawRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  function trimmedDataUrl(c: HTMLCanvasElement): { url: string; aspect: number } | null {
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const { width, height } = c;
    const data = ctx.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return null;
    const pad = 8;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width, maxX + pad);
    maxY = Math.min(height, maxY + pad);
    const w = maxX - minX;
    const h = maxY - minY;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    out.getContext("2d")!.drawImage(c, minX, minY, w, h, 0, 0, w, h);
    return { url: out.toDataURL("image/png"), aspect: w / h };
  }

  function useDrawn() {
    const c = drawRef.current;
    if (!c || !hasInk.current) return;
    const t = trimmedDataUrl(c);
    if (t) onDone(t.url, t.aspect);
  }

  function useTyped() {
    const text = typed.trim();
    if (!text) return;
    const c = document.createElement("canvas");
    const scale = 3;
    const fontPx = 64;
    const tmp = c.getContext("2d")!;
    tmp.font = `italic ${fontPx}px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive`;
    const w = Math.ceil(tmp.measureText(text).width) + 40;
    const h = Math.ceil(fontPx * 1.6);
    c.width = w * scale;
    c.height = h * scale;
    const ctx = c.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#0b2447";
    ctx.font = `italic ${fontPx}px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive`;
    ctx.textBaseline = "middle";
    ctx.fillText(text, 20, h / 2);
    onDone(c.toDataURL("image/png"), w / h);
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const url = String(rd.result);
      const img = new Image();
      img.onload = () => onDone(url, img.width / img.height);
      img.src = url;
    };
    rd.readAsDataURL(f);
  }

  const tabCls = (t: string) =>
    `flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${tab === t ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40" : "text-slate-300 hover:bg-white/[0.06]"}`;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0b1020] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-lg font-black text-white">{tr ? "İmza Oluştur" : "Create signature"}</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-1.5 px-5 pt-4">
          <button type="button" className={tabCls("draw")} onClick={() => setTab("draw")}><PenLine className="mr-1 inline h-4 w-4" />{tr ? "Çiz" : "Draw"}</button>
          <button type="button" className={tabCls("type")} onClick={() => setTab("type")}><TypeIcon className="mr-1 inline h-4 w-4" />{tr ? "Yaz" : "Type"}</button>
          <button type="button" className={tabCls("upload")} onClick={() => setTab("upload")}><Upload className="mr-1 inline h-4 w-4" />{tr ? "Yükle" : "Upload"}</button>
        </div>

        <div className="p-5">
          {tab === "draw" && (
            <>
              <canvas
                ref={drawRef}
                width={520}
                height={220}
                className="w-full touch-none rounded-xl border border-slate-300 bg-white"
                onPointerDown={(e) => {
                  drawing.current = true;
                  const c = drawRef.current!;
                  const ctx = c.getContext("2d")!;
                  const p = pos(e);
                  ctx.beginPath();
                  ctx.moveTo(p.x, p.y);
                }}
                onPointerMove={(e) => {
                  if (!drawing.current) return;
                  const ctx = drawRef.current!.getContext("2d")!;
                  const p = pos(e);
                  ctx.lineTo(p.x, p.y);
                  ctx.stroke();
                  hasInk.current = true;
                }}
                onPointerUp={() => (drawing.current = false)}
                onPointerLeave={() => (drawing.current = false)}
              />
              <div className="mt-3 flex justify-between">
                <button type="button" onClick={() => { const c = drawRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); hasInk.current = false; }} className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] font-medium text-slate-300 hover:bg-white/[0.06]">{tr ? "Temizle" : "Clear"}</button>
                <button type="button" onClick={useDrawn} className="rounded-lg bg-cyan-600 px-4 py-1.5 text-[13px] font-bold text-white hover:brightness-110">{tr ? "Kullan" : "Use"}</button>
              </div>
            </>
          )}

          {tab === "type" && (
            <>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={tr ? "Adınız Soyadınız" : "Your name"}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <div className="mt-3 flex min-h-[90px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4">
                <span style={{ fontFamily: '"Segoe Script","Brush Script MT","Snell Roundhand",cursive', fontStyle: "italic", fontSize: 40, color: "#0b2447" }}>{typed || (tr ? "önizleme" : "preview")}</span>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={useTyped} disabled={!typed.trim()} className="rounded-lg bg-cyan-600 px-4 py-1.5 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-50">{tr ? "Kullan" : "Use"}</button>
              </div>
            </>
          )}

          {tab === "upload" && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] p-8 text-center hover:border-cyan-400/40">
              <Upload className="h-8 w-8 text-cyan-300" />
              <span className="text-[13px] font-semibold text-white">{tr ? "İmza görseli seç (PNG şeffaf önerilir)" : "Choose signature image (transparent PNG best)"}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onUpload} />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
