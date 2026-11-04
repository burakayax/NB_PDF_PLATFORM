/**
 * PDF'E ÜST BİLGİ / ALT BİLGİ EKLE — her sayfanın üstüne/altına sol·orta·sağ metin ve sayfa numarası.
 *
 * Her şey cihazda yapılır (pdf-lib + pdf.js); dosya sunucuya gitmez. Orijinal içerik değişmez.
 *
 *  • Bölümler: farklı sayfalara farklı metin (tüm / tek / çift sayfalar ya da sayfa aralığı).
 *    Bir sayfa birden çok bölüme uyarsa en alttaki bölüm geçerli olur.
 *  • Üst bilgi ve alt bilginin görünümü (boyut, kalınlık, renk, kenar ve yan boşluk) ayrı ayrı ayarlanır.
 *  • Önizleme büyüktür, istenen sayfaya geçilebilir ve tam ekrana büyütülebilir.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { PdfThumbError, renderPdfPage } from "../../lib/pdfThumbs";
import {
  EMPTY_SLOT, addHeaderFooter, headerFooterOutputName, slotHasText,
  type HeaderFooterOptions, type HeaderFooterRule, type PageScope, type PartStyle, type Slot3,
} from "../../lib/pdfHeaderFooter";

const MAX_BYTES = 50 * 1024 * 1024;

type Preset = { id: string; tr: string; en: string; header: Slot3; footer: Slot3 };
const PRESETS: Preset[] = [
  { id: "num", tr: "Sayfa numarası", en: "Page number", header: EMPTY_SLOT, footer: { left: "", center: "{sayfa} / {toplam}", right: "" } },
  { id: "name", tr: "Dosya adı + numara", en: "File name + number", header: { left: "{dosya}", center: "", right: "" }, footer: { left: "", center: "", right: "Sayfa {sayfa} / {toplam}" } },
  { id: "date", tr: "Tarih + numara", en: "Date + number", header: { left: "", center: "", right: "{tarih}" }, footer: { left: "", center: "", right: "{sayfa}" } },
  { id: "conf", tr: "Gizlilik notu", en: "Confidentiality note", header: { left: "", center: "GİZLİDİR", right: "" }, footer: { left: "{dosya}", center: "", right: "{sayfa} / {toplam}" } },
];

const T = {
  tr: {
    hint: "PDF'i seç — üst ve alt bilgiyi sonraki adımda yazarsın.",
    reading: "Belge okunuyor…",
    encrypted: "Bu dosya şifreli. Lütfen şifresini kaldırıp tekrar yükleyin.",
    broken: "Dosya okunamadı. Bozuk olabilir; başka bir PDF dene.",
    tooBig: "Dosya 50 MB'dan büyük. Önce sıkıştırıp tekrar dene.",
    presets: "Hazır düzen",
    presetsHelp: "İlk bölümün metinlerini hazır bir düzenle doldurur.",
    sections: "Bölümler",
    sectionsHelp: "Her bölüm, seçtiğin sayfalara kendi üst ve alt bilgisini yazar. Farklı sayfalara farklı metin için bölüm ekle.",
    section: "Bölüm",
    scopeLabel: "Hangi sayfalara?",
    scope: { all: "Tüm sayfalar", odd: "Tek sayfalar (1, 3, 5…)", even: "Çift sayfalar (2, 4, 6…)", range: "Sayfa aralığı" } as Record<PageScope, string>,
    from: "İlk sayfa", to: "Son sayfa",
    addSection: "Farklı sayfalara başka metin ekle",
    removeSection: "Bölümü sil",
    overlapNote: "Bir sayfa birden çok bölüme giriyorsa en alttaki bölüm geçerli olur. Bir bölümü boş bırakırsan o sayfalara hiçbir şey yazılmaz.",
    header: "Üst bilgi",
    footer: "Alt bilgi",
    left: "Sol", center: "Orta", right: "Sağ",
    tokensTitle: "Yer tutucular — metne tıklayıp ekle",
    tokensHelp: "Bunlar her sayfada kendiliğinden değişen bilgilerdir. Önce yazacağın kutuya tıkla, sonra aşağıdan birini seç.",
    tokens: [
      { k: "{sayfa}", name: "Sayfa numarası", ex: "3. sayfada «3»" },
      { k: "{toplam}", name: "Toplam sayfa sayısı", ex: "12 sayfalık belgede «12»" },
      { k: "{tarih}", name: "Bugünün tarihi", ex: "04.11.2026" },
      { k: "{dosya}", name: "Dosya adı", ex: "sozlesme" },
    ],
    tokensExample: "Örnek: «Sayfa {sayfa} / {toplam}» yazarsan 3. sayfada «Sayfa 3 / 12» çıkar.",
    appearance: "Görünüm",
    headerLook: "Üst bilgi görünümü",
    footerLook: "Alt bilgi görünümü",
    size: "Yazı boyutu (pt)", color: "Renk", bold: "Kalın yaz", rule: "Altına/üstüne ince çizgi çiz",
    edgeTop: "Sayfanın üstünden (mm)", edgeBottom: "Sayfanın altından (mm)", side: "Soldan ve sağdan (mm)",
    numbering: "Numaralandırma",
    skipFirst: "İlk sayfaya (kapak) yazma", start: "Numara şuradan başlasın",
    preview: "Önizleme", previewing: "Önizleme hazırlanıyor…",
    page: "Sayfa", prev: "Önceki sayfa", next: "Sonraki sayfa", zoom: "Büyüt", closeZoom: "Kapat",
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
    presetsHelp: "Fills the texts of the first section with a ready-made layout.",
    sections: "Sections",
    sectionsHelp: "Each section writes its own header and footer on the pages you choose. Add a section to put different text on different pages.",
    section: "Section",
    scopeLabel: "Which pages?",
    scope: { all: "All pages", odd: "Odd pages (1, 3, 5…)", even: "Even pages (2, 4, 6…)", range: "Page range" } as Record<PageScope, string>,
    from: "First page", to: "Last page",
    addSection: "Add different text for other pages",
    removeSection: "Remove section",
    overlapNote: "If a page falls into more than one section, the last section wins. A section left empty writes nothing on its pages.",
    header: "Header",
    footer: "Footer",
    left: "Left", center: "Center", right: "Right",
    tokensTitle: "Placeholders — click to insert",
    tokensHelp: "These are details that change by themselves on every page. Click the box you want to write in first, then pick one below.",
    tokens: [
      { k: "{page}", name: "Page number", ex: "“3” on page 3" },
      { k: "{total}", name: "Total number of pages", ex: "“12” in a 12-page file" },
      { k: "{date}", name: "Today's date", ex: "04.11.2026" },
      { k: "{file}", name: "File name", ex: "contract" },
    ],
    tokensExample: "Example: write “Page {page} / {total}” and page 3 shows “Page 3 / 12”.",
    appearance: "Appearance",
    headerLook: "Header look",
    footerLook: "Footer look",
    size: "Font size (pt)", color: "Color", bold: "Bold", rule: "Draw a thin line",
    edgeTop: "From the top of the page (mm)", edgeBottom: "From the bottom of the page (mm)", side: "From left and right (mm)",
    numbering: "Numbering",
    skipFirst: "Skip the first page (cover)", start: "Start numbering at",
    preview: "Preview", previewing: "Preparing preview…",
    page: "Page", prev: "Previous page", next: "Next page", zoom: "Enlarge", closeZoom: "Close",
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
const input = "w-full rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[13px] text-slate-100 placeholder:text-slate-500";
const heading = "text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400";

type RuleState = { id: number; scope: PageScope; from: string; to: string; header: Slot3; footer: Slot3 };
type StyleState = { size: string; color: string; bold: boolean; edge: string; side: string; rule: boolean };
type FocusRef = { ruleId: number; part: "header" | "footer"; slot: keyof Slot3 } | null;

const DEFAULT_STYLE: StyleState = { size: "10", color: "#555555", bold: false, edge: "10", side: "10", rule: false };

let ruleSeq = 0;
const newRule = (over?: Partial<RuleState>): RuleState => ({
  id: ++ruleSeq, scope: "all", from: "", to: "", header: EMPTY_SLOT, footer: EMPTY_SLOT, ...over,
});

const num = (v: string, d: number) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d);
const toPartStyle = (s: StyleState): PartStyle => ({
  fontSize: num(s.size, 10), color: s.color, bold: s.bold, edgeMm: num(s.edge, 10), sideMm: num(s.side, 10), rule: s.rule,
});

function SlotRow({ label, slot, onChange, t, ruleId, part, onFocus }: {
  label: string; slot: Slot3; onChange: (s: Slot3) => void; t: TT; ruleId: number; part: "header" | "footer";
  onFocus: (f: FocusRef) => void;
}) {
  const cols: [keyof Slot3, string][] = [["left", t.left], ["center", t.center], ["right", t.right]];
  return (
    <section aria-label={label}>
      <p className="text-[12px] font-semibold text-slate-300">{label}</p>
      <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {cols.map(([k, name]) => (
          <label key={k} className="text-[12px] text-slate-400">
            {name}
            <input
              className={`${input} mt-1`}
              value={slot[k]}
              maxLength={120}
              onFocus={() => onFocus({ ruleId, part, slot: k })}
              onChange={(e) => onChange({ ...slot, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function StyleCard({ title, st, onChange, edgeLabel, t }: { title: string; st: StyleState; onChange: (s: StyleState) => void; edgeLabel: string; t: TT }) {
  const set = <K extends keyof StyleState>(k: K, v: StyleState[K]) => onChange({ ...st, [k]: v });
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[13px] font-semibold text-slate-100">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px] text-slate-400">
        <label>{t.size}<input className={`${input} mt-1`} inputMode="numeric" value={st.size} onChange={(e) => set("size", e.target.value)} /></label>
        <label>{t.color}<input type="color" className="mt-1 block h-[34px] w-full rounded border border-white/15 bg-transparent" value={st.color} onChange={(e) => set("color", e.target.value)} /></label>
        <label>{edgeLabel}<input className={`${input} mt-1`} inputMode="decimal" value={st.edge} onChange={(e) => set("edge", e.target.value)} /></label>
        <label>{t.side}<input className={`${input} mt-1`} inputMode="decimal" value={st.side} onChange={(e) => set("side", e.target.value)} /></label>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-slate-200">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={st.bold} onChange={(e) => set("bold", e.target.checked)} />{t.bold}</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={st.rule} onChange={(e) => set("rule", e.target.checked)} />{t.rule}</label>
      </div>
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

  const [rules, setRules] = useState<RuleState[]>(() => [newRule({ footer: PRESETS[0]!.footer })]);
  const [headerStyle, setHeaderStyle] = useState<StyleState>(DEFAULT_STYLE);
  const [footerStyle, setFooterStyle] = useState<StyleState>(DEFAULT_STYLE);
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
  const [zoom, setZoom] = useState(false);
  const seq = useRef(0);

  const hasText = rules.some((r) => slotHasText(r.header) || slotHasText(r.footer));

  const toRules = (): HeaderFooterRule[] =>
    rules.map((r) => ({
      header: r.header, footer: r.footer, pages: r.scope,
      from: parseInt(r.from, 10) || undefined, to: parseInt(r.to, 10) || undefined,
    }));

  const buildOptions = (): HeaderFooterOptions => ({
    rules: toRules(),
    headerStyle: toPartStyle(headerStyle),
    footerStyle: toPartStyle(footerStyle),
    skipFirst,
    startNumber: Number.isFinite(parseInt(startNumber, 10)) ? parseInt(startNumber, 10) : 1,
    fileName,
  });

  const load = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    if (f.size > MAX_BYTES) return setError(t.tooBig);
    setReading(true);
    try {
      const b = new Uint8Array(await f.arrayBuffer());
      const th = await renderPdfPage(b, 0, 1100);
      setBytes(b);
      setFileName(f.name);
      setPageCount(th.pageCount);
      setPreviewUrl(th.dataUrl);
      setPreviewPage(0);
      setPageInput("1");
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

  // Ayarlar ya da sayfa değişince seçili sayfanın önizlemesini (kısa bir beklemeyle) yeniler.
  const optionsKey = JSON.stringify([rules, headerStyle, footerStyle, skipFirst, startNumber, previewPage]);
  useEffect(() => {
    if (!bytes) return;
    const my = ++seq.current;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        // Önizleme yalnız seçili sayfa: büyük belgede tamamını işlememek için o sayfa ayrı belgeye alınır.
        const single = await singlePage(bytes, previewPage);
        let out = single;
        let stamped = 0;
        if (hasText) {
          const r = await addHeaderFooter(single, { ...buildOptions(), asPageIndex: previewPage, totalPages: pageCount });
          out = r.bytes;
          stamped = r.stamped;
        }
        const th = await renderPdfPage(out, 0, 1100);
        if (my === seq.current) {
          setPreviewUrl(th.dataUrl);
          setNotStamped(hasText && stamped === 0);
        }
      } catch {
        /* önizleme hatası işlemi engellemez */
      } finally {
        if (my === seq.current) setPreviewing(false);
      }
    }, 450);
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
    setRules([newRule({ footer: PRESETS[0]!.footer })]);
    setHeaderStyle(DEFAULT_STYLE);
    setFooterStyle(DEFAULT_STYLE);
    setSkipFirst(false);
    setStartNumber("1");
    setPreviewPage(0);
    setPageInput("1");
    setFocus(null);
  };

  const updateRule = (id: number, patch: Partial<RuleState>) => setRules((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const insertToken = (token: string) => {
    const target: NonNullable<FocusRef> = focus && rules.some((r) => r.id === focus.ruleId)
      ? focus
      : { ruleId: rules[0]!.id, part: "footer", slot: "center" };
    setRules((p) => p.map((r) => {
      if (r.id !== target.ruleId) return r;
      const slot = r[target.part];
      return { ...r, [target.part]: { ...slot, [target.slot]: (slot[target.slot] + token).slice(0, 120) } };
    }));
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

  const previewBox = (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-white">
      {previewUrl && <img src={previewUrl} alt={t.preview} className="block w-full" />}
      {previewing && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30" role="status" aria-label={t.previewing}>
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}
    </div>
  );

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
        {/* ── Büyük önizleme ── */}
        <aside aria-label={t.preview} className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className={`${heading} mr-auto`}>{t.preview}</p>
            <button type="button" aria-label={t.prev} disabled={previewPage <= 0} onClick={() => goPage(previewPage - 1)} className="rounded-lg border border-white/15 bg-white/[0.04] p-1.5 text-slate-200 hover:bg-white/[0.09] disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="flex items-center gap-1.5 text-[13px] text-slate-300">
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
            <button type="button" aria-label={t.next} disabled={previewPage >= pageCount - 1} onClick={() => goPage(previewPage + 1)} className="rounded-lg border border-white/15 bg-white/[0.04] p-1.5 text-slate-200 hover:bg-white/[0.09] disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setZoom(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.09]">
              <Maximize2 className="h-3.5 w-3.5" />{t.zoom}
            </button>
          </div>
          {previewBox}
          {notStamped && <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[12px] text-amber-200">{t.notStamped}</p>}
        </aside>

        {/* ── Ayarlar ── */}
        <div className="space-y-5">
          <section aria-label={t.presets}>
            <p className={heading}>{t.presets}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setRules((r) => r.map((x, i) => (i === 0 ? { ...x, header: p.header, footer: p.footer } : x)))}
                  className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.09]"
                >
                  {tr ? p.tr : p.en}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-slate-500">{t.presetsHelp}</p>
          </section>

          <section aria-label={t.sections} className="space-y-3">
            <div>
              <p className={heading}>{t.sections}</p>
              <p className="mt-1 text-[12px] text-slate-500">{t.sectionsHelp}</p>
            </div>
            {rules.map((r, idx) => (
              <div key={r.id} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <p className="text-[13px] font-bold text-cyan-200">{t.section} {idx + 1}</p>
                  <label className="text-[12px] text-slate-400">
                    {t.scopeLabel}
                    <select className={`${input} mt-1`} value={r.scope} onChange={(e) => updateRule(r.id, { scope: e.target.value as PageScope })}>
                      {(["all", "odd", "even", "range"] as PageScope[]).map((s) => <option key={s} value={s}>{t.scope[s]}</option>)}
                    </select>
                  </label>
                  {r.scope === "range" && (
                    <>
                      <label className="text-[12px] text-slate-400">{t.from}<input className={`${inputSm} mt-1 w-20`} inputMode="numeric" placeholder="1" value={r.from} onChange={(e) => updateRule(r.id, { from: e.target.value })} /></label>
                      <label className="text-[12px] text-slate-400">{t.to}<input className={`${inputSm} mt-1 w-20`} inputMode="numeric" placeholder={String(pageCount)} value={r.to} onChange={(e) => updateRule(r.id, { to: e.target.value })} /></label>
                    </>
                  )}
                  {rules.length > 1 && (
                    <button type="button" onClick={() => setRules((p) => p.filter((x) => x.id !== r.id))} aria-label={t.removeSection} title={t.removeSection} className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <SlotRow label={t.header} slot={r.header} onChange={(s) => updateRule(r.id, { header: s })} t={t} ruleId={r.id} part="header" onFocus={setFocus} />
                <SlotRow label={t.footer} slot={r.footer} onChange={(s) => updateRule(r.id, { footer: s })} t={t} ruleId={r.id} part="footer" onFocus={setFocus} />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRules((p) => [...p, newRule({ scope: "range" })])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-cyan-400/40 px-3 py-2 text-[13px] font-semibold text-cyan-200 hover:bg-cyan-400/10"
            >
              <Plus className="h-4 w-4" />{t.addSection}
            </button>
            {rules.length > 1 && <p className="text-[12px] text-slate-500">{t.overlapNote}</p>}
          </section>

          <section aria-label={t.tokensTitle} className="rounded-xl border border-sky-400/20 bg-sky-400/[0.04] p-3">
            <p className="text-[13px] font-semibold text-sky-100">{t.tokensTitle}</p>
            <p className="mt-1 text-[12px] text-slate-400">{t.tokensHelp}</p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {t.tokens.map((k) => (
                <li key={k.k}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertToken(k.k)}
                    className="flex w-full flex-col items-start rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.09]"
                  >
                    <span className="text-[13px] font-semibold text-slate-100"><code className="mr-1.5 rounded bg-black/30 px-1.5 py-0.5 text-cyan-200">{k.k}</code>{k.name}</span>
                    <span className="mt-0.5 text-[11.5px] text-slate-400">{k.ex}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-slate-300">{t.tokensExample}</p>
          </section>

          <section aria-label={t.appearance} className="space-y-3">
            <p className={heading}>{t.appearance}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <StyleCard title={t.headerLook} st={headerStyle} onChange={setHeaderStyle} edgeLabel={t.edgeTop} t={t} />
              <StyleCard title={t.footerLook} st={footerStyle} onChange={setFooterStyle} edgeLabel={t.edgeBottom} t={t} />
            </div>
          </section>

          <section aria-label={t.numbering} className="space-y-2">
            <p className={heading}>{t.numbering}</p>
            <div className="flex flex-wrap items-end gap-4 text-[12px] text-slate-400">
              <label>{t.start}<input className={`${inputSm} mt-1 w-24`} inputMode="numeric" value={startNumber} onChange={(e) => setStartNumber(e.target.value)} /></label>
              <label className="flex items-center gap-1.5 pb-1.5 text-[13px] text-slate-200"><input type="checkbox" checked={skipFirst} onChange={(e) => setSkipFirst(e.target.checked)} />{t.skipFirst}</label>
            </div>
          </section>

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

      {zoom &&
        createPortal(
          <div className="fixed inset-0 z-[11000] flex items-center justify-center p-2 sm:p-4" role="presentation">
            <button type="button" aria-label={t.closeZoom} className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onClick={() => setZoom(false)} />
            <div role="dialog" aria-modal="true" aria-label={t.preview} className="relative z-10 flex max-h-[96vh] max-w-[96vw] flex-col overflow-hidden rounded-xl border border-white/15 bg-slate-900">
              <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">{t.preview} · {t.page} {previewPage + 1} / {pageCount}</p>
                <button type="button" aria-label={t.prev} disabled={previewPage <= 0} onClick={() => goPage(previewPage - 1)} className="rounded-md border border-white/15 p-1.5 text-slate-200 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" aria-label={t.next} disabled={previewPage >= pageCount - 1} onClick={() => goPage(previewPage + 1)} className="rounded-md border border-white/15 p-1.5 text-slate-200 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                <button type="button" onClick={() => setZoom(false)} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/[0.12]"><X className="h-3.5 w-3.5" />{t.closeZoom}</button>
              </div>
              <div className="min-h-0 overflow-auto bg-slate-800 p-2">
                {previewUrl && <img src={previewUrl} alt={t.preview} className="mx-auto block max-h-[calc(96vh-4rem)] w-auto max-w-full bg-white" />}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Önizleme için yalnız seçili sayfayı içeren küçük bir PDF üretir (büyük belgede hızlı kalır). */
async function singlePage(src: Uint8Array, index: number): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(src);
  const out = await PDFDocument.create();
  const [p] = await out.copyPages(doc, [Math.min(index, doc.getPageCount() - 1)]);
  out.addPage(p!);
  return out.save();
}
