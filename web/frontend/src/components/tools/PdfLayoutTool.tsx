/**
 * SAYFA DÜZENİ — birden çok sayfayı tek yaprağa sığdırır ya da kitapçık dizer.
 *
 * İki kip:
 *  - "Yaprağa sığdır": 2/4/6/8/9/16 sayfa tek kâğıda. Kâğıt ve mürekkep tasarrufu.
 *  - "Kitapçık": çift taraflı yazdırıp ortadan katlayınca sırayla okunan kitapçık.
 *
 * Akış (Döndür/Sil/Sırala ile aynı): PDF yüklenir → tam ekran düzen penceresi açılır
 * (ayarlar + ÇIKTININ canlı önizlemesi) → «PDF'i Hazırla» → sonuç paneli.
 *
 * Kitapçıkta sıralamayı kullanıcı düşünmez; yazdırma yönergesi ekranda yazılıdır
 * çünkü yanlış yazdırma ancak kâğıt katlandıktan sonra fark edilir.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, FileText, Grid2x2, Loader2, Sliders, Trash2, X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { nUpYap, kitapcikYap, izgara } from "../../lib/pdfImposition";
import { sayfaNumaralariniBulOnbellekli } from "../../lib/pdfPageNumberMask";
import { getPdfPageCount, PdfEncryptedError } from "../../lib/clientPdfWorker";
import { PdfPageVisualGrid } from "../split/PdfPageVisualGrid";
import PdfErrorBoundary from "../split/PdfErrorBoundary";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";

const METIN = {
  tr: {
    hint: "PDF'i seç — sayfaları tek kâğıda sığdır ya da kitapçık olarak diz.",
    dropTitle: "PDF'i buraya sürükle",
    failed: "Belge okunamadı. Dosya bozuk olabilir.",
    encrypted: "Bu PDF şifre korumalı. Şifreli dosyalar için giriş yapın.",
    applyFailed: "Sayfa düzeni uygulanamadı.",
    modeNup: "Yaprağa sığdır",
    modeBooklet: "Kitapçık",
    nupNote: "Birden çok sayfayı tek kâğıda yerleştirir; kâğıt ve mürekkepten tasarruf edersin.",
    bookletNote:
      "Sayfaları öyle dizer ki çift taraflı yazdırıp ortadan katladığında sırayla okunan bir kitapçık olur.",
    frame: "Her sayfanın çevresine ince çerçeve çiz",
    hideNums: "Sayfa numaralarını gizle, yaprağa tek numara koy",
    hideNumsNote: "Belgenin kendi sayfa altı numaralarını bulup kapatır. Yalnız metin tabanlı PDF'lerde çalışır; taranmış (resim) PDF'lerde numaralar kalır.",
    printHint: "Yazdırırken: çift taraflı, «kısa kenardan çevir» seçeneğiyle bas; sonra ortadan katla.",
    pageCount: "sayfa",
    working: "Uygulanıyor…",
    modalTitle: "Sayfa düzeni",
    close: "Kapat",
    step1: "1 · Ne yapmak istiyorsun?",
    step2: "2 · Bir yaprağa kaç sayfa sığsın?",
    previewTitle: "Çıktı önizlemesi — PDF'in böyle görünecek",
    previewBusy: "Önizleme hazırlanıyor…",
    prepare: "PDF'i Hazırla",
    editLayout: "Düzeni Değiştir",
    chooseLayout: "Sayfa Düzenini Seç",
    layoutLabel: "Seçili düzen",
    bookletShort: "Kitapçık",
    remove: "Kaldır",
    zoom: "Yakınlaştır",
    gridHintNup: "Çıktının yaprakları. Her kart bir kâğıttır; içindeki küçük sayfalar sırayla dizilir.",
    gridHintBooklet:
      "Her kart bir kâğıdın bir YÜZÜDÜR (sol ve sağ yarı). Çift taraflı basınca kartlar sırayla ön/arka yüz olur; kâğıtları üst üste koyup ortadan katla.",
    sheetLine: (i: number, on: number, arka: number) => `${i}. kâğıt: ön yüz = kart ${on}, arka yüz = kart ${arka}`,
    blankNote: (b: number) =>
      `Sayfa sayısı 4'ün katı olmadığı için ${b} boş yer kaldı. Bunlar kapak içi ve arka kapak olarak boş bırakılır; sayfa sırası bozulmaz.`,
    nupShort: (adet: number) => `Yaprağa ${adet} sayfa`,
    summaryNup: (n: number, adet: number, y: number) =>
      `${n} sayfa → her yaprakta ${adet} sayfa → ${y} yaprak`,
    summaryBooklet: (n: number, y: number) =>
      `${n} sayfa → ${y} yaprak (çift taraflı) · ortadan katlanır`,
  },
  en: {
    hint: "Pick a PDF — fit several pages on one sheet or impose it as a booklet.",
    dropTitle: "Drag your PDF here",
    failed: "Could not read the document. The file may be corrupt.",
    encrypted: "This PDF is password-protected. Log in to process it.",
    applyFailed: "Could not apply the layout.",
    modeNup: "Fit on sheet",
    modeBooklet: "Booklet",
    nupNote: "Places several pages on a single sheet, saving paper and ink.",
    bookletNote:
      "Orders the pages so that printing double-sided and folding in the middle gives a booklet that reads in order.",
    frame: "Draw a thin frame around each page",
    hideNums: "Hide page numbers, add one number per sheet",
    hideNumsNote: "Finds and covers the document's own page numbers. Works only on text-based PDFs; numbers on scanned (image) PDFs stay.",
    printHint: "When printing: use double-sided, «flip on short edge», then fold in the middle.",
    pageCount: "pages",
    working: "Applying…",
    modalTitle: "Page layout",
    close: "Close",
    step1: "1 · What do you want to do?",
    step2: "2 · How many pages per sheet?",
    previewTitle: "Output preview — this is how your PDF will look",
    previewBusy: "Preparing preview…",
    prepare: "Prepare PDF",
    editLayout: "Change layout",
    chooseLayout: "Choose page layout",
    layoutLabel: "Selected layout",
    bookletShort: "Booklet",
    remove: "Remove",
    zoom: "Zoom",
    gridHintNup: "The output sheets. Each card is one sheet; the small pages on it are laid out in order.",
    gridHintBooklet:
      "Each card is one SIDE of a sheet (left and right half). Printed double-sided, the cards become front/back in order; stack the sheets and fold in the middle.",
    sheetLine: (i: number, on: number, arka: number) => `Sheet ${i}: front = card ${on}, back = card ${arka}`,
    blankNote: (b: number) =>
      `The page count is not a multiple of 4, so ${b} slot(s) stay blank (inside covers / back cover). Page order is unaffected.`,
    nupShort: (adet: number) => `${adet} pages per sheet`,
    summaryNup: (n: number, adet: number, y: number) =>
      `${n} pages → ${adet} per sheet → ${y} sheets`,
    summaryBooklet: (n: number, y: number) =>
      `${n} pages → ${y} sheets (double-sided) · folded in the middle`,
  },
} as const;

type Kip = "nup" | "kitapcik";
type Sonuc = { blob: Blob; filename: string };

const ZOOM_LEVELS = [25, 50, 75, 100] as const;
/** Yaprağa sığdır çıktısı; numara gizleme açıksa belgenin kendi numaraları kapatılır. */
async function nupUret(bytes: Uint8Array, adet: number, cerceve: boolean, gizle: boolean): Promise<Uint8Array> {
  let kapatilacakNumaralar;
  if (gizle) {
    try {
      kapatilacakNumaralar = await sayfaNumaralariniBulOnbellekli(bytes);
    } catch {
      kapatilacakNumaralar = undefined; // tespit edilemediyse belge olduğu gibi kalır
    }
  }
  return nUpYap(bytes, { adet, cerceve, kapatilacakNumaralar });
}

