import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Eye, FileDown, FilePlus2, FileUp, Loader2, Lock, PencilLine, Palette, Pencil, ScanSearch, Sparkles, Trash2, Wand2, FileUser, FileText, FileType2, ListChecks } from "lucide-react";
import type { Language } from "../../../i18n/landing";
import { ToolRating } from "../../common/ToolRating";
import { hasCvPass, isPaidPlan, useCurrentPlan } from "../../../lib/currentPlan";
import { CvForm } from "./CvForm";
import { CvDesignPanel } from "./CvDesignPanel";
import { CvAnalysisPanel } from "./CvAnalysisPanel";
import { CvAiPanel } from "./CvAiPanel";
import { CvPassModal, remainingLabel } from "./CvPassModal";
import { buildCvDocx, cvToText } from "./cvExport";
import { buildModel, EMPTY_CV, isCvEmpty, normalizeCv, sampleCv } from "./cvModel";
import { buildCvPdf, measureFit, paginate } from "./cvPdf";
import { MAX_FIT_STEP, styleFromSettings } from "./cvStyle";
import { MAX_CVS, useCvStore } from "./useCvStore";
import { CV_TEMPLATES, CvPage, PAGE_H, PAGE_W, ensureCvStyles, getTemplate, type CvTemplate } from "./cvTemplates";

