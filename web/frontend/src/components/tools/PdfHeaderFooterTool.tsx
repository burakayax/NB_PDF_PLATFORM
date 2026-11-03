/**
 * PDF'E ÜST BİLGİ / ALT BİLGİ EKLE — her sayfanın üstüne/altına sol·orta·sağ metin ve sayfa numarası.
 *
 * Her şey cihazda yapılır (pdf-lib + pdf.js); dosya sunucuya gitmez. Orijinal içerik değişmez.
 * Yer tutucular: {sayfa} {toplam} {tarih} {dosya}. Ayarlar değişince ilk sayfanın önizlemesi yenilenir.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { PdfThumbError, renderPdfPage } from "../../lib/pdfThumbs";
import {
  EMPTY_SLOT, addHeaderFooter, headerFooterOutputName, slotHasText, type HeaderFooterOptions, type Slot3,
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
    header: "Üst bilgi",
    footer: "Alt bilgi",
    left: "Sol", center: "Orta", right: "Sağ",
    tokens: "Yer tutucular: {sayfa} sayfa no · {toplam} toplam sayfa · {tarih} bugünün tarihi · {dosya} dosya adı",
    style: "Görünüm",
    size: "Boyut (pt)", color: "Renk", bold: "Kalın", margin: "Kenar boşluğu (mm)", rule: "İnce çizgi çiz",
    range: "Uygulanacak sayfalar", from: "İlk", to: "Son", skipFirst: "İlk sayfaya (kapak) yazma", start: "Numara şuradan başlasın",
    preview: "Önizleme (1. sayfa)", previewing: "Önizleme hazırlanıyor…",
    emptyWarn: "Üst ya da alt bilgiye en az bir metin yaz.",
    add: "Üst/alt bilgiyi ekle", working: "Ekleniyor…",
    failed: "İşlem tamamlanamadı. Dosya bozuk ya da korumalı olabilir.",
    privacy: "Dosyanız tarayıcınızda işlenir — sunucumuza yüklenmez.",
    shrunk: "Bazı metinler sığması için küçültüldü.",
    done: (n: number) => `${n} sayfaya eklendi.`,
    note: "Metin sayfanın üstüne yazılır; sayfada o noktada yazı varsa üst üste binebilir. Önizlemeden kontrol et, gerekirse kenar boşluğunu artır.",
    change: "Başka dosya seç",
  },
  en: {
    hint: "Choose a PDF — you'll write the header and footer in the next step.",
    reading: "Reading the document…",
    encrypted: "This file is encrypted. Please remove the password and try again.",
    broken: "The file could not be read. It may be corrupt; try another PDF.",
    tooBig: "The file is larger than 50 MB. Compress it first and try again.",
    presets: "Quick layouts",
    header: "Header",
    footer: "Footer",
    left: "Left", center: "Center", right: "Right",
    tokens: "Placeholders: {page} page number · {total} total pages · {date} today's date · {file} file name",
    style: "Appearance",
    size: "Size (pt)", color: "Color", bold: "Bold", margin: "Margin (mm)", rule: "Draw a thin line",
    range: "Pages to apply", from: "First", to: "Last", skipFirst: "Skip the first page (cover)", start: "Start numbering at",
    preview: "Preview (page 1)", previewing: "Preparing preview…",
    emptyWarn: "Write at least one text in the header or footer.",
    add: "Add header/footer", working: "Adding…",
    failed: "The operation failed. The file may be corrupt or protected.",
    privacy: "Your file is processed in your browser — never uploaded.",
    shrunk: "Some texts were shrunk to fit.",
    done: (n: number) => `Added to ${n} pages.`,
    note: "Text is drawn on top of the page; it can overlap existing content at that spot. Check the preview and increase the margin if needed.",
    change: "Choose another file",
  },
} as const;

const input = "w-full rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[13px] text-slate-100 placeholder:text-slate-500";

function SlotRow({ label, slot, onChange, t, idPrefix }: { label: string; slot: Slot3; onChange: (s: Slot3) => void; t: (typeof T)["tr"] | (typeof T)["en"]; idPrefix: string }) {
  const cols: [keyof Slot3, string][] = [["left", t.left], ["center", t.center], ["right", t.right]];
  return (
    <section aria-label={label}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {cols.map(([k, name]) => (
          <label key={k} className="text-[12px] text-slate-400">
            {name}
            <input
              id={`${idPrefix}-${k}`}
              className={`${input} mt-1`}
              value={slot[k]}
              maxLength={120}
              onChange={(e) => onChange({ ...slot, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </section>
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

  const [header, setHeader] = useState<Slot3>(EMPTY_SLOT);
  const [footer, setFooter] = useState<Slot3>(PRESETS[0]!.footer);
  const [fontSize, setFontSize] = useState("10");
  const [color, setColor] = useState("#555555");
  const [bold, setBold] = useState(false);
  const [marginMm, setMarginMm] = useState("10");
  const [rule, setRule] = useState(false);
  const [fromPage, setFromPage] = useState("");
  const [toPage, setToPage] = useState("");
  const [skipFirst, setSkipFirst] = useState(false);
  const [startNumber, setStartNumber] = useState("1");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; stamped: number; shrunk: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const seq = useRef(0);

  const hasText = slotHasText(header) || slotHasText(footer);

  const buildOptions = (): HeaderFooterOptions => ({
    header,
    footer,
    fontSize: Number(fontSize) || 10,
    color,
    bold,
    marginMm: Number(marginMm) || 10,
    rule,
    fromPage: Number(fromPage) || undefined,
    toPage: Number(toPage) || undefined,
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
      const th = await renderPdfPage(b, 0, 640);
      setBytes(b);
      setFileName(f.name);
      setPageCount(th.pageCount);
      setPreviewUrl(th.dataUrl);
    } catch (e) {
      setError(e instanceof PdfThumbError && e.kind === "encrypted" ? t.encrypted : t.broken);
    } finally {
      setReading(false);
    }
  };

  // Ayarlar değişince 1. sayfanın önizlemesini (kısa bir beklemeyle) yeniler.
  const optionsKey = JSON.stringify([header, footer, fontSize, color, bold, marginMm, rule, fromPage, toPage, skipFirst, startNumber]);
  useEffect(() => {
    if (!bytes) return;
    const my = ++seq.current;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        // Önizleme yalnız 1. sayfa: büyük belgede tamamını işlememek için ilk sayfa ayrı belgeye alınır.
        const opts = { ...buildOptions(), fromPage: undefined, toPage: undefined };
        const first = await firstPageOnly(bytes);
        const out = hasText ? (await addHeaderFooter(first, { ...opts, skipFirst: false, startNumber: Number.isFinite(parseInt(startNumber, 10)) ? parseInt(startNumber, 10) : 1, totalPages: pageCount })).bytes : first;
        const th = await renderPdfPage(out, 0, 640);
        if (my === seq.current) setPreviewUrl(th.dataUrl);
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
        setError(tr ? "Seçilen sayfa aralığında işlenecek sayfa yok." : "No pages in the chosen range.");
        return;
      }
      setResult({ blob: new Blob([r.bytes as unknown as BlobPart], { type: "application/pdf" }), stamped: r.stamped, shrunk: r.shrunk });
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
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
        onClose={() => setResult(null)}
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

  return (
    <div className="w-full">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-5">
          <section aria-label={t.presets}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t.presets}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setHeader(p.header); setFooter(p.footer); }}
                  className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.09]"
                >
                  {tr ? p.tr : p.en}
                </button>
              ))}
            </div>
          </section>

          <SlotRow label={t.header} slot={header} onChange={setHeader} t={t} idPrefix="hf-header" />
          <SlotRow label={t.footer} slot={footer} onChange={setFooter} t={t} idPrefix="hf-footer" />
          <p className="text-[12px] text-slate-400">{t.tokens}</p>

          <section aria-label={t.style} className="space-y-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t.style}</p>
            <div className="flex flex-wrap items-end gap-3 text-[12px] text-slate-400">
              <label>{t.size}<input className={`${input} mt-1 w-20`} inputMode="numeric" value={fontSize} onChange={(e) => setFontSize(e.target.value)} /></label>
              <label>{t.margin}<input className={`${input} mt-1 w-24`} inputMode="numeric" value={marginMm} onChange={(e) => setMarginMm(e.target.value)} /></label>
              <label>{t.color}<input type="color" className="mt-1 block h-8 w-14 rounded border border-white/15 bg-transparent" value={color} onChange={(e) => setColor(e.target.value)} /></label>
              <label className="flex items-center gap-1.5 pb-1.5 text-[13px] text-slate-200"><input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} />{t.bold}</label>
              <label className="flex items-center gap-1.5 pb-1.5 text-[13px] text-slate-200"><input type="checkbox" checked={rule} onChange={(e) => setRule(e.target.checked)} />{t.rule}</label>
            </div>
          </section>

          <section aria-label={t.range} className="space-y-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t.range} <span className="font-normal normal-case tracking-normal">({pageCount})</span></p>
            <div className="flex flex-wrap items-end gap-3 text-[12px] text-slate-400">
              <label>{t.from}<input className={`${input} mt-1 w-20`} inputMode="numeric" placeholder="1" value={fromPage} onChange={(e) => setFromPage(e.target.value)} /></label>
              <label>{t.to}<input className={`${input} mt-1 w-20`} inputMode="numeric" placeholder={String(pageCount)} value={toPage} onChange={(e) => setToPage(e.target.value)} /></label>
              <label>{t.start}<input className={`${input} mt-1 w-20`} inputMode="numeric" value={startNumber} onChange={(e) => setStartNumber(e.target.value)} /></label>
              <label className="flex items-center gap-1.5 pb-1.5 text-[13px] text-slate-200"><input type="checkbox" checked={skipFirst} onChange={(e) => setSkipFirst(e.target.checked)} />{t.skipFirst}</label>
            </div>
          </section>

          <p className="rounded-xl border border-sky-400/20 bg-sky-400/[0.05] px-3.5 py-2.5 text-[12px] leading-relaxed text-sky-100/90">{t.note}</p>
          {!hasText && <p className="text-[12px] text-amber-300">{t.emptyWarn}</p>}
          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300" role="alert">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="primary-action" onClick={() => void run()} disabled={busy || !hasText}>
              {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t.working}</span> : t.add}
            </button>
            <button type="button" className="text-[13px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline" onClick={() => { setBytes(null); setPreviewUrl(null); setError(null); }}>
              {t.change}
            </button>
          </div>
          <p className="text-[12px] text-slate-400">{t.privacy}</p>
        </div>

        <aside aria-label={t.preview} className="md:sticky md:top-4 md:self-start">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t.preview}</p>
          <div className="relative mt-2 overflow-hidden rounded-lg border border-white/10 bg-white">
            {previewUrl && <img src={previewUrl} alt={t.preview} className="block w-full" />}
            {previewing && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30" role="status" aria-label={t.previewing}>
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <p className="mt-1 truncate text-[12px] text-slate-400">{fileName}</p>
        </aside>
      </div>
    </div>
  );
}

/** Önizleme için yalnız ilk sayfayı içeren küçük bir PDF üretir (büyük belgede hızlı kalır). */
async function firstPageOnly(src: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(src);
  const out = await PDFDocument.create();
  const [p] = await out.copyPages(doc, [0]);
  out.addPage(p!);
  return out.save();
}
