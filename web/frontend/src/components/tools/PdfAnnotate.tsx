import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved -- Vite ?url
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  ArrowUpRight,
  Download,
  Highlighter,
  Loader2,
  Minus,
  MousePointer2,
  Paintbrush,
  Pencil,
  Redo2,
  Spline,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import {
  applyAnnotations,
  pdfBytesToBlob,
  type AnnotationItem,
} from "../../lib/clientPdf";
import { saveBlobToUser } from "../../api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type Tool = "select" | "highlight" | "marker" | "rect" | "pen" | "arrow" | "text";

/** Ekran (overlay) koordinatlarıyla tutulan yorumlama nesnesi; hepsi 0..1 oranlı. */
type Anno =
  | {
      id: string;
      page: number;
      kind: "highlight" | "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      thickness: number;
    }
  | {
      id: string;
      page: number;
      kind: "pen";
      points: Array<[number, number]>;
      color: string;
      thickness: number;
      /** Fosforlu kalem (keçeli marker) ise 0..1 saydamlık; ince kalemde yok. */
      opacity?: number;
    }
  | {
      id: string;
      page: number;
      kind: "arrow";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      thickness: number;
    }
  | {
      id: string;
      page: number;
      kind: "text";
      x: number;
      y: number;
      w: number;
      aspect: number;
      text: string;
      color: string;
      dataUrl: string;
      bytes: Uint8Array;
    };

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#111827"];
const HIGHLIGHT_COLORS = ["#fde047", "#86efac", "#93c5fd", "#f9a8d4", "#fdba74"];
const THICKNESS = [2, 4, 8, 14, 22]; // ince → çok kalın
const MARKER_THICKNESS = [12, 20, 32, 48, 64]; // fosforlu: geniş kademe
const MARKER_OPACITY = 0.4;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Nesneyi (dx,dy) oranı kadar taşır — türüne göre tüm koordinatlar kayar. */
function moveAnnoBy(a: Anno, dx: number, dy: number): Anno {
  if (a.kind === "highlight" || a.kind === "rect" || a.kind === "text")
    return { ...a, x: clamp01(a.x + dx), y: clamp01(a.y + dy) };
  if (a.kind === "arrow")
    return { ...a, x1: clamp01(a.x1 + dx), y1: clamp01(a.y1 + dy), x2: clamp01(a.x2 + dx), y2: clamp01(a.y2 + dy) };
  if (a.kind === "pen")
    return { ...a, points: a.points.map(([x, y]) => [clamp01(x + dx), clamp01(y + dy)] as [number, number]) };
  return a;
}

/** Boyutlandırma kolu: kutu/vurgu sağ-alt köşesi, metin genişliği, ok uç noktası. */
function resizeAnnoTo(a: Anno, px: number, py: number): Anno {
  if (a.kind === "highlight" || a.kind === "rect")
    return { ...a, w: Math.max(0.02, px - a.x), h: Math.max(0.02, py - a.y) };
  if (a.kind === "text") return { ...a, w: Math.max(0.05, px - a.x) };
  if (a.kind === "arrow") return { ...a, x2: clamp01(px), y2: clamp01(py) };
  return a; // pen serbest çizim yeniden boyutlanmaz
}