const ADETLER = [2, 4, 6, 8, 9, 16] as const;

/** Çıktının kaç yaprak olacağı — önizleme beklemeden özet yazabilmek için. */
function yaprakSayisi(kip: Kip, sayfa: number, adet: number): number {
  return kip === "kitapcik" ? Math.ceil(sayfa / 4) : Math.ceil(sayfa / adet);
}

/** Seçeneğin küçük çizimi: kâğıt üzerinde sayfaların nasıl dizileceğini gösterir. */
function MiniIzgara({ adet, aktif }: { adet: number; aktif: boolean }) {
  const { sutun, satir } = izgara(adet, false);
  return (
    <span
      aria-hidden
      className={`grid h-11 w-8 shrink-0 gap-[2px] rounded-[3px] border p-[3px] ${
        aktif ? "border-cyan-300/70 bg-cyan-400/10" : "border-white/25 bg-white/[0.04]"
      }`}
      style={{ gridTemplateColumns: `repeat(${sutun}, 1fr)`, gridTemplateRows: `repeat(${satir}, 1fr)` }}
    >
      {Array.from({ length: adet }, (_, i) => (
        <span key={i} className={`rounded-[1px] ${aktif ? "bg-cyan-300/80" : "bg-slate-400/60"}`} />
      ))}
    </span>
  );
}

