/**
 * PDF'E ÜST BİLGİ / ALT BİLGİ EKLE — her sayfanın üstüne/altına sol·orta·sağ metin ve sayfa numarası.
 *
 * Her şey cihazda yapılır (pdf-lib + pdf.js); dosya sunucuya gitmez. Orijinal içerik değişmez.
 *
 *  • İki kip: «tüm sayfalara aynı metin» ya da «sayfa sayfa farklı metin» (o an açık sayfa için yazılır).
 *  • Üst bilgi ve alt bilginin görünümü ayrı; boyut, renk ve kalınlık her sütun (sol/orta/sağ) için ayrı.
 *  • Önizleme büyüktür: sayfa geçişi, yakınlaştırma ve fareyle tutup sürükleyerek gezme.
 */
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, FileText, Hash, Loader2, Pencil, Sigma, Slash, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { PdfThumbError, renderPdfPage } from "../../lib/pdfThumbs";
import {
  EMPTY_SLOT, addHeaderFooter, formatDateTr, headerFooterOutputName, slotHasText,
  type HeaderFooterOptions, type HeaderFooterRule, type PageScope, type PartStyle, type Slot3,
} from "../../lib/pdfHeaderFooter";

const MAX_BYTES = 50 * 1024 * 1024;
const PREVIEW_PX = 1500;

type Preset = { id: string; tr: string; en: string; header: Slot3; footer: Slot3 };
const PRESETS: Preset[] = [
  { id: "num", tr: "Sayfa Numarası", en: "Page Number", header: EMPTY_SLOT, footer: { left: "", center: "{sayfa} / {toplam}", right: "" } },
  { id: "name", tr: "Dosya Adı + Numara", en: "File Name + Number", header: { left: "{dosya}", center: "", right: "" }, footer: { left: "", center: "", right: "Sayfa {sayfa} / {toplam}" } },
  { id: "date", tr: "Tarih + Numara", en: "Date + Number", header: { left: "", center: "", right: "{tarih}" }, footer: { left: "", center: "", right: "{sayfa}" } },
  { id: "conf", tr: "Gizlilik Notu", en: "Confidentiality Note", header: { left: "", center: "GİZLİDİR", right: "" }, footer: { left: "{dosya}", center: "", right: "{sayfa} / {toplam}" } },
];

