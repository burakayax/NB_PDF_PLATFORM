/**
 * PDF BİRLEŞTİR + TIKLANABİLİR İÇİNDEKİLER — dosyaları sırala, başlıklarını düzenle,
 * tek PDF'de içindekiler sayfası + yer imleriyle indir.
 *
 * Her şey cihazda yapılır (pdf-lib + pdf.js); dosyalar sunucuya gitmez.
 * Birleştirme zaten en az 2 dosya ister; bu yüzden tek dosyada düğme kapalıdır.
 */
import { useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, FileText, GripVertical, ListTree, Loader2, Plus, Trash2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { MemberGateModal } from "../common/MemberGateModal";
import { PdfThumbError, renderPdfPage } from "../../lib/pdfThumbs";
import {
  type TocSub, MAX_SUBS, readOutline,
  TOC_DEFAULT_OUTPUT, TOC_MAX_FILES, TOC_MAX_FILE_BYTES, TocFileError, defaultTitle, mergeWithToc,
} from "../../lib/pdfToc";

/** Kayıt gerekli mi? Karar verilince tek yerden değişir (katalogdaki free/account bayrağıyla birlikte). */
const KAYIT_GEREKLI = true;

const T = {
  tr: {
    hint: "Birleştirmek istediğin PDF'leri seç (en az 2, en çok 20).",
    files: "Dosyalar", order: "Sırayı sürükleyerek ya da oklarla değiştir; başlığa tıklayıp içindekilerde görünecek adı düzenle.",
    az: "A-Z sırala", pages: "sayfa", up: "Yukarı taşı", down: "Aşağı taşı", remove: "Kaldır", titleLabel: "Bölüm başlığı",
    encrypted: "Bu dosya şifreli. Lütfen şifresini kaldırıp tekrar yükleyin.",
    broken: "Bu dosya okunamadı (bozuk olabilir). Birleştirmeye dahil edilmeyecek.",
    tooBig: "Bu dosya 50 MB'dan büyük, eklenmedi.",
    tooMany: "En fazla 20 dosya ekleyebilirsin; fazlası eklenmedi.",
    subsTitle: "Alt başlıklar", subsAdd: "Alt başlık ekle", subsTitleLabel: "Alt başlık", subsPage: "Sayfa", subsImport: "Dosyanın kendi yer imlerini al", subsNone: "Henüz alt başlık yok.", subsHint: "Alt başlıklar içindekilerde bölümün altında girintili görünür; tıklanınca o sayfaya gider.",
    needTwo: "Birleştirmek için en az 2 geçerli PDF gerekli.",
    settings: "İçindekiler ayarları", heading: "Sayfa başlığı", headingDefault: "İçindekiler",
    numbering: "Bölümleri numaralandır (1., 2., 3. …)", footer: "Tüm sayfalara «Sayfa 3 / 42» alt bilgisi ekle",
    back: "Her bölümün başına «İçindekilere dön» bağlantısı ekle", outName: "Dosya adı",
    build: "Birleştir ve içindekiler ekle", working: "Hazırlanıyor…", failed: "Birleştirme başarısız oldu. Dosyalardan biri korumalı ya da bozuk olabilir.",
    fileErr: "Hata:", another: "Dosyaları temizle", addMore: "Dosya ekle",
    onDevice: "Dosyaların cihazından çıkmaz.", sub: "bölüm", pageWord: "Sayfa", continued: "(devam)", backLabel: "İçindekilere dön",
    reading: "Okunuyor…",
  },
  en: {
    hint: "Choose the PDFs to merge (at least 2, at most 20).",
    files: "Files", order: "Drag or use the arrows to reorder; click a title to edit the name shown in the contents.",
    az: "Sort A-Z", pages: "pages", up: "Move up", down: "Move down", remove: "Remove", titleLabel: "Section title",
    encrypted: "This file is password-protected. Remove the password and upload it again.",
    broken: "This file could not be read (it may be corrupt). It will not be merged.",
    tooBig: "This file is larger than 50 MB and was not added.",
    tooMany: "You can add at most 20 files; the rest were not added.",
    subsTitle: "Sub-headings", subsAdd: "Add sub-heading", subsTitleLabel: "Sub-heading", subsPage: "Page", subsImport: "Use the file's own bookmarks", subsNone: "No sub-headings yet.", subsHint: "Sub-headings appear indented under the section in the contents; a click jumps to that page.",
    needTwo: "At least 2 valid PDFs are needed to merge.",
    settings: "Contents settings", heading: "Page heading", headingDefault: "Contents",
    numbering: "Number the sections (1., 2., 3. …)", footer: "Add a “Page 3 / 42” footer to every page",
    back: "Add a “Back to contents” link at the start of each section", outName: "File name",
    build: "Merge and add contents", working: "Working…", failed: "Merge failed. One of the files may be protected or corrupt.",
    fileErr: "Error:", another: "Clear files", addMore: "Add files",
    onDevice: "Your files never leave your device.", sub: "sections", pageWord: "Page", continued: "(cont.)", backLabel: "Back to contents",
    reading: "Reading…",
  },
} as const;

type Item = {
  id: number;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  thumb: string | null;
  title: string;
  error: "encrypted" | "broken" | null;
  subs: TocSub[];
  outline: TocSub[];
  open: boolean;
};

let sayac = 0;

export function PdfMergeTocTool({
  language,
  isSignedIn,
  onLogin,
}: {
  language: Language;
  accessToken?: string | null;
  initialFile?: File | null;
  isSignedIn?: boolean;
  onLogin?: () => void;
}) {
  const dil = language === "tr" ? "tr" : "en";
  const t = T[dil];
  const { describesTool } = useToolPageContext();
  const [items, setItems] = useState<Item[]>([]);
  const [notlar, setNotlar] = useState<string[]>([]);
  const [okuyor, setOkuyor] = useState(false);
  const [heading, setHeading] = useState<string>(t.headingDefault);
  const [numbering, setNumbering] = useState(true);
  const [footer, setFooter] = useState(false);
  const [backLinks, setBackLinks] = useState(false);
  const [outName, setOutName] = useState(TOC_DEFAULT_OUTPUT.replace(/\.pdf$/, ""));
  const [calisiyor, setCalisiyor] = useState(false);
  const [kapi, setKapi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<{ blob: Blob; ad: string; bolum: number; sayfa: number } | null>(null);
  const surukleniyor = useRef<number | null>(null);

  const ekle = async (files: File[]) => {
    setOkuyor(true);
    const yeniNotlar: string[] = [];
    const eklenecek: Item[] = [];
    let kalan = TOC_MAX_FILES - items.length;
    for (const f of files) {
      if (kalan <= 0) {
        yeniNotlar.push(t.tooMany);
        break;
      }
      if (f.size > TOC_MAX_FILE_BYTES) {
        yeniNotlar.push(`${f.name}: ${t.tooBig}`);
        continue;
      }
      kalan--;
      const bytes = new Uint8Array(await f.arrayBuffer());
      const item: Item = { id: ++sayac, name: f.name, bytes, pageCount: 0, thumb: null, title: defaultTitle(f.name), error: null, subs: [], outline: [], open: false };
      try {
        const th = await renderPdfPage(bytes, 0, 140);
        item.pageCount = th.pageCount;
        item.thumb = th.dataUrl;
        item.outline = await readOutline(bytes);
      } catch (e) {
        item.error = e instanceof PdfThumbError && e.kind === "encrypted" ? "encrypted" : "broken";
      }
      eklenecek.push(item);
    }
    setItems((m) => [...m, ...eklenecek]);
    setNotlar(yeniNotlar);
    setOkuyor(false);
  };

  const tasi = (i: number, d: -1 | 1) =>
    setItems((m) => {
      const j = i + d;
      if (j < 0 || j >= m.length) return m;
      const c = [...m];
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });

  const gecerli = items.filter((i) => !i.error);
  const toplamSayfa = gecerli.reduce((n, i) => n + i.pageCount, 0);

  const birlestir = async () => {
    if (gecerli.length < 2) return;
    if (KAYIT_GEREKLI && !isSignedIn) {
      setKapi(true);
      return;
    }
    setCalisiyor(true);
    setHata(null);
    try {
      const [fontBytes, boldBytes] = await Promise.all([
        fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)),
        fetch("/fonts/Roboto-Bold.ttf").then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)),
      ]);
      const r = await mergeWithToc(
        gecerli.map((i) => ({ name: i.name, title: i.title.trim() || defaultTitle(i.name), bytes: i.bytes, subs: i.subs })),
        {
          heading: heading.trim() || t.headingDefault, continued: t.continued, numbering, pageFooter: footer,
          pageWord: t.pageWord, backLinks, backLabel: t.backLabel, fontBytes, boldBytes,
        },
      );
      const ad = (outName.trim().replace(/[\\/:*?"<>|]+/g, "") || TOC_DEFAULT_OUTPUT.replace(/\.pdf$/, "")) + ".pdf";
      setSonuc({
        blob: new Blob([r.bytes as unknown as BlobPart], { type: "application/pdf" }),
        ad,
        bolum: r.sections.length,
        sayfa: r.tocPages + toplamSayfa,
      });
    } catch (e) {
      if (e instanceof TocFileError) {
        const dosya = gecerli[e.index]?.name ?? "";
        setHata(`${t.fileErr} ${dosya} — ${e.kind === "encrypted" ? t.encrypted : t.broken}`);
      } else setHata(t.failed);
    } finally {
      setCalisiyor(false);
    }
  };

  if (sonuc) {
    return (
      <ToolResultPanel
        ratingToolSlug="pdf-birlestir-icindekiler"
        blob={sonuc.blob}
        filename={sonuc.ad}
        language={language}
        processedOnDevice
        subtitle={`${sonuc.bolum} ${t.sub} · ${sonuc.sayfa} ${t.pages}${dil === "tr" ? " (içindekiler dahil)" : " (contents included)"}`}
        onClose={() => setSonuc(null)}
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-full">
        <div className="tool-form">
          <WorkspaceUploadField
            toolId="pdf-birlestir-icindekiler"
            language={language}
            accept="application/pdf,.pdf"
            multiple
            note={t.hint}
            hideHeader={describesTool}
            onFiles={(f) => void ekle(f)}
          />
        </div>
        {okuyor && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-slate-300" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> {t.reading}
          </p>
        )}
      </div>
    );
  }

  const girdi = "w-full rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-2 text-[13px] text-white placeholder:text-slate-500";

  return (
    <div className="w-full">
      <div className="mt-1 mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="font-bold text-white">{items.length} {dil === "tr" ? "dosya" : "files"}</span>
            {toplamSayfa > 0 && <span className="text-slate-400">{toplamSayfa} {t.pages}</span>}
            <span className="text-slate-500">{items.length}/{TOC_MAX_FILES}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setItems((m) => [...m].sort((a, b) => a.title.localeCompare(b.title, dil, { numeric: true })))}
              className="rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white">{t.az}</button>
            <label className="cursor-pointer rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
              {t.addMore}
              <input type="file" accept="application/pdf,.pdf" multiple className="sr-only"
                onChange={(e) => { void ekle(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            </label>
            <button type="button" onClick={() => { setItems([]); setNotlar([]); setHata(null); }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300">
              <Trash2 className="h-3.5 w-3.5" />{dil === "tr" ? "Tümünü sil" : "Clear all"}
            </button>
          </div>
        </div>
        <p className="mt-1.5 border-t border-white/[0.05] pt-1.5 text-[12px] text-slate-400">{t.order}</p>
      </div>

      <ul className="space-y-2">
        {items.map((it, i) => (
          <li
            key={it.id}
            draggable
            onDragStart={() => { surukleniyor.current = i; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const k = surukleniyor.current;
              surukleniyor.current = null;
              if (k === null || k === i) return;
              setItems((m) => {
                const c = [...m];
                const [x] = c.splice(k, 1);
                c.splice(i, 0, x!);
                return c;
              });
            }}
            className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white/[0.03] px-3 py-2.5 ${it.error ? "border-amber-400/30 bg-amber-500/[0.06]" : "border-white/[0.08]"}`}
          >
            <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-slate-400 sm:block" aria-hidden />
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${it.error ? "bg-amber-500/10 text-amber-300" : "bg-white/[0.06] text-cyan-300"}`}>
              {it.error ? <AlertTriangle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <input className={girdi} value={it.title} aria-label={`${t.titleLabel}: ${it.name}`} maxLength={120}
                onChange={(e) => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))} />
              <p className="mt-1 truncate text-[11px] text-slate-500">
                {it.name}{it.pageCount ? ` · ${it.pageCount} ${t.pages}` : ""}
              </p>
              {it.error && (
                <p className="mt-0.5 flex items-start gap-1 text-[12px] text-rose-300" role="alert">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {it.error === "encrypted" ? t.encrypted : t.broken}
                </p>
              )}
            </div>
            <span className="flex shrink-0 items-center">
              <button type="button" onClick={() => tasi(i, -1)} disabled={i === 0} aria-label={t.up} className="rounded-md p-1 text-slate-400 transition hover:text-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" onClick={() => tasi(i, 1)} disabled={i === items.length - 1} aria-label={t.down} className="rounded-md p-1 text-slate-400 transition hover:text-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
            </span>
            <button type="button" onClick={() => setItems((m) => m.filter((x) => x.id !== it.id))} aria-label={t.remove} className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            {!it.error && (
              <div className="basis-full border-t border-white/[0.06] pt-2">
                <button type="button" onClick={() => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, open: !x.open } : x)))}
                  aria-expanded={it.open} className="text-[12px] font-semibold text-cyan-300 hover:text-cyan-200">
                  {t.subsTitle}{it.subs.length ? ` (${it.subs.length})` : ""} {it.open ? "▴" : "▾"}
                </button>
                {it.open && (
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-slate-500">{t.subsHint}</p>
                    {it.subs.length === 0 && <p className="text-[12px] text-slate-400">{t.subsNone}</p>}
                    {it.subs.map((s, k) => (
                      <div key={k} className="flex items-center gap-2">
                        <input className={girdi} value={s.title} maxLength={120} aria-label={t.subsTitleLabel}
                          onChange={(e) => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, subs: x.subs.map((y, j) => (j === k ? { ...y, title: e.target.value } : y)) } : x)))} />
                        <label className="flex shrink-0 items-center gap-1 text-[12px] text-slate-400">{t.subsPage}
                          <input type="number" min={1} max={it.pageCount} value={s.page} aria-label={`${t.subsPage} (${s.title})`}
                            className="w-16 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-2 text-[13px] text-white"
                            onChange={(e) => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, subs: x.subs.map((y, j) => (j === k ? { ...y, page: Math.min(it.pageCount, Math.max(1, Number(e.target.value) || 1)) } : y)) } : x)))} />
                        </label>
                        <button type="button" aria-label={t.remove} onClick={() => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, subs: x.subs.filter((_, j) => j !== k) } : x)))}
                          className="rounded-md border border-white/15 p-1.5 text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={it.subs.length >= MAX_SUBS}
                        onClick={() => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, subs: [...x.subs, { title: "", page: 1 }] } : x)))}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.08] disabled:opacity-40">
                        <Plus className="h-3.5 w-3.5" /> {t.subsAdd}
                      </button>
                      {it.outline.length > 0 && (
                        <button type="button"
                          onClick={() => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, subs: x.outline.slice(0, MAX_SUBS) } : x)))}
                          className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1.5 text-[12px] font-semibold text-cyan-100 hover:bg-cyan-500/20">
                          {t.subsImport} ({it.outline.length})
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {okuyor && <p className="mt-2 flex items-center gap-2 text-[13px] text-slate-300" role="status"><Loader2 className="h-4 w-4 animate-spin" /> {t.reading}</p>}
      {notlar.map((n, k) => <p key={k} className="mt-1 text-[12px] text-amber-300" role="alert">{n}</p>)}

      <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-[13px] font-semibold text-slate-100">{t.settings}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label><span className="mb-1 block text-[12px] text-slate-400">{t.heading}</span>
            <input className={girdi} value={heading} maxLength={60} onChange={(e) => setHeading(e.target.value)} /></label>
          <label><span className="mb-1 block text-[12px] text-slate-400">{t.outName}</span>
            <span className="flex items-center gap-1">
              <input className={girdi} value={outName} maxLength={80} onChange={(e) => setOutName(e.target.value)} />
              <span className="text-[13px] text-slate-400">.pdf</span>
            </span></label>
        </div>
        <div className="mt-3 space-y-2">
          {([[numbering, setNumbering, t.numbering], [footer, setFooter, t.footer], [backLinks, setBackLinks, t.back]] as const).map(([v, set, l]) => (
            <label key={l} className="flex items-start gap-2.5 text-sm text-slate-200">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={v} onChange={(e) => set(e.target.checked)} /> {l}
            </label>
          ))}
        </div>
      </div>

      {gecerli.length < 2 && <p className="mt-3 text-[13px] text-amber-300" role="status">{t.needTwo}</p>}
      {hata && <p className="mt-3 text-[13px] text-rose-300" role="alert">{hata}</p>}

      <button
        type="button"
        onClick={() => void birlestir()}
        disabled={gecerli.length < 2 || calisiyor}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.7)] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-70 disabled:saturate-50"
      >
        {calisiyor ? <><Loader2 className="h-5 w-5 animate-spin" />{t.working}</> : <>{t.build} →</>}
      </button>
      <p className="mt-2 text-center text-[12px] text-slate-500">{t.onDevice}</p>
      {kapi && !isSignedIn && (
        <MemberGateModal language={language} icon={<ListTree className="h-7 w-7" />} toolName={dil === "tr" ? "Birleştir + İçindekiler" : "Merge + Table of Contents"} onClose={() => setKapi(false)} onLogin={onLogin} />
      )}
    </div>
  );
}
