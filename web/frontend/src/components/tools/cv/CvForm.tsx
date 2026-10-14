import { useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Briefcase,
  ChevronDown,
  Award,
  FolderGit2,
  GraduationCap,
  Heart,
  ImagePlus,
  Languages,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Wrench,
  FileText,
  Camera,
  Layers,
  Lock,
  ListOrdered,
  AlertCircle,
  AlignLeft,
  List,
  Tags,
  LayoutGrid,
} from "lucide-react";
import {
  LANG_LEVELS,
  uid,
  type SectionKey,
  type CvCustomItem,
  type CvCustomSection,
  type CvCustomStyle,
  type CvCert,
  type CvData,
  type CvEducation,
  type CvExperience,
  type CvLanguageItem,
  type CvPhoto,
  type CvProject,
  type CvReference,
  type CvSkill,
  type CvSocial,
  EDU_HONORS,
  EDU_LEVELS,
  GPA_SCALES,
  SOCIAL_KINDS,
} from "./cvModel";
import { bakePhoto, type CvTemplate } from "./cvTemplates";
import { useEffect } from "react";
import { CvPhotoPrep } from "./CvPhotoPrep";
import { BulletPicker, SkillPicker, SummaryPicker } from "./CvPhrasePicker";
import { dateOrderIssue, emailIssue, linkIssue, phoneIssue } from "./cvValidate";
import { SuggestInput } from "./CvSuggestInput";
import { CvSectionManager } from "./CvSectionManager";
import { suggestLanguages, suggestSkills, suggestTitles } from "./cvVocabulary";
import { MonthField, PhoneField, inputCls } from "./CvFields";

export { inputCls };

type Props = {
  data: CvData;
  /** AI araçlarıyla aynı "Çok Yakında" kilidi: fotoğrafı AI ile hazırla düğmesini kapatır. */
  aiComingSoon?: boolean;
  /** Fotoğraf yapay zekâsı yalnızca ücretli üyelere açık; true ise düğme kilitli görünür. */
  aiLocked?: boolean;
  onAiLocked?: () => void;
  onChange: (next: CvData) => void;
  tpl: CvTemplate;
  disabled: boolean;
  tr: boolean;
};

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-slate-300">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Text({ label, value, onChange, placeholder, type = "text", disabled, hint, autoComplete, error, suggest, tr }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean; hint?: string; autoComplete?: string; error?: string | null; suggest?: (q: string) => string[]; tr?: boolean }) {
  if (type === "month") return <MonthField label={label} value={value} onChange={onChange} tr={tr ?? true} disabled={disabled} error={error} hint={hint} />;
  return (
    <Field label={label} hint={error ? undefined : hint}>
      {suggest ? (
        <SuggestInput value={value} onChange={onChange} suggest={suggest} placeholder={placeholder} disabled={disabled} tr={tr ?? true} className={inputCls} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} autoComplete={autoComplete} aria-invalid={error ? true : undefined} className={`${inputCls} ${error ? "!border-amber-400/60 !ring-2 !ring-amber-400/20" : ""}`} />
      )}
      {error ? <span className="mt-1 flex items-start gap-1 text-[11.5px] font-medium text-amber-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</span> : null}
    </Field>
  );
}

export function Area({ label, value, onChange, placeholder, rows = 4, disabled, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled} className={`${inputCls} resize-y leading-relaxed`} />
    </Field>
  );
}

export function Accordion({ title, icon, defaultOpen, count, children }: { title: string; icon: ReactNode; defaultOpen?: boolean; count?: number; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03]">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">{icon}</span>
        <span className="flex-1 text-[14px] font-bold text-white">{title}</span>
        {count ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-300">{count}</span> : null}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}

export function ItemCard({ children, onUp, onDown, onRemove, tr, first, last }: { children: ReactNode; onUp: () => void; onDown: () => void; onRemove: () => void; tr: boolean; first: boolean; last: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="space-y-3">{children}</div>
      <div className="mt-3 flex items-center justify-end gap-1 border-t border-white/5 pt-2">
        <button type="button" disabled={first} onClick={onUp} aria-label={tr ? "Yukarı taşı" : "Move up"} className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
        <button type="button" disabled={last} onClick={onDown} aria-label={tr ? "Aşağı taşı" : "Move down"} className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-semibold text-red-300 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />{tr ? "Sil" : "Delete"}</button>
      </div>
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-400/40 bg-sky-500/[0.05] px-3 py-2.5 text-[13px] font-semibold text-sky-200 hover:bg-sky-500/10">
      <Plus className="h-4 w-4" />
      {label}
    </button>
  );
}

export function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function patch<T extends { id: string }>(arr: T[], id: string, p: Partial<T>): T[] {
  return arr.map((x) => (x.id === id ? { ...x, ...p } : x));
}

/** Fotoğrafı yükler, EXIF yönünü uygular, en çok 900 px'e küçültür. */
async function readPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.9);
}