const T = {
  tr: {
    hint: "PDF'i seç — üst ve alt bilgiyi sonraki adımda yazarsın.",
    reading: "Belge okunuyor…",
    encrypted: "Bu dosya şifreli. Lütfen şifresini kaldırıp tekrar yükleyin.",
    broken: "Dosya okunamadı. Bozuk olabilir; başka bir PDF dene.",
    tooBig: "Dosya 50 MB'dan büyük. Önce sıkıştırıp tekrar dene.",
    presets: "Hazır düzen",
    modeTitle: "Hangi sayfalara yazılsın?",
    modeAll: "Tüm sayfalar",
    modeAllHelp: "Yazdığın üst ve alt bilgi her sayfaya eklenir.",
    modePage: "Sayfa sayfa",
    modePageHelp: "Soldaki önizlemede bir sayfa aç, o sayfanın metnini yaz. Metin girmediğin sayfalara bir şey yazılmaz.",
    editingAll: "Tüm sayfalara yazılacak metin",
    editingPage: (n: number) => `Sayfa ${n} için yazılacak metin`,
    clear: "Temizle",
    header: "Üst bilgi",
    footer: "Alt bilgi",
    left: "Sol", center: "Orta", right: "Sağ",
    insertTitle: "Kutuya ekle",
    insertPageAuto: "«Sayfa No» her sayfada kendi numarasını yazar; kutuda şu an baktığın sayfanın numarası görünür.",
    chips: { page: "Sayfa No", total: "Toplam Sayfa", both: "Sayfa / Toplam", date: "Tarih", file: "Dosya Adı" },
    appearance: "Görünüm",
    headerLook: "Üst bilgi görünümü",
    footerLook: "Alt bilgi görünümü",
    colStyles: "Sütunların yazısı",
    size: "Boyut", color: "Renk", boldShort: "Kalın",
    edgeTop: "Üstten boşluk (mm)", edgeBottom: "Alttan boşluk (mm)", side: "Yandan boşluk (mm)",
    ruleHeader: "Altına ince çizgi çiz", ruleFooter: "Üstüne ince çizgi çiz",
    ruleColor: "Çizgi rengi", ruleWidth: "Çizgi kalınlığı (pt)",
    numbering: "Numaralandırma",
    skipFirst: "İlk sayfaya (kapak) yazma", start: "Numara şuradan başlasın",
    preview: "Önizleme", previewing: "Önizleme hazırlanıyor…",
    page: "Sayfa", prev: "Önceki sayfa", next: "Sonraki sayfa",
    zoomIn: "Yakınlaştır", zoomOut: "Uzaklaştır", zoomFit: "Sığdır",
    altWheel: "Alt + fare tekerleği ile yakınlaştır / uzaklaştır",
    notStamped: "Bu sayfaya üst/alt bilgi yazılmayacak.",
    emptyWarn: "Üst ya da alt bilgiye en az bir metin yaz.",
    add: "Üst/alt bilgiyi PDF'ye ekle", working: "Ekleniyor…",
    failed: "İşlem tamamlanamadı. Dosya bozuk ya da korumalı olabilir.",
    privacy: "Dosyanız tarayıcınızda işlenir — sunucumuza yüklenmez.",
    shrunk: "Bazı metinler sığması için küçültüldü.",
    done: (n: number) => `${n} sayfaya eklendi.`,
    note: "Metin sayfanın üstüne yazılır; sayfada o noktada yazı varsa üst üste binebilir. Önizlemeden kontrol et, gerekirse kenar boşluğunu artır.",
    change: "Başka dosya seç",
    back: "Düzenlemeye Dön",
    noPages: "Seçilen sayfalarda işlenecek sayfa yok.",
  },
  en: {
    hint: "Choose a PDF — you'll write the header and footer in the next step.",
    reading: "Reading the document…",
    encrypted: "This file is encrypted. Please remove the password and try again.",
    broken: "The file could not be read. It may be corrupt; try another PDF.",
    tooBig: "The file is larger than 50 MB. Compress it first and try again.",
    presets: "Quick layouts",
    modeTitle: "Which pages?",
    modeAll: "All pages",
    modeAllHelp: "The header and footer you write are added to every page.",
    modePage: "Page by page",
    modePageHelp: "Open a page in the preview on the left and write its text. Pages you leave empty get nothing.",
    editingAll: "Text written on all pages",
    editingPage: (n: number) => `Text for page ${n}`,
    clear: "Clear",
    header: "Header",
    footer: "Footer",
    left: "Left", center: "Center", right: "Right",
    insertTitle: "Insert into box",
    insertPageAuto: "“Page No” writes each page's own number; the box shows the number of the page you are looking at.",
    chips: { page: "Page No", total: "Total Pages", both: "Page / Total", date: "Date", file: "File Name" },
    appearance: "Appearance",
    headerLook: "Header look",
    footerLook: "Footer look",
    colStyles: "Text of each column",
    size: "Size", color: "Color", boldShort: "Bold",
    edgeTop: "Top margin (mm)", edgeBottom: "Bottom margin (mm)", side: "Side margin (mm)",
    ruleHeader: "Draw a thin line below", ruleFooter: "Draw a thin line above",
    ruleColor: "Line color", ruleWidth: "Line thickness (pt)",
    numbering: "Numbering",
    skipFirst: "Skip the first page (cover)", start: "Start numbering at",
    preview: "Preview", previewing: "Preparing preview…",
    page: "Page", prev: "Previous page", next: "Next page",
    zoomIn: "Zoom in", zoomOut: "Zoom out", zoomFit: "Fit",
    altWheel: "Alt + mouse wheel to zoom in / out",
    notStamped: "No header/footer will be written on this page.",
    emptyWarn: "Write at least one text in the header or footer.",
    add: "Add header/footer to PDF", working: "Adding…",
    failed: "The operation failed. The file may be corrupt or protected.",
    privacy: "Your file is processed in your browser — never uploaded.",
    shrunk: "Some texts were shrunk to fit.",
    done: (n: number) => `Added to ${n} pages.`,
    note: "Text is drawn on top of the page; it can overlap existing content at that spot. Check the preview and increase the margin if needed.",
    change: "Choose another file",
    back: "Back to Editing",
    noPages: "No pages to process in the chosen pages.",
  },
} as const;

type TT = (typeof T)["tr"] | (typeof T)["en"];

const inputSm = "rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[13px] text-slate-100 placeholder:text-slate-500";
const input = `w-full ${inputSm}`;
const heading = "text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400";

type TextPair = { header: Slot3; footer: Slot3 };
type Mode = "all" | "page";
type Col = "left" | "center" | "right";
type ColState = { size: string; color: string; bold: boolean };
type StyleState = { cols: Record<Col, ColState>; edge: string; side: string; rule: boolean; ruleColor: string; ruleWidth: string };
type FocusRef = { part: "header" | "footer"; slot: Col } | null;