type ModalProps = {
  open: boolean;
  language: Language;
  fileName: string;
  bytes: Uint8Array;
  pageCount: number;
  kip: Kip;
  onKip: (k: Kip) => void;
  adet: number;
  onAdet: (n: number) => void;
  cerceve: boolean;
  onCerceve: (b: boolean) => void;
  gizle: boolean;
  onGizle: (b: boolean) => void;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onApply: () => void;
};

/** Tam ekran düzen penceresi: ayarlar + ÇIKTININ canlı önizlemesi. */
function LayoutModal(p: ModalProps) {
  const t = METIN[p.language === "tr" ? "tr" : "en"];
  const { open, bytes, kip, adet, cerceve, gizle } = p;
  const [onizleme, setOnizleme] = useState<{ file: File; v: number } | null>(null);
  const [hazirlaniyor, setHazirlaniyor] = useState(false);
  const surum = useRef(0);
  const [zoom, setZoom] = useState<number>(50);

  // Ayar değişince çıktıyı yeniden üretip ızgarada göster. Eski istek geç dönerse yok sayılır.
  useEffect(() => {
    if (!open) return;
    const v = ++surum.current;
    const zamanlayici = setTimeout(async () => {
      setHazirlaniyor(true);
      try {
        const cikti = kip === "kitapcik" ? await kitapcikYap(bytes) : await nupUret(bytes, adet, cerceve, gizle);
        if (v !== surum.current) return;
        const f = new File([cikti as unknown as BlobPart], "onizleme.pdf", { type: "application/pdf" });
        setOnizleme({ file: f, v });
      } catch {
        if (v === surum.current) setOnizleme(null);
      } finally {
        if (v === surum.current) setHazirlaniyor(false);
      }
    }, 250);
    return () => clearTimeout(zamanlayici);
  }, [open, bytes, kip, adet, cerceve, gizle]);

  if (!open) return null;
  const yaprak = yaprakSayisi(kip, p.pageCount, adet);
  const bosYer = Math.ceil(p.pageCount / 4) * 4 - p.pageCount;
  const ozet =
    kip === "kitapcik" ? t.summaryBooklet(p.pageCount, yaprak) : t.summaryNup(p.pageCount, adet, yaprak);

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-1 sm:p-1.5" role="presentation">
      <button
        type="button"
        aria-label={t.close}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={p.onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.modalTitle}
        className="relative z-10 flex h-[min(94vh,100dvh)] w-[min(96vw,100vw)] max-w-[96vw] flex-col overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-b from-slate-900/[0.98] via-slate-950/[0.99] to-[#070b12] shadow-[0_25px_80px_-20px_rgba(0,0,0,0.85)]"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-cyan-500/15 bg-slate-950/50 px-3 py-2.5">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-50 sm:text-base">
            {t.modalTitle} <span className="font-normal text-slate-400">· {p.fileName}</span>
          </h2>
          <button
            type="button"
            onClick={p.onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/[0.12]"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {t.close}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Ayarlar */}
          <div className="max-h-[46%] shrink-0 space-y-4 overflow-y-auto border-b border-white/[0.08] p-3 sm:p-4 lg:max-h-none lg:w-[21rem] lg:border-b-0 lg:border-r">
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-300">{t.step1}</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "nup" as Kip, ad: t.modeNup, not: t.nupNote, Icon: Grid2x2 },
                  { id: "kitapcik" as Kip, ad: t.modeBooklet, not: t.bookletNote, Icon: BookOpen },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => p.onKip(m.id)}
                    aria-pressed={kip === m.id}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      kip === m.id
                        ? "border-cyan-400/50 bg-cyan-500/10"
                        : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-100">
                      <m.Icon className="h-4 w-4 shrink-0 text-cyan-300" />
                      {m.ad}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-slate-400">{m.not}</span>
                  </button>
                ))}
              </div>
            </div>

            {kip === "nup" ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-300">{t.step2}</p>
                <div className="grid grid-cols-3 gap-2">
                  {ADETLER.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => p.onAdet(n)}
                      aria-pressed={adet === n}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
                        adet === n
                          ? "border-cyan-400/50 bg-cyan-500/10"
                          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <MiniIzgara adet={n} aktif={adet === n} />
                      <span className="text-sm font-bold tabular-nums text-slate-100">{n}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={cerceve}
                    onChange={(e) => p.onCerceve(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                  <span className="text-[13px] text-slate-200">{t.frame}</span>
                </label>
                <label className="mt-3 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={gizle}
                    onChange={(e) => p.onGizle(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                  <span>
                    <span className="block text-[13px] text-slate-200">{t.hideNums}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{t.hideNumsNote}</span>
                  </span>
                </label>
              </div>
            ) : (
              <p className="rounded-xl border border-cyan-400/25 bg-cyan-500/[0.08] px-3 py-2.5 text-[12px] leading-relaxed text-cyan-100">
                {t.printHint}
              </p>
            )}
          </div>

          {/* Çıktı önizlemesi */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2 sm:p-3">
            <p className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-slate-300">
              {t.previewTitle}
              {hazirlaniyor ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" aria-label={t.previewBusy} />
              ) : null}
              <span className="ml-auto flex items-center gap-1">
                <span className="hidden text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:inline">
                  {t.zoom}
                </span>
                <span className="flex items-center gap-0.5 rounded-md border border-white/10 bg-black/35 p-px">
                  {ZOOM_LEVELS.map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZoom(z)}
                      aria-pressed={zoom === z}
                      className={`rounded px-1.5 py-1 text-[10px] font-semibold tabular-nums transition sm:px-2 sm:text-xs ${
                        zoom === z
                          ? "border border-cyan-400/45 bg-cyan-500/25 text-cyan-50"
                          : "border border-transparent text-slate-400 hover:border-cyan-500/25 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      %{z}
                    </button>
                  ))}
                </span>
              </span>
            </p>
            {kip === "kitapcik" ? (
              <div className="mb-2 rounded-lg border border-cyan-400/20 bg-cyan-500/[0.06] px-3 py-2 text-[12px] leading-relaxed text-cyan-100">
                {Array.from({ length: yaprak }, (_, i) => (
                  <p key={i} className="font-medium">
                    {t.sheetLine(i + 1, i * 2 + 1, i * 2 + 2)}
                  </p>
                ))}
                {bosYer > 0 ? <p className="mt-1 text-cyan-100/75">{t.blankNote(bosYer)}</p> : null}
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
              {onizleme ? (
                <PdfErrorBoundary>
                  <PdfPageVisualGrid
                    key={`layout-prev-${onizleme.v}`}
                    file={onizleme.file}
                    password=""
                    maxPage={null}
                    language={p.language}
                    mode="preview"
                    pagesText=""
                    onPagesTextChange={() => {}}
                    onPagesErrorClear={() => {}}
                    pageRotations={{}}
                    onPageRotationsChange={() => {}}
                    pageOrder={[]}
                    onPageOrderChange={() => {}}
                    zoomPercent={zoom}
                    hidePageNumbers={kip === "nup"}
                    hintOverride={kip === "kitapcik" ? t.gridHintBooklet : t.gridHintNup}
                  />
                </PdfErrorBoundary>
              ) : (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.previewBusy}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-cyan-500/15 bg-slate-950/60 px-3 py-2.5 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-[12.5px] font-medium text-slate-300">{ozet}</p>
          {p.error && <p className="text-[12px] text-rose-300">{p.error}</p>}
          <button
            type="button"
            onClick={p.onApply}
            disabled={p.busy}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
          >
            {p.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {p.busy ? t.working : `${t.prepare} →`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PdfLayoutTool({
  language,
  initialFile,
}: {
  language: Language;
  accessToken?: string | null;
  initialFile?: File | null;
}) {
  const t = METIN[language === "tr" ? "tr" : "en"];
  // Araç zaten anlatılmış bir sayfanın (GuestSeoToolPage) ya da Hero'nun
  // kendi tanıtım şeridinin İÇİNDEYSE, yükleme panelinin kendi başlığı
  // (ikon+ad+açıklama+rozet) aynı şeyi bir kez daha söylüyordu.
  const { describesTool } = useToolPageContext();
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("belge.pdf");
  const [pageCount, setPageCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  /** Kullanıcı düzen penceresinde bir seçim yaptı mı — özet kartı o zaman görünür. */
  const [secildi, setSecildi] = useState(false);
  const [kip, setKip] = useState<Kip>("nup");
  const [adet, setAdet] = useState(4);
  const [cerceve, setCerceve] = useState(false);
  const [gizle, setGizle] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  const dosyaYukle = useCallback(
    async (f: File | undefined) => {
      if (!f) return;
      setHata(null);
      try {
        const buf = await f.arrayBuffer();
        const n = await getPdfPageCount(buf);
        setBytes(new Uint8Array(buf));
        setFileName(f.name);
        setPageCount(n);
        setSecildi(false);
        setModalOpen(true); // dosya yüklenince düzen penceresi açılır (diğer sayfa araçlarıyla aynı)
      } catch (e) {
        setHata(e instanceof PdfEncryptedError ? t.encrypted : t.failed);
      }
    },
    [t.encrypted, t.failed],
  );

  // Dışarıdan (Belge Tarayıcı / PDF Merkezi) gelen dosya otomatik yüklenir.
  useEffect(() => {
    if (initialFile) void dosyaYukle(initialFile);
  }, [initialFile, dosyaYukle]);

  function sifirla() {
    setBytes(null);
    setPageCount(0);
    setModalOpen(false);
    setSecildi(false);
    setHata(null);
  }

  const uygula = async () => {
    if (!bytes) return;
    setCalisiyor(true);
    setHata(null);
    try {
      const cikti = kip === "kitapcik" ? await kitapcikYap(bytes) : await nupUret(bytes, adet, cerceve, gizle);
      const ek = kip === "kitapcik" ? "kitapcik" : `${adet}li`;
      setSonuc({
        blob: new Blob([cikti as unknown as BlobPart], { type: "application/pdf" }),
        filename: fileName.replace(/\.pdf$/i, "") + `-${ek}.pdf`,
      });
      setModalOpen(false);
    } catch (e) {
      setHata(e instanceof Error && e.message ? e.message : t.applyFailed);
    } finally {
      setCalisiyor(false);
    }
  };

  if (sonuc) {
    return (
      <ToolResultPanel
        ratingToolSlug="sayfa-duzeni"
        blob={sonuc.blob}
        filename={sonuc.filename}
        language={language}
        processedOnDevice
        subtitle={kip === "kitapcik" ? t.printHint : undefined}
        onClose={() => setSonuc(null)}
      >
        <ValueMomentNudge language={language} source="layout_success" />
      </ToolResultPanel>
    );
  }

  if (!bytes) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="tool-form">
          <WorkspaceUploadField
            toolId="sayfa-duzeni"
            language={language}
            accept="application/pdf,.pdf"
            label={t.dropTitle}
            note={t.hint}
            hideHeader={describesTool}
            onFiles={(files) => void dosyaYukle(files[0])}
          />
        </div>
        {hata && <p className="mt-3 text-[13px] text-rose-300">{hata}</p>}
      </div>
    );
  }

  const yaprak = yaprakSayisi(kip, pageCount, adet);
  const ozet =
    kip === "kitapcik" ? t.summaryBooklet(pageCount, yaprak) : t.summaryNup(pageCount, adet, yaprak);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-cyan-300">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-slate-100">{fileName}</p>
          <p className="text-[11px] text-slate-400">
            {pageCount} {t.pageCount}
          </p>
        </div>
        <button
          type="button"
          onClick={sifirla}
          className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
          aria-label={t.remove}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {secildi && (
        <div className="mt-3 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.07] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300/80">{t.layoutLabel}</p>
          <p className="mt-0.5 text-sm font-semibold text-cyan-50">
            {kip === "kitapcik" ? t.bookletShort : t.nupShort(adet)}
          </p>
          <p className="mt-0.5 text-[12px] text-cyan-100/70">{ozet}</p>
        </div>
      )}

      {hata && <p className="mt-3 text-[13px] text-rose-300">{hata}</p>}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
        >
          <Sliders className="h-4 w-4" />
          {secildi ? t.editLayout : t.chooseLayout}
        </button>
        <button
          type="button"
          onClick={() => void uygula()}
          disabled={calisiyor}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.7)] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
        >
          {calisiyor ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t.working}
            </>
          ) : (
            <>{t.prepare} →</>
          )}
        </button>
      </div>

      {createPortal(
        <LayoutModal
          open={modalOpen}
          language={language}
          fileName={fileName}
          bytes={bytes}
          pageCount={pageCount}
          kip={kip}
          onKip={(k) => {
            setKip(k);
            setSecildi(true);
          }}
          adet={adet}
          onAdet={(n) => {
            setAdet(n);
            setSecildi(true);
          }}
          cerceve={cerceve}
          onCerceve={(b) => {
            setCerceve(b);
            setSecildi(true);
          }}
          gizle={gizle}
          onGizle={(b) => {
            setGizle(b);
            setSecildi(true);
          }}
          busy={calisiyor}
          error={hata}
          onClose={() => {
            setSecildi(true);
            setModalOpen(false);
          }}
          onApply={() => void uygula()}
        />,
        document.body,
      )}
    </div>
  );
}
