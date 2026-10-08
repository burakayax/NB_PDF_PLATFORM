import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Copy, FileDown, FileUp, Loader2, Mail, ShieldCheck, Sparkles, Target, Wand2 } from "lucide-react";
import type { Language } from "../../../i18n/landing";
import { fetchAiQuota, type AiError, type AiQuota } from "../../../api/ai";
import { ocrPdfToText } from "../../../lib/ocr";
import { pdfBytesToBlob, summaryToPdf } from "../../../lib/summaryPdf";
import { AiCreditBadge } from "../AiCreditBadge";
import { TopUpModal } from "../TopUpModal";
import type { CvData } from "./cvModel";
import {
  aiYears,
  applyTailor,
  callCvAi,
  cvTextForAi,
  parsedToCv,
  readCvFile,
  replaceBullet,
  type ParsedCv,
  type TailorResult,
} from "./cvAi";

type Props = {
  data: CvData;
  onChange: (d: CvData) => void;
  onNewCv: (d: CvData, name: string) => void;
  tr: boolean;
  language: Language;
  accessToken: string | null;
  onLogin: () => void;
  onUpgrade: () => void;
  comingSoon?: boolean;
  isAdmin?: boolean;
  ad: string;
  setAd: (s: string) => void;
  disabled: boolean;
};

type Bullets = { items: { original: string; improved: string; askMetric: string; added: string[]; rejectedNumber: boolean }[] };
type Summaries = { text: string; added: string[] }[];
type Cover = { text: string; unsupported: string[] };

function Card({ icon, title, sub, children, open: o = false }: { icon: ReactNode; title: string; sub: string; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(o);
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03]">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-200">{icon}</span>
        <span className="flex-1"><span className="block text-[14px] font-bold text-white">{title}</span><span className="block text-[11.5px] text-slate-400">{sub}</span></span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}

const btn = "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2.5 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-40";
const ghost = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-white/10 disabled:opacity-40";

