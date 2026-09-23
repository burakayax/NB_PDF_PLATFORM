import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { ToolRating } from "../common/ToolRating";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Italic,
  Loader2,
  ImagePlus,
  Minus,
  Move,
  Pencil,
  Plus,
  RotateCw,
  Share2,
  ShieldAlert,
  Sparkles,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ProductTour, type TourStep } from "../onboarding/ProductTour";
import { fillPageTextColors, mergeInvisibleWords, ocrScannedPagesLocal, scannedPageIndexes } from "../../lib/pdfAnalyzeClient";
import {
  analyzePdf,
  editPdfTextPrepare,
  downloadEditedPdf,
  EditDailyLimitError,
  saveBlobToUser,
  type PdfAnalysis,
  type PdfElement,
  type PdfTextEdit,
} from "../../api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const uid = () => Math.random().toString(36).slice(2, 9);
// Ölçü-uyumlu aileler (Calibri→carlito …) sunucudaki `edit_fonts.py` ile AYNI dosyalar
// (public/fonts/edit/*.woff2) → önizleme ölçüsü = indirilen PDF ölçüsü.
type MetricKey = "carlito" | "caladea" | "lsans" | "lserif" | "lmono" | "gelasio";
type FontKey = "sans" | "serif" | "mono" | "lato" | "montserrat" | "merriweather" | "oswald" | MetricKey;
type AlignKey = "left" | "center" | "right";
// Biçim bayrakları — kalın/italik/altı çizili/üstü çizili + hizalama.
type Fmt = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; align?: AlignKey };
// html: kelime bazlı zengin biçim (contentEditable innerHTML). Doluysa export insert_htmlbox
// ile yapılır (parça parça renk/kalın/italik/altı-üstü çizili/boyut korunur).
type Edit = { text?: string; deleted?: boolean; size?: number; color?: string; font?: FontKey; html?: string } & Fmt;
type Added = { id: string; page: number; bbox: [number, number, number, number]; text: string; size: number; color: string; font: FontKey } & Fmt;
// Kullanıcının eklediği resim — bbox (PDF pt, döndürülmemiş), aspect (w/h), açı (derece).
type AddedImg = { id: string; page: number; bbox: [number, number, number, number]; dataUrl: string; aspect: number; rotate: number };
type ImgDrag =
  | { id: string; mode: "move"; sx: number; sy: number; ox: number; oy: number }
  | { id: string; mode: "resize"; sx: number; ow: number; oh: number; x0: number; y0: number }
  | { id: string; mode: "rotate"; cx: number; cy: number }
  | null;

const FONT_CSS: Record<FontKey, string> = {
  sans: "Roboto, system-ui, sans-serif",
  serif: "'Noto Serif', Georgia, serif",
  mono: "'Roboto Mono', ui-monospace, monospace",
  lato: "Lato, system-ui, sans-serif",
  montserrat: "Montserrat, system-ui, sans-serif",
  merriweather: "Merriweather, Georgia, serif",
  oswald: "Oswald, 'Arial Narrow', sans-serif",
  // Yerel kurulu aynı adlı (farklı sürüm) fontla karışmasın diye özel aile adları; eksik harf
  // (ör. ₺) sunucudaki gibi aynı sınıfın yedeğinden (Roboto / Noto Serif / Roboto Mono).
  carlito: "'PPE Carlito', Roboto, sans-serif",
  caladea: "'PPE Caladea', 'Noto Serif', serif",
  lsans: "'PPE Liberation Sans', Roboto, sans-serif",
  lserif: "'PPE Liberation Serif', 'Noto Serif', serif",
  lmono: "'PPE Liberation Mono', 'Roboto Mono', monospace",
  gelasio: "'PPE Gelasio', 'Noto Serif', serif",
};
// Menüde görünen ad: orijinal fontun adı + birebir ölçü notu.
const FONT_MENU: Record<FontKey, string> = {
  sans: "Roboto", serif: "Noto Serif", mono: "Roboto Mono", lato: "Lato", montserrat: "Montserrat",
  merriweather: "Merriweather", oswald: "Oswald",
  carlito: "Calibri (birebir)", caladea: "Cambria (birebir)", lsans: "Arial / Helvetica (birebir)",
  lserif: "Times New Roman (birebir)", lmono: "Courier New (birebir)", gelasio: "Georgia (birebir)",
};
const METRIC_FILES: Record<MetricKey, string> = {
  carlito: "Carlito", caladea: "Caladea", lsans: "LiberationSans", lserif: "LiberationSerif", lmono: "LiberationMono", gelasio: "Gelasio",
};
const METRIC_CSS_NAME: Record<MetricKey, string> = {
  carlito: "PPE Carlito", caladea: "PPE Caladea", lsans: "PPE Liberation Sans", lserif: "PPE Liberation Serif", lmono: "PPE Liberation Mono", gelasio: "PPE Gelasio",
};
const FONT_KEYS: FontKey[] = ["carlito", "caladea", "lsans", "lserif", "lmono", "gelasio", "sans", "serif", "mono", "lato", "montserrat", "merriweather", "oswald"];
const isFontKey = (k: unknown): k is FontKey => typeof k === "string" && (FONT_KEYS as string[]).includes(k);
const FONT_LABEL: Record<FontKey, string> = {
  sans: "Roboto", serif: "Noto Serif", mono: "Roboto Mono",
  lato: "Lato", montserrat: "Montserrat", merriweather: "Merriweather", oswald: "Oswald",
  // Sunucu (insert_htmlbox) @font-face aile adları — edit_fonts.METRIC_FAMILIES ile aynı.
  carlito: "Carlito", caladea: "Caladea", lsans: "Liberation Sans", lserif: "Liberation Serif", lmono: "Liberation Mono", gelasio: "Gelasio",
};
// Hazır renk paleti — hızlı seçim.
const PRESET_COLORS = ["#111111", "#ffffff", "#e11d48", "#f59e0b", "#16a34a", "#2563eb", "#7c3aed", "#0891b2", "#6b7280", "#000000"];

// Metin genişliğini PDF nokta (pt) cinsinden ölç — komşu-kaydırma (madde 3) hesabı için.
// Ölçümde fontSize=pt→px kullanıldığından dönen genişlik pt ile sayısal olarak eşdeğer.
const _measureCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
// Kelime bazlı zengin HTML'i export öncesi hafifçe temizle (insert_htmlbox'a giden).
// Script/style/olay-işleyici ve gömme etiketlerini sıyır; contentEditable'ın ürettiği
// span/b/i/u/font gibi güvenli biçim etiketlerini korur.
function sanitizeRichHtml(html: string): string {
  return html
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|img|svg)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
}

type Spacing = { hs: number; cs: number; ws: number };
const NO_SPACING: Spacing = { hs: 1, cs: 0, ws: 0 };

function measureTextPt(text: string, sizePt: number, fontKey: FontKey, bold: boolean, italic: boolean, sp: Spacing = NO_SPACING, css?: string): number {
  const ctx = _measureCanvas?.getContext("2d");
  if (!ctx || !text) return 0;
  ctx.font = `${italic ? "italic " : ""}${bold ? "700 " : "400 "}${sizePt}px ${css ?? FONT_CSS[fontKey]}`;
  // Sunucudaki edit_fonts.spaced_width ile aynı: glif genişliği×hs + harf başına cs + boşluk başına ws.
  const spaces = (text.match(/ /g) ?? []).length;
  return ctx.measureText(text).width * sp.hs + sp.cs * [...text].length + sp.ws * spaces;
}

// Satır yüksekliği 1 iken taban çizgisinin kutu üstünden uzaklığı (em) — fontun GERÇEK
// ascent/descent'inden (CSS yarım-aralık kuralı): (1 − (A + D)) / 2 + A. Sabit 0.8 yerine
// her font için ölçülür → önizleme taban çizgisi indirilen PDF'teki ile aynı.
const _baselineCache = new Map<string, number>();
function baselineRatio(fontCss: string, bold: boolean, italic: boolean): number {
  const key = `${fontCss}|${bold}|${italic}`;
  const hit = _baselineCache.get(key);
  if (hit !== undefined) return hit;
  const ctx = _measureCanvas?.getContext("2d");
  if (!ctx) return 0.8;
  ctx.font = `${italic ? "italic " : ""}${bold ? "700 " : "400 "}100px ${fontCss}`;
  const m = ctx.measureText("Hg");
  const A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
  if (!(A > 0) || !(D >= 0)) return 0.8;
  const r = (100 - (A + D)) / 2 / 100 + A / 100;
  if (document.fonts?.check?.(ctx.font)) _baselineCache.set(key, r); // font yüklenince önbelleğe al
  return r;
}

/** Otomatik-genişleyen düzenlenebilir metin (contentEditable) — orijinal boyutu korur,
 * kutu içeriğe göre büyür (kırpmaz). Kontrolsüz: metin bir kez ayarlanır. */
/** Silinen görselin ÖNİZLEMESİ: sunucu görseli boyamadan kaldırır (zemin aynen görünür); önizlemede
 * de düz renk kutu yerine alan, çevresindeki piksellerden yatay+dikey doğrusal geçişle doldurulur
 * (degrade/fotoğraf zeminde kutu görünmez). `src` = sayfanın çizildiği canvas, `rect` = CSS px. */