function PhotoCropper({ photo, tpl, onChange, disabled, tr }: { photo: CvPhoto; tpl: CvTemplate; onChange: (p: CvPhoto) => void; disabled: boolean; tr: boolean }) {
  const { w, h, shape } = tpl.theme.photo;
  const boxW = 150;
  const boxH = Math.round((150 * h) / w);
  const [url, setUrl] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let live = true;
    void bakePhoto(photo, boxW, boxH, shape).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [photo, boxH, shape]);
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return (
    <div className="flex items-start gap-4">
      <div
        className="relative shrink-0 cursor-grab touch-none overflow-hidden bg-slate-800 ring-1 ring-white/15 active:cursor-grabbing"
        style={{ width: boxW, height: boxH, borderRadius: shape === "circle" ? "50%" : shape === "rounded" ? 14 : 4 }}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
          drag.current = { x: e.clientX, y: e.clientY };
          const k = 1 / (boxW * 0.45 * Math.max(1, photo.zoom));
          onChange({ ...photo, x: clamp(photo.x + dx * k * 2), y: clamp(photo.y + dy * k * 2) });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        {url ? <img src={url} alt="" draggable={false} className="h-full w-full select-none" /> : null}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-[11.5px] leading-relaxed text-slate-400">{tr ? "Fotoğrafı sürükleyerek kaydırın, yakınlaştırmak için çubuğu kullanın." : "Drag the photo to reposition and use the slider to zoom."}</p>
        <label className="block text-[12px] text-slate-300">{tr ? "Yakınlaştır" : "Zoom"}
          <input type="range" min={1} max={3} step={0.02} value={photo.zoom} disabled={disabled} onChange={(e) => onChange({ ...photo, zoom: Number(e.target.value) })} className="mt-1 w-full accent-sky-400" />
        </label>
      </div>
    </div>
  );
}