function Added({ words, tr }: { words: string[]; tr: boolean }) {
  if (!words.length) return null;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-amber-200">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>{tr ? "Yeni eklenen kelimeler — doğruluğunu siz onaylayın:" : "Newly added words — please confirm they're true:"}</span>
      {words.map((w) => <span key={w} className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold ring-1 ring-amber-400/25">{w}</span>)}
    </p>
  );
}

export function CvAiPanel({ data, onChange, onNewCv, tr, language, accessToken, onLogin, onUpgrade, comingSoon, isAdmin, ad, setAd, disabled }: Props) {
  const lang = data.settings.lang;
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; gate?: "login" | "upgrade" | "quota" } | null>(null);
  const [expIdx, setExpIdx] = useState(0);
  const [summaries, setSummaries] = useState<Summaries | null>(null);
  const [bullets, setBullets] = useState<(Bullets & { expId: string; pick: boolean[] }) | null>(null);
  const [tailor, setTailor] = useState<(TailorResult & { pickSummary: boolean; pickBullets: boolean[] }) | null>(null);
  const [tone, setTone] = useState<"formal" | "warm" | "direct">("formal");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [cover, setCover] = useState<Cover | null>(null);
  const [copied, setCopied] = useState(false);
  const [imp, setImp] = useState<{ name: string; parsed: ParsedCv; scanned?: boolean } | null>(null);
  const [impNote, setImpNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (comingSoon) return;
    void fetchAiQuota(accessToken).then((q) => q && setQuota(q));
  }, [accessToken, comingSoon]);

  const aiText = useMemo(() => cvTextForAi(data), [data]);
  const exps = data.experience.filter((e) => e.desc.trim());

  async function run<T>(key: string, fn: () => Promise<{ result: T; quota?: AiQuota }>, ok: (r: T) => void) {
    setBusy(key);
    setErr(null);
    try {
      const r = await fn();
      if (r.quota) setQuota(r.quota);
      ok(r.result);
    } catch (e) {
      const ae = e as AiError;
      if (ae.status === 401) setErr({ msg: tr ? "Devam etmek için giriş yapın." : "Please log in to continue.", gate: "login" });
      else if (ae.status === 403) setErr({ msg: tr ? "Yapay zekâ özellikleri Pro / Business üyelere açıktır." : "AI features are for Pro / Business members.", gate: "upgrade" });
      else if (ae.status === 429) setErr({ msg: tr ? "Aylık yapay zekâ hakkınız ve krediniz bitti." : "You've used your monthly AI allowance and credits.", gate: "quota" });
      else setErr({ msg: ae.message || (tr ? "İşlem başarısız. Hakkınız düşülmedi, tekrar deneyin." : "Failed. You weren't charged; try again.") });
    } finally {
      setBusy(null);
    }
  }

  // ── Özet ──
  const doSummary = () =>
    run<Summaries>("summary", () => callCvAi("summary", {
      title: data.title,
      years: aiYears(data),
      skills: data.skills.map((s) => s.name).filter(Boolean),
      roles: data.experience.slice(0, 6).map((e) => [e.role, e.company].filter(Boolean).join(" · ")).filter(Boolean),
      bullets: data.experience.flatMap((e) => e.desc.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)).slice(0, 14),
      ad: ad.trim().length > 80 ? ad : undefined,
    }, accessToken, lang), setSummaries);

  // ── Maddeler ──
  const doBullets = () => {
    const e = exps[Math.min(expIdx, exps.length - 1)];
    if (!e) return;
    void run<Bullets>("bullets", () => callCvAi("bullets", {
      role: e.role, company: e.company,
      bullets: e.desc.split(/\r?\n/).map((x) => x.replace(/^[\s•\-–*]+/, "").trim()).filter(Boolean),
      ad: ad.trim().length > 80 ? ad : undefined,
    }, accessToken, lang), (r) => setBullets({ ...r, expId: e.id, pick: r.items.map((i) => i.improved !== i.original) }));
  };
  const applyBullets = () => {
    if (!bullets) return;
    onChange({
      ...data,
      experience: data.experience.map((e) => {
        if (e.id !== bullets.expId) return e;
        let desc = e.desc;
        bullets.items.forEach((it, i) => { if (bullets.pick[i] && it.improved !== it.original) desc = replaceBullet(desc, it.original, it.improved); });
        return { ...e, desc };
      }),
    });
    setBullets(null);
  };

  // ── İlana uyarla ──
  const doTailor = () =>
    run<TailorResult>("tailor", () => callCvAi("tailor", { cvText: aiText, ad, years: aiYears(data) }, accessToken, lang), (r) => setTailor({ ...r, pickSummary: !!r.summary, pickBullets: r.bullets.map(() => true) }));

  // ── Ön yazı ──
  const doCover = () =>
    run<Cover>("cover", () => callCvAi("coverLetter", { cvText: aiText, ad: ad.trim().length > 80 ? ad : undefined, tone, company, position, name: data.name }, accessToken, lang), setCover);
  const copyCover = async () => {
    if (!cover) return;
    try { await navigator.clipboard.writeText(cover.text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* panoya yazılamadı */ }
  };
  const coverPdf = async () => {
    if (!cover) return;
    const bytes = await summaryToPdf(cover.text, tr ? "Ön Yazı" : "Cover Letter");
    const url = URL.createObjectURL(pdfBytesToBlob(bytes));
    const a = document.createElement("a");
    a.href = url; a.download = `${(data.name || "on-yazi").trim().replace(/\s+/g, "-").toLowerCase()}-on-yazi.pdf`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  // ── İçe aktar ──
  async function pickFile(f: File | undefined) {
    if (!f) return;
    setErr(null); setImp(null); setImpNote(null);
    setBusy("import");
    try {
      let { text, scanned } = await readCvFile(f);
      if (scanned && f.name.toLowerCase().endsWith(".pdf")) {
        setImpNote(tr ? "Taranmış belge algılandı; metin cihazınızda OCR ile okunuyor (biraz sürebilir)…" : "Scanned document detected; reading text with on-device OCR (this can take a moment)…");
        text = await ocrPdfToText(f);
      }
      if (text.trim().length < 80) throw new Error("short");
      setImpNote(tr ? "Belge metni yapay zekâya gönderilip alanlara ayrılıyor…" : "Sending the document text to AI to split it into fields…");
      const r = await callCvAi<ParsedCv>("parse", { text }, accessToken, lang);
      if (r.quota) setQuota(r.quota);
      setImp({ name: f.name.replace(/\.[^.]+$/, ""), parsed: r.result });
      setImpNote(null);
    } catch (e) {
      const ae = e as AiError;
      setImpNote(null);
      if (ae.status === 401) setErr({ msg: tr ? "Devam etmek için giriş yapın." : "Please log in to continue.", gate: "login" });
      else if (ae.status === 403) setErr({ msg: tr ? "Yapay zekâ özellikleri Pro / Business üyelere açıktır." : "AI features are for Pro / Business members.", gate: "upgrade" });
      else if (ae.status === 429) setErr({ msg: tr ? "Aylık yapay zekâ hakkınız ve krediniz bitti." : "You've used your monthly AI allowance and credits.", gate: "quota" });
      else if (ae.status) setErr({ msg: ae.message });
      else setErr({ msg: (e as Error).message === "type" ? (tr ? "Yalnızca PDF, Word (.docx) ya da metin (.txt) dosyası yükleyin." : "Upload a PDF, Word (.docx) or text (.txt) file.") : (tr ? "Belgeden yeterli metin okunamadı." : "Couldn't read enough text from the file.") });
    } finally {
      setBusy(null);
    }
  }

  if (comingSoon) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-fuchsia-400/30 bg-fuchsia-500/[0.05] p-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-fuchsia-200"><Sparkles className="h-3.5 w-3.5" />{tr ? "Çok Yakında" : "Coming Soon"}</span>
        <p className="mt-3 text-[15px] font-black text-white">{tr ? "CV Yapay Zekâ Asistanı" : "CV AI Assistant"}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-slate-300">{tr ? "Profil özeti yazma, deneyim maddelerini güçlendirme, ilana uyarlama, ön yazı ve mevcut CV'nizi belgeden içe aktarma. Hiçbir şey uydurmaz: eksik bilgiyi size sorar." : "Profile summary writing, stronger bullets, tailoring to a job ad, cover letters and importing your existing CV. It never makes things up: it asks you for what's missing."}</p>
      </div>
    );
  }

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3 border-0 p-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-300"><ShieldCheck className="h-4 w-4" />{tr ? "Adınız, e-postanız, telefonunuz ve adresiniz yapay zekâya GÖNDERİLMEZ" : "Your name, email, phone and address are NOT sent to the AI"}</p>
        {quota ? <AiCreditBadge quota={quota} language={language} onTopUp={() => setTopUpOpen(true)} /> : null}
      </div>

      <details className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] text-slate-300">
        <summary className="cursor-pointer font-semibold text-slate-200">{tr ? "Yapay zekâya tam olarak ne gidiyor?" : "Exactly what is sent to the AI?"}</summary>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950/70 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300">{aiText || (tr ? "(CV'niz henüz boş)" : "(your CV is still empty)")}</pre>
        <p className="mt-1.5 text-[11px] text-slate-500">{tr ? "İlan metni ve (ön yazıda) adınız ayrıca gider. Sağlayıcı verilerinizi model eğitiminde kullanmaz; sonuçlar sunucuda saklanmaz." : "The job ad and (for cover letters) your name are sent separately. The provider doesn't train on your data; results aren't stored on our server."}</p>
      </details>

      {err ? (
        <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3.5 py-3 text-[12.5px] text-red-200">
          {err.msg}
          {err.gate === "login" ? <button type="button" onClick={onLogin} className="ml-2 font-bold underline">{tr ? "Giriş yap" : "Log in"}</button> : null}
          {err.gate === "upgrade" ? <button type="button" onClick={onUpgrade} className="ml-2 font-bold underline">{tr ? "Planları gör" : "See plans"}</button> : null}
          {err.gate === "quota" ? <button type="button" onClick={() => setTopUpOpen(true)} className="ml-2 font-bold underline">{tr ? "Kredi al" : "Get credits"}</button> : null}
        </div>
      ) : null}

      <Card open icon={<Wand2 className="h-4 w-4" />} title={tr ? "Profil özeti yaz" : "Write a profile summary"} sub={tr ? "3 farklı öneri; yalnızca verdiğiniz bilgilerden" : "3 options, built only from what you've entered"}>
        <button type="button" className={btn} disabled={!!busy || (!data.title.trim() && !exps.length)} onClick={() => void doSummary()}>{busy === "summary" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{tr ? "Özet öner (1 hak)" : "Suggest summaries (1 credit)"}</button>
        {!data.title.trim() && !exps.length ? <p className="text-[11.5px] text-slate-500">{tr ? "Önce unvanınızı ve en az bir deneyim açıklamanızı girin." : "Enter your title and at least one job description first."}</p> : null}
        {summaries?.map((s, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <p className="text-[13px] leading-relaxed text-slate-100">{s.text}</p>
            <Added words={s.added} tr={tr} />
            <button type="button" className={`${ghost} mt-2`} onClick={() => { onChange({ ...data, summary: s.text }); setSummaries(null); }}><Check className="h-3.5 w-3.5" />{tr ? "Bunu kullan" : "Use this"}</button>
          </div>
        ))}
      </Card>

      <Card icon={<Sparkles className="h-4 w-4" />} title={tr ? "Deneyim maddelerini güçlendir" : "Strengthen job bullets"} sub={tr ? "Eylem fiili, net anlatım; rakam uydurmaz, eksik ölçüyü size sorar" : "Action verbs, clear wording; never invents numbers, asks you for missing measures"}>
        {exps.length ? (
          <>
            <select value={Math.min(expIdx, exps.length - 1)} onChange={(e) => { setExpIdx(Number(e.target.value)); setBullets(null); }} className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-[13px] text-white" aria-label={tr ? "Deneyim seç" : "Choose a job"}>
              {exps.map((e, i) => <option key={e.id} value={i}>{[e.role, e.company].filter(Boolean).join(" · ") || `#${i + 1}`}</option>)}
            </select>
            <button type="button" className={btn} disabled={!!busy} onClick={() => doBullets()}>{busy === "bullets" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{tr ? "Maddeleri güçlendir (1 hak)" : "Strengthen bullets (1 credit)"}</button>
          </>
        ) : <p className="text-[12px] text-slate-400">{tr ? "Önce bir deneyimin “Sorumluluklar ve başarılar” alanını doldurun." : "Fill in a job's “Responsibilities & achievements” first."}</p>}
        {bullets ? (
          <div className="space-y-2.5">
            {bullets.items.map((it, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <p className="text-[11.5px] text-slate-500 line-through">{it.original}</p>
                <p className="mt-1 text-[13px] font-semibold text-slate-100">{it.improved}</p>
                {it.rejectedNumber ? <p className="mt-1 text-[11.5px] text-amber-200">{tr ? "Yapay zekâ olmayan bir rakam eklemişti; reddedildi, özgün metin korundu." : "The AI had added a number you didn't give; it was rejected and your original kept."}</p> : null}
                <Added words={it.added} tr={tr} />
                {it.askMetric ? <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-sky-200"><Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />{tr ? "Rakam ekleyebilirsiniz: " : "You could add a measure: "}{it.askMetric}</p> : null}
                {it.improved !== it.original ? (
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-slate-200"><input type="checkbox" className="h-4 w-4 accent-fuchsia-500" checked={bullets.pick[i]} onChange={(e) => setBullets({ ...bullets, pick: bullets.pick.map((v, j) => (j === i ? e.target.checked : v)) })} />{tr ? "Bu değişikliği uygula" : "Apply this change"}</label>
                ) : <p className="mt-1.5 text-[11.5px] text-slate-500">{tr ? "Değişiklik önerilmedi." : "No change suggested."}</p>}
              </div>
            ))}
            <div className="flex gap-2"><button type="button" className={btn} onClick={applyBullets}><Check className="h-4 w-4" />{tr ? "Seçilenleri uygula" : "Apply selected"}</button><button type="button" className={ghost} onClick={() => setBullets(null)}>{tr ? "Vazgeç" : "Dismiss"}</button></div>
          </div>
        ) : null}
      </Card>

      <Card icon={<Target className="h-4 w-4" />} title={tr ? "İlana göre uyarla" : "Tailor to a job ad"} sub={tr ? "Mevcut CV'nizi bozmadan, ilana göre bir KOPYA hazırlar" : "Prepares a COPY for the ad without touching your CV"}>
        <textarea value={ad} onChange={(e) => setAd(e.target.value)} rows={5} placeholder={tr ? "İş ilanının metnini yapıştırın (Analiz sekmesiyle ortaktır)…" : "Paste the job ad (shared with the Analysis tab)…"} className="w-full resize-y rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-fuchsia-400/60 focus:outline-none" />
        <button type="button" className={btn} disabled={!!busy || ad.trim().length < 80 || aiText.length < 80} onClick={() => void doTailor()}>{busy === "tailor" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{tr ? "İlana uyarla (1 hak)" : "Tailor (1 credit)"}</button>
        {ad.trim().length < 80 ? <p className="text-[11.5px] text-slate-500">{tr ? "İlanın tamamını yapıştırın (en az birkaç cümle)." : "Paste the whole ad (at least a few sentences)."}</p> : null}
        {tailor ? (
          <div className="space-y-3">
            {tailor.summary ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{tr ? "Önerilen özet" : "Suggested summary"}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-100">{tailor.summary}</p>
                <Added words={tailor.summaryAdded} tr={tr} />
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-slate-200"><input type="checkbox" className="h-4 w-4 accent-fuchsia-500" checked={tailor.pickSummary} onChange={(e) => setTailor({ ...tailor, pickSummary: e.target.checked })} />{tr ? "Kopyaya uygula" : "Apply to the copy"}</label>
              </div>
            ) : null}
            {tailor.bullets.map((b, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <p className="text-[11px] text-slate-500">{b.where}</p>
                <p className="mt-0.5 text-[11.5px] text-slate-500 line-through">{b.original}</p>
                <p className="mt-1 text-[13px] font-semibold text-slate-100">{b.improved}</p>
                <p className="mt-1 text-[11.5px] text-slate-400">{b.why}</p>
                <Added words={b.added} tr={tr} />
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-slate-200"><input type="checkbox" className="h-4 w-4 accent-fuchsia-500" checked={tailor.pickBullets[i]} onChange={(e) => setTailor({ ...tailor, pickBullets: tailor.pickBullets.map((v, j) => (j === i ? e.target.checked : v)) })} />{tr ? "Kopyaya uygula" : "Apply to the copy"}</label>
              </div>
            ))}
            {tailor.emphasize.length ? <div><p className="mb-1 text-[12px] font-semibold text-emerald-300">{tr ? "CV'nizde zaten olan ve ilana uyan — öne çıkarın" : "Already in your CV and matching the ad — emphasise"}</p><div className="flex flex-wrap gap-1.5">{tailor.emphasize.map((w) => <span key={w} className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[12px] font-semibold text-emerald-100 ring-1 ring-emerald-400/25">{w}</span>)}</div></div> : null}
            {tailor.askUser.length ? (
              <div className="rounded-xl border border-sky-400/20 bg-sky-500/[0.06] p-3">
                <p className="text-[12px] font-bold text-sky-200">{tr ? "Size sorular (ilanda var, CV'nizde görünmüyor)" : "Questions for you (in the ad, not visible in your CV)"}</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12.5px] leading-relaxed text-slate-200">{tailor.askUser.map((q, i) => <li key={i}>{q}</li>)}</ul>
                <p className="mt-1.5 text-[11.5px] text-slate-400">{tr ? "Yanıtınız “evet” ise ilgili deneyimi CV'nize kendiniz ekleyin; yapay zekâ sizin yerinize bir şey eklemez." : "If the answer is “yes”, add the experience yourself; the AI never adds things for you."}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} onClick={() => { onNewCv(applyTailor(data, tailor, { summary: tailor.pickSummary, bullets: tailor.pickBullets }), position.trim() ? `${position.trim()} (${tr ? "uyarlanmış" : "tailored"})` : tr ? "İlana uyarlanmış CV" : "Tailored CV"); setTailor(null); }}><Copy className="h-4 w-4" />{tr ? "Uyarlanmış kopya oluştur" : "Create tailored copy"}</button>
              <button type="button" className={ghost} onClick={() => setTailor(null)}>{tr ? "Vazgeç" : "Dismiss"}</button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card icon={<Mail className="h-4 w-4" />} title={tr ? "Ön yazı hazırla" : "Write a cover letter"} sub={tr ? "CV'nize ve (varsa) ilana dayanır; yalnızca gerçek olguları kullanır" : "Based on your CV and (if given) the ad; uses real facts only"}>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={tr ? "Şirket (isteğe bağlı)" : "Company (optional)"} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-[13px] text-white placeholder:text-slate-500" />
          <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder={tr ? "Pozisyon (isteğe bağlı)" : "Position (optional)"} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-[13px] text-white placeholder:text-slate-500" />
        </div>
        <div role="radiogroup" aria-label={tr ? "Ton" : "Tone"} className="flex flex-wrap gap-1.5">
          {([["formal", tr ? "Resmî" : "Formal"], ["warm", tr ? "Samimi" : "Warm"], ["direct", tr ? "Kısa ve net" : "Short & direct"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={tone === k} onClick={() => setTone(k)} className={`rounded-xl px-3.5 py-2 text-[12.5px] font-semibold ${tone === k ? "bg-fuchsia-600 text-white" : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"}`}>{l}</button>
          ))}
        </div>
        <button type="button" className={btn} disabled={!!busy || aiText.length < 80} onClick={() => void doCover()}>{busy === "cover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{tr ? "Ön yazı yaz (1 hak)" : "Write letter (1 credit)"}</button>
        {cover ? (
          <div className="space-y-2.5">
            <textarea value={cover.text} onChange={(e) => setCover({ ...cover, text: e.target.value })} rows={14} className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-100" aria-label={tr ? "Ön yazı metni (düzenleyebilirsiniz)" : "Letter text (editable)"} />
            {cover.unsupported.length ? <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-amber-200"><AlertTriangle className="h-3.5 w-3.5" />{tr ? "CV'nizde bulunmayan şunlar geçiyor, kontrol edin:" : "These aren't in your CV, please check:"}{cover.unsupported.map((w) => <span key={w} className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold ring-1 ring-amber-400/25">{w}</span>)}</p> : null}
            <p className="text-[11.5px] text-slate-500">{tr ? "Bu bir taslaktır: göndermeden önce her cümlenin doğru olduğunu kontrol edin." : "This is a draft: check that every sentence is true before sending."}</p>
            <div className="flex flex-wrap gap-2"><button type="button" className={ghost} onClick={() => void copyCover()}>{copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}{copied ? (tr ? "Kopyalandı" : "Copied") : (tr ? "Kopyala" : "Copy")}</button><button type="button" className={ghost} onClick={() => void coverPdf()}><FileDown className="h-3.5 w-3.5" />{tr ? "PDF indir" : "Download PDF"}</button></div>
          </div>
        ) : null}
      </Card>

      <Card icon={<FileUp className="h-4 w-4" />} title={tr ? "Mevcut CV'nizi içe aktarın" : "Import your existing CV"} sub={tr ? "PDF, Word veya metin dosyası → alanlara otomatik ayrılır" : "PDF, Word or text file → split into fields automatically"}>
        <p className="text-[12px] leading-relaxed text-slate-400">{tr ? "Dosya cihazınızda okunur (taranmış PDF'lerde OCR ile); yalnızca metni yapay zekâya gönderilir, dosyanın kendisi gitmez. Yeni bir CV olarak eklenir; mevcut CV'niz bozulmaz." : "The file is read on your device (OCR for scans); only its text goes to the AI, never the file itself. It's added as a new CV; your current one is untouched."}</p>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" className={btn} disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{tr ? "Dosya seç (2 hak)" : "Choose a file (2 credits)"}</button>
        {impNote ? <p className="text-[12px] text-sky-200">{impNote}</p> : null}
        {imp ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-3 text-[12.5px] text-slate-100">
            <p className="font-bold text-emerald-200">{tr ? "Okundu:" : "Read:"} {imp.parsed.name || (tr ? "(ad bulunamadı)" : "(no name found)")}{imp.parsed.title ? ` — ${imp.parsed.title}` : ""}</p>
            <p className="mt-1 text-slate-300">{tr ? `${imp.parsed.experience.length} deneyim, ${imp.parsed.education.length} eğitim, ${imp.parsed.skills.length} beceri, ${imp.parsed.languages.length} dil${imp.parsed.other.length ? `, ${imp.parsed.other.length} ek bölüm` : ""}.` : `${imp.parsed.experience.length} jobs, ${imp.parsed.education.length} education, ${imp.parsed.skills.length} skills, ${imp.parsed.languages.length} languages${imp.parsed.other.length ? `, ${imp.parsed.other.length} extra section(s)` : ""}.`}</p>
            <p className="mt-1 text-[11.5px] text-slate-400">{tr ? "Eklemeden önce alanları gözden geçirin; yapay zekâ belgedeki bir bilgiyi yanlış okumuş olabilir." : "Review the fields after adding; the AI may have misread something."}</p>
            <div className="mt-2 flex gap-2"><button type="button" className={btn} onClick={() => { onNewCv(parsedToCv(imp.parsed, data), imp.name || (tr ? "İçe aktarılan CV" : "Imported CV")); setImp(null); }}><Check className="h-4 w-4" />{tr ? "Yeni CV olarak ekle" : "Add as a new CV"}</button><button type="button" className={ghost} onClick={() => setImp(null)}>{tr ? "Vazgeç" : "Dismiss"}</button></div>
          </div>
        ) : null}
      </Card>

      <p className="text-[11px] leading-relaxed text-slate-500">{tr ? "Yapay zekâ sonuçları hata içerebilir; kullanmadan önce kontrol edin. Hiçbir şey otomatik uygulanmaz: her öneriyi siz onaylarsınız." : "AI results can contain errors; check before using. Nothing is applied automatically: you approve every suggestion."}</p>
      {topUpOpen ? <TopUpModal language={language} accessToken={accessToken} isAdmin={isAdmin} bonus={quota?.bonus} onClose={() => setTopUpOpen(false)} onGranted={() => void fetchAiQuota(accessToken).then((q) => q && setQuota(q))} /> : null}
    </fieldset>
  );
}
