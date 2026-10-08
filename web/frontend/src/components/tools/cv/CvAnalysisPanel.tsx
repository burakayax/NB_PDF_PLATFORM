import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Loader2, ScanSearch, Target, XCircle } from "lucide-react";
import type { CvData } from "./cvModel";
import { atsXray, consistencyChecks, isSingleColumnLayout, matchJob, qualityChecks, scoreOf, totalExperienceYears, type Check, type Level, type XrayResult } from "./cvAnalysis";
import { buildCvPdf } from "./cvPdf";
import { extractTextItems } from "./cvXray";
import type { CvTemplate } from "./cvTemplates";

type Props = { data: CvData; tpl: CvTemplate; tr: boolean; disabled: boolean };

const icon = (l: Level) =>
  l === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : l === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> : l === "bad" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />;

function CheckList({ checks, tr }: { checks: Check[]; tr: boolean }) {
  const order: Record<Level, number> = { bad: 0, warn: 1, info: 2, ok: 3 };
  const sorted = [...checks].sort((a, b) => order[a.level] - order[b.level]);
  return (
    <ul className="space-y-2.5">
      {sorted.map((c) => (
        <li key={c.id} className="flex items-start gap-2.5 text-[13px] text-slate-200">
          {icon(c.level)}
          <span className="min-w-0">
            {tr ? c.tr : c.en}
            {c.kind === "heuristic" ? <span className="ml-1.5 rounded bg-white/[0.07] px-1.5 py-px align-middle text-[10px] font-semibold text-slate-400">{tr ? "rehber" : "guide"}</span> : null}
            {(tr ? c.fixTr : c.fixEn) && c.level !== "ok" ? <span className="mt-0.5 block text-[12px] leading-relaxed text-slate-400">{tr ? c.fixTr : c.fixEn}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, sub, children, open: o = true }: { title: string; sub?: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(o);
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03]">
        <span className="flex-1">
          <span className="block text-[14px] font-bold text-white">{title}</span>
          {sub ? <span className="block text-[11.5px] text-slate-400">{sub}</span> : null}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-white/10 px-4 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}

export function CvAnalysisPanel({ data, tpl, tr, disabled }: Props) {
  const checks = useMemo(() => [...consistencyChecks(data), ...qualityChecks(data)], [data]);
  const score = scoreOf(checks);
  const years = totalExperienceYears(data);

  // İlan eşleştirici
  const [ad, setAd] = useState("");
  const match = useMemo(() => (ad.trim().length > 30 ? matchJob(data, ad) : null), [data, ad]);

  // ATS röntgeni
  const [xray, setXray] = useState<XrayResult | null>(null);
  const [xBusy, setXBusy] = useState(false);
  const [xErr, setXErr] = useState<string | null>(null);
  const [view, setView] = useState<"stream" | "rows">("stream");

  async function runXray() {
    setXBusy(true);
    setXErr(null);
    try {
      const { bytes, pages } = await buildCvPdf(data, tpl.id, "export");
      const { items } = await extractTextItems(bytes);
      setXray(atsXray(items, data, pages));
    } catch {
      setXErr(tr ? "Röntgen çekilemedi. Sayfayı yenileyip tekrar deneyin." : "Couldn't run the X-ray. Refresh and try again.");
    } finally {
      setXBusy(false);
    }
  }

  const single = isSingleColumnLayout(tpl.layout);
  const scoreColor = score.value >= 85 ? "text-emerald-300" : score.value >= 65 ? "text-amber-300" : "text-red-300";

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3 border-0 p-0">
      <Card title={tr ? "CV sağlık raporu" : "CV health report"} sub={tr ? "Anında, cihazınızda hesaplanır" : "Instant, computed on your device"}>
        <div className="mb-3 flex items-center gap-4 rounded-xl bg-white/[0.04] p-3">
          <div className={`text-3xl font-black tabular-nums ${scoreColor}`}>{score.value}</div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white">{tr ? score.label.tr : score.label.en}</p>
            <p className="text-[11.5px] leading-relaxed text-slate-400">{tr ? "Puan bir rehberdir; gerçek bir başvuru sisteminin ya da işe alımcının puanı değildir. Her bulgu sabit puan düşer: kritik −12, uyarı −6, bilgi −1." : "The score is a guide, not a real hiring system's or recruiter's rating. Each finding deducts a fixed amount: critical −12, warning −6, info −1."}</p>
          </div>
        </div>
        {years > 0 ? <p className="mb-3 text-[12px] text-slate-400">{tr ? `Toplam deneyim (örtüşmeler tek sayılır): ${years} yıl.` : `Total experience (overlaps counted once): ${years} years.`}</p> : null}
        <CheckList checks={checks} tr={tr} />
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{tr ? "“rehber” etiketli maddeler kural/sezgi tabanlıdır; diğerleri hesapla kesin bulunur." : "Items tagged “guide” are rule/heuristic based; the others are computed exactly."}</p>
      </Card>

      <Card title={tr ? "İlana göre eşleştir" : "Match to a job ad"} sub={tr ? "İlan metnini yapıştırın; CV'nizde neyin eksik olduğunu görün" : "Paste the ad; see what's missing from your CV"}>
        <textarea value={ad} onChange={(e) => setAd(e.target.value)} rows={6} placeholder={tr ? "İş ilanının metnini buraya yapıştırın…" : "Paste the job ad text here…"} className="w-full resize-y rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-[13px] leading-relaxed text-white placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/20" />
        <p className="mt-1.5 text-[11px] text-slate-500">{tr ? "İlan metni bu cihazda işlenir; hiçbir yere gönderilmez." : "The ad is processed on this device and sent nowhere."}</p>
        {match ? (
          <div className="mt-3 space-y-3">
            <div>
              <div className="flex items-baseline justify-between"><span className="text-[12.5px] font-semibold text-slate-200">{tr ? "Anahtar kelime eşleşmesi" : "Keyword match"}</span><span className="text-lg font-black tabular-nums text-white">%{match.score}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: `${match.score}%` }} /></div>
            </div>
            {match.yearsAsked !== null ? (
              <p className="text-[12.5px] text-slate-300">{tr ? `İlan yaklaşık ${match.yearsAsked} yıl deneyim istiyor; CV'nizde ${match.yearsHave} yıl görünüyor.` : `The ad asks for about ${match.yearsAsked} years; your CV shows ${match.yearsHave}.`} {match.yearsHave >= match.yearsAsked ? "✓" : ""}</p>
            ) : null}
            {match.titleHit !== null ? (
              <p className="text-[12.5px] text-slate-300">{match.titleHit ? (tr ? "✓ İlanın unvanıyla CV'nizdeki unvan/son rol örtüşüyor." : "✓ The ad's title overlaps your title/latest role.") : (tr ? "İlanın unvanı CV'nizdeki unvan ya da son rolle örtüşmüyor; hedef unvanı ilana yakın yazmayı düşünün (doğruysa)." : "The ad's title doesn't overlap your title or latest role; consider wording your target title closer to the ad (if accurate).")}</p>
            ) : null}
            {match.missing.length ? (
              <div>
                <p className="mb-1.5 text-[12px] font-semibold text-amber-300">{tr ? `CV'nizde bulunamayanlar (${match.missing.length})` : `Not found in your CV (${match.missing.length})`}</p>
                <div className="flex flex-wrap gap-1.5">{match.missing.map((k) => <span key={k.term} className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${k.hard ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/30" : "bg-white/[0.07] text-slate-200"}`}>{k.term}</span>)}</div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-slate-400">{tr ? "Yalnızca gerçekten sahip olduğunuz beceri ve deneyimleri ekleyin: Beceriler bölümüne ya da ilgili iş maddesine. Sahip olmadığınız bir şeyi yazmak mülakatta geri döner." : "Only add skills and experience you really have: in Skills or the relevant job bullet. Claiming something you don't have comes back at the interview."}</p>
              </div>
            ) : (
              <p className="text-[12.5px] font-semibold text-emerald-300">{tr ? "İlandaki önemli anahtar kelimelerin hepsi CV'nizde var." : "Every key term from the ad appears in your CV."}</p>
            )}
            {match.matched.length ? (
              <div>
                <p className="mb-1.5 text-[12px] font-semibold text-emerald-300">{tr ? `Eşleşenler (${match.matched.length})` : `Matched (${match.matched.length})`}</p>
                <div className="flex flex-wrap gap-1.5">{match.matched.map((k) => <span key={k.term} className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[12px] font-semibold text-emerald-100 ring-1 ring-emerald-400/25">{k.term}</span>)}</div>
              </div>
            ) : null}
            <p className="text-[11px] leading-relaxed text-slate-500">{tr ? "Eşleştirme yaklaşıktır: Türkçe eklerden dolayı kelimeler gövdeye göre karşılaştırılır. Sonuçlar, bir başvuru sisteminin gerçek puanı değildir." : "Matching is approximate: Turkish suffixes mean words are compared by stem. Results are not a real hiring-system score."}</p>
          </div>
        ) : null}
      </Card>

      <Card title={tr ? "ATS röntgeni — makine bu CV'yi nasıl okur?" : "ATS X-ray — how a machine reads this CV"} sub={tr ? "İndireceğiniz PDF'ten gerçekten çıkarılan metin" : "The text actually extracted from the PDF you'd download"} open={false}>
        <div className={`mb-3 rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed ${single ? "bg-emerald-500/[0.08] text-emerald-100 ring-1 ring-emerald-400/20" : "bg-amber-500/[0.08] text-amber-100 ring-1 ring-amber-400/20"}`}>
          {single ? (tr ? "Bu şablon tek sütunlu: başvuru sistemlerinin okuması için en güvenli düzen." : "This template is single-column: the safest layout for hiring systems.") : (tr ? "Bu şablon çok sütunlu. Çoğu sistem sorunsuz okur; bazıları sütunları karıştırabilir. En güvenlisi tek sütunlu şablonlardır (Sade, Net, Klasik Serif, Zarif, Zaman Çizgisi, Akademik)." : "This template has several columns. Most systems cope; some may interleave columns. Single-column templates (Plain, Clean, Classic Serif, Elegant, Timeline, Academic) are safest.")}
        </div>
        <button type="button" onClick={() => void runXray()} disabled={xBusy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3 text-[14px] font-bold text-white hover:brightness-110 disabled:opacity-50">
          {xBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}{tr ? "PDF'i oluştur ve röntgenini çek" : "Build the PDF and X-ray it"}
        </button>
        {xErr ? <p className="mt-2 text-[12.5px] text-red-300">{xErr}</p> : null}
        {xray ? (
          <div className="mt-4 space-y-3">
            <CheckList checks={xray.checks} tr={tr} />
            <div>
              <div className="mb-1.5 flex gap-1.5" role="tablist">
                {(["stream", "rows"] as const).map((v) => (
                  <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${view === v ? "bg-sky-500 text-white" : "bg-white/[0.07] text-slate-300"}`}>{v === "stream" ? (tr ? "Akış sırası (çoğu sistem)" : "Stream order (most systems)") : (tr ? "Satır satır (bazı sistemler)" : "Row by row (some systems)")}</button>
                ))}
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950/70 p-3 font-mono text-[11.5px] leading-relaxed text-slate-300">{(view === "stream" ? xray.streamLines : xray.rowLines).map((l, i) => `${String(i + 1).padStart(2, "0")}  ${l}`).join("\n")}</pre>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{tr ? "Bu, PDF'in metin katmanından okunan ham veridir (pdf.js). Gerçek bir başvuru sistemi değildir; sistemler kendi kurallarıyla ayrıştırır. Sayfa sayısı: " : "This is the raw data read from the PDF's text layer (pdf.js). It is not a real hiring system; systems apply their own rules. Pages: "}{xray.pages}</p>
            </div>
          </div>
        ) : null}
      </Card>
      <div className="flex items-center gap-2 text-[11px] text-slate-500"><Target className="h-3.5 w-3.5" />{tr ? "Analizler tamamen cihazınızda çalışır; CV'niz hiçbir yere gönderilmez." : "All analysis runs on your device; your CV is sent nowhere."}</div>
    </fieldset>
  );
}