function FillPatch({ src, rect, onClick, title }: {
  src: HTMLCanvasElement | null; rect: { left: number; top: number; width: number; height: number };
  onClick: (e: React.MouseEvent) => void; title: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const out = ref.current;
    if (!src || !out) return;
    const L = Math.max(1, Math.floor(rect.left)), T = Math.max(1, Math.floor(rect.top));
    const W = Math.max(1, Math.min(src.width - L - 1, Math.ceil(rect.width))), H = Math.max(1, Math.min(src.height - T - 1, Math.ceil(rect.height)));
    const sctx = src.getContext("2d", { willReadFrequently: true });
    const octx = out.getContext("2d");
    if (!sctx || !octx) return;
    out.width = W; out.height = H;
    // Kenar şeritleri (kutunun hemen DIŞI): sol/sağ sütun, üst/alt satır.
    const left = sctx.getImageData(L - 1, T, 1, H).data, right = sctx.getImageData(L + W, T, 1, H).data;
    const top = sctx.getImageData(L, T - 1, W, 1).data, bottom = sctx.getImageData(L, T + H, W, 1).data;
    // Bir kenar diğerlerinden çok farklıysa (ör. logo bandın tam kenarında → dışı beyaz sayfa) o kenar
    // YOK sayılır; yoksa önizleme bantta açık renkli bir geçiş gösteriyordu (canlıda görüldü).
    const mean = (d: Uint8ClampedArray) => { const m = [0, 0, 0]; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; } return m.map((v) => v / Math.max(1, n)); };
    const sides = { left: mean(left), right: mean(right), top: mean(top), bottom: mean(bottom) };
    const dist = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const ok = (k: keyof typeof sides) => {
      const others = (Object.keys(sides) as (keyof typeof sides)[]).filter((o) => o !== k).map((o) => sides[o]);
      const med = [0, 1, 2].map((c) => others.map((o) => o[c]).sort((x, y) => x - y)[1]);
      return dist(sides[k], med) < 90;
    };
    const useL = ok("left"), useR = ok("right"), useT = ok("top"), useB = ok("bottom");
    const img = octx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const fy = H > 1 ? y / (H - 1) : 0;
      for (let x = 0; x < W; x++) {
        const fx = W > 1 ? x / (W - 1) : 0;
        const o = (y * W + x) * 4;
        for (let k = 0; k < 3; k++) {
          const L = useL ? left[y * 4 + k] : useR ? right[y * 4 + k] : NaN;
          const R = useR ? right[y * 4 + k] : L;
          const T = useT ? top[x * 4 + k] : useB ? bottom[x * 4 + k] : NaN;
          const B = useB ? bottom[x * 4 + k] : T;
          const hz = L * (1 - fx) + R * fx;
          const vt = T * (1 - fy) + B * fy;
          const hv = Number.isFinite(hz), vv = Number.isFinite(vt);
          img.data[o + k] = hv && vv ? (hz + vt) / 2 : hv ? hz : vv ? vt : 255;
        }
        img.data[o + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
  }, [src, rect.left, rect.top, rect.width, rect.height]);
  return <canvas ref={ref} onClick={onClick} title={title} className="absolute cursor-pointer outline-dashed outline-1 outline-slate-300/70"
    style={{ left: Math.floor(rect.left), top: Math.floor(rect.top), width: Math.ceil(rect.width), height: Math.ceil(rect.height) }} />;
}

function AutoText({ id, initial, initialHtml, className, style, onInput, onClick, onFocus, autoFocus }: {
  id: string; initial: string; initialHtml?: string; className?: string; style?: React.CSSProperties;
  onInput: (text: string, html: string) => void; onClick: (e: React.MouseEvent) => void; onFocus: () => void; autoFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Zengin biçim varsa (kelime bazlı) innerHTML; yoksa düz metin.
    if (initialHtml && /<[a-z]/i.test(initialHtml)) el.innerHTML = initialHtml;
    else el.textContent = initial;
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
      onInput={() => onInput(ref.current?.textContent ?? "", ref.current?.innerHTML ?? "")}
      onClick={onClick} onFocus={onFocus}
      className={className}
      style={{ whiteSpace: "pre", display: "inline-block", minWidth: "6px", ...style }} />
  );
}