const DEFAULT_COL: ColState = { size: "10", color: "#555555", bold: false };
const defaultStyle = (): StyleState => ({
  cols: { left: { ...DEFAULT_COL }, center: { ...DEFAULT_COL }, right: { ...DEFAULT_COL } },
  edge: "10", side: "10", rule: false, ruleColor: "#555555", ruleWidth: "0.5",
});

const EMPTY_PAIR: TextPair = { header: EMPTY_SLOT, footer: EMPTY_SLOT };
const pairHasText = (p: TextPair) => slotHasText(p.header) || slotHasText(p.footer);
const samePair = (a: TextPair, b: { header: Slot3; footer: Slot3 }) => JSON.stringify([a.header, a.footer]) === JSON.stringify([b.header, b.footer]);

const num = (v: string, d: number) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d);
const toPartStyle = (s: StyleState): PartStyle => {
  const col = (c: ColState) => ({ fontSize: num(c.size, 10), color: c.color, bold: c.bold });
  return {
    cols: { left: col(s.cols.left), center: col(s.cols.center), right: col(s.cols.right) },
    edgeMm: num(s.edge, 10), sideMm: num(s.side, 10),
    rule: s.rule, ruleColor: s.ruleColor, ruleWidth: num(s.ruleWidth, 0.5),
  };
};

/**
 * Kutuda KOD değil, o an önizlenen sayfanın GERÇEK değeri görünür (ör. «3 / 30»).
 * Arka planda sayfa numarası gibi alanlar kod ({sayfa}) olarak saklanır ki her sayfada kendi numarası yazılsın;
 * kullanıcı kutuyu düzenlerse dokunduğu kısım düz metne döner, dokunmadığı alanlar kendiliğinden değişmeye devam eder.
 */
type Vars = { page: number; total: number; date: string; file: string };
type Seg = { text: string; raw: string; tok: boolean };
const TOKEN_RE = /\{(sayfa|toplam|tarih|dosya|page|total|date|file)\}/gi;
const tokenValue = (k: string, v: Vars) => {
  switch (k.toLowerCase()) {
    case "sayfa": case "page": return String(v.page);
    case "toplam": case "total": return String(v.total);
    case "tarih": case "date": return v.date;
    default: return v.file;
  }
};
function segsOf(raw: string, v: Vars): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  for (const m of raw.matchAll(TOKEN_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: raw.slice(last, i), raw: raw.slice(last, i), tok: false });
    out.push({ text: tokenValue(m[1]!, v), raw: m[0], tok: true });
    last = i + m[0].length;
  }
  if (last < raw.length) out.push({ text: raw.slice(last), raw: raw.slice(last), tok: false });
  return out;
}
const resolveText = (raw: string, v: Vars) => segsOf(raw, v).map((x) => x.text).join("");
/** Kutudaki görünen metin değişince, saklanan ham metni (kodlarla) günceller. */
function editRaw(raw: string, v: Vars, next: string): string {
  const segs = segsOf(raw, v);
  const old = segs.map((x) => x.text).join("");
  let p = 0;
  while (p < old.length && p < next.length && old[p] === next[p]) p++;
  let q = 0;
  while (q < old.length - p && q < next.length - p && old[old.length - 1 - q] === next[next.length - 1 - q]) q++;
  const mid = next.slice(p, next.length - q);
  const sStart = old.length - q;
  let pre = "";
  let suf = "";
  let pos = 0;
  for (const sg of segs) {
    const start = pos;
    const end = pos + sg.text.length;
    pos = end;
    if (end <= p) pre += sg.raw;
    else if (start >= sStart) suf += sg.raw;
    else {
      if (start < p) pre += sg.text.slice(0, p - start); // kısmen önekte → düz metne döner
      if (end > sStart) suf += sg.text.slice(Math.max(0, sStart - start)); // kısmen sonekte → düz metne döner
    }
  }
  return pre + mid + suf;
}