function hexToRgb01(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const int = parseInt(n, 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Metin kutusunu yüksek çözünürlüklü şeffaf PNG'ye çizer (Türkçe tam destekli). */
function renderTextToPng(text: string, color: string) {
  const t = text && text.trim() ? text : " ";
  const scale = 3;
  const fontPx = 34;
  const font = `600 ${fontPx}px "Segoe UI", Arial, "Helvetica Neue", sans-serif`;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const w = Math.ceil(measure.measureText(t).width) + 20;
  const h = Math.ceil(fontPx * 1.45);
  const c = document.createElement("canvas");
  c.width = Math.max(1, w * scale);
  c.height = Math.max(1, h * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillText(t, 10, h / 2);
  const dataUrl = c.toDataURL("image/png");
  return { dataUrl, bytes: dataUrlToBytes(dataUrl), aspect: w / h };
}

export function PdfAnnotate({ language }: { language: Language; accessToken?: string | null }) {
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
  const [annos, setAnnos] = useState<Anno[]>([]);
  const [tool, setTool] = useState<Tool>("highlight");
  const [color, setColor] = useState("#fde047");
  const [thickness, setThickness] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [straight, setStraight] = useState(true); // fosforlu/kalem: düz çizgi modu
  const [draft, setDraft] = useState<Anno | null>(null);
  const [editing, setEditing] = useState(false); // seçili nesne sürükleniyor/boyutlanıyor
  const [past, setPast] = useState<Anno[][]>([]); // geri al yığını
  const [future, setFuture] = useState<Anno[][]>([]); // ileri al yığını
  const [showHelp, setShowHelp] = useState(true); // kullanım ipucu şeridi
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const straightModeRef = useRef(false); // çizim boyunca düz-çizgi kilidi
  const draftRef = useRef<Anno | null>(null); // çizim taslağının güncel değeri (up için)
  const clipboardRef = useRef<Anno | null>(null); // Ctrl+C ile kopyalanan nesne
  const editRef = useRef<
    | { id: string; mode: "move"; sx: number; sy: number; snap: Anno }
    | { id: string; mode: "resize"; snap: Anno }
    | null
  >(null); // select modu: taşıma/boyutlandırma sürükleme durumu

  const openFile = useCallback(
    async (f: File) => {
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
        setAnnos([]);
        setEditorOpen(true);
      } catch {
        setError(
          tr
            ? "PDF okunamadı. Şifreli dosyalar desteklenmez."
            : "Couldn't read the PDF. Encrypted files aren't supported.",
        );
      }
    },
    [tr],
  );

  // Geri/ileri al: her KALICI değişiklikten önce pushHistory() çağrılır.
  const pushHistory = useCallback(() => {
    setPast((p) => [...p.slice(-49), annos]);
    setFuture([]);
  }, [annos]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      setFuture((f) => [annos, ...f]);
      setAnnos(p[p.length - 1]);
      setSelected(null);
      return p.slice(0, -1);
    });
  }, [annos]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p, annos]);
      setAnnos(f[0]);
      setSelected(null);
      return f.slice(1);
    });
  }, [annos]);

  // Thumbnail üretimi.
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

  // Klavye kısayolları: Delete=sil, Ctrl+Z=geri, Ctrl+Y/Ctrl+Shift+Z=ileri,
  // Ctrl+C=kopyala, Ctrl+V=yapıştır.
  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const mod = e.ctrlKey || e.metaKey;
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        pushHistory();
        setAnnos((a) => a.filter((x) => x.id !== selected));
        setSelected(null);
        return;
      }
      if (mod && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        undo();
        e.preventDefault();
        return;
      }
      if (mod && ((e.key === "y" || e.key === "Y") || ((e.key === "z" || e.key === "Z") && e.shiftKey))) {
        redo();
        e.preventDefault();
        return;
      }
      if (mod && (e.key === "c" || e.key === "C") && selected) {
        const p = annos.find((x) => x.id === selected);
        if (p) clipboardRef.current = p;
        e.preventDefault();
        return;
      }
      if (mod && (e.key === "v" || e.key === "V") && clipboardRef.current) {
        const src = clipboardRef.current;
        const id = newId();
        pushHistory();
        const copy = { ...moveAnnoBy(src, 0.03, 0.03), id, page: current } as Anno;
        setAnnos((a) => [...a, copy]);
        setSelected(id);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editorOpen, selected, annos, current, undo, redo, pushHistory]);

  function startEditDrag(e: React.PointerEvent, p: Anno, mode: "move" | "resize") {
    e.stopPropagation();
    setSelected(p.id);
    pushHistory();
    editRef.current =
      mode === "move"
        ? { id: p.id, mode, sx: e.clientX, sy: e.clientY, snap: p }
        : { id: p.id, mode, snap: p };
    setEditing(true);
  }

  // Seçili nesneyi taşıma/boyutlandırma sürüklemesi.
  useEffect(() => {
    if (!editing) return;
    const move = (e: PointerEvent) => {
      const ed = editRef.current;
      const r = overlayRef.current?.getBoundingClientRect();
      if (!ed || !r) return;
      const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      setAnnos((list) =>
        list.map((a) => {
          if (a.id !== ed.id) return a;
          if (ed.mode === "move") {
            const dx = (e.clientX - ed.sx) / r.width;
            const dy = (e.clientY - ed.sy) / r.height;
            return moveAnnoBy(ed.snap, dx, dy);
          }
          return resizeAnnoTo(ed.snap, px, py);
        }),
      );
    };
    const up = () => {
      editRef.current = null;
      setEditing(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [editing]);

  // Seçili nesnenin rengini/kalınlığını değiştirir (toolbar'dan, history'li).
  function patchSelected(patch: Partial<Extract<Anno, { kind: "pen" }>> | { color?: string; thickness?: number }) {
    if (!selected) return;
    pushHistory();
    setAnnos((list) =>
      list.map((a) => {
        if (a.id !== selected) return a;
        if (a.kind === "text" && "color" in patch && patch.color) {
          const r = renderTextToPng(a.text, patch.color);
          return { ...a, color: patch.color, dataUrl: r.dataUrl, bytes: r.bytes, aspect: r.aspect };
        }
        return { ...a, ...patch } as Anno;
      }),
    );
  }

  function relPoint(e: { clientX: number; clientY: number }): [number, number] {
    const r = overlayRef.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    ];
  }

  function onOverlayPointerDown(e: React.PointerEvent) {
    if (tool === "select") {
      // Boşluğa tıklama seçimi kaldırır (nesneler kendi pointerdown'ında durdurur).
      setSelected(null);
      return;
    }
    if (tool === "text") {
      const [x, y] = relPoint(e);
      const t = tr ? "Metin" : "Text";
      const r = renderTextToPng(t, color);
      const w = 0.22;
      const id = newId();
      pushHistory();
      setAnnos((a) => [
        ...a,
        { id, page: current, kind: "text", x, y, w, aspect: r.aspect, text: t, color, dataUrl: r.dataUrl, bytes: r.bytes },
      ]);
      setSelected(id);
      return;
    }
    e.preventDefault();
    drawing.current = true;
    // Kalem/fosforlu düz-çizgi modunda ise başlangıç noktasını kilitle (snap).
    straightModeRef.current = straight && (tool === "pen" || tool === "marker");
    const [x, y] = relPoint(e);
    let d: Anno;
    if (tool === "pen") {
      d = { id: newId(), page: current, kind: "pen", points: [[x, y]], color, thickness };
    } else if (tool === "marker") {
      d = { id: newId(), page: current, kind: "pen", points: [[x, y]], color, thickness, opacity: MARKER_OPACITY };
    } else if (tool === "arrow") {
      d = { id: newId(), page: current, kind: "arrow", x1: x, y1: y, x2: x, y2: y, color, thickness };
    } else {
      d = { id: newId(), page: current, kind: tool, x, y, w: 0, h: 0, color, thickness };
    }
    draftRef.current = d;
    setDraft(d);
  }

  useEffect(() => {
    if (!draft) return;
    const move = (e: PointerEvent) => {
      if (!drawing.current) return;
      const [x, y] = relPoint(e);
      setDraft((d) => {
        if (!d) return d;
        let nd: Anno = d;
        if (d.kind === "pen") {
          if (straightModeRef.current) {
            const s = d.points[0];
            const [ex, ey] = Math.abs(x - s[0]) >= Math.abs(y - s[1]) ? [x, s[1]] : [s[0], y];
            nd = { ...d, points: [s, [ex, ey]] };
          } else {
            nd = { ...d, points: [...d.points, [x, y]] };
          }
        } else if (d.kind === "arrow") {
          nd = { ...d, x2: x, y2: y };
        } else if (d.kind === "highlight" || d.kind === "rect") {
          nd = { ...d, w: x - d.x, h: y - d.y };
        }
        draftRef.current = nd;
        return nd;
      });
    };
    const up = () => {
      drawing.current = false;
      const d = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      if (!d) return;
      // Normalize + çok küçükleri at; geçerliyse geçmişe kaydedip ekle.
      if (d.kind === "highlight" || d.kind === "rect") {
        const x = Math.min(d.x, d.x + d.w);
        const y = Math.min(d.y, d.y + d.h);
        const w = Math.abs(d.w);
        const h = Math.abs(d.h);
        if (w < 0.01 || h < 0.01) return;
        pushHistory();
        setAnnos((a) => [...a, { ...d, x, y, w, h }]);
      } else if (d.kind === "arrow") {
        if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 0.01) return;
        pushHistory();
        setAnnos((a) => [...a, d]);
      } else if (d.kind === "pen") {
        if (d.points.length < 2) return;
        pushHistory();
        setAnnos((a) => [...a, d]);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [draft, pushHistory]);

  function updateText(id: string, newText: string) {
    setAnnos((a) =>
      a.map((x) => {
        if (x.id !== id || x.kind !== "text") return x;
        const r = renderTextToPng(newText, x.color);
        return { ...x, text: newText, dataUrl: r.dataUrl, bytes: r.bytes, aspect: r.aspect };
      }),
    );
  }

  async function apply() {
    if (!srcBytes || annos.length === 0) {
      setError(tr ? "Önce bir işaret ekleyin." : "Add a mark first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const items: AnnotationItem[] = annos.map((a): AnnotationItem => {
        if (a.kind === "highlight" || a.kind === "rect") {
          return {
            type: a.kind,
            page: a.page,
            xNorm: a.x,
            yNorm: a.y,
            wNorm: a.w,
            hNorm: a.h,
            color: hexToRgb01(a.color),
            borderWidth: a.thickness / scale,
          };
        }
        if (a.kind === "pen") {
          return {
            type: "pen",
            page: a.page,
            pointsNorm: a.points,
            color: hexToRgb01(a.color),
            thickness: a.thickness / scale,
            opacity: a.opacity,
          };
        }
        if (a.kind === "arrow") {
          return {
            type: "line",
            page: a.page,
            x1Norm: a.x1,
            y1Norm: a.y1,
            x2Norm: a.x2,
            y2Norm: a.y2,
            color: hexToRgb01(a.color),
            thickness: a.thickness / scale,
            arrow: true,
          };
        }
        if (a.kind === "text") {
          return {
            type: "image",
            page: a.page,
            xNorm: a.x,
            yNorm: a.y,
            wNorm: a.w,
            aspect: a.aspect,
            pngBytes: a.bytes,
          };
        }
        throw new Error("unreachable");
      });
      const outBytes = await applyAnnotations(srcBytes.slice(), items);
      const name = `${(file?.name || "belge").replace(/\.pdf$/i, "")}-isaretli.pdf`;
      await saveBlobToUser(pdfBytesToBlob(outBytes), name).catch(() => {});
      setEditorOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr ? "İşlem başarısız." : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  // Araç seçilince ilgili varsayılan renk/kalınlığı ayarla.
  function pickTool(t: Tool) {
    setTool(t);
    setSelected(null);
    const marker = t === "highlight" || t === "marker";
    if (marker && !HIGHLIGHT_COLORS.includes(color)) setColor("#fde047");
    if (!marker && HIGHLIGHT_COLORS.includes(color)) setColor("#ef4444");
    if (t === "marker" && !MARKER_THICKNESS.includes(thickness)) setThickness(16);
    if ((t === "pen" || t === "rect" || t === "arrow") && !THICKNESS.includes(thickness)) setThickness(4);
  }

  const palette = tool === "highlight" || tool === "marker" ? HIGHLIGHT_COLORS : COLORS;
  const thicknessSet = tool === "marker" ? MARKER_THICKNESS : THICKNESS;
  const pagePreview = draft && draft.page === current ? draft : null;
  const pageAnnos = annos.filter((a) => a.page === current);
  const selectedAnno = annos.find((a) => a.id === selected) ?? null;
  const selThickness =
    selectedAnno && "thickness" in selectedAnno ? selectedAnno.thickness : thickness;

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => pickTool(t)}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold transition ${
        tool === t ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40" : "text-slate-300 hover:bg-white/[0.06]"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-3xl text-left">
      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-600/20 text-amber-200 ring-1 ring-amber-400/30">
          <Highlighter className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "PDF İşaretle" : "Markup PDF"}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {tr
              ? "PDF'e fosforlu vurgu, serbest çizim, kutu, ok ve metin not ekle. Her şey cihazında işlenir — %100 gizli, üyeliksiz."
              : "Highlight, draw, box, arrow and add text notes on a PDF. Everything runs on your device — 100% private, no sign-up."}
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
            dragOver ? "border-amber-400/70 bg-amber-400/[0.06]" : "border-white/15 hover:border-amber-400/40 hover:bg-white/[0.02]"
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
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-200 ring-1 ring-white/10 transition group-hover:scale-105">
            <UploadCloud className="h-9 w-9" />
          </div>
          <p className="mt-5 text-lg font-bold text-white">{tr ? "İşaretlenecek PDF'i sürükle veya seç" : "Drag or choose a PDF to mark up"}</p>
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
            <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.08] bg-nb-bg-elevated/80 px-3 py-2.5">
              {toolBtn("select", <MousePointer2 className="h-4 w-4" />, tr ? "Seç" : "Select")}
              {toolBtn("marker", <Highlighter className="h-4 w-4" />, tr ? "Fosforlu" : "Marker")}
              {toolBtn("highlight", <Paintbrush className="h-4 w-4" />, tr ? "Vurgu" : "Highlight")}
              {toolBtn("pen", <Pencil className="h-4 w-4" />, tr ? "Kalem" : "Pen")}
              {toolBtn("rect", <Square className="h-4 w-4" />, tr ? "Kutu" : "Box")}
              {toolBtn("arrow", <ArrowUpRight className="h-4 w-4" />, tr ? "Ok" : "Arrow")}
              {toolBtn("text", <TypeIcon className="h-4 w-4" />, tr ? "Metin" : "Text")}

              <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
              {/* Renk paleti + özel renk seçici — seçili nesne varsa onu da değiştirir */}
              <div className="flex items-center gap-1">
                {palette.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      patchSelected({ color: c });
                    }}
                    title={c}
                    className={`h-6 w-6 rounded-full border-2 transition ${(selectedAnno?.color ?? color) === c ? "border-white scale-110" : "border-white/20 hover:border-white/50"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label
                  className="relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-white/20 hover:border-white/50"
                  title={tr ? "Özel renk seç" : "Pick a custom color"}
                  style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
                >
                  <input
                    type="color"
                    value={selectedAnno?.color ?? color}
                    onChange={(e) => {
                      setColor(e.target.value);
                      patchSelected({ color: e.target.value });
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
              {(tool === "marker" || tool === "pen") && (
                <button
                  type="button"
                  onClick={() => setStraight((v) => !v)}
                  title={straight ? (tr ? "Şu an: düz çizgi — serbest çizime geç" : "Now: straight — switch to freehand") : tr ? "Şu an: serbest — düz çizgiye geç" : "Now: freehand — switch to straight"}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold transition ${straight ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40" : "text-slate-300 hover:bg-white/[0.06]"}`}
                >
                  {straight ? <Minus className="h-4 w-4" /> : <Spline className="h-4 w-4" />}
                  {straight ? (tr ? "Düz" : "Straight") : tr ? "Serbest" : "Free"}
                </button>
              )}
              {tool !== "highlight" && tool !== "text" && (tool !== "select" || (selectedAnno && "thickness" in selectedAnno)) && (
                <div className="ml-1 flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-1 py-0.5">
                  {(tool === "select"
                    ? selectedAnno && selectedAnno.kind === "pen" && selectedAnno.opacity
                      ? MARKER_THICKNESS
                      : THICKNESS
                    : thicknessSet
                  ).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setThickness(t);
                        patchSelected({ thickness: t });
                      }}
                      title={`${t}px`}
                      className={`flex h-6 w-6 items-center justify-center rounded-lg transition ${selThickness === t ? "bg-cyan-500/25" : "hover:bg-white/10"}`}
                    >
                      <span className="rounded-full bg-current" style={{ width: Math.min(t + 1, 15), height: Math.min(t + 1, 15), color: "#e2e8f0" }} />
                    </button>
                  ))}
                </div>
              )}

              {selected && annos.find((a) => a.id === selected)?.kind === "text" && (
                <input
                  autoFocus
                  value={(annos.find((a) => a.id === selected) as Extract<Anno, { kind: "text" }>).text}
                  onChange={(e) => updateText(selected, e.target.value)}
                  placeholder={tr ? "Metni düzenle…" : "Edit text…"}
                  className="w-36 rounded-lg border border-cyan-400/40 bg-white/[0.06] px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-slate-500"
                />
              )}

              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-1 py-0.5">
                  <button type="button" onClick={undo} disabled={past.length === 0} title={tr ? "Geri al (Ctrl+Z)" : "Undo (Ctrl+Z)"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30">
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={redo} disabled={future.length === 0} title={tr ? "İleri al (Ctrl+Y)" : "Redo (Ctrl+Y)"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30">
                    <Redo2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-1.5 py-1">
                  <button type="button" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.2) * 100) / 100))} title={tr ? "Uzaklaştır" : "Zoom out"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white">
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setZoom(1)} className="min-w-[3rem] rounded-lg px-1.5 py-1 text-center text-[12px] font-semibold tabular-nums text-slate-200 hover:bg-white/10">{Math.round(zoom * 100)}%</button>
                  <button type="button" onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.2) * 100) / 100))} title={tr ? "Yakınlaştır" : "Zoom in"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white">
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
                <span className="hidden text-[12px] font-semibold text-amber-300 md:inline">{annos.length} {tr ? "öğe" : "items"}</span>
                <button
                  type="button"
                  disabled={busy || annos.length === 0}
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

            {showHelp && (
              <div className="flex items-start gap-3 border-b border-white/[0.06] bg-cyan-500/[0.06] px-4 py-2 text-[12px] leading-relaxed text-slate-300">
                <span className="shrink-0 pt-0.5 font-bold text-cyan-200">{tr ? "Nasıl kullanılır?" : "How to use?"}</span>
                <span className="min-w-0 flex-1">
                  {tr
                    ? "Bir araç seç → sayfada sürükleyerek çiz. Fosforlu/Kalem'de «Düz/Serbest» ve kalınlık seçebilirsin. «Seç» aracıyla bir nesneye tıkla: sürükleyip taşı, köşeden boyutlandır, renk/kalınlığını değiştir. Kısayollar: Ctrl+Z geri, Ctrl+Y ileri, Ctrl+C/V kopyala-yapıştır, Del sil."
                    : "Pick a tool → drag on the page to draw. Marker/Pen offer «Straight/Free» and thickness. With «Select», click an item: drag to move, resize from the corner, change color/thickness. Shortcuts: Ctrl+Z undo, Ctrl+Y redo, Ctrl+C/V copy-paste, Del delete."}
                </span>
                <button type="button" onClick={() => setShowHelp(false)} className="shrink-0 rounded-md px-2 py-1 font-semibold text-cyan-200 hover:bg-white/10">
                  {tr ? "Anladım" : "Got it"}
                </button>
              </div>
            )}

            <div className="flex min-h-0 flex-1">
              {/* Sol: thumbnail'ler */}
              <div className="w-24 shrink-0 overflow-y-auto border-r border-white/[0.08] bg-black/20 p-2 sm:w-28">
                {Array.from({ length: pageCount }).map((_, i) => {
                  const has = annos.some((a) => a.page === i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCurrent(i);
                        setSelected(null);
                      }}
                      className={`relative mb-2 block w-full overflow-hidden rounded-lg border-2 transition ${current === i ? "border-amber-400" : "border-transparent hover:border-white/20"}`}
                    >
                      {thumbs[i] ? <img src={thumbs[i]} alt={`${i + 1}`} className="w-full bg-white" /> : <div className="flex h-24 w-full items-center justify-center bg-white/5 text-[10px] text-slate-500">{i + 1}</div>}
                      {has && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-black/40" />}
                      <span className={`block py-0.5 text-center text-[10px] ${current === i ? "text-amber-300" : "text-slate-500"}`}>{i + 1}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sağ: yorumlama alanı */}
              <div className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">
                <div className="relative mx-auto w-fit rounded-lg bg-white shadow-2xl">
                  <canvas ref={canvasRef} className="block rounded-lg" />
                  {rendering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                    </div>
                  )}
                  <div
                    ref={overlayRef}
                    onPointerDown={onOverlayPointerDown}
                    className="absolute inset-0 touch-none"
                    style={{ cursor: tool === "select" ? "default" : "crosshair" }}
                  >
                    {/* Vektörel yorumlar (SVG) */}
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" width={dims.w} height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`}>
                      {[...pageAnnos, ...(pagePreview ? [pagePreview] : [])].map((a) => {
                        if (a.kind === "highlight") {
                          const x = Math.min(a.x, a.x + a.w) * dims.w;
                          const y = Math.min(a.y, a.y + a.h) * dims.h;
                          return <rect key={a.id} x={x} y={y} width={Math.abs(a.w) * dims.w} height={Math.abs(a.h) * dims.h} fill={a.color} fillOpacity={0.35} />;
                        }
                        if (a.kind === "rect") {
                          const x = Math.min(a.x, a.x + a.w) * dims.w;
                          const y = Math.min(a.y, a.y + a.h) * dims.h;
                          return <rect key={a.id} x={x} y={y} width={Math.abs(a.w) * dims.w} height={Math.abs(a.h) * dims.h} fill="none" stroke={a.color} strokeWidth={a.thickness} />;
                        }
                        if (a.kind === "pen") {
                          return <polyline key={a.id} points={a.points.map((p) => `${p[0] * dims.w},${p[1] * dims.h}`).join(" ")} fill="none" stroke={a.color} strokeOpacity={a.opacity ?? 1} strokeWidth={a.thickness} strokeLinecap="round" strokeLinejoin="round" />;
                        }
                        if (a.kind === "arrow") {
                          const x1 = a.x1 * dims.w, y1 = a.y1 * dims.h, x2 = a.x2 * dims.w, y2 = a.y2 * dims.h;
                          const ang = Math.atan2(y2 - y1, x2 - x1);
                          const head = Math.max(8, a.thickness * 4);
                          const sp = Math.PI / 7;
                          return (
                            <g key={a.id} stroke={a.color} strokeWidth={a.thickness} strokeLinecap="round" fill="none">
                              <line x1={x1} y1={y1} x2={x2} y2={y2} />
                              <line x1={x2} y1={y2} x2={x2 - head * Math.cos(ang - sp)} y2={y2 - head * Math.sin(ang - sp)} />
                              <line x1={x2} y1={y2} x2={x2 - head * Math.cos(ang + sp)} y2={y2 - head * Math.sin(ang + sp)} />
                            </g>
                          );
                        }
                        return null;
                      })}
                    </svg>

                    {/* Seçim çerçeveleri + metin kutuları — select modda taşı/boyutlandır/sil */}
                    {pageAnnos.map((a) => {
                      const isSel = selected === a.id;
                      const selMode = tool === "select";
                      const delBtn = (
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            pushHistory();
                            setAnnos((list) => list.filter((x) => x.id !== a.id));
                            setSelected(null);
                          }}
                          className="absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                          title={tr ? "Sil" : "Delete"}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      );
                      const resizeHandle = (
                        <span
                          onPointerDown={(e) => startEditDrag(e, a, "resize")}
                          className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-full border-2 border-white bg-amber-400"
                          title={tr ? "Boyutlandır" : "Resize"}
                        />
                      );
                      if (a.kind === "text") {
                        const left = a.x * dims.w;
                        const top = a.y * dims.h;
                        const width = a.w * dims.w;
                        const height = width / (a.aspect || 1);
                        return (
                          <div
                            key={a.id}
                            onPointerDown={selMode ? (e) => startEditDrag(e, a, "move") : undefined}
                            className={`absolute select-none ${isSel ? "ring-2 ring-amber-400" : selMode ? "ring-1 ring-amber-400/30" : ""}`}
                            style={{ left, top, width, height, cursor: selMode ? "move" : "default", pointerEvents: selMode ? "auto" : "none" }}
                          >
                            <img src={a.dataUrl} alt="" className="pointer-events-none h-full w-full object-contain" draggable={false} />
                            {isSel && selMode && (
                              <>
                                {delBtn}
                                {resizeHandle}
                              </>
                            )}
                          </div>
                        );
                      }
                      // Vektörel yorumlar için tıklama-hedefi — yalnız select modda.
                      if (!selMode) return null;
                      let bx = 0, by = 0, bw = 0, bh = 0;
                      if (a.kind === "highlight" || a.kind === "rect") {
                        bx = Math.min(a.x, a.x + a.w) * dims.w;
                        by = Math.min(a.y, a.y + a.h) * dims.h;
                        bw = Math.abs(a.w) * dims.w;
                        bh = Math.abs(a.h) * dims.h;
                      } else if (a.kind === "arrow") {
                        bx = Math.min(a.x1, a.x2) * dims.w;
                        by = Math.min(a.y1, a.y2) * dims.h;
                        bw = Math.abs(a.x2 - a.x1) * dims.w;
                        bh = Math.abs(a.y2 - a.y1) * dims.h;
                      } else if (a.kind === "pen") {
                        const xs = a.points.map((p) => p[0]);
                        const ys = a.points.map((p) => p[1]);
                        bx = Math.min(...xs) * dims.w;
                        by = Math.min(...ys) * dims.h;
                        bw = (Math.max(...xs) - Math.min(...xs)) * dims.w;
                        bh = (Math.max(...ys) - Math.min(...ys)) * dims.h;
                      }
                      return (
                        <div
                          key={a.id}
                          onPointerDown={(e) => startEditDrag(e, a, "move")}
                          className={`absolute ${isSel ? "ring-2 ring-amber-400" : "hover:ring-1 hover:ring-amber-400/40"}`}
                          style={{ left: bx - 4, top: by - 4, width: bw + 8, height: bh + 8, cursor: "move" }}
                        >
                          {isSel && (
                            <>
                              {delBtn}
                              {a.kind !== "pen" && resizeHandle}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="mx-auto mt-3 max-w-lg text-center text-[12px] text-slate-500">
                  {tool === "select"
                    ? tr ? "Bir nesneye tıklayıp sürükleyerek taşı, köşedeki tutamaktan boyutlandır; renk ve kalınlığı üstteki çubuktan değiştir." : "Click and drag an item to move it, resize from the corner handle; change color and thickness in the top bar."
                    : tr ? "Sayfada sürükleyerek çiz. Düzenlemek/taşımak için «Seç» aracına geç." : "Drag on the page to draw. Switch to «Select» to edit or move."}
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