export function PdfEditor({ language, accessToken, initialFile }: { language: Language; accessToken?: string | null; initialFile?: File | null }) {
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
  const [addedImages, setAddedImages] = useState<AddedImg[]>([]);
  const [imgDrag, setImgDrag] = useState<ImgDrag>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(14);
  const [font, setFont] = useState<FontKey>("sans");
  const [align, setAlign] = useState<AlignKey>("left");
  // Çoklu seçim (Ctrl+A / toplu biçim). Boşsa tekil `selected` geçerli.
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set());
  const [tourOpen, setTourOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrTried, setOcrTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  // Sonuç sunucuda saklanır; blob İLK indirmede (günlük limit düşerek) alınır ve
  // önbelleğe konur → sonraki aç/paylaş tekrar limit düşmez.
  const [result, setResult] = useState<{ resultId: string; dl: string; filename: string; blob?: Blob } | null>(null);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [shared, setShared] = useState(false);
  // Öğe id → örneklenen arka plan rengi (#RRGGBB). Silgi/redaction bu renkle doldurulur
  // (beyaz varsayım yerine) → kırmızı/siyah/resimli zeminde beyaz kutu kalmaz.
  const [bgMap, setBgMap] = useState<Map<string, string>>(new Map());
  // Orijinal gömülü fontlar: anahtar → (tarayıcı aile adı, belgede doğrulanmış harfler). Yalnız
  // FontFace başarıyla yüklenenler — sunucu da AYNI kuralla (tüm harfler kümede) orijinali kullanır.
  const [origFonts, setOrigFonts] = useState<Map<string, { family: string; chars: string }>>(new Map());
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
    if (!document.getElementById("pdf-editor-metric-fonts")) {
      const st = document.createElement("style");
      st.id = "pdf-editor-metric-fonts";
      const faces: string[] = [];
      for (const k of Object.keys(METRIC_FILES) as MetricKey[]) {
        for (const [suf, w, it] of [["Regular", 400, "normal"], ["Bold", 700, "normal"], ["Italic", 400, "italic"], ["BoldItalic", 700, "italic"]] as const) {
          faces.push(`@font-face{font-family:'${METRIC_CSS_NAME[k]}';src:url('/fonts/edit/${METRIC_FILES[k]}-${suf}.woff2') format('woff2');font-weight:${w};font-style:${it};font-display:block;}`);
        }
      }
      st.textContent = faces.join("");
      document.head.appendChild(st);
    }
  }, []);

  // Mini tur (madde 6): editör ilk açıldığında göster; ?tour=1 ile her zaman tekrar oynat.
  useEffect(() => {
    if (!editorOpen) return;
    let replay = false;
    try { replay = new URLSearchParams(window.location.search).get("tour") === "1"; } catch { /* ignore */ }
    let seen = false;
    try { seen = localStorage.getItem("pdfEditorTourSeen") === "1"; } catch { /* ignore */ }
    if (!replay && seen) return;
    // Editör DOM'u ve ilk sayfa render'ı otursun diye kısa gecikme.
    const t = window.setTimeout(() => setTourOpen(true), 650);
    return () => window.clearTimeout(t);
  }, [editorOpen]);

  const closeTour = useCallback((r: { completed: boolean; shown: boolean; dontShowAgain: boolean }) => {
    setTourOpen(false);
    if (r.shown) { try { localStorage.setItem("pdfEditorTourSeen", "1"); } catch { /* ignore */ } }
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const pageEls = analysis?.pages[current]?.elements ?? [];
  // Görseller ALTTA, metinler ÜSTTE çizilsin → taranmış sayfada (tam sayfa görsel + OCR metni)
  // ya da görsel zemin üstündeki yazıda tıklama metne gider, görsel onu yutmaz.
  const pageElsStacked = [...pageEls.filter((e) => e.type === "image"), ...pageEls.filter((e) => e.type !== "image")];
  const pageAdded = added.filter((a) => a.page === current);
  const pageImages = addedImages.filter((a) => a.page === current);
  const editCount = edits.size + added.length + addedImages.length;
  // Taranmış PDF: hiç metin katmanı yok (yalnız görsel) → var olan yazı düzenlenemez.
  // Sayfa bazlı: görüntü ağırlıklı ve düzenlenebilir yazısı olmayan sayfa varsa OCR önerilir
  // (tek bir "Sayfa 1" yazısı artık tüm taramayı gizlemez).
  const scanned = !!analysis && scannedPageIndexes(analysis).length > 0;

  async function pickFile(f: File | undefined) {
    setError(null);
    setResult(null);
    if (!f) return;
    if (f.type !== "application/pdf") { setError(tr ? "Lütfen bir PDF seçin." : "Please choose a PDF."); return; }
    try {
      setFile(f);
      setLoadingMsg(tr ? "Belge analiz ediliyor…" : "Analyzing document…");
      const buf = await f.arrayBuffer();
      // Analiz SUNUCUDA (PyMuPDF) — renk/kalın/italik/span bölme kaynağından birebir; hafif
      // (sayfa başına ~10-70 ms). Ağır olan OCR ise cihazda (runOcr).
      const [d, a] = await Promise.all([
        pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise,
        analyzePdf(f, accessToken ?? null),
      ]);
      colorDoneRef.current.clear();
      setDoc(d);
      setAnalysis(mergeInvisibleWords(a));
      setPageCount(d.numPages);
      setCurrent(0);
      setEdits(new Map());
      setAdded([]);
      setOcrTried(false);
      setEditorOpen(true);
    } catch (e) {
      setFile(null);
      setError(e instanceof Error ? e.message : tr ? "PDF açılamadı." : "Couldn't open the PDF.");
    } finally { setLoadingMsg(null); }
  }

  // Dışarıdan (ör. PDF Merkezi → PDF Düzenle) gelen başlangıç PDF'i otomatik yükle.
  useEffect(() => {
    if (initialFile) void pickFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

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

  // Orijinal gömülü fontları tarayıcıya yükle (FontFace). Yüklenemeyen (tarayıcının reddettiği)
  // font listeye girmez → o öğe ölçü-uyumlu aileyle önizlenir ve sunucuya ofont GÖNDERİLMEZ.
  useEffect(() => {
    const fonts = analysis?.fonts;
    if (!fonts || !Object.keys(fonts).length) { setOrigFonts(new Map()); return; }
    let alive = true;
    const tag = uid();
    void Promise.all(Object.entries(fonts).map(async ([key, f]) => {
      try {
        const bytes = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
        const family = `PPO ${tag} ${key}`;
        const face = new FontFace(family, bytes);
        await face.load();
        document.fonts.add(face);
        return [key, { family, chars: f.chars }] as const;
      } catch { return null; }
    })).then((res) => {
      if (!alive) return;
      setOrigFonts(new Map(res.filter((x): x is NonNullable<typeof x> => !!x)));
    });
    return () => { alive = false; };
  }, [analysis?.fonts]);

  // OCR metninin vektör rengi yok → sayfa ilk açıldığında çizilmiş sayfadan örneklenir
  // (sunucu analizindeki öğelerin rengi zaten var; onlara dokunulmaz).
  const colorDoneRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!doc || !editorOpen || !analysis) return;
    const pi = current;
    if (colorDoneRef.current.has(pi)) return;
    colorDoneRef.current.add(pi);
    const els = analysis.pages[pi]?.elements;
    if (!els) return;
    void fillPageTextColors(doc, pi, els).then((colored) => {
      if (colored === els) return;
      setAnalysis((a) => {
        if (!a || a.pages[pi]?.elements !== els) return a;
        const pages = a.pages.slice();
        pages[pi] = { ...pages[pi], elements: colored };
        return { ...a, pages };
      });
    }).catch(() => { colorDoneRef.current.delete(pi); });
  }, [doc, editorOpen, analysis, current]);

  const setEdit = useCallback((id: string, patch: Edit) => {
    setEdits((m) => { const n = new Map(m); n.set(id, { ...n.get(id), ...patch }); return n; });
  }, []);
  const clearEdit = (id: string) => setEdits((m) => { const n = new Map(m); n.delete(id); return n; });

  function elText(el: PdfElement): string { return edits.get(el.id)?.text ?? el.text ?? ""; }
  function elColor(el: PdfElement): string { return edits.get(el.id)?.color ?? el.color ?? "#111111"; }
  function elSize(el: PdfElement): number { return edits.get(el.id)?.size ?? el.size ?? 12; }
  // Orijinal font kullanılabilir mi: kullanıcı font/kalın/italik değiştirmemiş, zengin biçim yok ve
  // metnin TÜM harfleri belgede bu fontla doğrulanmış → önizleme ve çıktı orijinal gliflerle.
  function origFor(el: PdfElement): string | null {
    const o = el.ofont ? origFonts.get(el.ofont) : undefined;
    if (!o) return null;
    const ed = edits.get(el.id);
    if (ed?.font !== undefined) return null;
    if (ed?.bold !== undefined && ed.bold !== (el.bold ?? false)) return null;
    if (ed?.italic !== undefined && ed.italic !== (el.italic ?? false)) return null;
    if (ed?.html && /<[a-z]/i.test(ed.html)) return null;
    const t = ed?.text ?? el.text ?? "";
    for (const ch of t) if (!o.chars.includes(ch)) return null;
    return o.family;
  }
  function elCss(el: PdfElement): string {
    const fam = origFor(el);
    return fam ? `'${fam}', ${FONT_CSS[elFont(el)]}` : FONT_CSS[elFont(el)];
  }
  // Önizleme örtüsünün dikey sınırı — sunucu vektör yazıda yalnız HARFLERİ siler (dolgu yok), bu
  // yüzden önizleme de tam font kutusunu boyamamalı (tablo çizgisini örtüyordu). Yazının mürekkep
  // bandı: taban çizgisinin 0.85 em üstü (büyük harf üstü aksanı varsa 1 em) ile 0.27 em altı.
  // OCR / görünmez katman / görselde yazı görüntünün parçası → tam kutu (sunucu da orayı boyar).
  function coverY(el: PdfElement): [number, number] {
    const [, y0, , y1] = el.bbox;
    if (el.ink) return [Math.min(y0, el.ink[1]), Math.max(y1, el.ink[3])];
    if (el.type !== "text" || el.ocr || el.inv || el.by == null) return [y0, y1];
    const sz = el.size ?? (y1 - y0) / 1.2;
    const topF = /[ÂÊÎÔÛÄËÏÖÜÀÈÌÒÙÁÉÍÓÚİÅÃÑ]/.test(el.text ?? "") ? 1.0 : 0.85;
    return [Math.max(y0, el.by - topF * sz), Math.min(y1, el.by + 0.27 * sz)];
  }
  // hs = gerçek sıkıştırma (Tz) × genişlik uydurma (yalnız yedek fontta — orijinal font zaten birebir).
  function elSpacing(el: PdfElement): Spacing {
    const orig = !!origFor(el);
    return { hs: (el.hs ?? 1) * (orig ? 1 : (el.fit ?? 1)), cs: (el.cs ?? 0) + (orig ? (el.ocs ?? 0) : 0), ws: el.ws ?? 0 };
  }
  function elFont(el: PdfElement): FontKey { return edits.get(el.id)?.font ?? (isFontKey(el.font) ? el.font : "sans"); }
  function elBold(el: PdfElement): boolean { return edits.get(el.id)?.bold ?? el.bold ?? false; }
  function elItalic(el: PdfElement): boolean { return edits.get(el.id)?.italic ?? el.italic ?? false; }
  function elUnderline(el: PdfElement): boolean { return edits.get(el.id)?.underline ?? false; }
  function elStrike(el: PdfElement): boolean { return edits.get(el.id)?.strike ?? false; }
  function elAlign(el: PdfElement): AlignKey { return edits.get(el.id)?.align ?? "left"; }
  const isDeleted = (id: string) => edits.get(id)?.deleted === true;
  const bgFor = (id: string) => bgMap.get(id) ?? "#ffffff";

  // ── Seçim hedefleri + toplu uygulama (Ctrl+A / çoklu seçim) ──
  const isAddedId = (id: string) => added.some((a) => a.id === id);
  const selTargets = (): string[] => {
    if (multiSel.size) return [...multiSel];
    if (selected) return [selected];
    return [];
  };
  // Bir biçim yamasını seçili TÜM öğelere uygula (eklenen metin ↔ mevcut metin ayrımıyla).
  const applyPatch = useCallback((patch: Partial<Added> & Edit) => {
    const ids = multiSel.size ? [...multiSel] : selected ? [selected] : [];
    if (!ids.length) return;
    for (const id of ids) {
      if (added.some((a) => a.id === id)) setAdded((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      else setEdit(id, patch);
    }
  }, [multiSel, selected, added, setEdit]);
  // Toolbar vurgusu için birincil (ilk) seçili öğenin biçim durumu.
  const primaryId = () => (multiSel.size ? [...multiSel][0] : selected);
  function curFmt(key: keyof Fmt): boolean | AlignKey {
    const id = primaryId();
    if (!id) return key === "align" ? "left" : false;
    const a = added.find((x) => x.id === id);
    if (a) return key === "align" ? (a.align ?? "left") : !!a[key];
    const el = analysis?.pages[current]?.elements.find((x) => x.id === id);
    const ed = edits.get(id);
    if (key === "align") return ed?.align ?? "left";
    if (key === "bold") return ed?.bold ?? el?.bold ?? false;
    if (key === "italic") return ed?.italic ?? el?.italic ?? false;
    return !!ed?.[key];
  }
  // ── Kelime bazlı zengin biçim (seçili metin parçasına uygula) ──
  /** Odaklı düzenlenebilir metin içinde ÇÖKMEMİŞ (gerçek) seçim varsa döndürür. */
  function focusedSelection(): { el: HTMLElement; id: string } | null {
    const ae = document.activeElement as HTMLElement | null;
    if (!ae || !ae.isContentEditable) return null;
    const id = ae.getAttribute("data-tid");
    if (!id) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    if (!ae.contains(sel.anchorNode) || !ae.contains(sel.focusNode)) return null;
    return { el: ae, id };
  }
  function commitRich(el: HTMLElement, id: string) {
    setEdit(id, { text: el.textContent ?? "", html: el.innerHTML });
  }
  /** Seçili parçaya execCommand ile biçim uygula; seçim yoksa false → çağıran tüm-öğeye düşer. */
  function richExec(cmd: string, value?: string): boolean {
    const f = focusedSelection();
    if (!f) return false;
    try { document.execCommand("styleWithCSS", false, "true"); } catch { /* eski tarayıcı */ }
    try { document.execCommand(cmd, false, value); } catch { return false; }
    commitRich(f.el, f.id);
    return true;
  }
  /** Seçili parçayı bir <span> ile sarmalayıp verilen stili uygula (manuel → temiz, tırnaklı CSS). */
  function richWrapStyle(applyStyle: (span: HTMLSpanElement) => void): boolean {
    const f = focusedSelection();
    if (!f) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    try {
      const range = sel.getRangeAt(0);
      const span = document.createElement("span");
      applyStyle(span);
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.removeAllRanges();
      const r = document.createRange();
      r.selectNodeContents(span);
      sel.addRange(r);
    } catch { return false; }
    commitRich(f.el, f.id);
    return true;
  }
  /** Seçili parçayı em ORANIYLA büyüt/küçült (px değil → önizleme+export ölçekten bağımsız doğru). */
  const richFontStep = (bigger: boolean): boolean =>
    richWrapStyle((span) => { span.style.fontSize = bigger ? "1.15em" : "0.87em"; });
  /** Seçili parçaya gerçek font ailesi (Roboto/Noto Serif/…) uygula → backend @font-face ile doğru. */
  const richFontFamily = (fam: string): boolean =>
    richWrapStyle((span) => { span.style.fontFamily = `'${fam}'`; });
  const toggleFmt = (key: "bold" | "italic" | "underline" | "strike") => {
    const cmd = key === "bold" ? "bold" : key === "italic" ? "italic" : key === "underline" ? "underline" : "strikeThrough";
    if (richExec(cmd)) return; // seçili kelime/parça → yalnız ona uygula
    applyPatch({ [key]: !curFmt(key) } as Fmt); // seçim yoksa → tüm öğe
  };
  const applyAlign = (a: AlignKey) => { setAlign(a); applyPatch({ align: a }); }; // hizalama satır bazlı
  function sizeStep(bigger: boolean) {
    if (richFontStep(bigger)) return; // seçili parça → em oranıyla
    applySize(bigger ? size + 1 : size - 1); // tüm öğe
  }

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

  // Eklenen resim: taşıma / boyutlandırma (oran korumalı) / merkez etrafı döndürme.
  useEffect(() => {
    if (!imgDrag) return;
    const onMove = (e: PointerEvent) => {
      setAddedImages((arr) => arr.map((im) => {
        if (im.id !== imgDrag.id) return im;
        const [x0, y0, x1, y1] = im.bbox;
        if (imgDrag.mode === "move") {
          const dx = (e.clientX - imgDrag.sx) / scale, dy = (e.clientY - imgDrag.sy) / scale;
          const w = x1 - x0, h = y1 - y0;
          const nx = Math.max(0, imgDrag.ox + dx), ny = Math.max(0, imgDrag.oy + dy);
          return { ...im, bbox: [nx, ny, nx + w, ny + h] };
        }
        if (imgDrag.mode === "resize") {
          const dw = (e.clientX - imgDrag.sx) / scale;
          const nw = Math.max(16, imgDrag.ow + dw);
          const nh = nw / (im.aspect || 1);
          return { ...im, bbox: [imgDrag.x0, imgDrag.y0, imgDrag.x0 + nw, imgDrag.y0 + nh] };
        }
        const ang = (Math.atan2(e.clientY - imgDrag.cy, e.clientX - imgDrag.cx) * 180) / Math.PI + 90;
        let deg = Math.round(ang);
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        return { ...im, rotate: ((deg % 360) + 360) % 360 };
      }));
    };
    const onUp = () => setImgDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [imgDrag, scale]);

  function addImageFile(f: File | undefined) {
    if (!f || !f.type.startsWith("image/")) return;
    const rd = new FileReader();
    rd.onload = () => {
      const dataUrl = String(rd.result);
      const im = new Image();
      im.onload = () => {
        const aspect = im.width / im.height || 1;
        const pageW = analysis?.pages[current]?.width ?? (scale ? dims.w / scale : 400);
        const pageH = analysis?.pages[current]?.height ?? (scale ? dims.h / scale : 560);
        const w = Math.min(pageW * 0.35, pageW - 20);
        const h = w / aspect;
        const x0 = Math.max(0, (pageW - w) / 2), y0 = Math.max(0, (pageH - h) / 2);
        const id = uid();
        setAddedImages((arr) => [...arr, { id, page: current, bbox: [x0, y0, x0 + w, y0 + h], dataUrl, aspect, rotate: 0 }]);
        setSelected(id);
        setAddMode(false);
      };
      im.src = dataUrl;
    };
    rd.readAsDataURL(f);
  }

  function ensureBg(el: PdfElement) {
    if (bgMap.has(el.id)) return;
    const c = sampleBgColor(el.bbox[0], el.bbox[1], el.bbox[2], el.bbox[3]);
    setBgMap((mp) => { const n = new Map(mp); n.set(el.id, c); return n; });
  }

  function selectEl(el: PdfElement, additive = false) {
    if (additive) {
      // Ctrl/Shift ile tıkla → çoklu seçime ekle/çıkar.
      setMultiSel((s) => { const n = new Set(s); if (n.has(el.id)) n.delete(el.id); else n.add(el.id); return n; });
      setSelected(el.id);
    } else {
      setMultiSel(new Set());
      setSelected(el.id);
    }
    setAddMode(false);
    ensureBg(el);
    if (el.type === "text") { setColor(elColor(el)); setSize(Math.round(elSize(el))); setFont(elFont(el)); setAlign(elAlign(el)); }
  }
  // Native picker/select (renk kutusu, font açılır menüsü) AÇILINCA contentEditable seçimi
  // kaybolur → AÇILMADAN ÖNCE (mousedown) seçimi sakla, seçim yapılınca geri yükleyip yalnız
  // o parçaya uygula.
  const savedRangeRef = useRef<{ id: string; range: Range } | null>(null);
  function captureSelectionForPicker() {
    const f = focusedSelection();
    const sel = window.getSelection();
    if (f && sel && sel.rangeCount) savedRangeRef.current = { id: f.id, range: sel.getRangeAt(0).cloneRange() };
    else savedRangeRef.current = null;
  }
  /** Native picker/select açılmadan önce saklanan seçimi geri yükle (varsa true). */
  function restoreSaved(): boolean {
    const saved = savedRangeRef.current;
    savedRangeRef.current = null;
    if (!saved) return false;
    const el = document.querySelector<HTMLElement>(`[data-tid="${saved.id}"]`);
    const sel = window.getSelection();
    if (!el || !sel) return false;
    el.focus();
    sel.removeAllRanges();
    sel.addRange(saved.range);
    return true;
  }
  function applyFont(fk: FontKey) {
    setFont(fk);
    restoreSaved(); // font menüsü seçimi kaybettiyse geri yükle
    // Seçili parça varsa yalnız ona; gerçek font adı (backend @font-face ile 7 font doğru).
    if (richFontFamily(FONT_LABEL[fk])) return;
    applyPatch({ font: fk });
  }
  function applyColorFromPicker(c: string) {
    setColor(c);
    restoreSaved(); // renk penceresi seçimi kaybettiyse geri yükle
    if (richExec("foreColor", c)) return; // yalnız seçili parça
    applyPatch({ color: c }); // seçim yoksa tüm öğe
  }

  // Klavye ile silme: bir GÖRSEL seçiliyken Delete/Backspace → hemen sil (beyazla kapat).
  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const editing = tag === "textarea" || tag === "input" || (document.activeElement as HTMLElement)?.isContentEditable;
      // Ctrl/Cmd+A → sayfadaki TÜM düzenlenebilir metinleri seç (toplu biçim için).
      // Bir metni düzenlerken (contentEditable) araya girme → normal metin seçimi çalışsın.
      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        if (editing) return;
        e.preventDefault();
        const ids = [
          ...(analysis?.pages[current]?.elements ?? []).filter((x) => x.type === "text" && edits.get(x.id)?.deleted !== true).map((x) => x.id),
          ...added.filter((a) => a.page === current).map((a) => a.id),
        ];
        setMultiSel(new Set(ids));
        setSelected(ids[0] ?? null);
        return;
      }
      if (e.key === "Escape") { setMultiSel(new Set()); return; }
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (editing) return;
      // Çoklu seçim varken toplu sil.
      if (multiSel.size) {
        e.preventDefault();
        for (const id of multiSel) {
          const el = analysis?.pages[current]?.elements.find((x) => x.id === id);
          if (el) setEdit(id, { deleted: true });
          else setAdded((a) => a.filter((x) => x.id !== id));
        }
        setMultiSel(new Set()); setSelected(null);
        return;
      }
      if (!selected) return;
      const el = analysis?.pages[current]?.elements.find((x) => x.id === selected);
      if (el?.type === "image") { e.preventDefault(); setEdit(el.id, { deleted: true }); setSelected(null); }
      else if (el?.type === "text") { e.preventDefault(); setEdit(el.id, { deleted: true }); setSelected(null); }
      else if (pageAdded.find((a) => a.id === selected)) { e.preventDefault(); setAdded((a) => a.filter((x) => x.id !== selected)); setSelected(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, selected, current, analysis, pageAdded, added, edits, multiSel]);

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
    if (richExec("foreColor", c)) return; // seçili kelime/parça → yalnız ona
    applyPatch({ color: c }); // seçim yoksa → tüm öğe
  }
  function applySize(s: number) {
    const cl = Math.max(6, Math.min(72, Math.round(s)));
    setSize(cl);
    applyPatch({ size: cl });
  }

  // ── Madde 3: Komşu metni sağa kaydır ──
  // Bir metin kutusu düzenlenip genişleyince (yeni metin kutudan taşınca), AYNI SATIRDAKİ
  // sağındaki metinleri, taşma miktarı kadar sağa öteler. Böylece font küçültülmez ve
  // komşu yazının üstüne binmez. Dönen harita: element id → kaydırma (PDF pt).
  const computeShifts = useCallback((pageIndex: number): Map<string, number> => {
    const out = new Map<string, number>();
    const els = (analysis?.pages[pageIndex]?.elements ?? []).filter((e) => e.type === "text");
    if (!els.length) return out;
    const byLine = new Map<string, PdfElement[]>();
    for (const el of els) {
      const key = el.line ?? `~${Math.round(el.by ?? el.bbox[1])}`;
      const arr = byLine.get(key);
      if (arr) arr.push(el); else byLine.set(key, [el]);
    }
    for (const group of byLine.values()) {
      group.sort((a, b) => a.bbox[0] - b.bbox[0]);
      let cum = 0;
      for (const el of group) {
        if (cum > 0.5) out.set(el.id, cum);
        if (edits.get(el.id)?.deleted) continue;
        const ed = edits.get(el.id);
        // Yalnız GERÇEKTEN değişen (metin/boyut/font/kalın) öğeler taşma üretir.
        const changed = ed && (ed.text !== undefined || ed.size !== undefined || ed.font !== undefined || ed.bold !== undefined);
        if (!changed) continue;
        const txt = edits.get(el.id)?.text ?? el.text ?? "";
        const boxW = el.bbox[2] - el.bbox[0];
        const w = measureTextPt(txt, edits.get(el.id)?.size ?? el.size ?? 12, elFont(el), edits.get(el.id)?.bold ?? el.bold ?? false, edits.get(el.id)?.italic ?? el.italic ?? false, elSpacing(el), elCss(el));
        const overflow = w - boxW;
        if (overflow > 1) cum += overflow + 2; // 2pt güvenlik payı
      }
    }
    return out;
  }, [analysis, edits]);

  const shifts = useMemo(() => computeShifts(current), [computeShifts, current]);

  // Kaydırılan komşuların ORİJİNAL konumunu düzgün örtebilmek için arka plan rengini örnekle.
  useEffect(() => {
    if (!shifts.size) return;
    for (const id of shifts.keys()) {
      if (bgMap.has(id)) continue;
      const el = analysis?.pages[current]?.elements.find((x) => x.id === id);
      if (el) ensureBg(el);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts, current]);

  // Taranmış PDF → CİHAZDA Tesseract OCR ile metni tanı, analizi düzenlenebilir metinle değiştir.
  async function runOcr() {
    if (!file || !doc || !analysis || ocrBusy) return;
    setOcrBusy(true);
    setError(null);
    setLoadingMsg(tr ? "Taranmış belge — metin cihazınızda tanınıyor (ilk kullanımda dil verisi indirilir)…" : "Scanned document — recognizing text on your device (language data downloads on first use)…");
    try {
      const a = await ocrScannedPagesLocal(doc, analysis, (r) =>
        setLoadingMsg(tr ? `Metin tanınıyor… %${Math.round(r * 100)}` : `Recognizing text… ${Math.round(r * 100)}%`));
      colorDoneRef.current.clear();
      setAnalysis(a);
      setEdits(new Map());
      setSelected(null);
      setMultiSel(new Set());
      setOcrTried(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr ? "OCR başarısız." : "OCR failed.");
    } finally {
      setOcrBusy(false);
      setLoadingMsg(null);
    }
  }

  async function preparePdf() {
    if (!file || !analysis) return;
    const ops: PdfTextEdit[] = [];
    // Vektör yazı → sunucu şeritle yalnız harfleri siler (dolgu/görsel/çizgiye dokunmaz).
    const vtOf = (el: PdfElement): Partial<PdfTextEdit> =>
      el.type === "text" && !el.ocr && !el.inv ? { vt: true, osz: el.size } : {};
    for (let p = 0; p < analysis.pages.length; p++) {
      const sMap = computeShifts(p);
      for (const el of analysis.pages[p].elements) {
        const ed = edits.get(el.id);
        const shift = sMap.get(el.id) ?? 0;
        const [x0, y0, x1, y1] = el.bbox;
        if (ed?.deleted) {
          // Silme (metin veya görsel) → orijinali arka planla kapat.
          ops.push({ page: p, bbox: el.bbox, clear: el.ink, text: "", size: ed.size ?? el.size ?? 12, color: ed.color ?? el.color, font: ed.font ?? "sans", bg: bgMap.get(el.id), by: el.by, img: el.type === "image" || undefined, ...vtOf(el) });
          continue;
        }
        if (el.type !== "text") continue;
        const richHtml = ed?.html && /<[a-z]/i.test(ed.html) ? ed.html : undefined;
        const changed = ed && ((ed.text !== undefined && ed.text !== el.text) || ed.color !== undefined || ed.size !== undefined || ed.font !== undefined || ed.bold !== undefined || ed.italic !== undefined || ed.underline !== undefined || ed.strike !== undefined || ed.align !== undefined || !!richHtml);
        let drawBbox: [number, number, number, number] = shift > 0.5 ? [x0 + shift, y0, x1 + shift, y1] : el.bbox;
        // Görüntüdeki yazıda (OCR/görünmez katman) silinecek alan = GERÇEK mürekkep sınırı (el.ink):
        // OCR kutusu harf uçlarından dar → uçlar kalıyordu.
        const clearBase: [number, number, number, number] = el.ink ?? [x0, y0, x1, y1];
        let clearBbox: [number, number, number, number] | undefined = shift > 0.5 || el.ink ? clearBase : undefined;
        // Hizalama merkez/sağ → çizim kutusunu SAYFA genişliğine yay (orijinal x0'ı simetrik
        // marj al), orijinali `clear` ile temizle → ortala/sağa-yasla GERÇEKTEN çalışır
        // (öğenin dar kutusunda hizalama görünmezdi).
        const _alignV = ed?.align;
        if (_alignV === "center" || _alignV === "right") {
          const pageW = analysis.pages[p].width;
          const m = Math.max(0, Math.min(x0, pageW - x1));
          drawBbox = [m, y0, pageW - m, y1];
          clearBbox = clearBase;
        }
        if (changed && richHtml) {
          // Kelime bazlı zengin biçim → insert_htmlbox ile parça parça renk/kalın/italik/
          // altı-üstü çizili/boyut korunur. Temel stil (renk/boyut/font/hizalama) wrapper'da;
          // iç span'ler parça bazında ezer. Boyut em oranıyla saklandığı için ölçek uyumlu.
          const size = ed!.size ?? el.size ?? 12;
          const fk = elFont(el);
          const baseColor = ed!.color ?? el.color ?? "#111111";
          // Gerçek font adı (Roboto/Noto Serif/…) → backend @font-face ile gömülü TTF'ye çözülür
          // (7 font doğru). Tarayıcı önizlemesindeki adla birebir → önizleme = indirilen.
          const wrapped = `<div style="font-family:'${FONT_LABEL[fk]}';font-size:${size}px;color:${baseColor};text-align:${ed!.align ?? "left"};line-height:1.0;margin:0;padding:0">${sanitizeRichHtml(richHtml)}</div>`;
          ops.push({ page: p, bbox: drawBbox, clear: clearBbox, html: wrapped, by: el.by, bg: bgMap.get(el.id), ...vtOf(el) });
          continue;
        }
        if (changed) {
          // Düzenlenmiş öğe. Önizlemedeki font ("sans" varsayılan) ile birebir olsun diye
          // ed.font ?? "sans" kullanılır. Taşma varsa noshrink (küçültme yerine komşu kaydı).
          const size = ed!.size ?? el.size ?? 12;
          const fk = elFont(el);
          const bold = ed!.bold ?? el.bold ?? false;
          const italic = ed!.italic ?? el.italic ?? false;
          const txt = ed!.text ?? el.text ?? "";
          const overflow = measureTextPt(txt, size, fk, bold, italic, elSpacing(el), elCss(el)) - (drawBbox[2] - drawBbox[0]);
          ops.push({
            page: p, bbox: drawBbox, clear: clearBbox, text: txt, size, color: ed!.color ?? el.color,
            font: fk, by: el.by, bg: bgMap.get(el.id),
            noshrink: overflow > 1 ? true : undefined,
            bold: bold || undefined, italic: italic || undefined,
            underline: ed!.underline || undefined, strike: ed!.strike || undefined, align: ed!.align,
            hs: el.hs, cs: el.cs, ws: el.ws, fit: el.fit, ocs: el.ocs, ofont: origFor(el) ? el.ofont : undefined,
            ...vtOf(el),
          });
        } else if (shift > 0.5) {
          // Değişmemiş ama SAĞA KAYDIRILAN komşu → orijinalini temizle, aynı içeriği yeni yere
          // yaz (orijinal font/boyut/renk korunur, küçültme yok).
          ops.push({
            page: p, bbox: drawBbox, clear: clearBbox, text: el.text ?? "", size: el.size ?? 12,
            color: el.color, font: elFont(el), by: el.by, bg: bgMap.get(el.id),
            noshrink: true, bold: el.bold || undefined, italic: el.italic || undefined,
            hs: el.hs, cs: el.cs, ws: el.ws, fit: el.fit, ocs: el.ocs, ofont: origFor(el) ? el.ofont : undefined,
            ...vtOf(el),
          });
        }
      }
    }
    for (const a of added) if (a.text.trim()) ops.push({ page: a.page, bbox: a.bbox, text: a.text, size: a.size, color: a.color, font: a.font, bold: a.bold || undefined, italic: a.italic || undefined, underline: a.underline || undefined, strike: a.strike || undefined, align: a.align });
    for (const im of addedImages) ops.push({ page: im.page, bbox: im.bbox, text: "", size: 0, image: im.dataUrl, rotate: im.rotate });
    if (ops.length === 0) { setError(tr ? "Henüz bir düzenleme yapmadınız." : "No edits yet."); return; }
    try {
      setBusy(true);
      setLimitMsg(null);
      const { resultId, dl } = await editPdfTextPrepare(file, ops, accessToken ?? null);
      setResult({ resultId, dl, filename: `${file.name.replace(/\.pdf$/i, "")}-duzenlenmis.pdf` });
    } catch (e) { setError(e instanceof Error ? e.message : tr ? "Hazırlanamadı." : "Failed."); }
    finally { setBusy(false); }
  }

  function limitText(e: EditDailyLimitError): string {
    // Yenilenme anını SAAT olarak ("Yenilenme: 00:00") yazmak "00:00 kaldı" diye okunuyordu →
    // KALAN SÜRE + saat. resetAt geçmişte/eksikse bir sonraki gece yarısı (Türkiye) kullanılır.
    const now = Date.now();
    let at = e.resetAt ? new Date(e.resetAt).getTime() : NaN;
    if (!Number.isFinite(at) || at <= now) {
      const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
      at = now + ((24 - ist.getHours()) * 60 - ist.getMinutes()) * 60000;
    }
    const mins = Math.max(1, Math.round((at - now) / 60000));
    const h = Math.floor(mins / 60), m = mins % 60;
    const clock = new Date(at).toLocaleTimeString(tr ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
    const when = tr
      ? ` Hakkınız ${h ? `${h} saat ` : ""}${m ? `${m} dakika ` : ""}sonra (${clock === "00:00" ? "gece 00:00" : clock}'da) yenilenir.`
      : ` It renews in ${h ? `${h} h ` : ""}${m ? `${m} min ` : ""}(at ${clock}).`;
    if (tr) {
      return e.guest
        ? `Bugünkü ücretsiz indirme hakkınız doldu (${e.limit}/gün). Ücretsiz hesap açarak günde 2, Pro ile sınırsız indirebilirsiniz.${when}`
        : `Bugünkü indirme limitiniz doldu (${e.limit}/gün). Pro'ya geçerek sınırsız indirin.${when}`;
    }
    return e.guest
      ? `Daily free download limit reached (${e.limit}/day). Sign up free for 2/day, or Pro for unlimited.${when}`
      : `Daily download limit reached (${e.limit}/day). Upgrade to Pro for unlimited.${when}`;
  }


  // Sonucun blob'unu getir — İLK çağrıda sunucudan indirir (günlük limit düşer) ve önbelleğe
  // alır; sonraki aç/paylaş tekrar limit düşürmeden bu blob'u kullanır.
  async function ensureBlob(): Promise<Blob | null> {
    if (!result) return null;
    if (result.blob) return result.blob;
    setFetching(true); setLimitMsg(null); setError(null);
    try {
      const blob = await downloadEditedPdf(result.resultId, result.dl, accessToken ?? null);
      setResult((r) => (r ? { ...r, blob } : r));
      return blob;
    } catch (e) {
      if (e instanceof EditDailyLimitError) setLimitMsg(limitText(e));
      else setError(e instanceof Error ? e.message : tr ? "İndirilemedi." : "Download failed.");
      return null;
    } finally { setFetching(false); }
  }

  async function downloadResult() {
    const fn = result?.filename ?? "duzenlenmis.pdf";
    const blob = await ensureBlob();
    if (blob) void saveBlobToUser(blob, fn).catch(() => {});
  }
  async function openResult() {
    const blob = await ensureBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function shareResult() {
    const fn = result?.filename ?? "duzenlenmis.pdf";
    const blob = await ensureBlob();
    if (!blob) return;
    const f = new File([blob], fn, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d?: unknown) => boolean };
    if (typeof nav.share === "function" && nav.canShare?.({ files: [f] })) {
      try { await nav.share({ files: [f], title: fn }); setShared(true); setTimeout(() => setShared(false), 1600); return; } catch { /* iptal */ }
    }
    void saveBlobToUser(blob, fn).catch(() => {});
  }
  function reset() { setFile(null); setDoc(null); setAnalysis(null); setEdits(new Map()); setAdded([]); setAddedImages([]); setResult(null); setError(null); setLimitMsg(null); setFetching(false); setEditorOpen(false); setThumbs([]); setZoom(1); setMultiSel(new Set()); setOcrTried(false); setOcrBusy(false); }

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
        <p>{tr
          ? <>Gerçek düzenleme için dosyanız güvenli sunucumuzda işlenir ve işlem biter bitmez silinir. Ücretsiz kayıt hakkı: misafir günde 1, üye günde 2 — <b>Pro'da sınırsız</b>.</>
          : <>For real editing, your file is processed on our secure server and deleted right after. Free saves: 1/day as a guest, 2/day with an account — <b>unlimited with Pro</b>.</>}</p>
      </div>

      {scanned && (
        <div className="mb-4 rounded-2xl border border-orange-400/30 bg-orange-500/[0.08] px-4 py-3 text-[13px] text-orange-200">
          <div className="flex items-start gap-2.5">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{ocrTried
              ? (tr
                ? "OCR bu belgede düzenlenebilir metin bulamadı (görüntü kalitesi düşük olabilir). Görselleri silebilir ve «Metin Ekle» ile üzerine yeni yazı ekleyebilirsiniz."
                : "OCR couldn't find editable text in this document (image quality may be low). You can delete images and add new text with «Add Text».")
              : (tr
                ? "Bu PDF taranmış görünüyor (sayfalar resim). Metni düzenlenebilir yapmak için OCR çalıştırın — yazıları tanıyıp metne çevirir."
                : "This PDF looks scanned (pages are images). Run OCR to make the text editable — it recognizes the words and turns them into text.")}</p>
          </div>
          {!ocrTried && (
            <button type="button" onClick={() => void runOcr()} disabled={ocrBusy}
              className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50">
              {ocrBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {tr ? "Metni Tanı (OCR)" : "Recognize Text (OCR)"}
            </button>
          )}
        </div>
      )}

      {result ? (
        <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"><Check className="h-8 w-8" /></div>
          <p className="mt-4 text-xl font-bold text-white">{tr ? "PDF hazır 🎉" : "Ready 🎉"}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => void downloadResult()} disabled={fetching} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50">{fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{tr ? "İndir" : "Download"}</button>
            <button type="button" onClick={() => void openResult()} disabled={fetching} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08] disabled:opacity-50"><ExternalLink className="h-4 w-4" />{tr ? "Aç" : "Open"}</button>
            <button type="button" onClick={() => void shareResult()} disabled={fetching} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08] disabled:opacity-50">{shared ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}{tr ? "Paylaş" : "Share"}</button>
            <button type="button" onClick={() => { setResult(null); setLimitMsg(null); setEditorOpen(true); }} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"><Pencil className="h-4 w-4" />{tr ? "Düzenlemeye Dön" : "Back to Editor"}</button>
            <button type="button" onClick={reset} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]">{tr ? "Yeni PDF" : "New PDF"}</button>
          </div>
          {limitMsg && (
            <p className="mx-auto mt-5 max-w-md rounded-xl border border-amber-400/30 bg-amber-500/[0.08] px-4 py-3 text-[13px] text-amber-200">{limitMsg}</p>
          )}
          <ToolRating toolSlug="pdf-duzenle" language={language} />
          {/* Kayıt daveti yalnızca günlük hak dolunca (ceza anı) geçiyordu; başarı
              anında — değer tazeyken — hiçbir davet yoktu. */}
          <ValueMomentNudge language={language} source="editor_success" />
        </div>
      ) : !file ? (
        <div className="tool-form">
          <WorkspaceUploadField
            toolId="pdf-duzenle"
            language={language}
            accept="application/pdf,.pdf"
            note={tr ? "Tam ekran editör açılır — sol sayfalar, sağ düzenleme." : "A full-screen editor opens — pages on the left, editing on the right."}
            onFiles={(files) => { void pickFile(files[0]); }}
          />
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-300"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-100">{file.name}</p><p className="text-[11px] text-slate-400">{editCount > 0 ? (tr ? `${editCount} düzenleme · hazır` : `${editCount} edits · ready`) : (tr ? "Henüz düzenleme yok" : "No edits yet")}</p></div>
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
            <button data-tour="editor-add-text" type="button" onClick={() => { setAddMode((v) => !v); setSelected(null); }} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold transition ${addMode ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40" : "text-slate-300 hover:bg-white/[0.06]"}`}><Type className="h-4 w-4" /><span className="hidden sm:inline">{tr ? "Metin Ekle" : "Add Text"}</span></button>
            <button data-tour="editor-add-image" type="button" onClick={() => imageInputRef.current?.click()} className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.06]"><ImagePlus className="h-4 w-4" /><span className="hidden sm:inline">{tr ? "Resim Ekle" : "Add Image"}</span></button>
            <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => { addImageFile(e.target.files?.[0]); e.target.value = ""; }} />
            {/* Biçimlendirme araçları HER ZAMAN görünür; metin seçili değilken PASİF (soluk). */}
            <span className="mx-1 h-5 w-px bg-white/10" />
            <div
              className="flex flex-wrap items-center gap-2 transition-opacity"
              style={{ opacity: selInfo?.kind === "text" ? 1 : 0.4, pointerEvents: selInfo?.kind === "text" ? "auto" : "none" }}
              aria-disabled={selInfo?.kind !== "text"}
              title={selInfo?.kind === "text" ? undefined : (tr ? "Bir yazıya tıklayın" : "Click a text")}
            >
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-300">
                  {tr ? "Renk" : "Color"}
                  <span className="flex items-center gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyColor(c)} title={c}
                        className={`h-5 w-5 rounded-md border transition hover:scale-110 ${color.toLowerCase() === c.toLowerCase() ? "border-white ring-2 ring-cyan-400" : "border-white/20"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </span>
                  <input type="color" value={color} onMouseDown={captureSelectionForPicker} onChange={(e) => applyColorFromPicker(e.target.value)} className="h-7 w-7 cursor-pointer rounded-lg border border-white/10 bg-transparent" title={tr ? "Özel renk" : "Custom color"} />
                </label>
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-300">
                  {tr ? "Font" : "Font"}
                  <select value={font} onMouseDown={captureSelectionForPicker} onChange={(e) => applyFont(e.target.value as FontKey)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-white">
                    {FONT_KEYS.map((f) => <option key={f} value={f} className="text-black" style={{ fontFamily: FONT_CSS[f] }}>{FONT_MENU[f]}</option>)}
                  </select>
                </label>
                {/* Boyut — görsel seçicideki gibi buton çiftli (madde 9) */}
                <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-300">
                  {tr ? "Boyut" : "Size"}
                  <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1 py-0.5">
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sizeStep(false)} title={tr ? "Küçült" : "Smaller"} aria-label={tr ? "Küçült" : "Smaller"} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="min-w-[2ch] text-center text-[12px] font-semibold tabular-nums text-white">{size}</span>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sizeStep(true)} title={tr ? "Büyüt" : "Larger"} aria-label={tr ? "Büyüt" : "Larger"} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"><Plus className="h-3.5 w-3.5" /></button>
                  </span>
                </label>
                {/* Biçim — kalın/italik/altı çizili/üstü çizili (madde 8) */}
                <span className="mx-1 h-5 w-px bg-white/10" />
                <span className="flex items-center gap-1">
                  {([
                    ["bold", Bold, tr ? "Kalın" : "Bold"],
                    ["italic", Italic, tr ? "İtalik" : "Italic"],
                    ["underline", Underline, tr ? "Altı çizili" : "Underline"],
                    ["strike", Strikethrough, tr ? "Üstü çizili" : "Strikethrough"],
                  ] as [("bold" | "italic" | "underline" | "strike"), typeof Bold, string][]).map(([k, Icon, label]) => (
                    <button key={k} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleFmt(k)} title={label} aria-label={label} aria-pressed={curFmt(k) === true}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${curFmt(k) === true ? "bg-cyan-500/25 text-cyan-200 ring-1 ring-cyan-400/50" : "text-slate-300 hover:bg-white/[0.08]"}`}>
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </span>
                {/* Hizalama (madde 8) */}
                <span className="flex items-center gap-1">
                  {([
                    ["left", AlignLeft, tr ? "Sola yasla" : "Align left"],
                    ["center", AlignCenter, tr ? "Ortala" : "Align center"],
                    ["right", AlignRight, tr ? "Sağa yasla" : "Align right"],
                  ] as [AlignKey, typeof AlignLeft, string][]).map(([k, Icon, label]) => (
                    <button key={k} type="button" onClick={() => applyAlign(k)} title={label} aria-label={label} aria-pressed={curFmt("align") === k}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${curFmt("align") === k ? "bg-cyan-500/25 text-cyan-200 ring-1 ring-cyan-400/50" : "text-slate-300 hover:bg-white/[0.08]"}`}>
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {/* Yakınlaştırma — görsel seçicideki gibi */}
              <div data-tour="editor-zoom" className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-1.5 py-1">
                <button type="button" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.2) * 100) / 100))} title={tr ? "Uzaklaştır" : "Zoom out"} aria-label={tr ? "Uzaklaştır" : "Zoom out"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"><ZoomOut className="h-4 w-4" /></button>
                <input type="range" min={50} max={300} step={10} value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} className="hidden w-24 accent-cyan-400 sm:block" aria-label={tr ? "Yakınlaştırma" : "Zoom"} />
                <button type="button" onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.2) * 100) / 100))} title={tr ? "Yakınlaştır" : "Zoom in"} aria-label={tr ? "Yakınlaştır" : "Zoom in"} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"><ZoomIn className="h-4 w-4" /></button>
                <button type="button" onClick={() => setZoom(1)} title={tr ? "Genişliğe sığdır" : "Fit to width"} className="min-w-[3rem] rounded-lg px-1.5 py-1 text-center text-[12px] font-semibold tabular-nums text-slate-200 transition hover:bg-white/10">{Math.round(zoom * 100)}%</button>
              </div>
              <span className="hidden text-[12px] font-semibold text-slate-300 md:inline">{tr ? "Öğeye tıkla → düzenle. Görsel/amblem seçip Delete → sil" : "Click to edit. Select image + Delete key → remove"} · <span className="text-cyan-300">{editCount} {tr ? "değişiklik" : "edits"}</span></span>
              <button type="button" onClick={() => setTourOpen(true)} title={tr ? "Turu tekrar göster" : "Replay tour"} aria-label={tr ? "Turu tekrar göster" : "Replay tour"} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-cyan-300"><HelpCircle className="h-5 w-5" /></button>
              <button data-tour="editor-done" type="button" onClick={() => setEditorOpen(false)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-[13px] font-bold text-white transition hover:brightness-110"><Check className="h-4 w-4" />{tr ? "Tamam" : "Done"}</button>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label={tr ? "Kapat" : "Close"} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Sol: sayfa thumbnail'leri */}
            <div className="w-28 shrink-0 overflow-y-auto border-r border-white/[0.08] bg-black/20 p-2 sm:w-32">
              {Array.from({ length: pageCount }).map((_, i) => (
                <button key={i} type="button" onClick={() => { setCurrent(i); setSelected(null); }}
                  className={`mb-2 block w-full overflow-hidden rounded-lg border-2 transition ${current === i ? "border-cyan-400" : "border-transparent hover:border-white/20"}`}>
                  {thumbs[i] ? <img src={thumbs[i]} alt={`${i + 1}`} className="w-full bg-white" /> : <div className="flex h-24 w-full items-center justify-center bg-white/5 text-[10px] text-slate-400">{i + 1}</div>}
                  <span className={`block py-0.5 text-center text-[10px] ${current === i ? "text-cyan-300" : "text-slate-400"}`}>{i + 1}</span>
                </button>
              ))}
            </div>

            {/* Sağ: büyük düzenleme alanı */}
            <div className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">
              <div data-tour="editor-canvas" className="relative mx-auto w-fit rounded-lg bg-white shadow-2xl">
                <canvas ref={canvasRef} className="block rounded-lg" />
                {rendering && <div className="absolute inset-0 flex items-center justify-center bg-black/10"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>}
                <div ref={overlayRef} onClick={onCanvasClick} className="absolute inset-0" style={{ cursor: addMode ? "text" : "default" }}>
                  {/* KAPAK katmanı: aktif/kaydırılan metinlerin ORİJİNAL konumunu arka planla ört.
                      İçerik katmanının ALTINDA kalır → sağa kaydırılan komşu metin, örtülen orijinalin
                      ÜSTÜNE net biner (paint sırası sorunu çözülür). */}
                  {pageEls.map((el) => {
                    if (el.type !== "text" || isDeleted(el.id)) return null;
                    const shift = shifts.get(el.id) ?? 0;
                    const activeCover = selected === el.id || multiSel.has(el.id) || edits.has(el.id) || shift > 0.5;
                    if (!activeCover) return null;
                    const [x0, y0, x1, y1] = el.bbox;
                    const [cy0, cy1] = coverY(el);
                    const cx0 = el.ink ? Math.min(x0, el.ink[0]) : x0, cx1 = el.ink ? Math.max(x1, el.ink[2]) : x1;
                    return <div key={`cover_${el.id}`} className="pointer-events-none absolute" style={{ left: cx0 * scale - 1, top: cy0 * scale - 1, width: Math.max((cx1 - cx0 + Math.max(0, shift)) * scale, 4) + 2, height: Math.max((cy1 - cy0) * scale, 6) + 2, backgroundColor: bgFor(el.id) }} />;
                  })}
                  {/* İçerik katmanı — mevcut öğeler (görseller altta) */}
                  {pageElsStacked.map((el) => {
                    const [x0, y0, x1, y1] = el.bbox;
                    const del = isDeleted(el.id);
                    const shift = shifts.get(el.id) ?? 0;
                    const sel = selected === el.id || multiSel.has(el.id);
                    if (el.type === "image") {
                      const style = { left: x0 * scale, top: y0 * scale, width: Math.max((x1 - x0) * scale, 8), height: Math.max((y1 - y0) * scale, 8) } as const;
                      // Silinmiş görsel → arka plan rengiyle kapat. Silgiyi bbox'tan ~3px taşır:
                      // amblem/logo kenarındaki ince hat çizgileri de örtülsün (indirmede zaten yok).
                      if (del) return <FillPatch key={el.id} src={canvasRef.current} onClick={(e) => { e.stopPropagation(); clearEdit(el.id); }} rect={{ left: style.left - 1, top: style.top - 1, width: style.width + 2, height: style.height + 2 }} title={tr ? "Silindi — geri almak için tıkla" : "Deleted — click to undo"} />;
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
                      return <div key={el.id} onClick={(e) => { e.stopPropagation(); clearEdit(el.id); }} className="absolute cursor-pointer ring-1 ring-dashed ring-slate-300/70" style={{ ...eb, top: coverY(el)[0] * scale, height: Math.max((coverY(el)[1] - coverY(el)[0]) * scale, 6), backgroundColor: bgFor(el.id) }} title={tr ? "Silindi — geri almak için tıkla" : "Deleted — click to undo"} />;
                    }
                    // Değişmemiş, seçili değil ve KAYDIRILMAMIŞ → sadece şeffaf tıklama hedefi;
                    // canvas'taki NET orijinal metin görünür (çift görüntü yok).
                    const active = sel || edits.has(el.id) || shift > 0.5;
                    if (!active) {
                      return <div key={el.id} onClick={(e) => { e.stopPropagation(); selectEl(el); }} className="absolute cursor-text rounded-[2px] transition hover:bg-cyan-400/10 hover:ring-1 hover:ring-cyan-400/50" style={eb} title={tr ? "Düzenlemek için tıkla" : "Click to edit"} />;
                    }
                    // Aktif/kaydırılmış → metni SAĞA kaydırılmış konumda çiz (orijinali KAPAK
                    // katmanı örter). Gerçek taban çizgisine (by) hizala + biçim (kalın/italik/
                    // altı-üstü çizili) + hizalama → önizleme indirilen PDF ile birebir (madde 3/7/8).
                    // Backend ile BİREBİR: metin orijinal kutudan genişse fontu SIĞDIR (küçült)
                    // → önizleme, indirilen PDF ile aynı boyutta görünür ("bir tık büyük" biter,
                    // madde 2/7). Düzenlenip taşan (noshrink) veya kaydırılan öğede küçültme yok.
                    const richHtml = edits.get(el.id)?.html;
                    const isRich = !!richHtml && /<[a-z]/i.test(richHtml);
                    const rawPx = elSize(el) * scale;
                    const _sp = isRich ? NO_SPACING : elSpacing(el);
                    const _txtW = measureTextPt(elText(el), elSize(el), elFont(el), elBold(el), elItalic(el), _sp, elCss(el));
                    const _boxW = x1 - x0;
                    const _noShrink = (edits.has(el.id) && _txtW - _boxW > 1) || shift > 0.5;
                    // Zengin (kelime bazlı) öğede küçültme yok — export htmlbox otomatik ölçekler.
                    const _fit = (!isRich && !_noShrink && _txtW > _boxW && _boxW > 1)
                      ? Math.max(_boxW / _txtW, 5 / Math.max(elSize(el), 1))
                      : 1;
                    const fsPx = rawPx * _fit;
                    const baselinePt = el.by ?? (y0 + (el.size ?? 12));
                    const textTop = (baselinePt - y0) * scale - baselineRatio(elCss(el), elBold(el), elItalic(el)) * fsPx;
                    const shiftPx = shift * scale;
                    const deco = [elUnderline(el) ? "underline" : "", elStrike(el) ? "line-through" : ""].filter(Boolean).join(" ") || "none";
                    const al = elAlign(el);
                    // Hizalama merkez/sağ → önizlemede de SAYFA genişliğinde bölgeye yay (export ile
                    // birebir); aksi halde öğenin kendi kutusu. bg şeffaf (geniş bölgeyi doldurmasın).
                    const _pageW = analysis?.pages[current]?.width ?? 0;
                    const _aligned = (al === "center" || al === "right") && _pageW > 0;
                    const _m = _aligned ? Math.max(0, Math.min(x0, _pageW - x1)) : 0;
                    const containerLeft = _aligned ? _m * scale : eb.left + shiftPx;
                    const textW = _aligned ? (_pageW - 2 * _m) * scale : (al === "left" ? undefined : eb.width);
                    return (
                      <div key={el.id} className="absolute" style={{ left: containerLeft, top: eb.top }}>
                        <AutoText id={el.id} initial={elText(el)} initialHtml={richHtml} autoFocus={sel && !edits.has(el.id) && !multiSel.size}
                          onInput={(t, h) => setEdit(el.id, { text: t, html: h })}
                          onClick={(e) => { e.stopPropagation(); selectEl(el, e.ctrlKey || e.metaKey || e.shiftKey); }}
                          onFocus={() => { if (!multiSel.size) selectEl(el); }}
                          className={`outline-none ${sel ? "ring-2 ring-cyan-500" : ""}`}
                          style={{ position: "absolute", left: 0, top: textTop, width: textW, textAlign: al, color: elColor(el), fontSize: `${fsPx}px`, lineHeight: 1, fontWeight: elBold(el) ? 700 : 400, fontStyle: elItalic(el) ? "italic" : "normal", textDecoration: deco, fontFamily: elCss(el), padding: 0, backgroundColor: _aligned || (el.type === "text" && !el.ocr && !el.inv) ? "transparent" : bgFor(el.id),
                            // Orijinal harf/kelime aralığı + yatay ölçek (Tc/Tw/Tz) — sunucu çizimiyle aynı.
                            letterSpacing: _sp.cs ? `${_sp.cs * scale * _fit}px` : undefined,
                            wordSpacing: _sp.ws ? `${_sp.ws * scale * _fit}px` : undefined,
                            transform: _sp.hs !== 1 ? `scaleX(${_sp.hs})` : undefined, transformOrigin: "left center" }} />
                      </div>
                    );
                  })}
                  {/* Eklenen metinler — serbest sürüklenebilir (taşıma tutamacı) */}
                  {pageAdded.map((a) => {
                    const [x0, y0] = a.bbox;
                    const sel = selected === a.id || multiSel.has(a.id);
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
                          onClick={(e) => { e.stopPropagation(); if (!(e.ctrlKey || e.metaKey || e.shiftKey)) setMultiSel(new Set()); setSelected(a.id); setColor(a.color); setSize(a.size); setFont(a.font); setAlign(a.align ?? "left"); setAddMode(false); }}
                          onFocus={() => { if (!multiSel.size) { setSelected(a.id); setColor(a.color); setSize(a.size); setFont(a.font); setAlign(a.align ?? "left"); } }}
                          className={`bg-white/90 leading-none outline-none ${sel ? "ring-2 ring-cyan-500" : "ring-1 ring-cyan-400/50"}`}
                          style={{ position: "absolute", left: 0, top: 0, color: a.color, fontSize: `${a.size * scale}px`, fontFamily: FONT_CSS[a.font], padding: 0, fontWeight: a.bold ? 700 : 400, fontStyle: a.italic ? "italic" : "normal", textDecoration: [a.underline ? "underline" : "", a.strike ? "line-through" : ""].filter(Boolean).join(" ") || "none", textAlign: a.align ?? "left" }} />
                      </div>
                    );
                  })}
                  {/* Eklenen resimler — taşı (sürükle) · köşeden boyutlandır · üstten döndür */}
                  {pageImages.map((im) => {
                    const [x0, y0, x1, y1] = im.bbox;
                    const left = x0 * scale, top = y0 * scale;
                    const w = (x1 - x0) * scale, h = (y1 - y0) * scale;
                    const sel = selected === im.id;
                    return (
                      <div
                        key={im.id}
                        onPointerDown={(e) => { e.stopPropagation(); setSelected(im.id); setAddMode(false); e.currentTarget.setPointerCapture?.(e.pointerId); setImgDrag({ id: im.id, mode: "move", sx: e.clientX, sy: e.clientY, ox: x0, oy: y0 }); }}
                        className={`absolute select-none ${sel ? "ring-2 ring-cyan-500" : "ring-1 ring-cyan-400/40 hover:ring-cyan-400/70"}`}
                        style={{ left, top, width: w, height: h, transform: im.rotate ? `rotate(${im.rotate}deg)` : undefined, cursor: "move", touchAction: "none" }}
                      >
                        <img src={im.dataUrl} alt="" draggable={false} className="pointer-events-none h-full w-full select-none" style={{ objectFit: "fill" }} />
                        {sel && (
                          <>
                            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setAddedImages((a) => a.filter((x) => x.id !== im.id)); setSelected(null); }} className="absolute -right-2.5 -top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow" title={tr ? "Sil" : "Delete"}><Trash2 className="h-3.5 w-3.5" /></button>
                            <span onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); setImgDrag({ id: im.id, mode: "resize", sx: e.clientX, ow: x1 - x0, oh: y1 - y0, x0, y0 }); }} style={{ touchAction: "none" }} className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-cyan-400" title={tr ? "Boyutlandır" : "Resize"} />
                            <span onPointerDown={(e) => { e.stopPropagation(); const r = overlayRef.current!.getBoundingClientRect(); setImgDrag({ id: im.id, mode: "rotate", cx: r.left + left + w / 2, cy: r.top + top + h / 2 }); }} style={{ touchAction: "none" }} className="absolute -top-8 left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-white bg-cyan-400 text-white" title={tr ? "Döndür (Shift: 15°)" : "Rotate (Shift: 15°)"}><RotateCw className="h-3 w-3" /></span>
                            <span className="absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-cyan-400/60" />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mx-auto mt-3 max-w-lg text-center text-[12px] text-slate-400">{tr ? "Yazıya tıkla → değiştir; renk/boyut üstte. Görsele tıkla → «Sil». «Metin Ekle» / «Resim Ekle» ile yeni öğe (resmi köşeden boyutlandır, üstten döndür). Bitince «Tamam» → «PDF'i Hazırla»." : "Click text → edit; color/size on top. Click an image → «Delete». «Add Text» / «Add Image» for new items (resize an image from the corner, rotate from the top). «Done» → «Prepare PDF»."}</p>
              <p className="mx-auto mt-1.5 max-w-lg text-center text-[11px] text-amber-300/70">{tr ? "Not: Bir yazıyı düzenlerken beliren kapatma kutusu üst/alt çizgilere taşabilir — bu yalnızca önizlemedir; indirdiğiniz PDF'te o çizgiler korunur." : "Note: while editing a line, the cover box may overlap the lines above/below — this is preview only; those lines are kept in the downloaded PDF."}</p>
            </div>
          </div>
          <ProductTour
            open={tourOpen}
            onClose={closeTour}
            language={language}
            steps={([
              { selector: "[data-tour='editor-add-text']", title: tr ? "Metin ekle" : "Add text", body: tr ? "Sayfanın istediğiniz yerine yeni yazı ekleyin — tıklayıp yazın, sürükleyerek taşıyın." : "Add new text anywhere on the page — click to type, drag to move." },
              { selector: "[data-tour='editor-add-image']", title: tr ? "Görsel / imza ekle" : "Add image / signature", body: tr ? "İmza, logo veya herhangi bir görsel ekleyin; köşeden boyutlandırın, üstten döndürün." : "Add a signature, logo or any image; resize from the corner, rotate from the top." },
              { selector: "[data-tour='editor-canvas']", title: tr ? "Yazıları düzenle" : "Edit any text", body: tr ? "Herhangi bir yazıya tıklayın → değiştirin. Renk, boyut, kalın/italik/altı çizili ve hizalama üstteki çubukta. Ctrl+A ile tümünü seçip toplu değiştirin (ör. hepsini kırmızı yapın). Uzun yazınca komşu metin otomatik sağa kayar." : "Click any text → edit it. Color, size, bold/italic/underline and alignment are in the top bar. Press Ctrl+A to select all and change them at once (e.g. make everything red). Typing longer text pushes the neighbour right automatically." },
              { selector: "[data-tour='editor-zoom']", title: tr ? "Yakınlaştır" : "Zoom", body: tr ? "Detaylı düzenleme için yakınlaştırın/uzaklaştırın; % ile genişliğe sığdırın." : "Zoom in/out for precise editing; the % button fits to width." },
              { selector: "[data-tour='editor-done']", title: tr ? "Bitir ve indir" : "Finish & download", body: tr ? "«Tamam» → «PDF'i Hazırla» → «İndir/Aç/Paylaş». Önizleme ücretsizdir; günlük indirme hakkı yalnızca indirmede düşer." : "«Done» → «Prepare PDF» → «Download/Open/Share». Preview is free; your daily quota is only used when you download." },
            ] as TourStep[])}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