type Props = {
  language: Language;
  accessToken: string | null;
  onLogin: () => void;
  onRegister: () => void;
  onUpgrade: () => void;
  isAdmin?: boolean;
  /** AI araçlarıyla aynı "Çok Yakında" kilidi (ödemeler kapalıyken yetkisiz kullanıcıda). */
  aiComingSoon?: boolean;
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const slugify = (s: string) =>
  s.toLocaleLowerCase("tr").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ── Şablon küçük resmi ─────────────────────────────────────────────────────

const THUMB_W = 132;
const SAMPLE = { tr: sampleCv("tr"), en: sampleCv("en") };

const TemplateThumb = memo(function TemplateThumb({ tpl, lang }: { tpl: CvTemplate; lang: "tr" | "en" }) {
  const m = useMemo(() => buildModel({ ...SAMPLE[lang], photo: null }, "export"), [lang]);
  const scale = THUMB_W / PAGE_W;
  return (
    <div className="pointer-events-none relative overflow-hidden bg-white" style={{ width: THUMB_W, height: Math.round(PAGE_H * scale * 0.72) }} aria-hidden>
      <div style={{ width: PAGE_W, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <CvPage m={m} tpl={tpl} size="m" accent={null} />
      </div>
    </div>
  );
});

type RightTab = "content" | "design" | "analysis" | "ai";

// ── Ana bileşen ────────────────────────────────────────────────────────────

export function CvMakerTool({ language, accessToken, onLogin, onRegister, onUpgrade, isAdmin, aiComingSoon }: Props) {
  const tr = language === "tr";
  const signedIn = !!accessToken;
  const store = useCvStore(language, signedIn);
  const { data, templateId, setData, setTemplateId } = store;
  const [view, setView] = useState<"draft" | "export">("draft");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [rightTab, setRightTab] = useState<RightTab>("content");
  const [ad, setAd] = useState("");
  const [busy, setBusy] = useState<null | "pdf" | "blank">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const tpl = getTemplate(templateId);
  const planState = useCurrentPlan();
  const [passOpen, setPassOpen] = useState(false);
  const [, setClock] = useState(0);
  const passActive = hasCvPass(planState);
  const paid = !!isAdmin || isPaidPlan(planState) || passActive;
  // CV Geçişi bitince sayfa yenilenmeden şablonlar yeniden kilitlensin
  useEffect(() => {
    if (!planState.cvPassUntil) return;
    const ms = Date.parse(planState.cvPassUntil) - Date.now();
    if (!(ms > 0) || ms > 2_000_000_000) return;
    const id = window.setTimeout(() => setClock((c) => c + 1), ms + 500);
    return () => window.clearTimeout(id);
  }, [planState.cvPassUntil]);
  const locked = !tpl.free && !paid;

  useEffect(() => {
    ensureCvStyles();
  }, []);

  // Kilitli şablonda kullanıcının verisi değil, örnek içerik gösterilir
  const shownData = useMemo(() => (locked ? sampleCv(data.settings.lang) : data), [locked, data]);
  const model = useMemo(() => buildModel(shownData, locked ? "export" : view), [shownData, locked, view]);

  // ── "Tek sayfaya sığdır": PDF'in (boş alanlar çıkarılmış) ölçüsü ekran dışında hesaplanır ──
  const fitOn = data.settings.fitOnePage && !locked;
  const [fitRes, setFitRes] = useState<{ step: number; pages: number } | null>(null);
  useEffect(() => {
    if (!fitOn) { setFitRes(null); return; }
    let live = true;
    const id = window.setTimeout(() => {
      void measureFit(data, tpl.id).then((r) => live && setFitRes(r)).catch(() => undefined);
    }, 350);
    return () => { live = false; window.clearTimeout(id); };
  }, [fitOn, data, tpl.id]);
  const fitStep = fitOn ? fitRes?.step ?? 0 : 0;

  const styleOpts = useMemo(() => (locked ? undefined : styleFromSettings({ ...shownData.settings, fitOnePage: fitOn }, fitStep)), [locked, shownData.settings, fitOn, fitStep]);

  // ── Önizleme ölçeği ve sayfalama ──
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fitW = () => setScale(Math.min(1, Math.max(0.3, (el.clientWidth - 2) / PAGE_W)));
    fitW();
    const ro = new ResizeObserver(fitW);
    ro.observe(el);
    return () => ro.disconnect();
  }, [signedIn, tab]);

  const repaginate = useCallback(() => {
    const root = pageRef.current?.firstElementChild as HTMLElement | null;
    if (!root) return;
    setPages(paginate(root));
  }, []);
  useLayoutEffect(() => {
    repaginate();
  }, [model, tpl, styleOpts, data.settings.size, data.settings.accent, scale, repaginate, tab, fitStep]);
  useEffect(() => {
    void document.fonts.ready.then(repaginate);
    const t = window.setTimeout(repaginate, 400); // fotoğraf/yazı tipi geç yüklenirse
    return () => window.clearTimeout(t);
  }, [model, tpl, repaginate]);

  const fitFailed = fitOn && !!fitRes && fitRes.pages > 1 && fitRes.step >= MAX_FIT_STEP;

  async function makePdf(mode: "export" | "blank") {
    setError(null);
    setDone(null);
    setBusy(mode === "export" ? "pdf" : "blank");
    try {
      const { bytes, pages: n } = await buildCvPdf(data, templateId, mode);
      const base = mode === "blank" ? `cv-sablon-${tpl.id}` : `${slugify(data.name) || "cv"}-cv`;
      download(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${base}.pdf`);
      setDone(
        mode === "blank"
          ? tr ? "Boş şablon indirildi. Dilerseniz “PDF Düzenle” aracıyla üzerine yazabilirsiniz." : "Blank template downloaded. You can type over it with the Edit PDF tool."
          : tr ? `CV'niz indirildi (${n} sayfa). Boş bıraktığınız alanlar dosyaya eklenmedi.` : `Your CV was downloaded (${n} page${n > 1 ? "s" : ""}). Fields you left empty were not included.`,
      );
    } catch {
      setError(tr ? "PDF oluşturulamadı. Sayfayı yenileyip tekrar deneyin." : "Couldn't build the PDF. Refresh the page and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function makeOther(kind: "docx" | "txt") {
    setError(null);
    setDone(null);
    try {
      const base = `${slugify(data.name) || "cv"}-cv`;
      if (kind === "docx") {
        download(await buildCvDocx(data, templateId), `${base}.docx`);
        setDone(tr ? "Word dosyası indirildi. Word çıktısı sade ve tek sütunludur (başvuru sistemleri için en güvenli biçim); görsel tasarım için PDF'i kullanın." : "Word file downloaded. The Word output is plain and single-column (the safest format for hiring systems); use the PDF for the visual design.");
      } else {
        download(new Blob([cvToText(data)], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
        setDone(tr ? "Düz metin indirildi: başvuru formlarına yapıştırmak için." : "Plain text downloaded: for pasting into application forms.");
      }
    } catch {
      setError(tr ? "Dosya oluşturulamadı. Sayfayı yenileyip tekrar deneyin." : "Couldn't build the file. Refresh and try again.");
    }
  }

  const emptyCv = isCvEmpty(data);
  const fillSample = () => setData({ ...sampleCv(data.settings.lang), photo: data.photo, showPhoto: data.showPhoto, settings: data.settings });
  const clearAll = () => {
    if (isCvEmpty(data) || window.confirm(tr ? "Girdiğiniz tüm bilgiler silinsin mi?" : "Delete everything you entered?")) setData(normalizeCv({ ...EMPTY_CV, settings: data.settings }));
  };

  // ── CV'lerim (çoklu sürüm) + yedek ──
  const importRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState(false);
  const exportBackup = () => {
    download(new Blob([store.exportJson()], { type: "application/json" }), `cv-yedek-${new Date().toISOString().slice(0, 10)}.json`);
    setDone(tr ? "Tüm CV'lerinizin yedeği indirildi (fotoğraflar dahil)." : "A backup of all your CVs was downloaded (photos included).");
  };
  const importBackup = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      const n = store.importJson(await f.text());
      setDone(tr ? `${n} CV içe aktarıldı.` : `${n} CV(s) imported.`);
      if (!n) setError(tr ? `CV sayısı sınırına (${MAX_CVS}) ulaşıldı; önce birini silin.` : `CV limit (${MAX_CVS}) reached; delete one first.`);
    } catch {
      setError(tr ? "Bu dosya geçerli bir CV yedeği değil." : "This file isn't a valid CV backup.");
    }
  };

  const pagesH = pages * PAGE_H;

  return (
    <div className="mx-auto w-full max-w-[1500px] text-left">
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/25 to-indigo-600/20 text-sky-200 ring-1 ring-sky-400/30">
          <FileUser className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "CV Oluştur" : "CV Maker"}</h1>
          <p className="mt-1 text-sm text-slate-400">{tr ? "Bir şablon seçin, bilgilerinizi sağa girin; CV'niz solda canlı olarak oluşsun. Hazır olunca PDF olarak indirin." : "Pick a template, enter your details on the right and watch your CV build live on the left. Download it as a PDF when ready."}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/[0.07] px-3 py-1 text-[12px] font-semibold text-emerald-200">{tr ? "Bilgileriniz yalnızca bu tarayıcıda kalır; sunucuya gönderilmez." : "Your details stay in this browser; nothing is sent to a server."}</p>
        </div>
      </div>

      {/* Şablon seçici */}
      <section aria-label={tr ? "Şablonlar" : "Templates"} className="mb-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-300">{tr ? `Şablonlar (${CV_TEMPLATES.length})` : `Templates (${CV_TEMPLATES.length})`}</h2>
          {!paid ? <span className="text-[12px] text-slate-400">{tr ? "4 şablon ücretsiz · diğerleri Pro üyelere ya da CV Geçişi ile açılır" : "4 templates free · the rest unlock with Pro or a CV pass"}</span> : passActive && !isPaidPlan(planState) && planState.cvPassUntil ? <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-[12px] font-semibold text-sky-200">{tr ? `CV Geçişi: ${remainingLabel(planState.cvPassUntil, true)} kaldı` : `CV pass: ${remainingLabel(planState.cvPassUntil, false)} left`}</span> : null}
        </div>
        <div role="radiogroup" aria-label={tr ? "CV şablonu" : "CV template"} className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]">
          {CV_TEMPLATES.map((t) => {
            const on = t.id === templateId;
            const lockedT = !t.free && !paid;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => { setTemplateId(t.id); setTab("preview"); }} className={`group relative shrink-0 rounded-xl p-1.5 text-left transition ${on ? "bg-sky-500/20 ring-2 ring-sky-400" : "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.08]"}`} style={{ width: THUMB_W + 12 }}>
                <div className={`overflow-hidden rounded-lg ${lockedT ? "opacity-60" : ""}`}><TemplateThumb tpl={t} lang={data.settings.lang} /></div>
                {lockedT ? <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"><Lock className="h-3 w-3" />PRO</span> : !t.free ? <span className="absolute right-3 top-3 rounded-full bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">PRO</span> : <span className="absolute right-3 top-3 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">{tr ? "ÜCRETSİZ" : "FREE"}</span>}
                <div className="mt-1.5 truncate px-0.5 text-[12px] font-semibold text-white">{tr ? t.tr : t.en}</div>
              </button>
            );
          })}
        </div>
      </section>

      {!signedIn ? (
        <div className="rounded-3xl border border-sky-400/25 bg-sky-500/[0.06] p-8 text-center">
          <p className="text-lg font-bold text-white">{tr ? "CV oluşturmak için ücretsiz üye olun" : "Create a free account to build your CV"}</p>
          <p className="mx-auto mt-2 max-w-lg text-[14px] text-slate-300">{tr ? "Üyelik ücretsiz. CV'niz tarayıcınızda hazırlanır, taslağınız bu cihazda saklanır ve istediğiniz zaman kaldığınız yerden devam edersiniz." : "Membership is free. Your CV is built in your browser, the draft is kept on this device and you can pick up where you left off."}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onRegister} className="rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-3 text-sm font-bold text-white hover:brightness-110">{tr ? "Ücretsiz üye ol" : "Sign up free"}</button>
            <button type="button" onClick={onLogin} className="rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-bold text-white hover:bg-white/10">{tr ? "Giriş yap" : "Log in"}</button>
          </div>
        </div>
      ) : (
        <>
          {/* Mobil sekmeler */}
          <div className="mb-3 flex gap-2 lg:hidden" role="tablist">
            {([["edit", tr ? "Bilgilerim" : "My details", PencilLine], ["preview", tr ? "Önizleme" : "Preview", Eye]] as const).map(([k, label, Ico]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold ${tab === k ? "bg-sky-500 text-white" : "bg-white/[0.06] text-slate-300"}`}><Ico className="h-4 w-4" />{label}</button>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] xl:grid-cols-[minmax(0,1fr)_520px]">
            {/* SOL: canlı önizleme */}
            <div className={`${tab === "preview" ? "block" : "hidden"} min-w-0 lg:block`}>
              <div className="lg:sticky lg:top-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl bg-white/[0.06] p-1" role="tablist" aria-label={tr ? "Önizleme türü" : "Preview type"}>
                    <button type="button" role="tab" aria-selected={view === "draft"} onClick={() => setView("draft")} className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold ${view === "draft" ? "bg-sky-500 text-white" : "text-slate-300"}`}>{tr ? "Taslak görünüm" : "Draft view"}</button>
                    <button type="button" role="tab" aria-selected={view === "export"} onClick={() => setView("export")} className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold ${view === "export" ? "bg-sky-500 text-white" : "text-slate-300"}`}>{tr ? "PDF görünümü" : "PDF view"}</button>
                  </div>
                  <span className="text-[12px] text-slate-400">{fitOn && fitRes && view === "draft" ? `${fitRes.pages} ${tr ? "sayfa (PDF)" : "page(s) (PDF)"}` : `${pages} ${tr ? "sayfa" : pages > 1 ? "pages" : "page"}`}</span>
                </div>
                {view === "draft" && !locked ? (
                  <p className="mb-3 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-sky-100">
                    {tr ? "Soluk ve kesik çizgili alanlar henüz doldurmadığınız yerlerdir. " : "Faded, dashed areas are the ones you haven't filled in. "}
                    <b>{tr ? "Boş bıraktığınız bölümler indirdiğiniz PDF'ten silinir." : "Anything you leave empty is removed from the PDF you download."}</b>
                    {tr ? " Sonucu görmek için “PDF görünümü”ne geçin." : " Switch to “PDF view” to see the result."}
                  </p>
                ) : null}
                {fitFailed ? <p className="mb-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-3.5 py-2.5 text-[12.5px] text-amber-100">{tr ? "İçerik, okunaklılığı bozmadan tek sayfaya sığmadı. Birkaç maddeyi kısaltın ya da bölüm gizleyin." : "The content doesn't fit on one page without hurting legibility. Shorten a few bullets or hide a section."}</p> : null}

                <div ref={wrapRef} className="w-full">
                  <div className="relative mx-auto select-none overflow-hidden rounded-lg bg-white shadow-[0_24px_70px_-24px_rgba(0,0,0,0.85)] ring-1 ring-white/15" style={{ width: PAGE_W * scale, height: pagesH * scale }} onContextMenu={locked ? (e) => e.preventDefault() : undefined}>
                    <div ref={pageRef} style={{ width: PAGE_W, transform: `scale(${scale})`, transformOrigin: "top left", opacity: locked ? 0.55 : 1 }}>
                      <CvPage m={model} tpl={tpl} size={shownData.settings.size} accent={locked ? null : shownData.settings.accent} style={styleOpts} />
                    </div>
                    {/* Sayfa sınırları */}
                    {Array.from({ length: pages - 1 }, (_, i) => (
                      <div key={i} className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-sky-500/70" style={{ top: (i + 1) * PAGE_H * scale }}>
                        <span className="absolute right-2 top-1 rounded bg-sky-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">{tr ? `Sayfa ${i + 2}` : `Page ${i + 2}`}</span>
                      </div>
                    ))}
                    {locked ? (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.28)", backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='170'><text x='20' y='110' transform='rotate(-24 130 85)' font-family='Arial' font-weight='700' font-size='26' fill='%23475569' fill-opacity='0.22'>PDF PLATFORM · PRO</text></svg>\")" }}>
                        <div className="mx-4 max-w-sm rounded-2xl bg-slate-900/92 p-5 text-center shadow-2xl ring-1 ring-white/15">
                          <Lock className="mx-auto h-7 w-7 text-amber-300" />
                          <p className="mt-2 text-[15px] font-bold text-white">{tr ? "Bu şablon Pro üyelere özel" : "This template is for Pro members"}</p>
                          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-300">{tr ? "Önizleme örnek içerikle gösteriliyor. Pro ile tüm şablonları kullanın ya da ücretsiz şablonlardan birini seçin." : "The preview shows sample content. Go Pro to use every template, or pick one of the free ones."}</p>
                          <div className="mt-4 flex flex-col gap-2">
                            <button type="button" onClick={onUpgrade} className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-[13px] font-bold text-slate-900 hover:brightness-105">{tr ? "Pro'ya geç (süresiz)" : "Go Pro (permanent)"}</button>
                            <button type="button" onClick={() => setPassOpen(true)} className="rounded-xl bg-sky-500/20 px-4 py-2.5 text-[13px] font-bold text-sky-100 ring-1 ring-sky-400/40 hover:bg-sky-500/30">{tr ? "CV Geçişi al (tek seferlik)" : "Get a CV pass (one-off)"}</button>
                            <button type="button" onClick={() => setTemplateId("sade")} className="rounded-xl bg-white/10 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/15">{tr ? "Ücretsiz şablona dön" : "Back to a free template"}</button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 text-center text-[12px] text-slate-400"><b className="text-slate-200">{tr ? tpl.tr : tpl.en}</b> — {tr ? tpl.descTr : tpl.descEn}</p>
              </div>
            </div>

            {/* SAĞ: CV'lerim + eylemler + sekmeler */}
            <div className={`${tab === "edit" ? "block" : "hidden"} min-w-0 space-y-4 lg:block`}>
              {/* CV'lerim */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="cv-switch">{tr ? "CV seç" : "Choose CV"}</label>
                  {renaming ? (
                    <input autoFocus defaultValue={store.current.name} onBlur={(e) => { store.rename(e.target.value.trim() || store.current.name); setRenaming(false); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className="min-w-0 flex-1 rounded-xl border border-sky-400/50 bg-slate-900/70 px-3 py-2 text-[13px] font-semibold text-white focus:outline-none" />
                  ) : (
                    <select id="cv-switch" value={store.current.id} onChange={(e) => store.switchTo(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-[13px] font-semibold text-white">
                      {store.cvs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => setRenaming(true)} aria-label={tr ? "Adını değiştir" : "Rename"} title={tr ? "Adını değiştir" : "Rename"} className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-slate-200 hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                  <button type="button" disabled={store.cvs.length >= MAX_CVS} onClick={() => store.add()} aria-label={tr ? "Yeni CV" : "New CV"} title={tr ? "Yeni boş CV" : "New blank CV"} className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-slate-200 hover:bg-white/10 disabled:opacity-40"><FilePlus2 className="h-4 w-4" /></button>
                  <button type="button" disabled={store.cvs.length >= MAX_CVS} onClick={() => store.duplicate()} aria-label={tr ? "Kopyala" : "Duplicate"} title={tr ? "Bu CV'yi kopyala (ilana göre uyarlamak için)" : "Duplicate (to tailor for a job)"} className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-slate-200 hover:bg-white/10 disabled:opacity-40"><Copy className="h-4 w-4" /></button>
                  <button type="button" onClick={() => { if (window.confirm(tr ? `“${store.current.name}” silinsin mi?` : `Delete “${store.current.name}”?`)) store.remove(); }} aria-label={tr ? "Sil" : "Delete"} title={tr ? "Bu CV'yi sil" : "Delete this CV"} className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-red-300 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-400">
                  <span>{tr ? `${store.cvs.length} CV · her ilan için ayrı sürüm tutabilirsiniz` : `${store.cvs.length} CV(s) · keep a version per job`}</span>
                  <button type="button" onClick={exportBackup} className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:text-sky-200"><FileDown className="h-3.5 w-3.5" />{tr ? "Yedek indir" : "Back up"}</button>
                  <button type="button" onClick={() => importRef.current?.click()} className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:text-sky-200"><FileUp className="h-3.5 w-3.5" />{tr ? "Yedekten yükle" : "Restore"}</button>
                  <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void importBackup(e.target.files?.[0]); e.target.value = ""; }} />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={locked || !!busy} onClick={() => void makePdf("export")} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3 text-[14px] font-bold text-white shadow-[0_10px_28px_-10px_rgba(59,130,246,0.7)] hover:brightness-110 disabled:opacity-40 sm:col-span-2">
                    {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{tr ? "CV'yi PDF olarak indir" : "Download CV as PDF"}
                  </button>
                  <button type="button" disabled={locked || !!busy} onClick={() => void makeOther("docx")} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2.5 text-[12.5px] font-semibold text-white hover:bg-white/10 disabled:opacity-40"><FileText className="h-4 w-4" />{tr ? "Word (.docx) indir" : "Download Word (.docx)"}</button>
                  <button type="button" disabled={locked || !!busy} onClick={() => void makeOther("txt")} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2.5 text-[12.5px] font-semibold text-white hover:bg-white/10 disabled:opacity-40"><FileType2 className="h-4 w-4" />{tr ? "Düz metin (.txt) indir" : "Download plain text (.txt)"}</button>
                  <button type="button" disabled={locked || !!busy} onClick={() => void makePdf("blank")} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2.5 text-[12.5px] font-semibold text-white hover:bg-white/10 disabled:opacity-40">
                    {busy === "blank" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}{tr ? "Boş şablonu indir" : "Download blank template"}
                  </button>
                  <div className="flex gap-2">
                    <button type="button" disabled={locked} onClick={fillSample} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-2 py-2.5 text-[12.5px] font-semibold text-white hover:bg-white/10 disabled:opacity-40"><Wand2 className="h-3.5 w-3.5" />{tr ? "Örnekle doldur" : "Fill sample"}</button>
                    <button type="button" disabled={locked || emptyCv} onClick={clearAll} aria-label={tr ? "Tümünü temizle" : "Clear all"} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2.5 text-red-300 hover:bg-red-500/10 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {emptyCv && !locked ? <p className="mt-2 text-[11.5px] text-amber-300/90">{tr ? "CV'niz henüz boş. Bilgilerinizi girin ya da “Örnekle doldur” ile nasıl görüneceğine bakın." : "Your CV is still empty. Enter your details or try “Fill sample” to see how it looks."}</p> : null}
                {error ? <p className="mt-2 rounded-lg border border-red-500/25 bg-red-500/[0.07] px-3 py-2 text-[12.5px] text-red-300">{error}</p> : null}
                {done ? <p className="mt-2 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.07] px-3 py-2 text-[12.5px] text-emerald-200">{done}</p> : null}
              </div>

              <div role="tablist" aria-label={tr ? "Bölümler" : "Sections"} className="grid grid-cols-4 gap-1 rounded-2xl bg-white/[0.05] p-1">
                {([["content", tr ? "İçerik" : "Content", ListChecks], ["design", tr ? "Tasarım" : "Design", Palette], ["analysis", tr ? "Analiz" : "Analysis", ScanSearch], ["ai", tr ? "Yapay Zekâ" : "AI", Sparkles]] as const).map(([k, label, Ico]) => (
                  <button key={k} type="button" role="tab" aria-selected={rightTab === k} onClick={() => setRightTab(k)} className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[13px] font-semibold transition ${rightTab === k ? "bg-sky-500 text-white" : "text-slate-300 hover:text-white"}`}><Ico className="h-4 w-4" />{label}</button>
                ))}
              </div>

              <div className="relative">
                {locked ? (
                  <div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-slate-950/55 p-6 backdrop-blur-[1px]">
                    <p className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-[12.5px] font-semibold text-amber-200 ring-1 ring-amber-300/30"><Lock className="h-3.5 w-3.5" />{tr ? "Pro şablon — alanlar kilitli" : "Pro template — fields locked"}</p>
                  </div>
                ) : null}
                {rightTab === "content" ? <CvForm data={data} onChange={setData} tpl={tpl} disabled={locked} tr={tr} /> : null}
                {rightTab === "design" ? <CvDesignPanel data={data} onChange={setData} disabled={locked} tr={tr} /> : null}
                {rightTab === "analysis" ? <CvAnalysisPanel data={data} tpl={tpl} tr={tr} disabled={locked} ad={ad} setAd={setAd} /> : null}
                {rightTab === "ai" ? <CvAiPanel data={data} onChange={setData} onNewCv={(d, name) => store.add({ data: d, name })} tr={tr} language={language} accessToken={accessToken} onLogin={onLogin} onUpgrade={onUpgrade} comingSoon={aiComingSoon} isAdmin={isAdmin} ad={ad} setAd={setAd} disabled={locked} /> : null}
              </div>

              {done ? <ToolRating toolSlug="cv-olustur" language={language} /> : null}
              <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-slate-500"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />{tr ? "İpucu: Başvuru sistemleri (ATS) düz metni sever. Bu araçla ürettiğiniz PDF'te yazılar seçilebilir metin olarak gömülüdür; “Analiz” sekmesindeki ATS röntgeniyle makinenin gördüğünü kendiniz kontrol edebilirsiniz." : "Tip: hiring systems (ATS) love plain text. In the PDF made here all text is selectable; use the ATS X-ray under “Analysis” to check what a machine sees."}</p>
            </div>
          </div>
        </>
      )}
      {passOpen ? <CvPassModal language={language} accessToken={accessToken} onClose={() => setPassOpen(false)} onUpgrade={onUpgrade} /> : null}
    </div>
  );
}
