import { Fragment, useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { createPortal } from "react-dom";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { useEditorLimits } from "../../lib/editorLimits";
import { useCurrentPlan } from "../../lib/currentPlan";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  FileText,
  HelpCircle,
  Info,
  Italic,
  Loader2,
  ImagePlus,
  Minus,
  Move,
  Pencil,
  Plus,
  RotateCw,
  ScanText,
  ShieldAlert,
  Sparkles,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
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
  type EditQuota,
  type PdfAnalysis,
  type PdfElement,
  type PdfTextEdit,
} from "../../api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const uid = () => Math.random().toString(36).slice(2, 9);
// Ölçü-uyumlu aileler (Calibri→carlito …) sunucudaki `edit_fonts.py` ile AYNI dosyalar
// (public/fonts/edit/*.woff2) → önizleme ölçüsü = indirilen PDF ölçüsü.
type MetricKey = "carlito" | "caladea" | "lsans" | "lserif" | "lmono" | "gelasio";
type ExtraKey = "opensans" | "poppins" | "playfair" | "lora" | "ptserif" | "dancing" | "greatvibes" | "pacifico" | "anton";
type FontKey = "sans" | "serif" | "mono" | "lato" | "montserrat" | "merriweather" | "oswald" | ExtraKey | MetricKey;
type AlignKey = "left" | "center" | "right";
// Biçim bayrakları — kalın/italik/altı çizili/üstü çizili + hizalama.
type Fmt = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; align?: AlignKey };
// html: kelime bazlı zengin biçim (contentEditable innerHTML). Doluysa export insert_htmlbox
// ile yapılır (parça parça renk/kalın/italik/altı-üstü çizili/boyut korunur).
// dx/dy: öğenin orijinal konumundan kaydırması (PDF pt) — çerçeveden tutup taşıma + sayfaya hizalama.
type Edit = { text?: string; deleted?: boolean; size?: number; color?: string; font?: FontKey; html?: string; dx?: number; dy?: number } & Fmt;
type Added = { id: string; page: number; bbox: [number, number, number, number]; text: string; size: number; color: string; font: FontKey } & Fmt;
// Kullanıcının eklediği resim — bbox (PDF pt, döndürülmemiş), aspect (w/h), açı (derece).
type AddedImg = { id: string; page: number; bbox: [number, number, number, number]; dataUrl: string; aspect: number; rotate: number };
// Çerçeveden tutup taşıma (mevcut metin/görsel + eklenen metin/görsel). ox/oy = sürükleme başındaki
// ofset (mevcut öğede dx/dy, eklenende sol-üst x/y); bx/by/w/h = öğenin SAYFADAKİ başlangıç kutusu.
type FrameDrag = {
  kind: "el" | "added" | "addedImg";
  id: string; sx: number; sy: number; ox: number; oy: number;
  bx: number; by: number; w: number; h: number; moved: boolean;
};
type Guide = { axis: "x" | "y"; pos: number };
type ImgDrag =
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
  opensans: "'Open Sans', system-ui, sans-serif",
  poppins: "Poppins, system-ui, sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
  lora: "Lora, Georgia, serif",
  ptserif: "'PT Serif', Georgia, serif",
  dancing: "'Dancing Script', cursive",
  greatvibes: "'Great Vibes', cursive",
  pacifico: "Pacifico, cursive",
  anton: "Anton, Impact, sans-serif",
};
// Menüde görünen ad. Ölçü-uyumlu aileler (Calibri vb.) ayrı bir grupta: Word/Office belgesindeki
// yazıyı değiştirirken satır uzunluğu kaymasın diye orijinal fontla AYNI harf genişliğini verir.
const FONT_MENU: Record<FontKey, string> = {
  sans: "Roboto", serif: "Noto Serif", mono: "Roboto Mono", lato: "Lato", montserrat: "Montserrat",
  merriweather: "Merriweather", oswald: "Oswald",
  carlito: "Calibri", caladea: "Cambria", lsans: "Arial / Helvetica",
  lserif: "Times New Roman", lmono: "Courier New", gelasio: "Georgia",
  opensans: "Open Sans", poppins: "Poppins", playfair: "Playfair Display", lora: "Lora", ptserif: "PT Serif",
  dancing: "Dancing Script (imza)", greatvibes: "Great Vibes (imza)", pacifico: "Pacifico", anton: "Anton (başlık)",
};
const METRIC_FILES: Record<MetricKey, string> = {
  carlito: "Carlito", caladea: "Caladea", lsans: "LiberationSans", lserif: "LiberationSerif", lmono: "LiberationMono", gelasio: "Gelasio",
};
const METRIC_CSS_NAME: Record<MetricKey, string> = {
  carlito: "PPE Carlito", caladea: "PPE Caladea", lsans: "PPE Liberation Sans", lserif: "PPE Liberation Serif", lmono: "PPE Liberation Mono", gelasio: "PPE Gelasio",
};
const METRIC_KEYS: FontKey[] = ["carlito", "caladea", "lsans", "lserif", "lmono", "gelasio"];
const OTHER_FONT_KEYS: FontKey[] = ["sans", "opensans", "poppins", "lato", "montserrat", "oswald", "anton", "serif", "ptserif", "lora", "merriweather", "playfair", "mono", "dancing", "greatvibes", "pacifico"];
const FONT_KEYS: FontKey[] = [...METRIC_KEYS, ...OTHER_FONT_KEYS];
const isFontKey = (k: unknown): k is FontKey => typeof k === "string" && (FONT_KEYS as string[]).includes(k);
const FONT_LABEL: Record<FontKey, string> = {
  sans: "Roboto", serif: "Noto Serif", mono: "Roboto Mono",
  lato: "Lato", montserrat: "Montserrat", merriweather: "Merriweather", oswald: "Oswald",
  // Sunucu (insert_htmlbox) @font-face aile adları — edit_fonts.METRIC_FAMILIES ile aynı.
  carlito: "Carlito", caladea: "Caladea", lsans: "Liberation Sans", lserif: "Liberation Serif", lmono: "Liberation Mono", gelasio: "Gelasio",
  opensans: "Open Sans", poppins: "Poppins", playfair: "Playfair Display", lora: "Lora", ptserif: "PT Serif",
  dancing: "Dancing Script", greatvibes: "Great Vibes", pacifico: "Pacifico", anton: "Anton",
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
function FillPatch({ src, rect }: {
  src: HTMLCanvasElement | null; rect: { left: number; top: number; width: number; height: number };
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
    // Sayfanın büyük kısmını kaplayan görsel (tam sayfa tarama/arka plan): kenar renklerinden geçiş üretmek
    // karmaşık, kirli bir zemin veriyordu → beyaz bırak (sunucuda da görsel kalkınca sayfa beyaz kalır).
    if (W * H > src.width * src.height * 0.5) { octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, W, H); return; }
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
  return <canvas ref={ref} className="pointer-events-none absolute"
    style={{ left: Math.floor(rect.left), top: Math.floor(rect.top), width: Math.ceil(rect.width), height: Math.ceil(rect.height) }} />;
}

/** Seçili metnin çerçevesinin 4 kenarında tutulabilir şeritler: yazının içine tıklamayı bozmadan çerçeveden tutup taşımaya yarar. */
function FrameStrips({ w, h, top, onDown }: { w: number; h: number; top: number; onDown: (e: React.PointerEvent) => void }) {
  const t = 8;
  const base = "absolute z-[5] cursor-move touch-none";
  const st = { touchAction: "none" } as const;
  return (
    <>
      <span onPointerDown={onDown} className={base} style={{ ...st, left: -t, top: top - t, width: w + 2 * t, height: t }} />
      <span onPointerDown={onDown} className={base} style={{ ...st, left: -t, top: top + h, width: w + 2 * t, height: t }} />
      <span onPointerDown={onDown} className={base} style={{ ...st, left: -t, top, width: t, height: h }} />
      <span onPointerDown={onDown} className={base} style={{ ...st, left: w, top, width: t, height: h }} />
    </>
  );
}

/** Taşınan MEVCUT görselin önizlemesi: sayfa canvas'ındaki görsel bölgesini yeni konuma kopyalar. */
function MovedImage({ src, from, to }: {
  src: HTMLCanvasElement | null; from: { left: number; top: number; width: number; height: number };
  to: { left: number; top: number; width: number; height: number };
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const out = ref.current;
    if (!src || !out) return;
    const L = Math.max(0, Math.floor(from.left)), T = Math.max(0, Math.floor(from.top));
    const W = Math.max(1, Math.min(src.width - L, Math.ceil(from.width))), H = Math.max(1, Math.min(src.height - T, Math.ceil(from.height)));
    out.width = W; out.height = H;
    out.getContext("2d")?.drawImage(src, L, T, W, H, 0, 0, W, H);
  }, [src, from.left, from.top, from.width, from.height]);
  return <canvas ref={ref} className="pointer-events-none absolute"
    style={{ left: to.left, top: to.top, width: to.width, height: to.height }} />;
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

export function PdfEditor({ language, accessToken, initialFile, belowHeader }: {
  language: Language; accessToken?: string | null; initialFile?: File | null;
  /** Başlığın HEMEN altına çizilen içerik (ör. «Nasıl çalışır?» kartı) — başlık önce, kart sonra. */
  belowHeader?: ReactNode;
}) {
  const tr = language === "tr";
  // Plan: OCR yalnız Plus ve üzeri planlarda (otomatik); günlük hak uyarıları yalnız misafir/ücretsiz/Başlangıç.
  const planState = useCurrentPlan();
  const EL = useEditorLimits(); // yönetim panelindeki günlük haklar
  const planUp = (planState.plan ?? "").toUpperCase();
  const loggedIn = !!accessToken;
  const unlimitedPlan = loggedIn && (planState.teamMember || planUp === "PLUS" || planUp === "PRO" || planUp === "BUSINESS");
  const ocrAllowed = unlimitedPlan;
  const isGuest = !loggedIn;
  // Araç zaten anlatılmış bir sayfanın (GuestSeoToolPage) ya da Hero'nun kendi
  // tanıtım şeridinin İÇİNDEYSE, yükleme panelinin kendi başlığı tekrar etmesin.
  const { describesTool } = useToolPageContext();
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
  const [frameDrag, setFrameDrag] = useState<FrameDrag | null>(null);
  // Sürükleme sırasında beliren hizalama çizgileri (PDF pt cinsinden konum).
  const [guides, setGuides] = useState<Guide[]>([]);
  // Boş alanda sürükleyerek çoklu seçim (kutu, overlay piksel koordinatı).
  const [marquee, setMarquee] = useState<{ sx: number; sy: number; cx: number; cy: number; add: boolean } | null>(null);
  // Silme geçmişi (Geri Al / Ctrl+Z) — her giriş tek silme işlemindeki kimlikler.
  const [delStack, setDelStack] = useState<string[][]>([]);
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
  useBodyScrollLock(editorOpen);
  const [busy, setBusy] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrPct, setOcrPct] = useState(0);
  const [ocrTried, setOcrTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  // Hazırlanan PDF (günlük hak «PDF'i Hazırla»da düşer; blob hemen alınır → ortak sonuç paneli).
  const [result, setResult] = useState<{ blob: Blob; filename: string; quota: EditQuota } | null>(null);
  // Günlük hak doldu uyarısı (popup) — yalnız misafir/ücretsiz/Başlangıç.
  const [quotaPopup, setQuotaPopup] = useState<{ used: number; limit: number; guest: boolean; resetAt: string | null; already: boolean } | null>(null);
  // Öğe id → örneklenen arka plan rengi (#RRGGBB). Silgi/redaction bu renkle doldurulur
  // (beyaz varsayım yerine) → kırmızı/siyah/resimli zeminde beyaz kutu kalmaz.
  const [bgMap, setBgMap] = useState<Map<string, string>>(new Map());
  // Orijinal gömülü fontlar: anahtar → (tarayıcı aile adı, belgede doğrulanmış harfler). Yalnız
  // FontFace başarıyla yüklenenler — sunucu da AYNI kuralla (tüm harfler kümede) orijinali kullanır.
  const [origFonts, setOrigFonts] = useState<Map<string, { family: string; chars: string }>>(new Map());

  // Editör font seçenekleri — önizleme gömülü TTF'lerle birebir olsun diye webfont'ları
  // yükle (yalnız editör açılınca, glyph kullanılınca iner). Her rotada çalışır.
  useEffect(() => {
    const id = "pdf-editor-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&family=Noto+Serif:wght@400;600&family=Lato:wght@400;700&family=Montserrat:wght@400;600;700&family=Merriweather:wght@400;700&family=Oswald:wght@400;500;600&family=Open+Sans:wght@400;700&family=Poppins:wght@400;700&family=Playfair+Display:wght@400;700&family=Lora:wght@400;700&family=PT+Serif:wght@400;700&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Pacifico&family=Anton&display=swap";
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

  // Taranmış PDF (Plus ve üzeri plan) → CİHAZDA Tesseract OCR; yükleme ekranı ilerlemeyi gösterir, bitince
  // belge düzenlemeye hazır. Ücretsiz/Başlangıç/misafirde OCR sunulmaz (uyarı + yükseltme önerisi).
  async function autoOcr(d: pdfjsLib.PDFDocumentProxy, a: PdfAnalysis) {
    setOcrBusy(true);
    setOcrPct(0);
    setError(null);
    try {
      const out = await ocrScannedPagesLocal(d, a, (r) => setOcrPct(Math.round(r * 100)));
      colorDoneRef.current.clear();
      setAnalysis(out);
      setEdits(new Map());
    } catch { /* OCR başarısız → belge görsel olarak düzenlenebilir; sessiz geç */ }
    finally { setOcrTried(true); setOcrBusy(false); setOcrPct(100); }
  }

  async function pickFile(f: File | undefined) {
    setError(null);
    setResult(null);
    setQuotaPopup(null);
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
      const merged = mergeInvisibleWords(a);
      setDoc(d);
      setAnalysis(merged);
      setPageCount(d.numPages);
      setCurrent(0);
      setEdits(new Map());
      setAdded([]);
      setAddedImages([]);
      setDelStack([]);
      setBgMap(new Map());
      setSelected(null);
      setMultiSel(new Set());
      setOcrTried(false);
      // Taranmış PDF + Plus ve üzeri plan → OCR kendiliğinden çalışır (ilerleme ekranı), bitince editör açılır.
      if (ocrAllowed && scannedPageIndexes(merged).length > 0) await autoOcr(d, merged);
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

  // Sayfa küçük resimleri. Taban resimler orijinalden BİR KEZ çizilir; düzenleme yapılan sayfaların
  // küçük resmi, düzenlemeler üstüne işlenerek her değişiklikte yenilenir (aşağıdaki «thumb compose»)
  // → soldaki liste HER ZAMAN sayfanın en son hâlini gösterir.
  const thumbBaseRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const thumbBaseUrlRef = useRef<string[]>([]);
  const thumbImgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [thumbTick, setThumbTick] = useState(0);
  useEffect(() => {
    if (!doc || !editorOpen) return;
    let alive = true;
    thumbBaseRef.current = new Map();
    thumbBaseUrlRef.current = [];
    (async () => {
      const out: string[] = [];
      for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
        if (!alive) return;
        try {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 0.25 });
          const c = document.createElement("canvas");
          c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
          const ctx = c.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            thumbBaseRef.current.set(i - 1, c);
            out[i - 1] = c.toDataURL("image/jpeg", 0.65);
            thumbBaseUrlRef.current[i - 1] = out[i - 1];
          }
          if (alive) { setThumbs([...out]); setThumbTick((n) => n + 1); }
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
        const cs = container ? getComputedStyle(container) : null;
        const padX = cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : 0;
        const availW = Math.min((container?.clientWidth ?? 700) - padX - 4, 820);
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
    // Üst: büyük harf, aksanlı harf (Ğ İ Ö Ü Â …) ve uzun harfler ~1 em'e çıkar; alt: cedilla (Ş Ç) ve
    // inen harfler (g y p) ~0.3 em. Eskiden Ğ/Ş/Ç listede yoktu ve kutu yazı kutusuna kırpılıyordu →
    // büyük yazıda noktalar/çengeller örtünün dışında kalıp görünüyordu. Kutu dışına en çok 0.2 em taşar
    // (komşu satırı/çizgiyi örtmesin).
    const topF = /[\p{Lu}ğıİÂÊÎÔÛâêîôû0-9bdfhklt]/u.test(el.text ?? "") ? 1.05 : 0.9;
    return [Math.max(el.by - topF * sz, y0 - 0.2 * sz), Math.min(el.by + 0.34 * sz, y1 + 0.2 * sz)];
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
      else if (analysis?.pages[current]?.elements.find((x) => x.id === id)?.type === "text") setEdit(id, patch);
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
  /** Seçim yazının yalnız BİR PARÇASINI mı kapsıyor? Tüm satır seçiliyse parça-biçimi (HTML) yerine biçim
   * öğenin TAMAMINA uygulanır → orijinal font/harf aralığı/boyut korunur (tam seçimi HTML'e çevirmek yedek
   * fonta düşürüp yazıyı küçültüyordu — «altını çizince boyut değişiyor» hatası). */
  function partialSelection(): boolean {
    const f = focusedSelection();
    if (!f) return false;
    const sel = window.getSelection();
    const total = (f.el.textContent ?? "").length;
    return !!sel && sel.toString().replace(/\n/g, "").length < total;
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
    if (partialSelection() && richExec(cmd)) return; // seçili kelime/parça → yalnız ona uygula
    applyPatch({ [key]: !curFmt(key) } as Fmt); // tüm satır seçili / seçim yok → tüm öğe
  };
  function sizeStep(bigger: boolean) {
    if (partialSelection() && richFontStep(bigger)) return; // seçili parça → em oranıyla
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

  // Çerçeveden tutup taşıma (mevcut/eklenen metin + görsel). Sayfa kenarı/ortası ve diğer öğelerin
  // kenar/orta çizgilerine YAKALAR (hizalama çizgileri görünür); Alt tuşu yakalamayı kapatır.
  const effBoxOf = (el: PdfElement): [number, number, number, number] => {
    const ed = edits.get(el.id);
    const dx = (ed?.dx ?? 0) + (shifts.get(el.id) ?? 0), dy = ed?.dy ?? 0;
    return [el.bbox[0] + dx, el.bbox[1] + dy, el.bbox[2] + dx, el.bbox[3] + dy];
  };
  useEffect(() => {
    if (!frameDrag) return;
    const fd = frameDrag;
    const pg = analysis?.pages[current];
    const pageW = pg?.width ?? dims.w / scale, pageH = pg?.height ?? dims.h / scale;
    const xs: number[] = [0, pageW / 2, pageW], ys: number[] = [0, pageH / 2, pageH];
    const addBox = (b: number[]) => { xs.push(b[0], (b[0] + b[2]) / 2, b[2]); ys.push(b[1], (b[1] + b[3]) / 2, b[3]); };
    for (const el of pageEls) if (el.id !== fd.id && edits.get(el.id)?.deleted !== true) addBox(effBoxOf(el));
    for (const a of pageAdded) if (a.id !== fd.id) addBox(a.bbox);
    for (const im of pageImages) if (im.id !== fd.id) addBox(im.bbox);
    const thr = 6 / scale;
    const snap = (start: number, size: number, targets: number[]): { off: number; line: number | null } => {
      let best: { off: number; line: number } | null = null;
      for (const c of [0, size / 2, size]) for (const t of targets) {
        const d = t - (start + c);
        if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.off))) best = { off: d, line: t };
      }
      return best ?? { off: 0, line: null };
    };
    let moved = false;
    const onMove = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - fd.sx, e.clientY - fd.sy) < 3) return;
      moved = true;
      let nx = fd.bx + (e.clientX - fd.sx) / scale, ny = fd.by + (e.clientY - fd.sy) / scale;
      // Sayfadan taşan öğe tutup geri getirilebilsin: tamamen dışarı çıkmasına izin verilmez (12 pt kalır).
      nx = Math.min(Math.max(nx, -fd.w + 12), pageW - 12);
      ny = Math.min(Math.max(ny, -fd.h + 12), pageH - 12);
      const none = { off: 0, line: null as number | null };
      const sx = e.altKey ? none : snap(nx, fd.w, xs), sy = e.altKey ? none : snap(ny, fd.h, ys);
      nx += sx.off; ny += sy.off;
      setGuides([...(sx.line != null ? [{ axis: "x" as const, pos: sx.line }] : []), ...(sy.line != null ? [{ axis: "y" as const, pos: sy.line }] : [])]);
      if (fd.kind === "el") setEdit(fd.id, { dx: fd.ox + (nx - fd.bx), dy: fd.oy + (ny - fd.by) });
      else if (fd.kind === "added") setAdded((arr) => arr.map((x) => (x.id === fd.id ? { ...x, bbox: [nx, ny, nx + fd.w, ny + fd.h] } : x)));
      else setAddedImages((arr) => arr.map((x) => (x.id === fd.id ? { ...x, bbox: [nx, ny, nx + fd.w, ny + fd.h] } : x)));
    };
    const onUp = () => { setFrameDrag(null); setGuides([]); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameDrag, scale]);

  // Eklenen resim: boyutlandırma (oran korumalı) / merkez etrafı döndürme.
  useEffect(() => {
    if (!imgDrag) return;
    const onMove = (e: PointerEvent) => {
      setAddedImages((arr) => arr.map((im) => {
        if (im.id !== imgDrag.id) return im;
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

  // Boş alanda sürükleyerek çoklu seçim (ayrık harfleri — A T A T Ü R K gibi — toplu seçmek için).
  const marqueeRef = useRef(marquee);
  marqueeRef.current = marquee;
  useEffect(() => {
    if (!marquee) return;
    const rectOf = () => overlayRef.current?.getBoundingClientRect();
    const onMove = (e: PointerEvent) => {
      const b = rectOf();
      if (b) setMarquee((m) => (m ? { ...m, cx: e.clientX - b.left, cy: e.clientY - b.top } : m));
    };
    const onUp = (e: PointerEvent) => {
      const m = marqueeRef.current, b = rectOf();
      setMarquee(null);
      if (!m || !b) return;
      const cx = e.clientX - b.left, cy = e.clientY - b.top;
      if (Math.hypot(cx - m.sx, cy - m.sy) < 5) { // sürükleme değil, boş yere tıklama → seçimi bırak
        if (!m.add) { setMultiSel(new Set()); setSelected(null); }
        return;
      }
      const x0 = Math.min(m.sx, cx) / scale, x1 = Math.max(m.sx, cx) / scale;
      const y0 = Math.min(m.sy, cy) / scale, y1 = Math.max(m.sy, cy) / scale;
      const inter = (bb: number[]) => Math.max(0, Math.min(bb[2], x1) - Math.max(bb[0], x0)) * Math.max(0, Math.min(bb[3], y1) - Math.max(bb[1], y0));
      const area = (bb: number[]) => Math.max(1e-6, (bb[2] - bb[0]) * (bb[3] - bb[1]));
      const ids: string[] = [];
      for (const el of pageEls) {
        if (edits.get(el.id)?.deleted === true) continue;
        const bb = effBoxOf(el);
        // Metin: değmesi yeter. Görsel: büyük (tam sayfa) görsel kazara seçilmesin → çoğu kutunun içinde olmalı.
        if (el.type === "text" ? inter(bb) > 0 : inter(bb) / area(bb) > 0.6) ids.push(el.id);
      }
      for (const a of pageAdded) if (inter(a.bbox) > 0) ids.push(a.id);
      for (const im of pageImages) if (inter(im.bbox) / area(im.bbox) > 0.6) ids.push(im.id);
      setMultiSel((prev) => (m.add ? new Set([...prev, ...ids]) : new Set(ids)));
      setSelected(ids[0] ?? null);
      setAddMode(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!marquee, scale]);
  function onOverlayPointerDown(e: React.PointerEvent) {
    if (addMode || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (e.target !== e.currentTarget && t.dataset.bg !== "1") return; // yalnız boş alan / arka plan görseli
    const b = overlayRef.current!.getBoundingClientRect();
    const sx = e.clientX - b.left, sy = e.clientY - b.top;
    setMarquee({ sx, sy, cx: sx, cy: sy, add: e.shiftKey || e.ctrlKey || e.metaKey });
  }

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
    // Seçili parça varsa yalnız ona; gerçek font adı (backend @font-face ile fontlar doğru).
    if (partialSelection() && richFontFamily(FONT_LABEL[fk])) return;
    applyPatch({ font: fk });
  }
  function applyColorFromPicker(c: string) {
    setColor(c);
    restoreSaved(); // renk penceresi seçimi kaybettiyse geri yükle
    if (partialSelection() && richExec("foreColor", c)) return; // yalnız seçili parça
    applyPatch({ color: c }); // seçim yoksa tüm öğe
  }

  // Silme + Geri Al. Silinenler yığına yazılır; «Geri Al» / Ctrl+Z son silmeyi geri getirir. (Silinen alana
  // tıklamak artık geri getirmez — kazara tıklamada yazı geri geliyordu.)
  function markDeleted(ids: string[]) {
    if (!ids.length) return;
    setEdits((m) => { const n = new Map(m); for (const id of ids) n.set(id, { ...n.get(id), deleted: true }); return n; });
    setDelStack((s) => [...s, ids]);
  }
  function undoDelete() {
    const last = delStack[delStack.length - 1];
    if (!last) return;
    setDelStack((s) => s.slice(0, -1));
    setEdits((m) => {
      const n = new Map(m);
      for (const id of last) {
        const cur = n.get(id);
        if (!cur) continue;
        const rest = { ...cur }; delete rest.deleted;
        if (Object.keys(rest).length) n.set(id, rest); else n.delete(id);
      }
      return n;
    });
  }

  // Klavye: Ctrl+A tümünü seç · Delete/Backspace sil · Ctrl+Z son silmeyi geri al · Esc seçimi bırak.
  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const editing = tag === "textarea" || tag === "input" || tag === "select" || (document.activeElement as HTMLElement)?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        if (editing || !delStack.length) return;
        e.preventDefault();
        undoDelete();
        return;
      }
      // Ctrl/Cmd+A → sayfadaki TÜM öğeleri (yazı + görsel/amblem + eklenenler) seç → toplu biçim/silme.
      // Bir metni düzenlerken (contentEditable) araya girme → normal metin seçimi çalışsın.
      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        if (editing) return;
        e.preventDefault();
        const ids = [
          ...(analysis?.pages[current]?.elements ?? []).filter((x) => edits.get(x.id)?.deleted !== true).map((x) => x.id),
          ...added.filter((a) => a.page === current).map((a) => a.id),
          ...addedImages.filter((a) => a.page === current).map((a) => a.id),
        ];
        setMultiSel(new Set(ids));
        setSelected(ids[0] ?? null);
        return;
      }
      if (e.key === "Escape") { setMultiSel(new Set()); setAddMode(false); return; }
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (editing) return;
      const targets = selTargets();
      if (!targets.length) return;
      e.preventDefault();
      const delIds: string[] = [];
      for (const id of targets) {
        if (analysis?.pages[current]?.elements.some((x) => x.id === id)) delIds.push(id);
        else if (added.some((x) => x.id === id)) setAdded((a) => a.filter((x) => x.id !== id));
        else if (addedImages.some((x) => x.id === id)) setAddedImages((a) => a.filter((x) => x.id !== id));
      }
      markDeleted(delIds);
      setMultiSel(new Set()); setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, selected, current, analysis, added, addedImages, edits, multiSel, delStack]);

  // «Metin Ekle» TEK SEFERLİK: bir yere tıklanınca kutu eklenir ve mod kapanır (art arda tıklama yeni kutu açmaz).
  function onCanvasClick(e: React.MouseEvent) {
    if (!addMode) return;
    const r = overlayRef.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
    const id = uid();
    setAdded((a) => [...a, { id, page: current, bbox: [x, y, x + 140, y + size + 4], text: "", size, color, font }]);
    setSelected(id);
    setMultiSel(new Set());
    setAddMode(false);
    setTimeout(() => document.querySelector<HTMLElement>(`[data-tid="${id}"]`)?.focus(), 20);
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
    if (partialSelection() && richExec("foreColor", c)) return; // seçili kelime/parça → yalnız ona
    applyPatch({ color: c }); // tüm satır seçili / seçim yok → tüm öğe
  }
  function applySize(s: number) {
    const cl = Math.max(6, Math.min(72, Math.round(s)));
    setSize(cl);
    applyPatch({ size: cl });
  }

  /** Hizalama SAYFAYA göre: sola → sayfadaki yazının sol kenarına, ortala → sayfa ortasına, sağa → sağ kenarına.
   * (Eskiden yalnız öğenin kendi dar kutusu içinde hizalanıyordu.) Öğe, kaydırma (dx) ile yeni yere konur. */
  const applyAlign = (a: AlignKey) => {
    setAlign(a);
    const pg = analysis?.pages[current];
    if (!pg) return;
    const texts = pg.elements.filter((e) => e.type === "text" && !isDeleted(e.id));
    const mL = texts.length ? Math.min(...texts.map((e) => e.bbox[0])) : 36;
    const mR = texts.length ? Math.max(...texts.map((e) => e.bbox[2])) : pg.width - 36;
    const targetX = (w: number) => (a === "left" ? mL : a === "center" ? (pg.width - w) / 2 : mR - w);
    for (const id of selTargets()) {
      const ad = added.find((x) => x.id === id);
      if (ad) {
        const w = measureTextPt(ad.text || " ", ad.size, ad.font, !!ad.bold, !!ad.italic);
        const nx = targetX(w);
        setAdded((arr) => arr.map((x) => (x.id === id ? { ...x, align: a, bbox: [nx, x.bbox[1], nx + (x.bbox[2] - x.bbox[0]), x.bbox[3]] } : x)));
        continue;
      }
      const el = pg.elements.find((x) => x.id === id);
      if (!el || el.type !== "text") continue;
      const w = measureTextPt(elText(el), elSize(el), elFont(el), elBold(el), elItalic(el), elSpacing(el), elCss(el));
      setEdit(id, { align: a, dx: targetX(w) - (el.bbox[0] + (shifts.get(id) ?? 0)) });
    }
  };

  // «thumb compose»: düzenleme yapılan sayfaların küçük resmini, düzenlemeler (örtü, yeni/taşınan yazı,
  // silinen/taşınan görsel, eklenen metin/görsel, altı çizgi) üstüne işleyerek yeniler → soldaki liste
  // HER ZAMAN en son hâli gösterir. Yazma sırasında titremesin diye kısa gecikmeyle (debounce).
  useEffect(() => {
    if (!editorOpen || !analysis) return;
    const timer = window.setTimeout(() => {
      const base = thumbBaseRef.current;
      const patch: Record<number, string> = {};
      for (let p = 0; p < Math.min(analysis.pages.length, 60); p++) {
        const bc = base.get(p), pg = analysis.pages[p];
        if (!bc || !pg) continue;
        const els = pg.elements;
        const touched = els.some((e) => edits.has(e.id)) || added.some((a) => a.page === p) || addedImages.some((a) => a.page === p);
        if (!touched) { const u = thumbBaseUrlRef.current[p]; if (u) patch[p] = u; continue; }
        const c = document.createElement("canvas");
        c.width = bc.width; c.height = bc.height;
        const ctx = c.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(bc, 0, 0);
        const k = bc.width / pg.width; // pt → küçük resim pikseli
        const fill = (x0: number, y0: number, x1: number, y1: number, color: string) => {
          ctx.fillStyle = color;
          ctx.fillRect(x0 * k - 0.5, y0 * k - 0.5, (x1 - x0) * k + 1, (y1 - y0) * k + 1);
        };
        const sMap = computeShifts(p);
        for (const el of els) {
          const ed = edits.get(el.id);
          if (!ed) continue;
          const [x0, y0, x1, y1] = el.bbox;
          const dx = ed.dx ?? 0, dy = ed.dy ?? 0;
          if (el.type === "image") {
            const big = (x1 - x0) * (y1 - y0) > pg.width * pg.height * 0.5;
            const bg = big ? "#ffffff" : bgMap.get(el.id) ?? "#ffffff";
            if (ed.deleted) fill(x0, y0, x1, y1, bg);
            else if (dx || dy) {
              fill(x0, y0, x1, y1, bg);
              ctx.drawImage(bc, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, (x0 + dx) * k, (y0 + dy) * k, (x1 - x0) * k, (y1 - y0) * k);
            }
            continue;
          }
          const [cy0, cy1] = coverY(el);
          const cx0 = el.ink ? Math.min(x0, el.ink[0]) : x0, cx1 = el.ink ? Math.max(x1, el.ink[2]) : x1;
          const sh = sMap.get(el.id) ?? 0;
          if (ed.deleted) { fill(cx0, cy0, cx1, cy1, bgFor(el.id)); continue; }
          const decoOnly = (ed.underline !== undefined || ed.strike !== undefined) && (ed.text === undefined || ed.text === el.text)
            && ed.color === undefined && ed.size === undefined && ed.font === undefined && ed.bold === undefined && ed.italic === undefined
            && !(ed.html && /<[a-z]/i.test(ed.html)) && !dx && !dy;
          const sz = elSize(el), pxSz = sz * k;
          const by = (el.by ?? y0 + sz) + dy;
          const tx = (x0 + sh + dx) * k;
          const tw = measureTextPt(elText(el), sz, elFont(el), elBold(el), elItalic(el), elSpacing(el), elCss(el)) * k;
          if (!decoOnly) {
            fill(cx0, cy0, cx1 + Math.max(0, sh), cy1, bgFor(el.id));
            ctx.font = `${elItalic(el) ? "italic " : ""}${elBold(el) ? "700 " : "400 "}${pxSz}px ${elCss(el)}`;
            ctx.fillStyle = elColor(el);
            ctx.textBaseline = "alphabetic";
            ctx.fillText(elText(el), tx, by * k);
          }
          if (elUnderline(el)) { ctx.fillStyle = elColor(el); ctx.fillRect(tx, by * k + 0.12 * pxSz, tw, Math.max(1, pxSz * 0.06)); }
          if (elStrike(el)) { ctx.fillStyle = elColor(el); ctx.fillRect(tx, by * k - 0.3 * pxSz, tw, Math.max(1, pxSz * 0.06)); }
        }
        for (const a of added) {
          if (a.page !== p || !a.text.trim()) continue;
          const pxSz = a.size * k;
          ctx.font = `${a.italic ? "italic " : ""}${a.bold ? "700 " : "400 "}${pxSz}px ${FONT_CSS[a.font]}`;
          ctx.fillStyle = a.color;
          ctx.textBaseline = "alphabetic";
          ctx.fillText(a.text, a.bbox[0] * k, (a.bbox[1] + a.size * 0.85) * k);
        }
        for (const im of addedImages) {
          if (im.page !== p) continue;
          let img = thumbImgCache.current.get(im.id);
          if (!img) {
            img = new Image();
            img.onload = () => setThumbTick((n) => n + 1);
            img.src = im.dataUrl;
            thumbImgCache.current.set(im.id, img);
          }
          if (!img.complete || !img.naturalWidth) continue;
          const [ix0, iy0, ix1, iy1] = im.bbox;
          ctx.save();
          ctx.translate(((ix0 + ix1) / 2) * k, ((iy0 + iy1) / 2) * k);
          if (im.rotate) ctx.rotate((im.rotate * Math.PI) / 180);
          ctx.drawImage(img, (-(ix1 - ix0) / 2) * k, (-(iy1 - iy0) / 2) * k, (ix1 - ix0) * k, (iy1 - iy0) * k);
          ctx.restore();
        }
        patch[p] = c.toDataURL("image/jpeg", 0.7);
      }
      setThumbs((prev) => {
        const n = prev.slice();
        let changed = false;
        for (const [p, u] of Object.entries(patch)) if (n[+p] !== u) { n[+p] = u; changed = true; }
        return changed ? n : prev;
      });
    }, 280);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, added, addedImages, bgMap, analysis, editorOpen, thumbTick, origFonts]);

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

  async function preparePdf() {
    if (!file || !analysis || busy) return;
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
        const mdx = ed?.dx ?? 0, mdy = ed?.dy ?? 0; // çerçeveden taşıma / sayfaya hizalama
        if (ed?.deleted) {
          // Silme (metin veya görsel) → orijinali arka planla kapat.
          ops.push({ page: p, bbox: el.bbox, clear: el.ink, text: "", size: ed.size ?? el.size ?? 12, color: ed.color ?? el.color, font: ed.font ?? "sans", bg: bgMap.get(el.id), by: el.by, img: el.type === "image" || undefined, vec: el.vec || undefined, ...vtOf(el) });
          continue;
        }
        if (el.type === "image") {
          // Taşınan mevcut görsel (vektör amblem taşınamaz): eski yerden kaldır, yenisine aynen koy.
          if ((mdx || mdy) && !el.vec) ops.push({ page: p, bbox: el.bbox, text: "", size: 12, img: true, xref: el.xref, move: [x0 + mdx, y0 + mdy, x1 + mdx, y1 + mdy], bg: bgMap.get(el.id) });
          continue;
        }
        if (el.type !== "text") continue;
        const richHtml = ed?.html && /<[a-z]/i.test(ed.html) ? ed.html : undefined;
        // Yalnız altı/üstü çizgi: yazı silinip YENİDEN yazılmaz (orijinal font/ölçü/aralık bozulmasın), sadece çizgi çekilir.
        const decoOnly = !!ed && (ed.underline !== undefined || ed.strike !== undefined) && (ed.text === undefined || ed.text === el.text)
          && ed.color === undefined && ed.size === undefined && ed.font === undefined && ed.bold === undefined && ed.italic === undefined
          && !richHtml && !mdx && !mdy;
        if (decoOnly) {
          if (ed!.underline || ed!.strike) ops.push({ page: p, bbox: el.bbox, text: "", size: el.size ?? 12, color: el.color, by: el.by, deco: true, underline: ed!.underline || undefined, strike: ed!.strike || undefined });
          continue;
        }
        const moved = !!(mdx || mdy);
        const changed = ed && ((ed.text !== undefined && ed.text !== el.text) || ed.color !== undefined || ed.size !== undefined || ed.font !== undefined || ed.bold !== undefined || ed.italic !== undefined || ed.underline !== undefined || ed.strike !== undefined || moved || !!richHtml);
        const drawBbox: [number, number, number, number] = shift > 0.5 || moved ? [x0 + shift + mdx, y0 + mdy, x1 + shift + mdx, y1 + mdy] : el.bbox;
        // Görüntüdeki yazıda (OCR/görünmez katman) silinecek alan = GERÇEK mürekkep sınırı (el.ink):
        // OCR kutusu harf uçlarından dar → uçlar kalıyordu.
        const clearBase: [number, number, number, number] = el.ink ?? [x0, y0, x1, y1];
        const clearBbox: [number, number, number, number] | undefined = shift > 0.5 || moved || el.ink ? clearBase : undefined;
        const newBy = el.by != null ? el.by + mdy : undefined; // yazı taban çizgisi (taşımada dy kadar)
        const oby = moved ? el.by : undefined; // ORİJİNAL taban çizgisi (vektör şerit silme için)
        if (changed && richHtml) {
          // Kelime bazlı zengin biçim → insert_htmlbox ile parça parça renk/kalın/italik/
          // altı-üstü çizili/boyut korunur. Temel stil (renk/boyut/font) wrapper'da;
          // iç span'ler parça bazında ezer. Boyut em oranıyla saklandığı için ölçek uyumlu.
          const size = ed!.size ?? el.size ?? 12;
          const fk = elFont(el);
          const baseColor = ed!.color ?? el.color ?? "#111111";
          // Gerçek font adı (Roboto/Noto Serif/…) → backend @font-face ile gömülü TTF'ye çözülür.
          const wrapped = `<div style="font-family:'${FONT_LABEL[fk]}';font-size:${size}px;color:${baseColor};text-align:left;line-height:1.0;margin:0;padding:0">${sanitizeRichHtml(richHtml)}</div>`;
          ops.push({ page: p, bbox: drawBbox, clear: clearBbox, html: wrapped, by: newBy, oby, bg: bgMap.get(el.id), ...vtOf(el) });
          continue;
        }
        if (changed) {
          // Düzenlenmiş öğe. Önizlemedeki font ("sans" varsayılan) ile birebir olsun diye
          // ed.font ?? "sans" kullanılır. Taşma/taşıma varsa noshrink (küçültme yerine komşu kaydı).
          const size = ed!.size ?? el.size ?? 12;
          const fk = elFont(el);
          const bold = ed!.bold ?? el.bold ?? false;
          const italic = ed!.italic ?? el.italic ?? false;
          const txt = ed!.text ?? el.text ?? "";
          const overflow = measureTextPt(txt, size, fk, bold, italic, elSpacing(el), elCss(el)) - (drawBbox[2] - drawBbox[0]);
          ops.push({
            page: p, bbox: drawBbox, clear: clearBbox, text: txt, size, color: ed!.color ?? el.color,
            font: fk, by: newBy, oby, bg: bgMap.get(el.id),
            noshrink: overflow > 1 || moved ? true : undefined,
            bold: bold || undefined, italic: italic || undefined,
            underline: ed!.underline || undefined, strike: ed!.strike || undefined,
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
    for (const a of added) if (a.text.trim()) ops.push({ page: a.page, bbox: a.bbox, text: a.text, size: a.size, color: a.color, font: a.font, bold: a.bold || undefined, italic: a.italic || undefined, underline: a.underline || undefined, strike: a.strike || undefined });
    for (const im of addedImages) ops.push({ page: im.page, bbox: im.bbox, text: "", size: 0, image: im.dataUrl, rotate: im.rotate });
    if (ops.length === 0) { setError(tr ? "Henüz bir düzenleme yapmadınız." : "No edits yet."); return; }
    try {
      setBusy(true);
      setError(null);
      // Günlük ücretsiz hak BU adımda düşer. Başarılı olunca PDF hemen alınır (indirme hak düşmez).
      const { resultId, dl, quota } = await editPdfTextPrepare(file, ops, accessToken ?? null);
      const blob = await downloadEditedPdf(resultId, dl, accessToken ?? null);
      setResult({ blob, filename: `${file.name.replace(/\.pdf$/i, "")}-duzenlenmis.pdf`, quota });
      // Son ücretsiz hakkı kullandıysa → hemen «hakkınız doldu» penceresi.
      if (!quota.unlimited && quota.used >= quota.limit) setQuotaPopup({ used: quota.used, limit: quota.limit, guest: quota.guest, resetAt: quota.resetAt, already: false });
    } catch (e) {
      if (e instanceof EditDailyLimitError) setQuotaPopup({ used: e.used, limit: e.limit, guest: e.guest, resetAt: e.resetAt, already: true });
      else setError(e instanceof Error ? e.message : tr ? "Hazırlanamadı." : "Failed.");
    }
    finally { setBusy(false); }
  }

  /** Hak yenilenmesine kalan süre + saat (Türkiye saati). */
  function resetInfo(resetAt: string | null): { h: number; m: number; clock: string } {
    const now = Date.now();
    let at = resetAt ? new Date(resetAt).getTime() : NaN;
    if (!Number.isFinite(at) || at <= now) {
      const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
      at = now + ((24 - ist.getHours()) * 60 - ist.getMinutes()) * 60000;
    }
    const mins = Math.max(1, Math.round((at - now) / 60000));
    const clock = new Date(at).toLocaleTimeString(tr ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
    return { h: Math.floor(mins / 60), m: mins % 60, clock: clock === "00:00" ? (tr ? "gece 00:00" : "00:00") : clock };
  }

  function reset() { setFile(null); setDoc(null); setAnalysis(null); setEdits(new Map()); setAdded([]); setAddedImages([]); setResult(null); setError(null); setQuotaPopup(null); setEditorOpen(false); setThumbs([]); setZoom(1); setMultiSel(new Set()); setSelected(null); setDelStack([]); setBgMap(new Map()); setOcrTried(false); setOcrBusy(false); }

  // Yalnız altı/üstü çizgi değişmiş öğe: yazı yeniden çizilmez (orijinal font/ölçü korunur), çizgi üstüne bindirilir.
  const isDecoOnly = (el: PdfElement, ed: Edit | undefined): boolean =>
    !!ed && (ed.underline !== undefined || ed.strike !== undefined) && (ed.text === undefined || ed.text === el.text)
    && ed.color === undefined && ed.size === undefined && ed.font === undefined && ed.bold === undefined && ed.italic === undefined
    && !(ed.html && /<[a-z]/i.test(ed.html)) && !ed.dx && !ed.dy && !ed.deleted;

  // Çerçeveden tutup taşımayı başlat (mevcut/eklenen metin + görsel).
  function startFrameDrag(e: React.PointerEvent, kind: FrameDrag["kind"], id: string, bx: number, by: number, w: number, h: number, ox = 0, oy = 0) {
    e.stopPropagation(); e.preventDefault();
    setAddMode(false);
    setFrameDrag({ kind, id, sx: e.clientX, sy: e.clientY, ox, oy, bx, by, w, h, moved: false });
  }

  const pgInfo = analysis?.pages[current];
  // Tur adımları SABİT referansla (useMemo): üst bileşen her yeniden çizildiğinde (ör. küçük resim yüklenince)
  // tur 1. adıma dönmesin — «3. adımda başa sarıyor» hatasının kaynağı yeni dizi oluşmasıydı.
  const tourSteps = useMemo<TourStep[]>(() => [
    { selector: "[data-tour='editor-add-text']", title: tr ? "Metin ekle" : "Add text", body: tr ? "Sayfaya yeni yazı eklemek için bu düğmeye basın, sonra sayfada bir yere tıklayın. Her yeni kutu için düğmeye yeniden basın. Yazıyı çerçevesinden tutup sürükleyerek taşıyın." : "Press this button, then click anywhere on the page to add new text. Press it again for each new box. Drag the text by its frame to move it." },
    { selector: "[data-tour='editor-add-image']", title: tr ? "Görsel / imza ekle" : "Add image / signature", body: tr ? "İmza, logo veya herhangi bir görsel ekleyin; köşeden boyutlandırın, üstten döndürün, tutup istediğiniz yere taşıyın." : "Add a signature, logo or any image; resize from the corner, rotate from the top, and drag it anywhere." },
    { selector: "[data-tour='editor-canvas']", title: tr ? "Yazıları ve görselleri düzenle" : "Edit text and images", body: tr ? "Bir yazıya tıklayın → değiştirin. Boş alanda sürükleyerek birden çok öğeyi (ayrık harfler dahil) seçin; Ctrl+A ile hepsini seçin. Seçili öğeyi çerçevesinden tutup taşıyın — hizalama çizgileri yardımcı olur. Delete ile silin, Ctrl+Z ile geri alın." : "Click text to change it. Drag on empty space to select many items (even separated letters); Ctrl+A selects everything. Drag a selected item by its frame — guide lines help you align. Delete removes it, Ctrl+Z undoes." },
    { selector: "[data-tour='editor-format']", title: tr ? "Biçim araçları" : "Formatting tools", body: tr ? "Renk, font, boyut, kalın/italik/altı çizili ve hizalama burada. Hizalama sayfaya göredir: sola yasla, ortala ya da sağa yasla." : "Color, font, size, bold/italic/underline and alignment live here. Alignment is relative to the page: left, center or right." },
    { selector: "[data-tour='editor-zoom']", title: tr ? "Yakınlaştır" : "Zoom", body: tr ? "Detaylı düzenleme için yakınlaştırın/uzaklaştırın; % ile genişliğe sığdırın." : "Zoom in/out for precise editing; the % button fits to width." },
    { selector: "[data-tour='editor-done']", title: tr ? "Bitir ve indir" : "Finish & download", body: unlimitedPlan
      ? (tr ? "«Tamam» → «PDF'i Hazırla» → «İndir/Aç/Paylaş». Planınızda düzenleme sayısı sınırsızdır." : "«Done» → «Prepare PDF» → «Download/Open/Share». Your plan has unlimited edits.")
      : (tr ? `«Tamam» → «PDF'i Hazırla» → «İndir/Aç/Paylaş». Düzenlemeler ücretsiz denenebilir; «PDF'i Hazırla» dediğinizde günlük ücretsiz hakkınızdan bir düşer (misafir günde ${EL.guest}, üye günde ${EL.free}, Başlangıç günde ${EL.starter}).` : `«Done» → «Prepare PDF» → «Download/Open/Share». Editing is free to try; one of your daily free edits is used when you press «Prepare PDF» (${EL.guest}/day as a guest, ${EL.free}/day with an account, ${EL.starter}/day on Starter).`) },
  ], [tr, unlimitedPlan, EL]);

  const grp = "flex items-center gap-1.5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_20px_-12px_rgba(0,0,0,0.7)]";
  const grpLabel = "hidden select-none pl-1 pr-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-500 xl:inline";
  const resetT = quotaPopup ? resetInfo(quotaPopup.resetAt) : null;

  return (
    <div className={`mx-auto w-full text-left ${file || result ? "max-w-3xl" : ""}`}>
      {/* Ad/açıklama zaten anlatılmış bir sayfanın (GuestSeoToolPage) ya da Hero'nun
          kendi tanıtım şeridinin İÇİNDEYSE bu başlık tekrar etmesin. */}
      {!describesTool && (
        <div className="mb-4 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/25 via-sky-500/20 to-blue-600/20 text-cyan-200 ring-1 ring-cyan-400/30 shadow-[0_0_30px_-8px_rgba(6,182,212,0.6)]"><Pencil className="h-7 w-7" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "PDF Düzenle" : "Edit PDF"}</h1>
              <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">{tr ? "Tam düzenleme" : "Full editing"}</span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{tr ? "Her yazıya ve görsele tıklayıp düzenleyin, silin, renk/boyut ve daha fazlasını değiştirin — gerçek düzenleme." : "Click any text or image to edit, delete, and change color, size and more — real editing."}</p>
          </div>
        </div>
      )}
      {belowHeader}

      {/* Günlük hak bilgisi YALNIZ misafire; üye/Başlangıç hakkı dolunca açılır pencereyle öğrenir; Plus+ hiç görmez.
          Giriş yapmışlara yalnızca (kota içermeyen) kısa gizlilik notu. */}
      {isGuest ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-[13px] text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{tr
            ? <>Gerçek düzenleme için dosyanız güvenli sunucumuzda işlenir ve işlem biter bitmez silinir. Ücretsiz kayıt hakkı: misafir günde {EL.guest}, üye günde {EL.free}, Başlangıç günde {EL.starter} — <b>Plus ve üzerinde sınırsız</b>.</>
            : <>For real editing, your file is processed on our secure server and deleted right after. Free saves: {EL.guest}/day as a guest, {EL.free}/day with an account, {EL.starter}/day on Starter — <b>unlimited on Plus and above</b>.</>}</p>
        </div>
      ) : (
        <p className="mb-4 flex items-center gap-2 px-1 text-[12px] text-slate-400">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          {tr ? "Gerçek düzenleme için dosyanız güvenli sunucumuzda işlenir ve işlem biter bitmez silinir." : "For real editing, your file is processed on our secure server and deleted right after."}
        </p>
      )}

      {scanned && !ocrAllowed && (
        <div className="mb-4 rounded-2xl border border-orange-400/30 bg-orange-500/[0.08] px-4 py-3 text-[13px] text-orange-200">
          <div className="flex items-start gap-2.5">
            <ScanText className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{tr
              ? "Bu PDF taranmış görünüyor (sayfalar resim, içinde gerçek yazı yok). Normal, yazı içeren PDF'lerde her yazıya tıklayıp değiştirebilirsiniz; ancak bu belgedeki yazılar resim olduğu için tıklanamıyor. Bu planda görselleri silebilir ve «Metin Ekle» ile üzerine yeni yazı yazabilirsiniz. Plus ve üzeri planlarda yazı tanıma (OCR) taranmış belgeyi otomatik okur ve her satır tıklanıp değiştirilebilir hâle gelir."
              : "This PDF looks scanned (pages are images). In regular PDFs with real text you can click and change any text, but the text in this document is part of an image, so it can't be clicked. On this plan you can delete images and type new text with «Add Text». On Plus and above, text recognition (OCR) reads scanned documents automatically and every line becomes clickable and editable."}</p>
          </div>
          <a href={tr ? "/pricing" : "/en/pricing"} className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-110">
            <Sparkles className="h-4 w-4" />{tr ? "Taranmış belgeleri otomatik düzenle — Plus'a geç" : "Edit scanned documents automatically — go Plus"}
          </a>
        </div>
      )}
      {scanned && ocrAllowed && ocrTried && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-orange-400/30 bg-orange-500/[0.08] px-4 py-3 text-[13px] text-orange-200">
          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{tr
            ? "Yazı tanıma bu belgede düzenlenebilir metin bulamadı (görüntü kalitesi düşük olabilir). Görselleri silebilir ve «Metin Ekle» ile üzerine yeni yazı ekleyebilirsiniz."
            : "Text recognition couldn't find editable text in this document (image quality may be low). You can delete images and add new text with «Add Text»."}</p>
        </div>
      )}

      {result ? (
        <ToolResultPanel
          blob={result.blob}
          filename={result.filename}
          language={language}
          subtitle={result.quota.unlimited ? undefined : (tr
            ? `Düzenleme tamamlandı · bugünkü ücretsiz hakkınız: ${result.quota.used}/${result.quota.limit} kullanıldı`
            : `Edit complete · today's free edits: ${result.quota.used}/${result.quota.limit} used`)}
          onClose={reset}
          ratingToolSlug="pdf-duzenle"
          extraActions={
            <button type="button" onClick={() => { setResult(null); setEditorOpen(true); }} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-5 py-3 text-sm font-bold text-cyan-100 transition duration-200 hover:scale-[1.04] hover:bg-cyan-500/20">
              <Pencil className="h-4 w-4" />{tr ? "Düzenlemeye Dön" : "Back to Editor"}
            </button>
          }
        >
          {/* Kayıt daveti yalnızca günlük hak dolunca (ceza anı) geçiyordu; başarı
              anında — değer tazeyken — hiçbir davet yoktu. */}
          <ValueMomentNudge language={language} source="editor_success" />
        </ToolResultPanel>
      ) : !file ? (
        <div className="tool-form">
          {/* Yükleme alanına kalp atışı ritminde yumuşak halka: dikkat çeker, içerik oynamaz. */}
          <div className="nb-heartbeat">
            <WorkspaceUploadField
              toolId="pdf-duzenle"
              language={language}
              accept="application/pdf,.pdf"
              label={tr ? "PDF'i buraya sürükle" : "Drag your PDF here"}
              note={tr ? "Tam ekran editör açılır — solda sayfalar, sağda düzenleme alanı." : "A full-screen editor opens — pages on the left, the editing area on the right."}
              hideHeader={describesTool}
              onFiles={(files) => { void pickFile(files[0]); }}
            />
          </div>
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

      {loadingMsg && !ocrBusy && <p className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] px-4 py-2.5 text-[13px] text-cyan-200"><Loader2 className="h-4 w-4 animate-spin" />{loadingMsg}</p>}
      {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}

      {/* Taranmış belge: OCR hazırlık ekranı (Plus ve üzeri) — ilerleme çubuğuyla, bitince editör açılır. */}
      {ocrBusy && createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#050912]/90 p-4 backdrop-blur-md" role="status" aria-live="polite">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-cyan-400/25 bg-gradient-to-b from-slate-900 to-slate-950 p-7 text-center shadow-[0_40px_120px_-30px_rgba(6,182,212,0.45)]">
            <div className="relative mx-auto h-32 w-24 overflow-hidden rounded-xl border border-cyan-400/30 bg-white/[0.05]">
              <div className="absolute inset-x-3 top-4 space-y-2">
                {[88, 100, 72, 94, 60, 100, 80].map((w, i) => <div key={i} className="h-1.5 rounded-full bg-white/15" style={{ width: `${w}%` }} />)}
              </div>
              <span className="nb-scan-line" />
            </div>
            <h3 className="mt-5 text-lg font-bold text-white">{tr ? "Taranmış belge algılandı" : "Scanned document detected"}</h3>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-slate-300">{tr
              ? "PDF dosyanız taranmış bir belge. Düzenleme yapabilmeniz için en iyi şekilde hazırlıyoruz: OCR (yazı tanıma) sistemini etkinleştiriyoruz."
              : "Your PDF is a scanned document. To let you edit it, we're preparing it the best way we can: activating the OCR (text recognition) system."}</p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ocrPct}>
              <div className="nb-bar-flow h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-[width] duration-300" style={{ width: `${Math.max(6, ocrPct)}%` }} />
            </div>
            <p className="mt-2.5 text-[12.5px] font-semibold text-cyan-200">
              {ocrPct < 4
                ? (tr ? "Yazı tanıma motoru hazırlanıyor…" : "Starting the text recognition engine…")
                : ocrPct < 100
                  ? (tr ? `Sayfalar okunuyor… %${ocrPct}` : `Reading pages… ${ocrPct}%`)
                  : (tr ? "Düzenlemeye hazırlanıyor…" : "Getting ready to edit…")}
            </p>
          </div>
        </div>,
        document.body,
      )}

      {/* Günlük ücretsiz hak doldu (yalnız misafir/ücretsiz/Başlangıç). */}
      {quotaPopup && createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setQuotaPopup(null)}>
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setQuotaPopup(null)} aria-label={tr ? "Kapat" : "Close"} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30"><Sparkles className="h-7 w-7" /></div>
            <h3 className="mt-4 text-lg font-bold text-white">{tr ? "Günlük kullanım hakkınıza ulaştınız" : "You've reached your daily limit"}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-300">
              {quotaPopup.limit === 0
                ? (tr ? "PDF Düzenle şu an bu hesap türü için geçici olarak kapalı. Plus ve üzeri planlarda düzenleme kullanılabilir." : "PDF Edit is temporarily unavailable for this account type. It is available on Plus and above.")
                : tr
                ? (quotaPopup.guest
                  ? `Bugünkü ücretsiz düzenleme hakkınızı (${quotaPopup.limit}/gün) kullandınız. Ücretsiz hesap açarak günde ${EL.free} düzenleme yapabilir, Başlangıç ile günde ${EL.starter}, Plus ve üzeri planlarla sınırsız düzenleyebilirsiniz.`
                  : `Bugünkü ücretsiz düzenleme hakkınızın tamamını (${quotaPopup.limit}/${quotaPopup.limit}) kullandınız. ${planUp === "STARTER" ? "Kesintisiz devam etmek için Plus'a geçin — düzenleme sınırsızdır." : "Başlangıç planıyla günde ${EL.starter}, Plus ve üzerinde sınırsız düzenleyebilirsiniz."}`)
                : (quotaPopup.guest
                  ? `You've used today's free edit (${quotaPopup.limit}/day). Create a free account for ${EL.free} a day, Starter for ${EL.starter}, or go Plus and above for unlimited editing.`
                  : `You've used all of today's free edits (${quotaPopup.limit}/${quotaPopup.limit}). ${planUp === "STARTER" ? "Go Plus to keep editing without limits." : "Starter gives ${EL.starter} a day; Plus and above is unlimited."}`)}
            </p>
            {resetT && (
              <p className="mt-2 text-[12px] text-slate-400">{tr
                ? `Hakkınız ${resetT.h ? `${resetT.h} saat ` : ""}${resetT.m ? `${resetT.m} dakika ` : ""}sonra (${resetT.clock}) yenilenir.`
                : `It renews in ${resetT.h ? `${resetT.h} h ` : ""}${resetT.m ? `${resetT.m} min ` : ""}(at ${resetT.clock}).`}</p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <a href={tr ? "/pricing" : "/en/pricing"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_12px_28px_-10px_rgba(245,158,11,0.7)] transition hover:brightness-110">
                <Sparkles className="h-4 w-4" />{tr ? "Planlara göz at" : "See plans"}
              </a>
              {quotaPopup.guest && (
                <a href="/register" className="inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-2.5 text-[13px] font-semibold text-slate-200 transition hover:bg-white/[0.06]">{tr ? "Ücretsiz hesap aç" : "Create free account"}</a>
              )}
              <button type="button" onClick={() => setQuotaPopup(null)} className="rounded-xl px-5 py-2 text-[13px] font-semibold text-slate-400 transition hover:text-white">{quotaPopup.already ? (tr ? "Kapat" : "Close") : (tr ? "Tamam" : "OK")}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {editorOpen && doc && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#0b1020]/97 backdrop-blur-sm">
          {/* Üst araç çubuğu — her grup kendi çerçevesinde: EKLE · BİÇİM · GÖRÜNÜM · BİTİR */}
          <div className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.08] bg-nb-bg-elevated/80 px-3 py-2.5">
            <div className={grp}>
              <span className={grpLabel}>{tr ? "Ekle" : "Add"}</span>
              <button data-tour="editor-add-text" type="button" onClick={() => { setAddMode((v) => !v); setSelected(null); setMultiSel(new Set()); }} aria-pressed={addMode}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-bold ring-1 transition duration-200 hover:scale-[1.03] ${addMode ? "bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950 shadow-[0_10px_26px_-8px_rgba(34,211,238,0.95)] ring-white/60" : "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_10px_24px_-12px_rgba(6,182,212,0.9)] ring-white/15 hover:brightness-110"}`}>
                <Type className="h-4 w-4" />{tr ? "Metin Ekle" : "Add Text"}
              </button>
              <button data-tour="editor-add-image" type="button" onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-2 text-[12.5px] font-bold text-white shadow-[0_10px_24px_-12px_rgba(168,85,247,0.9)] ring-1 ring-white/15 transition duration-200 hover:scale-[1.03] hover:brightness-110">
                <ImagePlus className="h-4 w-4" />{tr ? "Görsel / İmza Ekle" : "Add Image / Signature"}
              </button>
              <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => { addImageFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>

            {/* Biçimlendirme araçları HER ZAMAN görünür; metin seçili değilken PASİF (soluk). */}
            <div
              data-tour="editor-format"
              className={`${grp} transition-opacity`}
              style={{ opacity: selInfo?.kind === "text" ? 1 : 0.45, pointerEvents: selInfo?.kind === "text" ? "auto" : "none" }}
              aria-disabled={selInfo?.kind !== "text"}
              title={selInfo?.kind === "text" ? undefined : (tr ? "Bir yazıya tıklayın" : "Click a text")}
            >
              <span className={grpLabel}>{tr ? "Biçim" : "Format"}</span>
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
                Font
                <select value={font} onMouseDown={captureSelectionForPicker} onChange={(e) => applyFont(e.target.value as FontKey)} className="max-w-[10.5rem] rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-white">
                  <optgroup label={tr ? "Belgenizle aynı ölçüde (Word/Office)" : "Same metrics as your document"}>
                    {METRIC_KEYS.map((f) => <option key={f} value={f} className="text-black" style={{ fontFamily: FONT_CSS[f] }}>{FONT_MENU[f]}</option>)}
                  </optgroup>
                  <optgroup label={tr ? "Diğer fontlar" : "More fonts"}>
                    {OTHER_FONT_KEYS.map((f) => <option key={f} value={f} className="text-black" style={{ fontFamily: FONT_CSS[f] }}>{FONT_MENU[f]}</option>)}
                  </optgroup>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-300">
                {tr ? "Boyut" : "Size"}
                <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1 py-0.5">
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sizeStep(false)} title={tr ? "Küçült" : "Smaller"} aria-label={tr ? "Küçült" : "Smaller"} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="min-w-[2ch] text-center text-[12px] font-semibold tabular-nums text-white">{size}</span>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sizeStep(true)} title={tr ? "Büyüt" : "Larger"} aria-label={tr ? "Büyüt" : "Larger"} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"><Plus className="h-3.5 w-3.5" /></button>
                </span>
              </label>
              <span className="mx-0.5 h-6 w-px bg-white/15" />
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
              <span className="mx-0.5 h-6 w-px bg-white/15" />
              <span className="flex items-center gap-1">
                {([
                  ["left", AlignLeft, tr ? "Sayfada sola yasla" : "Align to page left"],
                  ["center", AlignCenter, tr ? "Sayfada ortala" : "Center on page"],
                  ["right", AlignRight, tr ? "Sayfada sağa yasla" : "Align to page right"],
                ] as [AlignKey, typeof AlignLeft, string][]).map(([k, Icon, label]) => (
                  <button key={k} type="button" onClick={() => applyAlign(k)} title={label} aria-label={label} aria-pressed={curFmt("align") === k}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${curFmt("align") === k ? "bg-cyan-500/25 text-cyan-200 ring-1 ring-cyan-400/50" : "text-slate-300 hover:bg-white/[0.08]"}`}>
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </span>
            </div>

            <div className={grp}>
              <span className={grpLabel}>{tr ? "Görünüm" : "View"}</span>
              <div data-tour="editor-zoom" className="flex items-center gap-1">
                <button type="button" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.2) * 100) / 100))} title={tr ? "Uzaklaştır" : "Zoom out"} aria-label={tr ? "Uzaklaştır" : "Zoom out"} className="flex h-9 w-9 items-center sm:h-7 sm:w-7 justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"><ZoomOut className="h-4 w-4" /></button>
                <input type="range" min={50} max={300} step={10} value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} className="hidden w-20 accent-cyan-400 sm:block" aria-label={tr ? "Yakınlaştırma" : "Zoom"} />
                <button type="button" onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.2) * 100) / 100))} title={tr ? "Yakınlaştır" : "Zoom in"} aria-label={tr ? "Yakınlaştır" : "Zoom in"} className="flex h-9 w-9 items-center sm:h-7 sm:w-7 justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"><ZoomIn className="h-4 w-4" /></button>
                <button type="button" onClick={() => setZoom(1)} title={tr ? "Genişliğe sığdır" : "Fit to width"} className="min-w-[3rem] rounded-lg px-1.5 py-1 text-center text-[12px] font-semibold tabular-nums text-slate-200 transition hover:bg-white/10">{Math.round(zoom * 100)}%</button>
              </div>
              <span className="mx-0.5 h-6 w-px bg-white/15" />
              <button type="button" onClick={undoDelete} disabled={!delStack.length} title={tr ? "Son silmeyi geri al (Ctrl+Z)" : "Undo last delete (Ctrl+Z)"}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent">
                <Undo2 className="h-4 w-4" /><span className="hidden md:inline">{tr ? "Geri Al" : "Undo"}</span>
              </button>
            </div>

            <div className={grp}>
              <button type="button" onClick={() => setTourOpen(true)} title={tr ? "Hızlı turu başlat" : "Start the quick tour"}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-[12.5px] font-bold text-slate-100 transition duration-200 hover:scale-[1.03] hover:bg-white/[0.1] hover:text-cyan-200">
                <HelpCircle className="h-4 w-4" />{tr ? "Nasıl Yapılır" : "How To"}
              </button>
              <button data-tour="editor-done" type="button" onClick={() => setEditorOpen(false)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-5 py-2 text-[13px] font-bold text-white shadow-[0_10px_26px_-10px_rgba(16,185,129,0.9)] ring-1 ring-white/15 transition duration-200 hover:scale-[1.04] hover:brightness-110"><Check className="h-4 w-4" />{tr ? "Tamam" : "Done"}</button>
            </div>
            <button type="button" onClick={() => setEditorOpen(false)} aria-label={tr ? "Kapat" : "Close"} className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Sol: sayfa küçük resimleri — düzenlenen sayfalar en son hâliyle görünür */}
            <div className="w-16 shrink-0 overflow-y-auto border-r border-white/[0.08] bg-black/20 p-1 sm:w-32 sm:p-2">
              {Array.from({ length: pageCount }).map((_, i) => {
                const pgEdited = !!analysis?.pages[i]?.elements.some((e) => edits.has(e.id)) || added.some((a) => a.page === i) || addedImages.some((a) => a.page === i);
                return (
                  <button key={i} type="button" onClick={() => { setCurrent(i); setSelected(null); setMultiSel(new Set()); }}
                    className={`relative mb-2 block w-full overflow-hidden rounded-lg border-2 transition ${current === i ? "border-cyan-400" : "border-transparent hover:border-white/20"}`}>
                    {thumbs[i] ? <img src={thumbs[i]} alt={`${i + 1}`} className="w-full bg-white" /> : <div className="flex h-24 w-full items-center justify-center bg-white/5 text-[10px] text-slate-400">{i + 1}</div>}
                    {pgEdited && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-cyan-400 ring-2 ring-slate-900" title={tr ? "Düzenlendi" : "Edited"} />}
                    <span className={`block py-0.5 text-center text-[10px] ${current === i ? "text-cyan-300" : "text-slate-400"}`}>{i + 1}</span>
                  </button>
                );
              })}
            </div>

            {/* Sağ: büyük düzenleme alanı */}
            <div className="min-w-0 flex-1 overflow-auto p-2 sm:p-6">
              {/* Önizleme notu — görünür yerde (sayfanın başında) */}
              <div className="mx-auto mb-3 flex max-w-xl items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/[0.09] px-3 py-2 text-[12px] leading-snug text-amber-200">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{tr ? "Önizleme notu: Bir yazıyı düzenlerken beliren beyaz örtü üst/alt çizgilere taşabilir — bu yalnızca önizlemedir; indirdiğiniz PDF'te o çizgiler korunur." : "Preview note: while editing a line, the white cover may overlap the lines above/below — this is preview only; those lines are kept in the downloaded PDF."}</p>
              </div>
              {addMode && (
                <div className="mx-auto mb-3 flex max-w-xl items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/[0.12] px-3 py-2 text-[12.5px] font-semibold text-cyan-100">
                  <Type className="h-4 w-4 shrink-0" />{tr ? "Yazı eklemek için sayfada bir yere tıklayın." : "Click anywhere on the page to add text."}
                </div>
              )}
              <div data-tour="editor-canvas" className="relative mx-auto w-fit rounded-lg bg-white shadow-2xl">
                <canvas ref={canvasRef} className="block rounded-lg" />
                {rendering && <div className="absolute inset-0 flex items-center justify-center bg-black/10"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>}
                <div ref={overlayRef} onClick={onCanvasClick} onPointerDown={onOverlayPointerDown} className="absolute inset-0" style={{ cursor: addMode ? "text" : "default", touchAction: "pan-x pan-y" }}>
                  {/* KAPAK katmanı: aktif/kaydırılan metinlerin ORİJİNAL konumunu arka planla ört.
                      İçerik katmanının ALTINDA kalır → sağa kaydırılan komşu metin, örtülen orijinalin
                      ÜSTÜNE net biner (paint sırası sorunu çözülür). */}
                  {pageEls.map((el) => {
                    if (el.type !== "text" || isDeleted(el.id)) return null;
                    const shift = shifts.get(el.id) ?? 0;
                    const ed = edits.get(el.id);
                    const activeCover = selected === el.id || multiSel.has(el.id) || (!!ed && !isDecoOnly(el, ed)) || shift > 0.5;
                    if (!activeCover) return null;
                    const [x0, , x1] = el.bbox;
                    const [cy0, cy1] = coverY(el);
                    const cx0 = el.ink ? Math.min(x0, el.ink[0]) : x0, cx1 = el.ink ? Math.max(x1, el.ink[2]) : x1;
                    return <div key={`cover_${el.id}`} className="pointer-events-none absolute" style={{ left: cx0 * scale - 1, top: cy0 * scale - 1, width: Math.max((cx1 - cx0 + Math.max(0, shift)) * scale, 4) + 2, height: Math.max((cy1 - cy0) * scale, 6) + 2, backgroundColor: bgFor(el.id) }} />;
                  })}
                  {/* İçerik katmanı — mevcut öğeler (görseller altta) */}
                  {pageElsStacked.map((el) => {
                    const [x0, y0, x1, y1] = el.bbox;
                    const del = isDeleted(el.id);
                    const shift = shifts.get(el.id) ?? 0;
                    const ed = edits.get(el.id);
                    const mdx = ed?.dx ?? 0, mdy = ed?.dy ?? 0;
                    const sel = selected === el.id || multiSel.has(el.id);
                    if (el.type === "image") {
                      const style = { left: x0 * scale, top: y0 * scale, width: Math.max((x1 - x0) * scale, 8), height: Math.max((y1 - y0) * scale, 8) } as const;
                      // Silinmiş görsel → arka plan rengiyle kapat (tam sayfa görselde düz beyaz). Silgiyi bbox'tan ~3px taşır:
                      // amblem/logo kenarındaki ince hat çizgileri de örtülsün (indirmede zaten yok).
                      const oldRect = { left: style.left - 1, top: style.top - 1, width: style.width + 2, height: style.height + 2 };
                      if (del) return <FillPatch key={el.id} src={canvasRef.current} rect={oldRect} />;
                      // Tam sayfa/arka plan görseli: sürükleme-seçim (marquee) bunun üstünden de başlayabilsin, taşınmasın.
                      const bgImg = !!pgInfo && (x1 - x0) * (y1 - y0) > pgInfo.width * pgInfo.height * 0.5;
                      const canMove = !el.vec && !bgImg;
                      const moved = !!(mdx || mdy);
                      const boxStyle = moved ? { ...style, left: (x0 + mdx) * scale, top: (y0 + mdy) * scale } : style;
                      return (
                        <Fragment key={el.id}>
                          {moved && <FillPatch src={canvasRef.current} rect={oldRect} />}
                          {moved && <MovedImage src={canvasRef.current} from={style} to={boxStyle} />}
                          <div data-bg={bgImg ? "1" : undefined}
                            onPointerDown={canMove ? (e) => { if (!sel) selectEl(el, e.shiftKey || e.ctrlKey || e.metaKey); startFrameDrag(e, "el", el.id, x0 + mdx, y0 + mdy, x1 - x0, y1 - y0, mdx, mdy); } : undefined}
                            onClick={(e) => { e.stopPropagation(); selectEl(el, e.shiftKey || e.ctrlKey || e.metaKey); }}
                            className={`absolute rounded-sm ${canMove ? "cursor-move" : "cursor-pointer"} ${sel ? "ring-2 ring-cyan-500 bg-cyan-500/10" : "hover:ring-2 hover:ring-cyan-400/70 hover:bg-cyan-400/5"}`}
                            style={{ ...boxStyle, touchAction: canMove ? "none" : undefined }}
                            title={el.vec ? (tr ? "Amblem — seç, sonra sil" : "Emblem — select, then delete") : canMove ? (tr ? "Görsel — seç, tutup taşı ya da sil" : "Image — select, drag to move, or delete") : (tr ? "Görsel — seç, sonra sil" : "Image — select, then delete")}>
                            {sel && (
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); markDeleted([el.id]); setSelected(null); }}
                                className="absolute -right-2.5 -top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                                title={tr ? "Sil" : "Delete"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </Fragment>
                      );
                    }
                    // Metin öğesi. Silgi kutusu = ORİJİNAL bbox (metin kısalıp temizlense de
                    // alttaki orijinal asla görünmesin). Boyut, içerikten BAĞIMSIZ.
                    const eb = { left: x0 * scale, top: y0 * scale, width: Math.max((x1 - x0) * scale, 4), height: Math.max((y1 - y0) * scale, 6) } as const;
                    if (del) {
                      // Silinmiş metin → orijinali arka plan rengiyle kapat. Tıklayınca GERİ GELMEZ (Geri Al / Ctrl+Z kullanılır).
                      return <div key={el.id} className="pointer-events-none absolute" style={{ ...eb, top: coverY(el)[0] * scale, height: Math.max((coverY(el)[1] - coverY(el)[0]) * scale, 6), backgroundColor: bgFor(el.id) }} />;
                    }
                    // Değişmemiş, seçili değil ve KAYDIRILMAMIŞ → sadece şeffaf tıklama hedefi;
                    // canvas'taki NET orijinal metin görünür (çift görüntü yok). Yalnız altı/üstü çizgi
                    // eklendiyse yazı yeniden çizilmez; çizgi üstüne bindirilir.
                    const decoOnly = isDecoOnly(el, ed);
                    const active = sel || (!!ed && !decoOnly) || shift > 0.5;
                    if (!active) {
                      const szp = elSize(el);
                      const baseY = ((el.by ?? y0 + szp) - y0) * scale;
                      return (
                        <div key={el.id} onClick={(e) => { e.stopPropagation(); selectEl(el, e.shiftKey || e.ctrlKey || e.metaKey); }} className="absolute cursor-text rounded-[2px] transition hover:bg-cyan-400/10 hover:ring-1 hover:ring-cyan-400/50" style={eb} title={tr ? "Düzenlemek için tıkla" : "Click to edit"}>
                          {decoOnly && elUnderline(el) && <span className="pointer-events-none absolute left-0 right-0" style={{ top: baseY + 0.12 * szp * scale, height: Math.max(1, szp * 0.05 * scale), backgroundColor: elColor(el) }} />}
                          {decoOnly && elStrike(el) && <span className="pointer-events-none absolute left-0 right-0" style={{ top: baseY - 0.3 * szp * scale, height: Math.max(1, szp * 0.05 * scale), backgroundColor: elColor(el) }} />}
                        </div>
                      );
                    }
                    // Aktif/kaydırılmış/taşınmış → metni konumunda çiz (orijinali KAPAK katmanı örter). Gerçek
                    // taban çizgisine (by) hizala + biçim (kalın/italik/altı-üstü çizili) → önizleme indirilen
                    // PDF ile birebir. Hizalama SAYFAYA göre (dx ile konumlanır).
                    // Backend ile BİREBİR: metin orijinal kutudan genişse fontu SIĞDIR (küçült); düzenlenip
                    // taşan (noshrink), kaydırılan veya taşınan öğede küçültme yok.
                    const richHtml = ed?.html;
                    const isRich = !!richHtml && /<[a-z]/i.test(richHtml);
                    const rawPx = elSize(el) * scale;
                    const _sp = isRich ? NO_SPACING : elSpacing(el);
                    const _txtW = measureTextPt(elText(el), elSize(el), elFont(el), elBold(el), elItalic(el), _sp, elCss(el));
                    const _boxW = x1 - x0;
                    const _noShrink = (!!ed && _txtW - _boxW > 1) || shift > 0.5 || !!(mdx || mdy);
                    // Zengin (kelime bazlı) öğede küçültme yok — export htmlbox otomatik ölçekler.
                    const _fit = (!isRich && !_noShrink && _txtW > _boxW && _boxW > 1)
                      ? Math.max(_boxW / _txtW, 5 / Math.max(elSize(el), 1))
                      : 1;
                    const fsPx = rawPx * _fit;
                    const baselinePt = el.by ?? (y0 + (el.size ?? 12));
                    const textTop = (baselinePt - y0) * scale - baselineRatio(elCss(el), elBold(el), elItalic(el)) * fsPx;
                    const shiftPx = shift * scale;
                    const deco = [elUnderline(el) ? "underline" : "", elStrike(el) ? "line-through" : ""].filter(Boolean).join(" ") || "none";
                    const containerLeft = eb.left + shiftPx + mdx * scale;
                    const containerTop = eb.top + mdy * scale;
                    const frameW = Math.max(_txtW * scale * _fit, 10);
                    const single = selected === el.id && !multiSel.size;
                    const downFrame = (e: React.PointerEvent) => startFrameDrag(e, "el", el.id, x0 + shift + mdx, y0 + mdy, Math.max(_txtW, 4), y1 - y0, mdx, mdy);
                    return (
                      <div key={el.id} className="absolute" style={{ left: containerLeft, top: containerTop }}>
                        {single && (
                          <>
                            <span onPointerDown={downFrame} style={{ touchAction: "none", top: textTop - 30 }} className="absolute left-0 z-10 inline-flex cursor-move touch-none select-none items-center gap-1 rounded-md bg-cyan-600 px-2 py-1 text-[11px] font-bold text-white shadow-lg" title={tr ? "Sürükleyerek taşı" : "Drag to move"}>
                              <Move className="h-3.5 w-3.5" />{tr ? "Taşı" : "Move"}
                            </span>
                            <FrameStrips w={frameW} h={fsPx} top={textTop} onDown={downFrame} />
                          </>
                        )}
                        <AutoText id={el.id} initial={elText(el)} initialHtml={richHtml} autoFocus={sel && !edits.has(el.id) && !multiSel.size}
                          onInput={(t, h) => setEdit(el.id, { text: t, html: h })}
                          onClick={(e) => { e.stopPropagation(); selectEl(el, e.ctrlKey || e.metaKey || e.shiftKey); }}
                          onFocus={() => { if (!multiSel.size) selectEl(el); }}
                          className={`outline-none ${sel ? "ring-2 ring-cyan-500" : ""}`}
                          style={{ position: "absolute", left: 0, top: textTop, textAlign: "left", color: elColor(el), fontSize: `${fsPx}px`, lineHeight: 1, fontWeight: elBold(el) ? 700 : 400, fontStyle: elItalic(el) ? "italic" : "normal", textDecoration: deco, fontFamily: elCss(el), padding: 0, backgroundColor: el.type === "text" && !el.ocr && !el.inv ? "transparent" : bgFor(el.id),
                            // Orijinal harf/kelime aralığı + yatay ölçek (Tc/Tw/Tz) — sunucu çizimiyle aynı.
                            letterSpacing: _sp.cs ? `${_sp.cs * scale * _fit}px` : undefined,
                            wordSpacing: _sp.ws ? `${_sp.ws * scale * _fit}px` : undefined,
                            transform: _sp.hs !== 1 ? `scaleX(${_sp.hs})` : undefined, transformOrigin: "left center" }} />
                      </div>
                    );
                  })}
                  {/* Eklenen metinler — çerçeveden tutup serbest taşınır */}
                  {pageAdded.map((a) => {
                    const [x0, y0] = a.bbox;
                    const sel = selected === a.id || multiSel.has(a.id);
                    const single = selected === a.id && !multiSel.size;
                    const aw = Math.max(measureTextPt(a.text || " ", a.size, a.font, !!a.bold, !!a.italic), 10);
                    const downFrame = (e: React.PointerEvent) => startFrameDrag(e, "added", a.id, x0, y0, aw, a.size + 4);
                    return (
                      <div key={a.id} className="absolute" style={{ left: x0 * scale, top: y0 * scale }}>
                        {sel && (
                          <>
                            <span onPointerDown={downFrame} style={{ touchAction: "none" }}
                              className="absolute -top-7 left-0 z-10 inline-flex cursor-move touch-none items-center gap-1 rounded-md bg-cyan-600 px-2 py-1 text-[11px] font-bold text-white shadow-lg select-none"
                              title={tr ? "Sürükleyerek taşı" : "Drag to move"}>
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
                        {single && <FrameStrips w={aw * scale} h={a.size * scale} top={0} onDown={downFrame} />}
                        <AutoText id={a.id} initial={a.text}
                          onInput={(t) => setAdded((arr) => arr.map((x) => (x.id === a.id ? { ...x, text: t } : x)))}
                          onClick={(e) => { e.stopPropagation(); if (!(e.ctrlKey || e.metaKey || e.shiftKey)) setMultiSel(new Set()); setSelected(a.id); setColor(a.color); setSize(a.size); setFont(a.font); setAlign(a.align ?? "left"); setAddMode(false); }}
                          onFocus={() => { if (!multiSel.size) { setSelected(a.id); setColor(a.color); setSize(a.size); setFont(a.font); setAlign(a.align ?? "left"); } }}
                          className={`bg-white/90 leading-none outline-none ${sel ? "ring-2 ring-cyan-500" : "ring-1 ring-cyan-400/50"}`}
                          style={{ position: "absolute", left: 0, top: 0, color: a.color, fontSize: `${a.size * scale}px`, fontFamily: FONT_CSS[a.font], padding: 0, fontWeight: a.bold ? 700 : 400, fontStyle: a.italic ? "italic" : "normal", textDecoration: [a.underline ? "underline" : "", a.strike ? "line-through" : ""].filter(Boolean).join(" ") || "none", textAlign: a.align ?? "left" }} />
                      </div>
                    );
                  })}
                  {/* Eklenen resimler — taşı (tut-sürükle) · köşeden boyutlandır · üstten döndür */}
                  {pageImages.map((im) => {
                    const [x0, y0, x1, y1] = im.bbox;
                    const left = x0 * scale, top = y0 * scale;
                    const w = (x1 - x0) * scale, h = (y1 - y0) * scale;
                    const sel = selected === im.id || multiSel.has(im.id);
                    return (
                      <div
                        key={im.id}
                        onPointerDown={(e) => { setSelected(im.id); if (!(e.shiftKey || e.ctrlKey || e.metaKey)) setMultiSel(new Set()); startFrameDrag(e, "addedImg", im.id, x0, y0, x1 - x0, y1 - y0); }}
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
                  {/* Hizalama çizgileri (taşırken) + seçim kutusu */}
                  {guides.map((g, i) => g.axis === "x"
                    ? <div key={`g${i}`} className="pointer-events-none absolute bottom-0 top-0 w-px bg-fuchsia-500" style={{ left: g.pos * scale, boxShadow: "0 0 0 0.5px rgba(217,70,239,0.35)" }} />
                    : <div key={`g${i}`} className="pointer-events-none absolute left-0 right-0 h-px bg-fuchsia-500" style={{ top: g.pos * scale, boxShadow: "0 0 0 0.5px rgba(217,70,239,0.35)" }} />)}
                  {marquee && (
                    <div className="pointer-events-none absolute border border-dashed border-cyan-500 bg-cyan-400/10"
                      style={{ left: Math.min(marquee.sx, marquee.cx), top: Math.min(marquee.sy, marquee.cy), width: Math.abs(marquee.cx - marquee.sx), height: Math.abs(marquee.cy - marquee.sy) }} />
                  )}
                </div>
              </div>
            </div>
          </div>
          <ProductTour
            open={tourOpen}
            onClose={closeTour}
            language={language}
            steps={tourSteps}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
