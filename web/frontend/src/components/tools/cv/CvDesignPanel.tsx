import type { ReactNode } from "react";
import type { CvData, CvDateFormat, CvDensity, CvFont, CvHeadingStyle, CvLang, CvPhotoShape, CvSettings, CvSize } from "./cvModel";
import { FONT_CSS } from "./cvTemplates";
import { ACCENTS } from "./CvForm";

type Props = { data: CvData; onChange: (d: CvData) => void; disabled: boolean; tr: boolean };

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-slate-300">{title}</h3>
      {hint ? <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Seg<T extends string>({ value, options, onPick, label }: { value: T; options: { v: T; label: string; style?: React.CSSProperties }[]; onPick: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onPick(o.v)} style={o.style} className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition ${value === o.v ? "bg-sky-500 text-white" : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] hover:text-white"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CvDesignPanel({ data, onChange, disabled, tr }: Props) {
  const st = data.settings;
  const set = <K extends keyof CvSettings>(k: K, v: CvSettings[K]) => onChange({ ...data, settings: { ...st, [k]: v } });
  const fontOpts: { v: CvFont | "tpl"; label: string; family?: string }[] = [
    { v: "tpl", label: tr ? "Şablonun yazı tipi" : "Template font" },
    { v: "carlito", label: "Carlito", family: FONT_CSS.carlito },
    { v: "arial", label: "Arial", family: FONT_CSS.arial },
    { v: "caladea", label: "Cambria", family: FONT_CSS.caladea },
    { v: "gelasio", label: "Georgia", family: FONT_CSS.gelasio },
    { v: "times", label: "Times", family: FONT_CSS.times },
  ];
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3 border-0 p-0">
      <Group title={tr ? "Yazı tipi" : "Typeface"} hint={tr ? "Seçtiğiniz yazı tipi PDF'e gömülür; Türkçe karakterlerin hepsi desteklenir." : "The chosen typeface is embedded in the PDF with full Turkish character support."}>
        <Seg label={tr ? "Yazı tipi" : "Typeface"} value={(st.font ?? "tpl") as CvFont | "tpl"} onPick={(v) => set("font", v === "tpl" ? null : v)} options={fontOpts.map((o) => ({ v: o.v, label: o.label, style: o.family ? { fontFamily: `'${o.family}'` } : undefined }))} />
      </Group>

      <Group title={tr ? "Boyut ve yoğunluk" : "Size & density"}>
        <div className="space-y-3">
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-300">{tr ? "Yazı boyutu" : "Text size"}</span>
            <Seg<CvSize> label={tr ? "Yazı boyutu" : "Text size"} value={st.size} onPick={(v) => set("size", v)} options={[{ v: "s", label: tr ? "Küçük" : "Small" }, { v: "m", label: tr ? "Normal" : "Normal" }, { v: "l", label: tr ? "Büyük" : "Large" }]} />
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-300">{tr ? "Boşluklar" : "Spacing"}</span>
            <Seg<CvDensity> label={tr ? "Boşluklar" : "Spacing"} value={st.density} onPick={(v) => set("density", v)} options={[{ v: "compact", label: tr ? "Sıkı" : "Tight" }, { v: "normal", label: tr ? "Normal" : "Normal" }, { v: "airy", label: tr ? "Ferah" : "Airy" }]} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sky-400/20 bg-sky-500/[0.05] px-3 py-3">
            <input type="checkbox" checked={st.fitOnePage} onChange={(e) => set("fitOnePage", e.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-400" />
            <span className="text-[13px] text-slate-100">
              {tr ? "Tek sayfaya sığdır" : "Fit on one page"}
              <span className="block text-[11.5px] text-slate-400">{tr ? "İçerik taşarsa yazı ve boşluklar, okunaklılığı bozmayacak sınıra kadar kademeli küçülür. Hâlâ sığmıyorsa içeriği kısaltmanız önerilir." : "If the content overflows, type and spacing shrink step by step down to a readable limit. If it still doesn't fit, shorten the content."}</span>
            </span>
          </label>
        </div>
      </Group>

      <Group title={tr ? "Renk" : "Colour"}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label={tr ? "Şablonun kendi rengi" : "Template colour"} onClick={() => set("accent", null)} className={`flex h-8 items-center rounded-full px-3 text-[11px] font-semibold ${st.accent === null ? "bg-sky-500 text-white" : "bg-white/[0.08] text-slate-300"}`}>{tr ? "Şablonun rengi" : "Default"}</button>
          {ACCENTS.map((c) => (
            <button key={c} type="button" aria-label={c} onClick={() => set("accent", c)} className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 ${st.accent === c ? "ring-sky-300" : "ring-transparent"}`} style={{ background: c }} />
          ))}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1 text-[11px] font-semibold text-slate-300">
            {tr ? "Özel" : "Custom"}
            <input type="color" value={st.accent ?? "#1d4ed8"} onChange={(e) => set("accent", e.target.value)} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
          </label>
        </div>
      </Group>

      <Group title={tr ? "Başlık biçimi" : "Heading style"}>
        <Seg<CvHeadingStyle | "tpl"> label={tr ? "Başlık biçimi" : "Heading style"} value={st.headingStyle ?? "tpl"} onPick={(v) => set("headingStyle", v === "tpl" ? null : v)}
          options={[{ v: "tpl", label: tr ? "Şablonun" : "Template" }, { v: "rule", label: tr ? "Alt çizgi" : "Underline" }, { v: "bar", label: tr ? "Sol çizgi" : "Side bar" }, { v: "caps", label: tr ? "İnce çizgi" : "Fine rule" }, { v: "dot", label: tr ? "Kare işaret" : "Marker" }, { v: "boxed", label: tr ? "Kutulu" : "Boxed" }]} />
      </Group>

      <Group title={tr ? "Fotoğraf biçimi" : "Photo shape"}>
        <Seg<CvPhotoShape | "tpl"> label={tr ? "Fotoğraf biçimi" : "Photo shape"} value={st.photoShape ?? "tpl"} onPick={(v) => set("photoShape", v === "tpl" ? null : v)}
          options={[{ v: "tpl", label: tr ? "Şablonun" : "Template" }, { v: "circle", label: tr ? "Yuvarlak" : "Round" }, { v: "rounded", label: tr ? "Yumuşak köşe" : "Rounded" }, { v: "rect", label: tr ? "Dikdörtgen" : "Rectangle" }]} />
      </Group>

      <Group title={tr ? "Dil ve tarih" : "Language & dates"}>
        <div className="space-y-3">
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-300">{tr ? "CV dili (başlıklar ve tarihler)" : "CV language (headings and dates)"}</span>
            <Seg<CvLang> label={tr ? "CV dili" : "CV language"} value={st.lang} onPick={(v) => set("lang", v)} options={[{ v: "tr", label: "Türkçe" }, { v: "en", label: "English" }]} />
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-300">{tr ? "Tarih biçimi" : "Date format"}</span>
            <Seg<CvDateFormat> label={tr ? "Tarih biçimi" : "Date format"} value={st.dateFormat} onPick={(v) => set("dateFormat", v)} options={[{ v: "mon", label: tr ? "Mar 2020" : "Mar 2020" }, { v: "num", label: "03.2020" }, { v: "year", label: tr ? "2020" : "2020" }]} />
          </div>
        </div>
      </Group>
    </fieldset>
  );
}
