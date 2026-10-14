import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { consistencyChecks, qualityChecks, type Check } from "./cvAnalysis";
import { cvStrength } from "./cvScore";
import { isCvEmpty, type CvData } from "./cvModel";
import { collectFieldIssues } from "./cvValidate";
import { hasPlaceholders } from "./cvPhrases";

type Row = { key: string; text: string; bad: boolean };

/** Formun yanında canlı "CV gücü" göstergesi: puan halkası + en önemli 3 öneri. Tamamı cihazda. */
export function CvLiveScore({ data, tr, onDetails }: { data: CvData; tr: boolean; onDetails: () => void }) {
  const { score, rows, empty } = useMemo(() => {
    const checks: Check[] = [...consistencyChecks(data), ...qualityChecks(data)];
    const sc = cvStrength(data);
    const list: Row[] = [];
    for (const f of collectFieldIssues(data)) list.push({ key: f.id, text: tr ? f.tr : f.en, bad: true });
    if (hasPlaceholders(data)) list.push({ key: "ph", text: tr ? "Hazır cümlelerdeki [X] yerlerine kendi rakamlarınızı yazın." : "Replace the [X] placeholders with your own numbers.", bad: true });
    for (const m of sc.missing.slice(0, 3)) list.push({ key: `m-${m.id}`, text: tr ? m.tr : m.en, bad: false });
    const order = (c: Check) => (c.level === "bad" ? 0 : c.level === "warn" ? 1 : 2);
    for (const c of checks.filter((x) => x.level === "bad" || x.level === "warn").sort((a, b) => order(a) - order(b))) {
      list.push({ key: c.id, text: (tr ? c.fixTr : c.fixEn) || (tr ? c.tr : c.en), bad: c.level === "bad" });
    }
    return { score: sc, rows: list.slice(0, 4), empty: isCvEmpty(data) };
  }, [data, tr]);

  const v = empty ? 0 : score.value;
  const tone = empty ? "#64748b" : v >= 85 ? "#34d399" : v >= 65 ? "#38bdf8" : "#fbbf24";
  const R = 22, C = 2 * Math.PI * R;
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-3.5">
      <div className="flex items-center gap-3.5">
        <div className="relative h-14 w-14 shrink-0" role="img" aria-label={tr ? `CV gücü yüzde ${v}` : `CV strength ${v} percent`}>
          <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
            <circle cx="28" cy="28" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
            <circle cx="28" cy="28" r={R} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} style={{ transition: "stroke-dashoffset .5s ease, stroke .3s" }} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[14px] font-black text-white">{empty ? "–" : v}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-white">{tr ? "CV gücü" : "CV strength"}{!empty ? <span className="ml-2 text-[12px] font-semibold" style={{ color: tone }}>{tr ? score.label.tr : score.label.en}</span> : null}</p>
          <p className="text-[12px] leading-snug text-slate-400">{empty ? (tr ? "Bilgilerinizi girdikçe puanınız canlı olarak yükselir." : "Your score rises live as you fill in your details.") : rows.length ? (tr ? "Puanı yükseltmek için şunlara bakın:" : "To raise your score, look at:") : (tr ? "Harika! Belirgin bir eksik görünmüyor." : "Great! No obvious gaps.")}</p>
        </div>
        <button type="button" onClick={onDetails} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-sky-300 hover:bg-white/10">{tr ? "Ayrıntı" : "Details"}<ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
      {!empty && rows.length ? (
        <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
          {rows.map((r) => (
            <li key={r.key} className="flex items-start gap-2 text-[12.5px] leading-snug text-slate-200">
              {r.bad ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />}
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