function SlotRow({ label, slot, onChange, t, part, onFocus, vars, st, onStyle }: {
  label: string; slot: Slot3; onChange: (s: Slot3) => void; t: TT; part: "header" | "footer"; onFocus: (f: FocusRef) => void;
  vars: Vars; st: StyleState; onStyle: (c: Col, patch: Partial<ColState>) => void;
}) {
  const cols: [Col, string][] = [["left", t.left], ["center", t.center], ["right", t.right]];
  return (
    <section aria-label={label}>
      <p className="text-[12px] font-semibold text-slate-300">{label}</p>
      <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cols.map(([k, name]) => (
          <div key={k} className="text-[12px] text-slate-400">
            <label className="block">
              {label} · {name}
              <input
                className={`${input} mt-1`}
                value={resolveText(slot[k], vars)}
                maxLength={120}
                onFocus={() => onFocus({ part, slot: k })}
                onChange={(e) => onChange({ ...slot, [k]: editRaw(slot[k], vars, e.target.value) })}
              />
            </label>
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                aria-label={`${label} ${name} ${t.size}`}
                title={t.size}
                className={`${inputSm} w-12 px-1.5 text-center`}
                inputMode="numeric"
                value={st.cols[k].size}
                onChange={(e) => onStyle(k, { size: e.target.value })}
              />
              <input
                aria-label={`${label} ${name} ${t.color}`}
                title={t.color}
                type="color"
                className="h-[34px] w-9 cursor-pointer rounded border border-white/15 bg-transparent"
                value={st.cols[k].color}
                onChange={(e) => onStyle(k, { color: e.target.value })}
              />
              <button
                type="button"
                aria-pressed={st.cols[k].bold}
                aria-label={`${label} ${name} ${t.boldShort}`}
                title={t.boldShort}
                onClick={() => onStyle(k, { bold: !st.cols[k].bold })}
                className={`h-[34px] w-8 rounded-lg border text-[14px] font-extrabold transition ${st.cols[k].bold ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-100" : "border-white/15 bg-white/[0.04] text-slate-300 hover:bg-white/[0.09]"}`}
              >
                B
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StyleCard({ title, st, onChange, edgeLabel, ruleLabel, t }: {
  title: string; st: StyleState; onChange: (s: StyleState) => void; edgeLabel: string; ruleLabel: string; t: TT;
}) {
  const set = <K extends keyof StyleState>(k: K, v: StyleState[K]) => onChange({ ...st, [k]: v });
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[13px] font-semibold text-slate-100">{title}</p>

      <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px] text-slate-400">
        <label>{edgeLabel}<input className={`${input} mt-1`} inputMode="decimal" value={st.edge} onChange={(e) => set("edge", e.target.value)} /></label>
        <label>{t.side}<input className={`${input} mt-1`} inputMode="decimal" value={st.side} onChange={(e) => set("side", e.target.value)} /></label>
      </div>

      <label className="mt-3 flex items-center gap-1.5 text-[13px] text-slate-200">
        <input type="checkbox" checked={st.rule} onChange={(e) => set("rule", e.target.checked)} />{ruleLabel}
      </label>
      {st.rule && (
        <div className="mt-2 flex flex-wrap items-end gap-3 text-[12px] text-slate-400">
          <label>{t.ruleColor}<input type="color" className="mt-1 block h-[34px] w-14 cursor-pointer rounded border border-white/15 bg-transparent" value={st.ruleColor} onChange={(e) => set("ruleColor", e.target.value)} /></label>
          <label>{t.ruleWidth}<input className={`${inputSm} mt-1 w-20`} inputMode="decimal" value={st.ruleWidth} onChange={(e) => set("ruleWidth", e.target.value)} /></label>
        </div>
      )}
    </div>
  );
}

export function PdfHeaderFooterTool({ language }: { language: Language }) {
  const t = T[language === "tr" ? "tr" : "en"];
  const tr = language === "tr";
  const { describesTool } = useToolPageContext();

  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("all");
  const [allText, setAllText] = useState<TextPair>({ header: EMPTY_SLOT, footer: PRESETS[0]!.footer });
  const [pageTexts, setPageTexts] = useState<Record<number, TextPair>>({});
  const [headerStyle, setHeaderStyle] = useState<StyleState>(defaultStyle);
  const [footerStyle, setFooterStyle] = useState<StyleState>(defaultStyle);
  const [skipFirst, setSkipFirst] = useState(false);
  const [startNumber, setStartNumber] = useState("1");
  const [focus, setFocus] = useState<FocusRef>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; stamped: number; shrunk: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  const [notStamped, setNotStamped] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [grabbing, setGrabbing] = useState(false);
  const seq = useRef(0);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  // Sayfa geçişini hızlandırmak için: kaynak belge bir kez ayrıştırılır, aynı ayar+sayfa önizlemesi önbellekten gelir.
  const srcDoc = useRef<Promise<import("pdf-lib").PDFDocument> | null>(null);
  const previewCache = useRef(new Map<string, { url: string; notStamped: boolean }>());
  const lastSettingsKey = useRef("");

  const cur: TextPair = mode === "all" ? allText : (pageTexts[previewPage] ?? EMPTY_PAIR);
  const setCur = (patch: Partial<TextPair>) => {
    if (mode === "all") setAllText((p) => ({ ...p, ...patch }));
    else setPageTexts((p) => ({ ...p, [previewPage]: { ...(p[previewPage] ?? EMPTY_PAIR), ...patch } }));
  };
  const hasText = mode === "all" ? pairHasText(allText) : Object.values(pageTexts).some(pairHasText);

  const toRules = (): HeaderFooterRule[] =>
    mode === "all"
      ? [{ header: allText.header, footer: allText.footer, pages: "all" }]
      : Object.entries(pageTexts)
          .filter(([, v]) => pairHasText(v))
          .map(([i, v]) => ({ header: v.header, footer: v.footer, pages: "range" as PageScope, from: Number(i) + 1, to: Number(i) + 1 }));

  const buildOptions = (): HeaderFooterOptions => ({
    rules: toRules(),
    headerStyle: toPartStyle(headerStyle),
    footerStyle: toPartStyle(footerStyle),
    skipFirst: mode === "all" ? skipFirst : false,
    startNumber: mode === "all" && Number.isFinite(parseInt(startNumber, 10)) ? parseInt(startNumber, 10) : 1,
    fileName,
  });

  const load = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    if (f.size > MAX_BYTES) return setError(t.tooBig);
    setReading(true);
    try {
      const b = new Uint8Array(await f.arrayBuffer());
      const th = await renderPdfPage(b, 0, PREVIEW_PX);
      srcDoc.current = null;
      previewCache.current.clear();
      setBytes(b);
      setFileName(f.name);
      setPageCount(th.pageCount);
      setPreviewUrl(th.dataUrl);
      setPreviewPage(0);
      setPageInput("1");
      setZoom(1);
    } catch (e) {
      setError(e instanceof PdfThumbError && e.kind === "encrypted" ? t.encrypted : t.broken);
    } finally {
      setReading(false);
    }
  };

  const goPage = (p: number) => {
    const n = Math.min(Math.max(0, p), Math.max(0, pageCount - 1));
    setPreviewPage(n);
    setPageInput(String(n + 1));
  };

  // Ayarlar ya da sayfa değişince seçili sayfanın önizlemesini yeniler (aynı ayar+sayfa önbellekten gelir).
  const settingsKey = JSON.stringify([mode, allText, pageTexts, headerStyle, footerStyle, skipFirst, startNumber]);
  const optionsKey = `${settingsKey}|${previewPage}`;
  useEffect(() => {
    if (!bytes) return;
    const my = ++seq.current;
    const cached = previewCache.current.get(optionsKey);
    const build = async (index: number) => {
      // Önizleme yalnız seçili sayfa: büyük belgede tamamını işlememek için o sayfa ayrı belgeye alınır.
      srcDoc.current ??= import("pdf-lib").then(({ PDFDocument }) => PDFDocument.load(bytes));
      const single = await singlePage(await srcDoc.current, index);
      let out = single;
      let stamped = 0;
      if (hasText) {
        const r = await addHeaderFooter(single, { ...buildOptions(), asPageIndex: index, totalPages: pageCount });
        out = r.bytes;
        stamped = r.stamped;
      }
      const th = await renderPdfPage(out, 0, PREVIEW_PX);
      const entry = { url: th.dataUrl, notStamped: hasText && stamped === 0 };
      if (previewCache.current.size > 24) previewCache.current.delete(previewCache.current.keys().next().value as string);
      previewCache.current.set(`${settingsKey}|${index}`, entry);
      return entry;
    };
    const prefetchNext = async () => {
      // Boşta kalınca sıradaki sayfayı da hazırla: "Sonraki"ye basınca anında gelsin.
      const nextIdx = previewPage + 1;
      if (my === seq.current && nextIdx < pageCount && !previewCache.current.has(`${settingsKey}|${nextIdx}`)) {
        try { await build(nextIdx); } catch { /* önemsiz */ }
      }
    };
    if (cached) {
      setPreviewUrl(cached.url);
      setNotStamped(cached.notStamped);
      setPreviewing(false);
      lastSettingsKey.current = settingsKey;
      const idle = setTimeout(() => void prefetchNext(), 150);
      return () => clearTimeout(idle);
    }
    // Yalnız sayfa değiştiyse bekleme yok; metin yazılırken kısa bekleme (her tuşta yeniden çizmesin).
    const wait = lastSettingsKey.current === settingsKey ? 0 : 450;
    lastSettingsKey.current = settingsKey;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const e = await build(previewPage);
        if (my === seq.current) {
          setPreviewUrl(e.url);
          setNotStamped(e.notStamped);
          setPreviewing(false);
        }
        await prefetchNext();
      } catch {
        /* önizleme hatası işlemi engellemez */
      } finally {
        if (my === seq.current) setPreviewing(false);
      }
    }, wait);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bytes, optionsKey]);

  const run = async () => {
    if (!bytes || !hasText) return;
    setError(null);
    setBusy(true);
    try {
      const r = await addHeaderFooter(bytes, buildOptions());
      if (!r.stamped) {
        setError(t.noPages);
        return;
      }
      setResult({ blob: new Blob([r.bytes as unknown as BlobPart], { type: "application/pdf" }), stamped: r.stamped, shrunk: r.shrunk });
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    setResult(null);
    setBytes(null);
    setPreviewUrl(null);
    setError(null);
    setMode("all");
    setAllText({ header: EMPTY_SLOT, footer: PRESETS[0]!.footer });
    setPageTexts({});
    setHeaderStyle(defaultStyle());
    setFooterStyle(defaultStyle());
    setSkipFirst(false);
    setStartNumber("1");
    setPreviewPage(0);
    setPageInput("1");
    setFocus(null);
    setZoom(1);
  };

  /** Düğmeye basılınca ilgili kutuya O ANKİ değer yazılır (sayfa kipinde sayfa numarası dahil). */
  const insertText = (text: string) => {
    const target: NonNullable<FocusRef> = focus ?? { part: "footer", slot: "center" };
    const slot = cur[target.part];
    setCur({ [target.part]: { ...slot, [target.slot]: text.slice(0, 120) } }); // otomatik düğme: kutunun içeriğinin ÜZERİNE yazar
  };
  const pageNo = previewPage + 1;
  const stripped = fileName.replace(/\.pdf$/i, "");
  const startN = Number.isFinite(parseInt(startNumber, 10)) ? parseInt(startNumber, 10) : 1;
  const vars: Vars = {
    page: mode === "all" ? startN + previewPage - (skipFirst ? 1 : 0) : pageNo,
    total: pageCount,
    date: formatDateTr(new Date()),
    file: stripped,
  };
  const setCols = (setter: React.Dispatch<React.SetStateAction<StyleState>>) => (c: Col, patch: Partial<ColState>) =>
    setter((p) => ({ ...p, cols: { ...p.cols, [c]: { ...p.cols[c], ...patch } } }));
  // «Tüm sayfalar» kipinde sayfa numarası her sayfada değişmeli → kod yazılır, kutuda ‹Sayfa no› görünür.
  const pageVal = mode === "all" ? "{sayfa}" : String(pageNo);
  const chips = [
    { id: "page", name: t.chips.page, Icon: Hash, ins: pageVal },
    { id: "total", name: t.chips.total, Icon: Sigma, ins: String(pageCount) },
    { id: "both", name: t.chips.both, Icon: Slash, ins: `${pageVal} / ${pageCount}` },
    { id: "date", name: t.chips.date, Icon: CalendarDays, ins: formatDateTr(new Date()) },
    { id: "file", name: t.chips.file, Icon: FileText, ins: stripped },
  ];

  const zoomRef = useRef(1);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  // Alt + fare tekerleği: imlecin altındaki nokta sabit kalacak şekilde yakınlaştır / uzaklaştır.
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.altKey) return;
      e.preventDefault();
      const z1 = zoomRef.current;
      const z2 = Math.min(3, Math.max(1, Math.round((z1 + (e.deltaY < 0 ? 0.25 : -0.25)) * 100) / 100));
      if (z2 === z1) return;
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const sl = el.scrollLeft;
      const st = el.scrollTop;
      setZoom(z2);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.scrollLeft = (sl + mx) * (z2 / z1) - mx;
        el.scrollTop = (st + my) * (z2 / z1) - my;
      }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bytes, result]);
  const changeZoom = (z: number) => setZoom(Math.min(3, Math.max(1, Math.round(z * 100) / 100)));
  const onPanDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = viewRef.current;
    if (!el || zoom <= 1 || e.pointerType !== "mouse" || e.button !== 0) return;
    pan.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    el.setPointerCapture(e.pointerId);
    setGrabbing(true);
  };
  const onPanMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = viewRef.current;
    const p = pan.current;
    if (!el || !p) return;
    el.scrollLeft = p.sl - (e.clientX - p.x);
    el.scrollTop = p.st - (e.clientY - p.y);
  };
  const onPanUp = () => {
    pan.current = null;
    setGrabbing(false);
  };

  if (result) {
    return (
      <ToolResultPanel
        ratingToolSlug="pdf-ust-alt-bilgi"
        blob={result.blob}
        filename={headerFooterOutputName(fileName)}
        language={language}
        processedOnDevice
        subtitle={t.done(result.stamped)}
        onClose={resetAll}
        extraActions={
          <button type="button" onClick={() => setResult(null)} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-5 py-3 text-sm font-bold text-cyan-100 transition duration-200 hover:scale-[1.04] hover:bg-cyan-500/20">
            <Pencil className="h-4 w-4" />{t.back}
          </button>
        }
      >
        {result.shrunk > 0 && <p className="mt-4 text-[12px] text-amber-300">{t.shrunk}</p>}
        <ValueMomentNudge language={language} source="header_footer_success" />
      </ToolResultPanel>
    );
  }

  if (!bytes) {
    return (
      <div className="w-full">
        <div className="tool-form">
          <WorkspaceUploadField
            toolId="pdf-ust-alt-bilgi"
            language={language}
            accept="application/pdf,.pdf"
            note={t.hint}
            hideHeader={describesTool}
            onFiles={(files) => void load(files[0])}
          />
        </div>
        {reading && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-slate-300" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> {t.reading}
          </p>
        )}
        {error && <p className="mt-3 text-[13px] text-rose-300" role="alert">{error}</p>}
      </div>
    );
  }

  const iconBtn = "rounded-lg border border-white/15 bg-white/[0.04] p-1.5 text-slate-200 hover:bg-white/[0.09] disabled:opacity-30";

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-slate-100">{fileName}</span>
        <span className="text-[12px] text-slate-400">{pageCount} {tr ? "sayfa" : "pages"}</span>
        <button type="button" className="text-[13px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline" onClick={resetAll}>
          {t.change}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* ── Büyük önizleme (solda) ── */}
        <aside aria-label={t.preview} className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className={`${heading} mr-auto`}>{t.preview} <span className="ml-1 text-[11px] font-normal normal-case tracking-normal text-slate-500">· {t.altWheel}</span></p>
            <div className="flex items-center gap-1">
              <button type="button" aria-label={t.prev} title={t.prev} disabled={previewPage <= 0} onClick={() => goPage(previewPage - 1)} className={iconBtn}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" aria-label={t.next} title={t.next} disabled={previewPage >= pageCount - 1} onClick={() => goPage(previewPage + 1)} className={iconBtn}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-1.5 py-1">
              <button type="button" disabled={zoom <= 1} onClick={() => changeZoom(zoom - 0.25)} title={t.zoomOut} aria-label={t.zoomOut} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-30">
                <ZoomOut className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => changeZoom(1)} title={t.zoomFit} className="min-w-[3rem] rounded-lg px-1.5 py-1 text-center text-[12px] font-semibold tabular-nums text-slate-200 hover:bg-white/10">
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" disabled={zoom >= 3} onClick={() => changeZoom(zoom + 0.25)} title={t.zoomIn} aria-label={t.zoomIn} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-30">
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
            <label className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-slate-300">
              {t.page}
              <input
                className={`${inputSm} w-14 text-center`}
                inputMode="numeric"
                value={pageInput}
                aria-label={t.page}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={() => goPage((parseInt(pageInput, 10) || 1) - 1)}
                onKeyDown={(e) => { if (e.key === "Enter") goPage((parseInt(pageInput, 10) || 1) - 1); }}
              />
              / {pageCount}
            </label>
          </div>

          <div
            ref={viewRef}
            onPointerDown={onPanDown}
            onPointerMove={onPanMove}
            onPointerUp={onPanUp}
            onPointerCancel={onPanUp}
            className={`relative overflow-auto rounded-lg border border-white/10 bg-white ${zoom > 1 ? `max-h-[78vh] ${grabbing ? "cursor-grabbing" : "cursor-grab"}` : ""}`}
          >
            {previewUrl && (
              <img
                src={previewUrl}
                alt={t.preview}
                draggable={false}
                style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
                className="block select-none"
              />
            )}
            {previewing && (
              <div className="pointer-events-none sticky bottom-0 left-0 flex h-0 items-center justify-center" role="status" aria-label={t.previewing}>
                <Loader2 className="absolute -top-8 h-6 w-6 animate-spin text-slate-500" />
              </div>
            )}
          </div>
                    {notStamped && <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[12px] text-amber-200">{t.notStamped}</p>}
        </aside>

        {/* ── Düzenleme (sağda) ── */}
        <div className="space-y-5">
          <section aria-label={t.modeTitle} className="space-y-2">
            <p className={heading}>{t.modeTitle}</p>
            <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
              {([["all", t.modeAll], ["page", t.modePage]] as [Mode, string][]).map(([m, name]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition ${mode === m ? "bg-cyan-500/20 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.45)]" : "text-slate-300 hover:bg-white/[0.07]"}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-slate-500">{mode === "all" ? t.modeAllHelp : t.modePageHelp}</p>
          </section>

          <section aria-label={t.presets}>
            <p className={heading}>{t.presets}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const on = samePair(cur, p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCur({ header: p.header, footer: p.footer })}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${on ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_3px_rgba(34,211,238,0.10)]" : "border-white/12 bg-white/[0.04] text-slate-200 hover:border-white/25 hover:bg-white/[0.09]"}`}
                  >
                    {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                    {tr ? p.tr : p.en}
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-label={mode === "all" ? t.editingAll : t.editingPage(pageNo)} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-bold text-cyan-200">{mode === "all" ? t.editingAll : t.editingPage(pageNo)}</p>
              {mode === "page" && pairHasText(cur) && (
                <button
                  type="button"
                  onClick={() => setPageTexts((p) => { const n = { ...p }; delete n[previewPage]; return n; })}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[12px] font-semibold text-rose-200 transition hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />{t.clear}
                </button>
              )}
            </div>
            <SlotRow label={t.header} slot={cur.header} onChange={(sl) => setCur({ header: sl })} t={t} part="header" onFocus={setFocus} vars={vars} st={headerStyle} onStyle={setCols(setHeaderStyle)} />
            <SlotRow label={t.footer} slot={cur.footer} onChange={(sl) => setCur({ footer: sl })} t={t} part="footer" onFocus={setFocus} vars={vars} st={footerStyle} onStyle={setCols(setFooterStyle)} />

            <div className="border-t border-white/10 pt-2.5">
              <p className="text-[12px] font-semibold text-slate-300">{t.insertTitle}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertText(c.ins)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-gradient-to-b from-white/[0.09] to-white/[0.03] px-3.5 py-2 text-[13px] font-bold text-slate-100 shadow-[0_2px_0_rgba(0,0,0,0.35)] transition hover:border-cyan-400/50 hover:from-cyan-400/20 hover:to-cyan-400/[0.06] active:translate-y-px active:shadow-none"
                  >
                    <c.Icon className="h-4 w-4 text-cyan-300" aria-hidden />
                    {c.name}
                  </button>
                ))}
              </div>
              {mode === "all" && <p className="mt-1.5 text-[11.5px] text-slate-500">{t.insertPageAuto}</p>}
            </div>
          </section>

          <section aria-label={t.appearance} className="space-y-3">
            <p className={heading}>{t.appearance}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <StyleCard title={t.headerLook} st={headerStyle} onChange={setHeaderStyle} edgeLabel={t.edgeTop} ruleLabel={t.ruleHeader} t={t} />
              <StyleCard title={t.footerLook} st={footerStyle} onChange={setFooterStyle} edgeLabel={t.edgeBottom} ruleLabel={t.ruleFooter} t={t} />
            </div>
          </section>

          {mode === "all" && (
            <section aria-label={t.numbering} className="space-y-2">
              <p className={heading}>{t.numbering}</p>
              <div className="flex flex-wrap items-end gap-4 text-[12px] text-slate-400">
                <label>{t.start}<input className={`${inputSm} mt-1 w-24`} inputMode="numeric" value={startNumber} onChange={(e) => setStartNumber(e.target.value)} /></label>
                <label className="flex items-center gap-1.5 pb-1.5 text-[13px] text-slate-200"><input type="checkbox" checked={skipFirst} onChange={(e) => setSkipFirst(e.target.checked)} />{t.skipFirst}</label>
              </div>
            </section>
          )}

          <p className="rounded-xl border border-sky-400/20 bg-sky-400/[0.05] px-3.5 py-2.5 text-[12px] leading-relaxed text-sky-100/90">{t.note}</p>
          {!hasText && <p className="text-[12px] text-amber-300">{t.emptyWarn}</p>}
          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300" role="alert">{error}</p>}

          <button
            type="button"
            onClick={() => void run()}
            disabled={busy || !hasText}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.7)] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
          >
            {busy ? (<><Loader2 className="h-5 w-5 animate-spin" />{t.working}</>) : (<>{t.add} →</>)}
          </button>
          <p className="text-[12px] text-slate-500">{t.privacy}</p>
        </div>
      </div>
    </div>
  );
}

/** Önizleme için yalnız seçili sayfayı içeren küçük bir PDF üretir (büyük belgede hızlı kalır). */
async function singlePage(doc: import("pdf-lib").PDFDocument, index: number): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const [p] = await out.copyPages(doc, [Math.min(index, doc.getPageCount() - 1)]);
  out.addPage(p!);
  return out.save();
}