/** Fotoğraf alanı: büyük "Fotoğraf ekle" düğmesi → yüklenince kadraj ayarı. Sihirbaz da bunu kullanır. */
export function PhotoField({ data, onChange, tpl, disabled, tr, aiComingSoon, aiLocked, onAiLocked }: { data: CvData; onChange: (d: CvData) => void; tpl: CvTemplate; disabled: boolean; tr: boolean; aiComingSoon?: boolean; aiLocked?: boolean; onAiLocked?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  const set = <K extends keyof CvData>(k: K, v: CvData[K]) => onChange({ ...data, [k]: v });

  async function pickPhoto(f: File | undefined) {
    if (!f) return;
    setPhotoErr(null);
    try {
      const src = await readPhoto(f);
      // Tek seferde yaz: iki ayrı set() eski "data" üzerinden çalışıp fotoğrafı geri siliyordu
      onChange({ ...data, photo: { src, zoom: 1, x: 0, y: 0 }, showPhoto: true });
    } catch {
      setPhotoErr(tr ? "Bu fotoğraf açılamadı. JPG veya PNG deneyin." : "This photo couldn't be opened. Try a JPG or PNG.");
    }
  }
  const inputs = (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={camRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );
  const camBtn = "hidden items-center gap-2 rounded-xl bg-white/[0.06] px-3.5 py-2 text-[13px] font-semibold text-slate-100 ring-1 ring-white/15 hover:bg-white/10 [@media(pointer:coarse)]:inline-flex";
  return (
    <div className="space-y-2">
      {inputs}
      {data.photo && data.showPhoto ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <PhotoCropper photo={data.photo} tpl={tpl} disabled={disabled} tr={tr} onChange={(p) => set("photo", p)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-3.5 py-2 text-[13px] font-semibold text-sky-100 ring-1 ring-sky-400/30 hover:bg-sky-500/25"><ImagePlus className="h-4 w-4" />{tr ? "Değiştir" : "Change"}</button>
            <button type="button" onClick={() => camRef.current?.click()} className={camBtn}><Camera className="h-4 w-4" />{tr ? "Kamerayla çek" : "Take a photo"}</button>
            {aiLocked || !aiComingSoon ? (
              aiLocked ? (
                <button type="button" onClick={onAiLocked} title={tr ? "Pro üyelere özel" : "Pro members only"} className="inline-flex items-center gap-2 rounded-xl bg-amber-400/10 px-3.5 py-2 text-[13px] font-semibold text-amber-100 ring-1 ring-amber-300/30 hover:bg-amber-400/20"><Lock className="h-4 w-4" />{tr ? "AI ile hazırla" : "Prepare with AI"}<span className="rounded-full bg-amber-300/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">PRO</span></button>
              ) : (
                <button type="button" onClick={() => setPrepOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-500/15 px-3.5 py-2 text-[13px] font-semibold text-fuchsia-100 ring-1 ring-fuchsia-400/30 hover:bg-fuchsia-500/25"><Sparkles className="h-4 w-4" />{tr ? "AI ile hazırla" : "Prepare with AI"}</button>
              )
            ) : null}
            <button type="button" onClick={() => onChange({ ...data, photo: null })} className="rounded-xl px-3 py-2 text-[13px] font-semibold text-slate-300 hover:bg-white/10">{tr ? "Kaldır" : "Remove"}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-dashed border-sky-400/40 bg-sky-500/[0.05] px-4 py-3.5 text-left hover:bg-sky-500/10">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-200"><Camera className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-[14px] font-bold text-white">{tr ? "Fotoğraf ekle" : "Add a photo"} <span className="font-normal text-slate-400">{tr ? "(isteğe bağlı)" : "(optional)"}</span></span>
              <span className="block text-[11.5px] text-slate-400">{tr ? "Tıklayın, cihazınızdan seçin. Fotoğraf sunucuya yüklenmez." : "Click and pick one from your device. It is never uploaded."}</span>
            </span>
          </button>
          <button type="button" onClick={() => camRef.current?.click()} className={camBtn}><Camera className="h-4 w-4" />{tr ? "Kamerayla çek" : "Take a photo"}</button>
        </div>
      )}
      {photoErr ? <p className="text-[12px] text-red-300">{photoErr}</p> : null}
      {prepOpen && data.photo && !aiComingSoon && !aiLocked ? <CvPhotoPrep photo={data.photo} tpl={tpl} tr={tr} onClose={() => setPrepOpen(false)} onApply={(src) => { onChange({ ...data, photo: { src, zoom: 1, x: 0, y: 0 }, showPhoto: true }); setPrepOpen(false); }} /> : null}
    </div>
  );
}

/** "Kendi bölümünüzü ekleyin" hızlı başlıkları: her biri uygun görünümle gelir. */
const CUSTOM_PRESETS: { id: string; tr: string; en: string; style: CvCustomStyle }[] = [
  { id: "volunteer", tr: "Gönüllülük", en: "Volunteering", style: "detailed" },
  { id: "awards", tr: "Ödüller ve başarılar", en: "Awards & achievements", style: "list" },
  { id: "pubs", tr: "Yayınlar", en: "Publications", style: "list" },
  { id: "courses", tr: "Kurslar ve eğitimler", en: "Courses & training", style: "list" },
  { id: "conf", tr: "Konferans ve etkinlikler", en: "Conferences & events", style: "cards" },
  { id: "tools", tr: "Kullandığım araçlar", en: "Tools I use", style: "tags" },
  { id: "hobbies", tr: "Hobiler", en: "Hobbies", style: "tags" },
  { id: "military", tr: "Askerlik durumu", en: "Military service", style: "list" },
  { id: "memberships", tr: "Üyelikler", en: "Memberships", style: "list" },
  { id: "social", tr: "Sosyal sorumluluk projeleri", en: "Community projects", style: "cards" },
];

/** Yeni mezun / stajyer: eğitim, projeler ve beceriler deneyimden önce. */
export const GRADUATE_ORDER: SectionKey[] = ["summary", "education", "projects", "skills", "experience", "certs", "languages", "interests", "references"];

export const ACCENTS = ["#1d4ed8", "#0f766e", "#166534", "#6d28d9", "#be185d", "#c2410c", "#a16207", "#0f2a4a", "#374151"];

/** Eğitim kaydı düzenleyicisi: düzey seçimi, bölüm, tarih, diploma notu ve başarılar. Form ve sihirbaz paylaşır. */
export function EducationEditor({ e, data, set, tr }: { e: CvEducation; data: CvData; set: <K extends keyof CvData>(k: K, v: CvData[K]) => void; tr: boolean }) {
  const upd = (p: Partial<CvEducation>) => set("education", patch(data.education, e.id, p));
  const school = e.level === "highschool" || e.level === "vocational";
  const honors = (e.honors ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const toggleHonor = (t: string) => upd({ honors: (honors.includes(t) ? honors.filter((x) => x !== t) : [...honors, t]).join("\n") });
  const deptPh: Record<string, [string, string]> = {
    highschool: ["Ör. Sayısal, Fen Lisesi", "E.g. Science track"],
    vocational: ["Ör. Bilişim Teknolojileri alanı", "E.g. Information Technology track"],
    associate: ["Ör. Bilgisayar Programcılığı", "E.g. Computer Programming"],
    bachelor: ["Ör. Bilgisayar Mühendisliği", "E.g. Computer Engineering"],
    master: ["Ör. İşletme (MBA)", "E.g. Business Administration (MBA)"],
    doctorate: ["Ör. Malzeme Bilimi", "E.g. Materials Science"],
    course: ["Ör. Veri Analizi Programı", "E.g. Data Analytics Program"],
  };
  return (
    <>
      <div>
        <span className="mb-1.5 block text-[12px] font-semibold text-slate-300">{tr ? "Eğitim düzeyi" : "Level of education"}</span>
        <div role="radiogroup" aria-label={tr ? "Eğitim düzeyi" : "Level of education"} className="flex flex-wrap gap-1.5">
          {EDU_LEVELS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={e.level === l.id} onClick={() => upd({ level: e.level === l.id ? "" : l.id })} className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${e.level === l.id ? "border-sky-400 bg-sky-500/20 text-white ring-1 ring-sky-400/40" : "border-white/15 bg-white/[0.04] text-slate-200 hover:border-white/30 hover:bg-white/[0.08]"}`}>{tr ? l.tr : l.en}</button>
          ))}
        </div>
      </div>
      <Text label={school ? (tr ? "Okul adı" : "School name") : (tr ? "Okul / üniversite" : "School / university")} value={e.school} onChange={(v) => upd({ school: v })} />
      <Text label={school ? (tr ? "Alan (isteğe bağlı)" : "Track (optional)") : (tr ? "Bölüm / program" : "Major / program")} value={e.degree} onChange={(v) => upd({ degree: v })} placeholder={(deptPh[e.level ?? ""] ?? ["Ör. Bilgisayar Mühendisliği", "E.g. Computer Engineering"])[tr ? 0 : 1]} hint={e.level ? (tr ? "Düzey CV'de bölümün yanına otomatik yazılır." : "The level is added next to the major automatically.") : (tr ? "Dilerseniz yukarıdan düzey seçin; “Lisans” gibi ekleri kendimiz yazarız." : "Pick a level above and we'll add words like “Bachelor's” for you.")} />
      <Text label={tr ? "Şehir" : "Location"} value={e.location} onChange={(v) => upd({ location: v })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Text label={tr ? "Başlangıç" : "Start"} type="month" tr={tr} value={e.start} onChange={(v) => upd({ start: v })} />
        <Text label={e.current ? (tr ? "Bitiş (devam ediyor)" : "End (ongoing)") : (tr ? "Bitiş / mezuniyet" : "End / graduation")} type="month" tr={tr} value={e.end} disabled={e.current} error={(() => { const x = dateOrderIssue(e.start, e.end, e.current); return x ? (tr ? x.tr : x.en) : null; })()} onChange={(v) => upd({ end: v })} />
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-slate-300"><input type="checkbox" className="h-4 w-4 accent-sky-400" checked={e.current} onChange={(ev) => upd({ current: ev.target.checked })} />{tr ? "Devam ediyorum" : "Currently studying"}</label>
      <div>
        <span className="mb-1 block text-[12px] font-semibold text-slate-300">{e.current ? (tr ? "Not ortalaması (isteğe bağlı)" : "GPA (optional)") : (tr ? "Diploma notu (isteğe bağlı)" : "Final grade (optional)")}</span>
        <div className="flex gap-2">
          <input value={e.gpa ?? ""} inputMode="decimal" onChange={(ev) => upd({ gpa: ev.target.value.replace(/[^0-9.,]/g, "").slice(0, 6) })} placeholder={tr ? "Ör. 3,45" : "E.g. 3.45"} aria-label={tr ? "Diploma notu" : "Final grade"} className={`${inputCls} min-w-0 flex-1`} />
          <select value={e.gpaScale || "4"} onChange={(ev) => upd({ gpaScale: ev.target.value })} aria-label={tr ? "Not ölçeği" : "Grade scale"} className="w-28 shrink-0 rounded-xl border border-white/10 bg-slate-900/60 px-2 py-2.5 text-[13px] text-white">
            {GPA_SCALES.map((g) => <option key={g.v} value={g.v}>{g.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-[12px] font-semibold text-slate-300">{tr ? "Başarılar (isteğe bağlı)" : "Achievements (optional)"}</span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {EDU_HONORS.map((h) => {
            const t = tr ? h.tr : h.en;
            const on = honors.includes(t);
            return (
              <button key={h.en} type="button" aria-pressed={on} onClick={() => toggleHonor(t)} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${on ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100" : "border-white/15 bg-white/[0.04] text-slate-200 hover:border-amber-300/40 hover:bg-amber-300/10"}`}>
                {on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3 text-amber-200" />}{t}
              </button>
            );
          })}
        </div>
        <textarea value={e.honors ?? ""} onChange={(ev) => upd({ honors: ev.target.value })} rows={2} placeholder={tr ? "Kendi başarınızı da yazabilirsiniz; her satır ayrı madde olur." : "Add your own too; each line becomes a bullet."} className={`${inputCls} resize-y leading-relaxed`} />
        <span className="mt-1 block text-[11px] text-slate-500">{tr ? "Yalnızca gerçekten aldığınız dereceleri işaretleyin." : "Only tick what you actually earned."}</span>
      </div>
      <Area label={tr ? "Ek bilgi (isteğe bağlı)" : "Details (optional)"} rows={2} value={e.desc} onChange={(v) => upd({ desc: v })} hint={tr ? "Bitirme projesi, önemli dersler, kulüp çalışmaları…" : "Thesis, key courses, clubs…"} />
    </>
  );
}

/** Web sitesi ve sosyal medya hesapları. */
export function SocialsEditor({ data, set, tr }: { data: CvData; set: <K extends keyof CvData>(k: K, v: CvData[K]) => void; tr: boolean }) {
  const iss = (i: { tr: string; en: string } | null) => (i ? (tr ? i.tr : i.en) : null);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Text label={tr ? "Web sitesi / portfolyo" : "Website / portfolio"} value={data.website} onChange={(v) => set("website", v)} placeholder="ornek.com" />
        <Text label="LinkedIn" value={data.linkedin} onChange={(v) => set("linkedin", v)} placeholder="linkedin.com/in/adiniz" error={iss(linkIssue(data.linkedin))} />
      </div>
      {data.socials.map((s: CvSocial) => (
        <div key={s.id} className="flex items-start gap-2">
          <select value={s.kind} onChange={(e) => set("socials", patch(data.socials, s.id, { kind: e.target.value }))} aria-label={tr ? "Hesap türü" : "Account type"} className="w-32 shrink-0 rounded-xl border border-white/10 bg-slate-900/60 px-2 py-2.5 text-[13px] text-white">
            {SOCIAL_KINDS.map((k) => <option key={k} value={k}>{k === "Diğer" && !tr ? "Other" : k}</option>)}
          </select>
          <input value={s.value} onChange={(e) => set("socials", patch(data.socials, s.id, { value: e.target.value }))} placeholder={tr ? "Hesap adresi ya da kullanıcı adı" : "Profile link or username"} aria-label={tr ? "Hesap adresi" : "Profile link"} className={`${inputCls} min-w-0 flex-1`} />
          <button type="button" onClick={() => set("socials", data.socials.filter((x) => x.id !== s.id))} aria-label={tr ? "Sil" : "Delete"} className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <AddButton label={tr ? "Başka bir hesap ekle (GitHub, Instagram, Behance…)" : "Add another account (GitHub, Instagram, Behance…)"} onClick={() => set("socials", [...data.socials, { id: uid(), kind: SOCIAL_KINDS[0], value: "" }])} />
    </div>
  );
}

/** Sertifika kayıtları. */
export function CertsEditor({ data, set, tr }: { data: CvData; set: <K extends keyof CvData>(k: K, v: CvData[K]) => void; tr: boolean }) {
  return (
    <>
      {data.certs.map((c: CvCert, i) => (
        <ItemCard key={c.id} tr={tr} first={i === 0} last={i === data.certs.length - 1} onUp={() => set("certs", move(data.certs, i, -1))} onDown={() => set("certs", move(data.certs, i, 1))} onRemove={() => set("certs", data.certs.filter((x) => x.id !== c.id))}>
          <Text label={tr ? "Sertifika adı" : "Certificate"} value={c.name} onChange={(v) => set("certs", patch(data.certs, c.id, { name: v }))} placeholder={tr ? "Ör. Forklift Operatörlük Belgesi" : "E.g. Forklift Operator Licence"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label={tr ? "Veren kurum" : "Issuer"} value={c.issuer} onChange={(v) => set("certs", patch(data.certs, c.id, { issuer: v }))} />
            <Text label={tr ? "Tarih" : "Date"} type="month" tr={tr} value={c.date} onChange={(v) => set("certs", patch(data.certs, c.id, { date: v }))} />
          </div>
        </ItemCard>
      ))}
      <AddButton label={data.certs.length ? (tr ? "Bir sertifika daha ekle" : "Add another certificate") : (tr ? "Sertifika ekle" : "Add a certificate")} onClick={() => set("certs", [...data.certs, { id: uid(), name: "", issuer: "", date: "" }])} />
    </>
  );
}

/** Referans kayıtları. */
export function ReferencesEditor({ data, set, tr }: { data: CvData; set: <K extends keyof CvData>(k: K, v: CvData[K]) => void; tr: boolean }) {
  return (
    <>
      {data.references.map((r: CvReference, i) => (
        <ItemCard key={r.id} tr={tr} first={i === 0} last={i === data.references.length - 1} onUp={() => set("references", move(data.references, i, -1))} onDown={() => set("references", move(data.references, i, 1))} onRemove={() => set("references", data.references.filter((x) => x.id !== r.id))}>
          <Text label={tr ? "Ad soyad" : "Name"} value={r.name} onChange={(v) => set("references", patch(data.references, r.id, { name: v }))} />
          <Text label={tr ? "Unvan, kurum" : "Title, company"} value={r.role} onChange={(v) => set("references", patch(data.references, r.id, { role: v }))} />
          <Text label={tr ? "Telefon / e-posta" : "Phone / email"} value={r.contact} onChange={(v) => set("references", patch(data.references, r.id, { contact: v }))} />
        </ItemCard>
      ))}
      <AddButton label={data.references.length ? (tr ? "Bir referans daha ekle" : "Add another reference") : (tr ? "Referans ekle" : "Add a reference")} onClick={() => set("references", [...data.references, { id: uid(), name: "", role: "", contact: "" }])} />
    </>
  );
}

/** Proje kayıtları. */
export function ProjectsEditor({ data, set, tr }: { data: CvData; set: <K extends keyof CvData>(k: K, v: CvData[K]) => void; tr: boolean }) {
  return (
    <>
      {data.projects.map((p: CvProject, i) => (
        <ItemCard key={p.id} tr={tr} first={i === 0} last={i === data.projects.length - 1} onUp={() => set("projects", move(data.projects, i, -1))} onDown={() => set("projects", move(data.projects, i, 1))} onRemove={() => set("projects", data.projects.filter((x) => x.id !== p.id))}>
          <Text label={tr ? "Proje adı" : "Project name"} value={p.name} onChange={(v) => set("projects", patch(data.projects, p.id, { name: v }))} />
          <Text label={tr ? "Bağlantı (isteğe bağlı)" : "Link (optional)"} value={p.link} onChange={(v) => set("projects", patch(data.projects, p.id, { link: v }))} />
          <Area label={tr ? "Ne yaptınız?" : "What did you do?"} rows={3} value={p.desc} onChange={(v) => set("projects", patch(data.projects, p.id, { desc: v }))} hint={tr ? "Rolünüzü, kullandığınız araçları ve sonucu yazın." : "Your role, tools used and the outcome."} />
        </ItemCard>
      ))}
      <AddButton label={data.projects.length ? (tr ? "Bir proje daha ekle" : "Add another project") : (tr ? "Proje ekle" : "Add a project")} onClick={() => set("projects", [...data.projects, { id: uid(), name: "", link: "", desc: "" }])} />
    </>
  );
}

export function CvForm({ data, onChange, tpl, disabled, tr, aiComingSoon, aiLocked, onAiLocked }: Props) {
  const set = <K extends keyof CvData>(k: K, v: CvData[K]) => onChange({ ...data, [k]: v });
  const [moreOpen, setMoreInfo] = useState(() => !!(data.website || data.linkedin || data.socials.length || data.birth || data.license));
  const iss = (i: { tr: string; en: string } | null) => (i ? (tr ? i.tr : i.en) : null);
  const lang = data.settings.lang;
  const monthType = "month";

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3 border-0 p-0">
      <Accordion title={tr ? "Kişisel bilgiler" : "Personal details"} icon={<UserRound className="h-4 w-4" />} defaultOpen>
        <PhotoField data={data} onChange={onChange} tpl={tpl} disabled={disabled} tr={tr} aiComingSoon={aiComingSoon} aiLocked={aiLocked} onAiLocked={onAiLocked} />

        <Text label={tr ? "Ad soyad" : "Full name"} value={data.name} onChange={(v) => set("name", v)} autoComplete="name" />
        <Text label={tr ? "Unvan / hedef pozisyon" : "Job title / target role"} value={data.title} onChange={(v) => set("title", v)} placeholder={tr ? "Ör. Muhasebe Uzmanı" : "E.g. Accountant"} suggest={(q) => suggestTitles(q, lang)} tr={tr} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label={tr ? "E-posta" : "Email"} type="email" value={data.email} onChange={(v) => set("email", v)} autoComplete="email" error={iss(emailIssue(data.email))} />
          <Text label={tr ? "Şehir" : "City"} value={data.city} onChange={(v) => set("city", v)} placeholder={tr ? "Ör. İstanbul" : "E.g. London"} autoComplete="address-level2" hint={tr ? "CV'de iletişim bilgileri arasında “Şehir” olarak görünür." : "Shown as “City” among your contact details."} />
        </div>
        <PhoneField label={tr ? "Telefon" : "Phone"} value={data.phone} onChange={(v) => set("phone", v)} city={data.city} tr={tr} disabled={disabled} error={iss(phoneIssue(data.phone))} />
        <button type="button" onClick={() => setMoreInfo((o) => !o)} aria-expanded={moreOpen} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-sky-300 hover:text-sky-200">
          <ChevronDown className={`h-3.5 w-3.5 transition ${moreOpen ? "rotate-180" : ""}`} />{tr ? "Daha fazla bilgi (web sitesi, LinkedIn, sosyal hesaplar, doğum tarihi, ehliyet…)" : "More details (website, LinkedIn, birth date…)"}
        </button>
        {moreOpen ? (
          <>
            <SocialsEditor data={data} set={set} tr={tr} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label={tr ? "Doğum tarihi" : "Date of birth"} value={data.birth} onChange={(v) => set("birth", v)} />
              <Text label={tr ? "Ehliyet" : "Driving licence"} value={data.license} onChange={(v) => set("license", v)} />
            </div>
          </>
        ) : null}
      </Accordion>

      <Accordion title={tr ? "Profil özeti" : "Profile summary"} icon={<FileText className="h-4 w-4" />}>
        <Area label={tr ? "Kendinizi anlatın" : "Tell us about yourself"} rows={6} value={data.summary} onChange={(v) => set("summary", v)} hint={tr ? "İstediğiniz kadar yazabilirsiniz. Deneyiminizi, güçlü yönlerinizi ve hedefinizi anlatın." : "Write as much as you like: your experience, strengths and goal."} />
        <SummaryPicker tr={tr} lang={lang} hint={`${data.title} ${data.experience[0]?.role ?? ""}`} onPick={(t) => set("summary", t)} />
      </Accordion>

      <Accordion title={tr ? "İş deneyimi" : "Work experience"} icon={<Briefcase className="h-4 w-4" />} count={data.experience.length} defaultOpen={false}>
        {data.experience.map((e: CvExperience, i) => (
          <ItemCard key={e.id} tr={tr} first={i === 0} last={i === data.experience.length - 1} onUp={() => set("experience", move(data.experience, i, -1))} onDown={() => set("experience", move(data.experience, i, 1))} onRemove={() => set("experience", data.experience.filter((x) => x.id !== e.id))}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label={tr ? "Pozisyon" : "Job title"} value={e.role} onChange={(v) => set("experience", patch(data.experience, e.id, { role: v }))} />
              <Text label={tr ? "Şirket" : "Company"} value={e.company} onChange={(v) => set("experience", patch(data.experience, e.id, { company: v }))} />
            </div>
            <Text label={tr ? "Şehir" : "Location"} value={e.location} onChange={(v) => set("experience", patch(data.experience, e.id, { location: v }))} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label={tr ? "Başlangıç" : "Start"} type="month" tr={tr} value={e.start} onChange={(v) => set("experience", patch(data.experience, e.id, { start: v }))} />
              <Text label={tr ? "Bitiş" : "End"} type="month" tr={tr} value={e.end} disabled={e.current} error={iss(dateOrderIssue(e.start, e.end, e.current))} onChange={(v) => set("experience", patch(data.experience, e.id, { end: v }))} />
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-300"><input type="checkbox" className="h-4 w-4 accent-sky-400" checked={e.current} onChange={(ev) => set("experience", patch(data.experience, e.id, { current: ev.target.checked }))} />{tr ? "Hâlâ çalışıyorum" : "I currently work here"}</label>
            <Area label={tr ? "Sorumluluklar ve başarılar" : "Responsibilities & achievements"} rows={4} value={e.desc} onChange={(v) => set("experience", patch(data.experience, e.id, { desc: v }))} hint={tr ? "Her satır ayrı bir madde olur. Rakamla anlatın: “satışları %20 artırdı”." : "Each line becomes a bullet. Use numbers: “grew sales by 20%”."} />
            <BulletPicker tr={tr} lang={lang} hint={`${e.role} ${data.title}`} current={e.desc} onAdd={(line) => set("experience", patch(data.experience, e.id, { desc: e.desc.trim() ? `${e.desc.replace(/\s+$/, "")}
${line}` : line }))} />
          </ItemCard>
        ))}
        <AddButton label={tr ? "Deneyim ekle" : "Add experience"} onClick={() => set("experience", [...data.experience, { id: uid(), company: "", role: "", location: "", start: "", end: "", current: false, desc: "" }])} />
      </Accordion>

      <Accordion title={tr ? "Eğitim" : "Education"} icon={<GraduationCap className="h-4 w-4" />} count={data.education.length}>
        {data.education.map((e: CvEducation, i) => (
          <ItemCard key={e.id} tr={tr} first={i === 0} last={i === data.education.length - 1} onUp={() => set("education", move(data.education, i, -1))} onDown={() => set("education", move(data.education, i, 1))} onRemove={() => set("education", data.education.filter((x) => x.id !== e.id))}>
            <EducationEditor e={e} data={data} set={set} tr={tr} />
          </ItemCard>
        ))}
        <AddButton label={tr ? "Eğitim ekle" : "Add education"} onClick={() => set("education", [...data.education, { id: uid(), school: "", degree: "", location: "", start: "", end: "", current: false, desc: "", level: "", gpa: "", gpaScale: "4", honors: "" }])} />
      </Accordion>

      <Accordion title={tr ? "Beceriler" : "Skills"} icon={<Wrench className="h-4 w-4" />} count={data.skills.length}>
        {data.skills.map((s: CvSkill) => (
          <div key={s.id} className="flex items-start gap-2">
            <div className="min-w-0 flex-1"><SuggestInput value={s.name} onChange={(v) => set("skills", patch(data.skills, s.id, { name: v }))} suggest={(q) => suggestSkills(q, lang, data.skills.map((x) => x.name))} placeholder={tr ? "Beceri yazın, öneriler çıkar" : "Type a skill, suggestions appear"} ariaLabel={tr ? "Beceri" : "Skill"} tr={tr} className={inputCls} /></div>
            <select value={s.level} onChange={(e) => set("skills", patch(data.skills, s.id, { level: Number(e.target.value) }))} className="w-28 shrink-0 rounded-xl border border-white/10 bg-slate-900/60 px-2 py-2.5 text-[13px] text-white" aria-label={tr ? "Seviye" : "Level"}>
              <option value={0}>{tr ? "Seviyesiz" : "No level"}</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
            </select>
            <button type="button" onClick={() => set("skills", data.skills.filter((x) => x.id !== s.id))} aria-label={tr ? "Sil" : "Delete"} className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <SkillPicker tr={tr} lang={lang} hint={`${data.title} ${data.experience[0]?.role ?? ""}`} have={data.skills.map((x) => x.name)} onAdd={(name) => set("skills", [...data.skills.filter((x) => x.name.trim()), { id: uid(), name, level: 0 }])} />
        <AddButton label={tr ? "Beceri ekle" : "Add skill"} onClick={() => set("skills", [...data.skills, { id: uid(), name: "", level: 0 }])} />
        <p className="text-[11px] text-slate-500">{tr ? "Seviye yalnızca çubuklu şablonlarda görünür." : "Levels show only in templates with skill bars."}</p>
      </Accordion>

      <Accordion title={tr ? "Yabancı diller" : "Languages"} icon={<Languages className="h-4 w-4" />} count={data.languages.length}>
        {data.languages.map((l: CvLanguageItem) => (
          <div key={l.id} className="flex items-start gap-2">
            <div className="min-w-0 flex-1"><SuggestInput value={l.name} onChange={(v) => set("languages", patch(data.languages, l.id, { name: v }))} suggest={(q) => suggestLanguages(q, lang, data.languages.map((x) => x.name))} placeholder={tr ? "Dil yazın (ör. Alm…)" : "Type a language"} ariaLabel={tr ? "Dil" : "Language"} tr={tr} className={inputCls} /></div>
            <select value={LANG_LEVELS[lang].includes(l.level) ? l.level : ""} onChange={(e) => set("languages", patch(data.languages, l.id, { level: e.target.value }))} className="w-44 shrink-0 rounded-xl border border-white/10 bg-slate-900/60 px-2 py-2.5 text-[13px] text-white" aria-label={tr ? "Seviye" : "Level"}>
              <option value="">{tr ? "Seviye seçin" : "Level"}</option>
              {LANG_LEVELS[lang].map((lv) => <option key={lv} value={lv}>{lv}</option>)}
            </select>
            <button type="button" onClick={() => set("languages", data.languages.filter((x) => x.id !== l.id))} aria-label={tr ? "Sil" : "Delete"} className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <AddButton label={tr ? "Dil ekle" : "Add language"} onClick={() => set("languages", [...data.languages, { id: uid(), name: "", level: "" }])} />
      </Accordion>

      <p className="px-1 pt-2 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">{tr ? "Ek bölümler (isteğe bağlı)" : "Extra sections (optional)"}</p>

      <Accordion title={tr ? "Sertifikalar" : "Certifications"} icon={<Award className="h-4 w-4" />} count={data.certs.length}>
        <CertsEditor data={data} set={set} tr={tr} />
      </Accordion>

      <Accordion title={tr ? "Projeler" : "Projects"} icon={<FolderGit2 className="h-4 w-4" />} count={data.projects.length}>
        <ProjectsEditor data={data} set={set} tr={tr} />
      </Accordion>

      <Accordion title={tr ? "İlgi alanları" : "Interests"} icon={<Heart className="h-4 w-4" />}>
        <Area label={tr ? "Virgülle ayırın" : "Separate with commas"} rows={2} value={data.interests} onChange={(v) => set("interests", v)} placeholder={tr ? "Fotoğrafçılık, yürüyüş, satranç" : "Photography, hiking, chess"} />
      </Accordion>

      <Accordion title={tr ? "Referanslar" : "References"} icon={<Users className="h-4 w-4" />} count={data.references.length}>
        <ReferencesEditor data={data} set={set} tr={tr} />
        <p className="text-[11px] text-slate-500">{tr ? "İsterseniz “Referanslar istek üzerine sunulur” yazmak yerine bu bölümü boş bırakın; PDF'e eklenmez." : "Leave this empty if you'd rather not list references; it won't appear in the PDF."}</p>
      </Accordion>

      {data.customSections.map((c: CvCustomSection) => {
        const style: CvCustomStyle = c.style ?? "detailed";
        const upd = (p: Partial<CvCustomSection>) => set("customSections", data.customSections.map((x) => (x.id === c.id ? { ...x, ...p } : x)));
        const updItems = (fn: (items: CvCustomItem[]) => CvCustomItem[]) => set("customSections", data.customSections.map((x) => (x.id === c.id ? { ...x, items: fn(x.items) } : x)));
        const styles: { v: CvCustomStyle; label: string; hint: string; icon: ReactNode }[] = [
          { v: "detailed", label: tr ? "Ayrıntılı" : "Detailed", hint: tr ? "Başlık, alt başlık, tarih, açıklama" : "Title, subtitle, date, text", icon: <AlignLeft className="h-4 w-4" /> },
          { v: "list", label: tr ? "Liste" : "List", hint: tr ? "Tek satırlık maddeler" : "One-line items", icon: <List className="h-4 w-4" /> },
          { v: "cards", label: tr ? "Kartlar" : "Cards", hint: tr ? "İki sütunlu kutular" : "Two-column boxes", icon: <LayoutGrid className="h-4 w-4" /> },
          { v: "tags", label: tr ? "Etiketler" : "Tags", hint: tr ? "Kısa kelimeler" : "Short words", icon: <Tags className="h-4 w-4" /> },
        ];
        return (
          <Accordion key={c.id} title={c.title.trim() || (tr ? "Özel bölüm" : "Custom section")} icon={<Layers className="h-4 w-4" />} count={c.items.length} defaultOpen>
            <Text label={tr ? "Bölüm başlığı" : "Section title"} value={c.title} onChange={(v) => upd({ title: v })} placeholder={tr ? "Ör. Gönüllülük, Yayınlar, Ödüller" : "E.g. Volunteering, Publications, Awards"} />
            <div>
              <span className="mb-1.5 block text-[12px] font-semibold text-slate-300">{tr ? "CV'de nasıl görünsün?" : "How should it look on the CV?"}</span>
              <div role="radiogroup" aria-label={tr ? "Bölüm görünümü" : "Section look"} className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {styles.map((o) => (
                  <button key={o.v} type="button" role="radio" aria-checked={style === o.v} onClick={() => upd({ style: o.v })} title={o.hint} className={`flex flex-col items-start gap-1 rounded-xl border px-2.5 py-2 text-left transition ${style === o.v ? "border-sky-400 bg-sky-500/15 text-white ring-1 ring-sky-400/40" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:bg-white/[0.06]"}`}>
                    <span className={style === o.v ? "text-sky-300" : "text-slate-400"}>{o.icon}</span>
                    <span className="text-[12.5px] font-bold">{o.label}</span>
                    <span className="text-[10.5px] leading-tight text-slate-400">{o.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            {c.items.map((it: CvCustomItem, i) => (
              <ItemCard key={it.id} tr={tr} first={i === 0} last={i === c.items.length - 1}
                onUp={() => updItems((items) => move(items, i, -1))}
                onDown={() => updItems((items) => move(items, i, 1))}
                onRemove={() => updItems((items) => items.filter((y) => y.id !== it.id))}>
                <Text label={style === "tags" ? (tr ? "Etiket" : "Tag") : (tr ? "Başlık" : "Title")} value={it.title} onChange={(v) => updItems((items) => patch(items, it.id, { title: v }))} />
                {style !== "tags" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Text label={tr ? "Alt başlık (isteğe bağlı)" : "Subtitle (optional)"} value={it.subtitle} onChange={(v) => updItems((items) => patch(items, it.id, { subtitle: v }))} />
                    <Text label={tr ? "Tarih (isteğe bağlı)" : "Date (optional)"} type="month" tr={tr} value={it.date} onChange={(v) => updItems((items) => patch(items, it.id, { date: v }))} />
                  </div>
                ) : null}
                {style === "detailed" || style === "cards" ? <Area label={tr ? "Açıklama" : "Description"} rows={2} value={it.desc} onChange={(v) => updItems((items) => patch(items, it.id, { desc: v }))} /> : null}
              </ItemCard>
            ))}
            <AddButton label={style === "tags" ? (tr ? "Etiket ekle" : "Add tag") : (tr ? "Madde ekle" : "Add item")} onClick={() => updItems((items) => [...items, { id: uid(), title: "", subtitle: "", date: "", desc: "" }])} />
            <button type="button" onClick={() => onChange({ ...data, customSections: data.customSections.filter((x) => x.id !== c.id), settings: { ...data.settings, order: data.settings.order?.filter((k) => k !== `custom:${c.id}`) ?? null, hidden: data.settings.hidden.filter((k) => k !== `custom:${c.id}`) } })} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-300 hover:text-red-200"><Trash2 className="h-3.5 w-3.5" />{tr ? "Bu bölümü sil" : "Delete this section"}</button>
          </Accordion>
        );
      })}
      <div className="rounded-2xl border border-dashed border-sky-400/35 bg-sky-500/[0.04] p-3.5">
        <p className="text-[13px] font-bold text-white">{tr ? "Kendi bölümünüzü ekleyin" : "Add your own section"}</p>
        <p className="mb-2.5 text-[11.5px] text-slate-400">{tr ? "Bir başlık seçin; uygun görünümle hazır gelir, istediğinizi sonradan değiştirebilirsiniz." : "Pick a title; it comes ready with a fitting look, which you can change later."}</p>
        <div className="flex flex-wrap gap-1.5">
          {CUSTOM_PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => set("customSections", [...data.customSections, { id: uid(), title: tr ? p.tr : p.en, style: p.style, items: [{ id: uid(), title: "", subtitle: "", date: "", desc: "" }] }])} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[12.5px] font-medium text-slate-100 hover:border-sky-400/50 hover:bg-sky-500/10"><Plus className="h-3.5 w-3.5 text-sky-300" />{tr ? p.tr : p.en}</button>
          ))}
          <button type="button" onClick={() => set("customSections", [...data.customSections, { id: uid(), title: "", style: "detailed", items: [{ id: uid(), title: "", subtitle: "", date: "", desc: "" }] }])} className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-[12.5px] font-bold text-sky-100 hover:bg-sky-500/25"><Plus className="h-3.5 w-3.5" />{tr ? "Boş bölüm" : "Blank section"}</button>
        </div>
      </div>

      <Accordion title={tr ? "Bölümler: sıra ve aç/kapa" : "Sections: order & show/hide"} icon={<ListOrdered className="h-4 w-4" />}>
        <CvSectionManager data={data} onChange={onChange} tr={tr} graduateOrder={GRADUATE_ORDER} />
      </Accordion>
    </fieldset>
  );
}
