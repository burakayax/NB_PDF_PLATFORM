import { useMemo, useState } from "react";
import { Check, ChevronDown, Lightbulb, Plus } from "lucide-react";
import { matchProfession, PROFESSIONS, professionById, type Profession } from "./cvPhrases";
import type { CvLang } from "./cvModel";

type Common = { tr: boolean; lang: CvLang; hint: string };

function useProfession(hint: string) {
  const auto = useMemo(() => matchProfession(hint), [hint]);
  const [pick, setPick] = useState<string>("");
  const prof: Profession = (pick && professionById(pick)) || auto || PROFESSIONS[PROFESSIONS.length - 1];
  return { prof, auto, pick, setPick };
}

function ProfSelect({ tr, value, auto, onChange }: { tr: boolean; value: string; auto: Profession | null; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11.5px] text-slate-400">
      <span>{tr ? "Meslek:" : "Field:"}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 text-[12px] text-white">
        <option value="">{auto ? (tr ? `Otomatik: ${auto.label.tr}` : `Auto: ${auto.label.en}`) : (tr ? "Otomatik (genel)" : "Auto (general)")}</option>
        {PROFESSIONS.map((p) => <option key={p.id} value={p.id}>{tr ? p.label.tr : p.label.en}</option>)}
      </select>
    </label>
  );
}

function Shell({ tr, title, sub, children }: { tr: boolean; title: string; sub: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-400/[0.07] to-transparent">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-300/15 text-amber-200"><Lightbulb className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-amber-50">{title}</span><span className="block truncate text-[11px] text-amber-100/60">{sub}</span></span>
        <ChevronDown className={`h-4 w-4 text-amber-200/70 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="space-y-2.5 border-t border-amber-300/15 px-3 pb-3 pt-2.5">{children}</div> : null}
      <span className="sr-only">{tr ? "Öneriler" : "Suggestions"}</span>
    </div>
  );
}

const chip = "flex w-full items-start gap-2 rounded-lg border border-white/10 bg-slate-950/40 px-2.5 py-2 text-left text-[12.5px] leading-snug text-slate-100 transition hover:border-amber-300/40 hover:bg-amber-300/[0.07] disabled:opacity-50";

/** İş deneyimi açıklaması için hazır maddeler. Tıklayınca satır olarak eklenir. */
export function BulletPicker({ tr, lang, hint, current, onAdd }: Common & { current: string; onAdd: (line: string) => void }) {
  const { prof, auto, pick, setPick } = useProfession(hint);
  const have = new Set(current.split("\n").map((l) => l.trim()));
  return (
    <Shell tr={tr} title={tr ? "Hazır cümleler" : "Ready-made phrases"} sub={tr ? "Tıklayın, satıra eklensin; [X] gördüğünüz yere kendi sayınızı yazın" : "Tap to add; type your own number where you see [X]"}>
      <ProfSelect tr={tr} value={pick} auto={auto} onChange={setPick} />
      <ul className="space-y-1.5">
        {prof.bullets[lang].map((b) => {
          const used = have.has(b);
          return (
            <li key={b}>
              <button type="button" disabled={used} onClick={() => onAdd(b)} className={chip}>
                {used ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /> : <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" />}
                <span>{b}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-amber-100/60">{tr ? "Yalnızca gerçekten yaptığınız işleri ekleyin. [X] yerine kendi sayınızı yazın (ör. 50); bilmiyorsanız o kısmı silin. Hâlâ çalıştığınız bir işse cümleleri şimdiki zamana çevirin (“hazırladım” yerine “hazırlıyorum”)." : "Only add what you actually did. Replace [X] with your own number (e.g. 50), or delete that part if you don't know it. For a current job, switch the verbs to present tense."}</p>
    </Shell>
  );
}

/** Profil özeti için hazır taslaklar. */
export function SummaryPicker({ tr, lang, hint, onPick }: Common & { onPick: (text: string) => void }) {
  const { prof, auto, pick, setPick } = useProfession(hint);
  return (
    <Shell tr={tr} title={tr ? "Özet taslakları" : "Summary drafts"} sub={tr ? "Birini seçip kendinize göre düzenleyin" : "Pick one and make it yours"}>
      <ProfSelect tr={tr} value={pick} auto={auto} onChange={setPick} />
      <ul className="space-y-1.5">
        {prof.summary[lang].map((s) => (
          <li key={s}><button type="button" onClick={() => onPick(s)} className={chip}><Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" /><span>{s}</span></button></li>
        ))}
      </ul>
    </Shell>
  );
}

/** Beceri önerileri (tıkla-ekle). */
export function SkillPicker({ tr, lang, hint, have, onAdd }: Common & { have: string[]; onAdd: (name: string) => void }) {
  const { prof, auto, pick, setPick } = useProfession(hint);
  const lower = new Set(have.map((h) => h.trim().toLocaleLowerCase("tr")));
  return (
    <Shell tr={tr} title={tr ? "Beceri önerileri" : "Skill suggestions"} sub={tr ? "Sizde olanlara tıklayın" : "Tap the ones you have"}>
      <ProfSelect tr={tr} value={pick} auto={auto} onChange={setPick} />
      <div className="flex flex-wrap gap-1.5">
        {prof.skills[lang].map((s) => {
          const used = lower.has(s.toLocaleLowerCase("tr"));
          return (
            <button key={s} type="button" disabled={used} onClick={() => onAdd(s)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${used ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/15 bg-white/[0.05] text-slate-100 hover:border-amber-300/50 hover:bg-amber-300/10"}`}>
              {used ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 text-amber-200" />}{s}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}
