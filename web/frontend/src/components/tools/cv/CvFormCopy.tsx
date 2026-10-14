import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { LABELS, type CvData } from "./cvModel";

type Item = { label: string; value: string };

function fmt(ym: string, tr: boolean, present?: boolean): string {
  if (present) return tr ? "Devam ediyor" : "Present";
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
}

/** Kariyer.net / İşkur / şirket başvuru formlarını doldururken alan alan kopyalama görünümü. */
export function CvFormCopy({ data, tr, onClose }: { data: CvData; tr: boolean; onClose: () => void }) {
  const [done, setDone] = useState<string | null>(null);
  const L = LABELS[data.settings.lang];
  const groups: { title: string; items: Item[] }[] = [
    { title: tr ? "Kişisel" : "Personal", items: [
      { label: tr ? "Ad soyad" : "Full name", value: data.name }, { label: tr ? "Unvan" : "Title", value: data.title }, { label: tr ? "E-posta" : "Email", value: data.email },
      { label: tr ? "Telefon" : "Phone", value: data.phone }, { label: tr ? "Şehir" : "City", value: data.city }, { label: "LinkedIn", value: data.linkedin }, { label: tr ? "Web sitesi" : "Website", value: data.website },
    ] },
    { title: L.profile, items: [{ label: L.profile, value: data.summary }] },
    ...data.experience.map((e, i) => ({ title: `${L.experience} ${i + 1}`, items: [
      { label: tr ? "Pozisyon" : "Job title", value: e.role }, { label: tr ? "Şirket" : "Company", value: e.company }, { label: tr ? "Şehir" : "Location", value: e.location },
      { label: tr ? "Başlangıç" : "Start", value: fmt(e.start, tr) }, { label: tr ? "Bitiş" : "End", value: fmt(e.end, tr, e.current) },
      { label: tr ? "Açıklama" : "Description", value: e.desc.split("\n").map((x) => x.trim()).filter(Boolean).join("\n") },
    ] })),
    ...data.education.map((e, i) => ({ title: `${L.education} ${i + 1}`, items: [
      { label: tr ? "Okul" : "School", value: e.school }, { label: tr ? "Bölüm / derece" : "Degree", value: e.degree },
      { label: tr ? "Başlangıç" : "Start", value: fmt(e.start, tr) }, { label: tr ? "Bitiş" : "End", value: fmt(e.end, tr, e.current) },
    ] })),
    { title: L.skills, items: [{ label: L.skills, value: data.skills.map((s) => s.name.trim()).filter(Boolean).join(", ") }] },
    { title: L.languages, items: [{ label: L.languages, value: data.languages.filter((l) => l.name.trim()).map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(", ") }] },
  ];
  async function copy(key: string, v: string) {
    try { await navigator.clipboard.writeText(v); setDone(key); setTimeout(() => setDone((d) => (d === key ? null : d)), 1500); } catch { /* panoya yazılamadı */ }
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label={tr ? "Başvuru formuna kopyala" : "Copy to application form"}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-slate-900 p-5 ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-black text-white">{tr ? "Başvuru formuna kopyala" : "Copy to application form"}</h3>
            <p className="mt-1 text-[12.5px] text-slate-400">{tr ? "Kariyer.net, İşkur ya da şirket sitelerinde form doldururken: her alanın yanındaki düğmeyle kopyalayıp yapıştırın." : "When filling in a job-site form, copy each field with its button and paste it in."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={tr ? "Kapat" : "Close"} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-4">
          {groups.map((g, gi) => {
            const items = g.items.filter((x) => x.value.trim());
            if (!items.length) return null;
            return (
              <section key={gi}>
                <h4 className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wider text-sky-300/90">{g.title}</h4>
                <ul className="space-y-1.5">
                  {items.map((it, ii) => {
                    const key = `${gi}-${ii}`;
                    return (
                      <li key={key} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="min-w-0 flex-1"><p className="text-[11px] text-slate-500">{it.label}</p><p className="whitespace-pre-wrap break-words text-[13px] text-slate-100">{it.value}</p></div>
                        <button type="button" onClick={() => void copy(key, it.value)} aria-label={tr ? `${it.label} kopyala` : `Copy ${it.label}`} className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-white/15">
                          {done === key ? <><Check className="h-3.5 w-3.5 text-emerald-300" />{tr ? "Kopyalandı" : "Copied"}</> : <><Copy className="h-3.5 w-3.5" />{tr ? "Kopyala" : "Copy"}</>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
