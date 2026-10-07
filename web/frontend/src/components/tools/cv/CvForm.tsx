import { useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  ChevronDown,
  Award,
  FolderGit2,
  GraduationCap,
  Heart,
  ImagePlus,
  Languages,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Wrench,
  FileText,
  Camera,
} from "lucide-react";
import {
  LANG_LEVELS,
  uid,
  type CvCert,
  type CvData,
  type CvEducation,
  type CvExperience,
  type CvLang,
  type CvLanguageItem,
  type CvPhoto,
  type CvProject,
  type CvReference,
  type CvSkill,
} from "./cvModel";
import { bakePhoto, type CvTemplate } from "./cvTemplates";
import { useEffect } from "react";

type Props = {
  data: CvData;
  onChange: (next: CvData) => void;
  tpl: CvTemplate;
  disabled: boolean;
  tr: boolean;
};

const inputCls =
  "w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-[14px] text-white placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50";

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-slate-300">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

function Text({ label, value, onChange, placeholder, type = "text", disabled, hint, autoComplete }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean; hint?: string; autoComplete?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} autoComplete={autoComplete} className={inputCls} />
    </Field>
  );
}

function Area({ label, value, onChange, placeholder, rows = 4, disabled, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled} className={`${inputCls} resize-y leading-relaxed`} />
    </Field>
  );
}

function Accordion({ title, icon, defaultOpen, count, children }: { title: string; icon: ReactNode; defaultOpen?: boolean; count?: number; children: ReactNode }) {
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

function ItemCard({ children, onUp, onDown, onRemove, tr, first, last }: { children: ReactNode; onUp: () => void; onDown: () => void; onRemove: () => void; tr: boolean; first: boolean; last: boolean }) {
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

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-400/40 bg-sky-500/[0.05] px-3 py-2.5 text-[13px] font-semibold text-sky-200 hover:bg-sky-500/10">
      <Plus className="h-4 w-4" />
      {label}
    </button>
  );
}

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

function patch<T extends { id: string }>(arr: T[], id: string, p: Partial<T>): T[] {
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
        <label className="block text-[12px] text-slate-300">{tr ? "Yatay konum" : "Horizontal"}
          <input type="range" min={-1} max={1} step={0.02} value={photo.x} disabled={disabled} onChange={(e) => onChange({ ...photo, x: Number(e.target.value) })} className="mt-1 w-full accent-sky-400" />
        </label>
        <label className="block text-[12px] text-slate-300">{tr ? "Dikey konum" : "Vertical"}
          <input type="range" min={-1} max={1} step={0.02} value={photo.y} disabled={disabled} onChange={(e) => onChange({ ...photo, y: Number(e.target.value) })} className="mt-1 w-full accent-sky-400" />
        </label>
      </div>
    </div>
  );
}

export const ACCENTS = ["#1d4ed8", "#0f766e", "#166534", "#6d28d9", "#be185d", "#c2410c", "#a16207", "#0f2a4a", "#374151"];

export function CvForm({ data, onChange, tpl, disabled, tr }: Props) {
  const set = <K extends keyof CvData>(k: K, v: CvData[K]) => onChange({ ...data, [k]: v });
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const lang = data.settings.lang;
  const monthType = "month";

  async function pickPhoto(f: File | undefined) {
    if (!f) return;
    setPhotoErr(null);
    try {
      const src = await readPhoto(f);
      set("photo", { src, zoom: 1, x: 0, y: 0 });
      set("showPhoto", true);
    } catch {
      setPhotoErr(tr ? "Bu fotoğraf açılamadı. JPG veya PNG deneyin." : "This photo couldn't be opened. Try a JPG or PNG.");
    }
  }

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3 border-0 p-0">
      <Accordion title={tr ? "Fotoğraf" : "Photo"} icon={<Camera className="h-4 w-4" />} defaultOpen>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-200">
          <input type="checkbox" checked={data.showPhoto} onChange={(e) => set("showPhoto", e.target.checked)} className="h-4 w-4 accent-sky-400" />
          {tr ? "CV'de fotoğraf kullan" : "Show a photo on the CV"}
        </label>
        {data.showPhoto ? (
          <>
            {data.photo ? <PhotoCropper photo={data.photo} tpl={tpl} disabled={disabled} tr={tr} onChange={(p) => set("photo", p)} /> : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-3.5 py-2.5 text-[13px] font-semibold text-sky-100 ring-1 ring-sky-400/30 hover:bg-sky-500/25"><ImagePlus className="h-4 w-4" />{data.photo ? (tr ? "Fotoğrafı değiştir" : "Change photo") : (tr ? "Fotoğraf yükle" : "Upload photo")}</button>
              {data.photo ? <button type="button" onClick={() => set("photo", null)} className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-white/10">{tr ? "Kaldır" : "Remove"}</button> : null}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            {photoErr ? <p className="text-[12px] text-red-300">{photoErr}</p> : null}
            <a href="/tools/ai-fotograf-studyosu" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-fuchsia-300 hover:text-fuchsia-200"><Sparkles className="h-3.5 w-3.5" />{tr ? "Fotoğrafınızı AI ile CV için hazırlayın (arka plan, kadraj)" : "Prepare your photo for your CV with AI (background, framing)"}</a>
            <p className="text-[11px] text-slate-500">{tr ? "Fotoğrafınız yalnızca bu tarayıcıda işlenir; sunucumuza yüklenmez." : "Your photo is processed only in this browser; it is never uploaded."}</p>
          </>
        ) : null}
      </Accordion>

      <Accordion title={tr ? "Kişisel bilgiler" : "Personal details"} icon={<UserRound className="h-4 w-4" />} defaultOpen>
        <Text label={tr ? "Ad soyad" : "Full name"} value={data.name} onChange={(v) => set("name", v)} autoComplete="name" />
        <Text label={tr ? "Unvan / hedef pozisyon" : "Job title / target role"} value={data.title} onChange={(v) => set("title", v)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label={tr ? "E-posta" : "Email"} type="email" value={data.email} onChange={(v) => set("email", v)} autoComplete="email" />
          <Text label={tr ? "Telefon" : "Phone"} type="tel" value={data.phone} onChange={(v) => set("phone", v)} autoComplete="tel" />
        </div>
        <Text label={tr ? "Şehir / adres" : "City / address"} value={data.city} onChange={(v) => set("city", v)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label={tr ? "Web sitesi" : "Website"} value={data.website} onChange={(v) => set("website", v)} />
          <Text label="LinkedIn" value={data.linkedin} onChange={(v) => set("linkedin", v)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label={tr ? "Doğum tarihi (isteğe bağlı)" : "Date of birth (optional)"} value={data.birth} onChange={(v) => set("birth", v)} />
          <Text label={tr ? "Ehliyet (isteğe bağlı)" : "Driving licence (optional)"} value={data.license} onChange={(v) => set("license", v)} />
        </div>
      </Accordion>

      <Accordion title={tr ? "Profil özeti" : "Profile summary"} icon={<FileText className="h-4 w-4" />}>
        <Area label={tr ? "Kendinizi tanıtın" : "Introduce yourself"} rows={5} value={data.summary} onChange={(v) => set("summary", v)} hint={tr ? "2-4 cümle yeterli; deneyiminiz, güçlü yönleriniz ve hedefiniz." : "Two to four sentences: experience, strengths and goal."} />
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
              <Text label={tr ? "Başlangıç" : "Start"} type={monthType} value={e.start} onChange={(v) => set("experience", patch(data.experience, e.id, { start: v }))} />
              <Text label={tr ? "Bitiş" : "End"} type={monthType} value={e.end} disabled={e.current} onChange={(v) => set("experience", patch(data.experience, e.id, { end: v }))} />
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-300"><input type="checkbox" className="h-4 w-4 accent-sky-400" checked={e.current} onChange={(ev) => set("experience", patch(data.experience, e.id, { current: ev.target.checked }))} />{tr ? "Hâlâ çalışıyorum" : "I currently work here"}</label>
            <Area label={tr ? "Sorumluluklar ve başarılar" : "Responsibilities & achievements"} rows={4} value={e.desc} onChange={(v) => set("experience", patch(data.experience, e.id, { desc: v }))} hint={tr ? "Her satır ayrı bir madde olur. Rakamla anlatın: “satışları %20 artırdı”." : "Each line becomes a bullet. Use numbers: “grew sales by 20%”."} />
          </ItemCard>
        ))}
        <AddButton label={tr ? "Deneyim ekle" : "Add experience"} onClick={() => set("experience", [...data.experience, { id: uid(), company: "", role: "", location: "", start: "", end: "", current: false, desc: "" }])} />
      </Accordion>

      <Accordion title={tr ? "Eğitim" : "Education"} icon={<GraduationCap className="h-4 w-4" />} count={data.education.length}>
        {data.education.map((e: CvEducation, i) => (
          <ItemCard key={e.id} tr={tr} first={i === 0} last={i === data.education.length - 1} onUp={() => set("education", move(data.education, i, -1))} onDown={() => set("education", move(data.education, i, 1))} onRemove={() => set("education", data.education.filter((x) => x.id !== e.id))}>
            <Text label={tr ? "Okul / üniversite" : "School / university"} value={e.school} onChange={(v) => set("education", patch(data.education, e.id, { school: v }))} />
            <Text label={tr ? "Bölüm ve derece" : "Major and degree"} value={e.degree} onChange={(v) => set("education", patch(data.education, e.id, { degree: v }))} />
            <Text label={tr ? "Şehir" : "Location"} value={e.location} onChange={(v) => set("education", patch(data.education, e.id, { location: v }))} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label={tr ? "Başlangıç" : "Start"} type={monthType} value={e.start} onChange={(v) => set("education", patch(data.education, e.id, { start: v }))} />
              <Text label={tr ? "Bitiş" : "End"} type={monthType} value={e.end} disabled={e.current} onChange={(v) => set("education", patch(data.education, e.id, { end: v }))} />
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-300"><input type="checkbox" className="h-4 w-4 accent-sky-400" checked={e.current} onChange={(ev) => set("education", patch(data.education, e.id, { current: ev.target.checked }))} />{tr ? "Devam ediyorum" : "Currently studying"}</label>
            <Area label={tr ? "Ek bilgi (isteğe bağlı)" : "Details (optional)"} rows={2} value={e.desc} onChange={(v) => set("education", patch(data.education, e.id, { desc: v }))} />
          </ItemCard>
        ))}
        <AddButton label={tr ? "Eğitim ekle" : "Add education"} onClick={() => set("education", [...data.education, { id: uid(), school: "", degree: "", location: "", start: "", end: "", current: false, desc: "" }])} />
      </Accordion>

      <Accordion title={tr ? "Beceriler" : "Skills"} icon={<Wrench className="h-4 w-4" />} count={data.skills.length}>
        {data.skills.map((s: CvSkill) => (
          <div key={s.id} className="flex items-center gap-2">
            <input value={s.name} onChange={(e) => set("skills", patch(data.skills, s.id, { name: e.target.value }))} placeholder={tr ? "Beceri" : "Skill"} className={inputCls} />
            <select value={s.level} onChange={(e) => set("skills", patch(data.skills, s.id, { level: Number(e.target.value) }))} className="w-28 shrink-0 rounded-xl border border-white/10 bg-slate-900/60 px-2 py-2.5 text-[13px] text-white" aria-label={tr ? "Seviye" : "Level"}>
              <option value={0}>{tr ? "Seviyesiz" : "No level"}</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
            </select>
            <button type="button" onClick={() => set("skills", data.skills.filter((x) => x.id !== s.id))} aria-label={tr ? "Sil" : "Delete"} className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <AddButton label={tr ? "Beceri ekle" : "Add skill"} onClick={() => set("skills", [...data.skills, { id: uid(), name: "", level: 0 }])} />
        <p className="text-[11px] text-slate-500">{tr ? "Seviye yalnızca çubuklu şablonlarda görünür." : "Levels show only in templates with skill bars."}</p>
      </Accordion>

      <Accordion title={tr ? "Yabancı diller" : "Languages"} icon={<Languages className="h-4 w-4" />} count={data.languages.length}>
        {data.languages.map((l: CvLanguageItem) => (
          <div key={l.id} className="flex items-center gap-2">
            <input value={l.name} onChange={(e) => set("languages", patch(data.languages, l.id, { name: e.target.value }))} placeholder={tr ? "Dil" : "Language"} className={inputCls} />
            <select value={LANG_LEVELS[lang].includes(l.level) ? l.level : ""} onChange={(e) => set("languages", patch(data.languages, l.id, { level: e.target.value }))} className="w-44 shrink-0 rounded-xl border border-white/10 bg-slate-900/60 px-2 py-2.5 text-[13px] text-white" aria-label={tr ? "Seviye" : "Level"}>
              <option value="">{tr ? "Seviye seçin" : "Level"}</option>
              {LANG_LEVELS[lang].map((lv) => <option key={lv} value={lv}>{lv}</option>)}
            </select>
            <button type="button" onClick={() => set("languages", data.languages.filter((x) => x.id !== l.id))} aria-label={tr ? "Sil" : "Delete"} className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <AddButton label={tr ? "Dil ekle" : "Add language"} onClick={() => set("languages", [...data.languages, { id: uid(), name: "", level: "" }])} />
      </Accordion>

      <Accordion title={tr ? "Sertifikalar" : "Certifications"} icon={<Award className="h-4 w-4" />} count={data.certs.length}>
        {data.certs.map((c: CvCert, i) => (
          <ItemCard key={c.id} tr={tr} first={i === 0} last={i === data.certs.length - 1} onUp={() => set("certs", move(data.certs, i, -1))} onDown={() => set("certs", move(data.certs, i, 1))} onRemove={() => set("certs", data.certs.filter((x) => x.id !== c.id))}>
            <Text label={tr ? "Sertifika adı" : "Certificate"} value={c.name} onChange={(v) => set("certs", patch(data.certs, c.id, { name: v }))} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label={tr ? "Veren kurum" : "Issuer"} value={c.issuer} onChange={(v) => set("certs", patch(data.certs, c.id, { issuer: v }))} />
              <Text label={tr ? "Tarih" : "Date"} type={monthType} value={c.date} onChange={(v) => set("certs", patch(data.certs, c.id, { date: v }))} />
            </div>
          </ItemCard>
        ))}
        <AddButton label={tr ? "Sertifika ekle" : "Add certification"} onClick={() => set("certs", [...data.certs, { id: uid(), name: "", issuer: "", date: "" }])} />
      </Accordion>

      <Accordion title={tr ? "Projeler" : "Projects"} icon={<FolderGit2 className="h-4 w-4" />} count={data.projects.length}>
        {data.projects.map((p: CvProject, i) => (
          <ItemCard key={p.id} tr={tr} first={i === 0} last={i === data.projects.length - 1} onUp={() => set("projects", move(data.projects, i, -1))} onDown={() => set("projects", move(data.projects, i, 1))} onRemove={() => set("projects", data.projects.filter((x) => x.id !== p.id))}>
            <Text label={tr ? "Proje adı" : "Project name"} value={p.name} onChange={(v) => set("projects", patch(data.projects, p.id, { name: v }))} />
            <Text label={tr ? "Bağlantı (isteğe bağlı)" : "Link (optional)"} value={p.link} onChange={(v) => set("projects", patch(data.projects, p.id, { link: v }))} />
            <Area label={tr ? "Kısa açıklama" : "Short description"} rows={2} value={p.desc} onChange={(v) => set("projects", patch(data.projects, p.id, { desc: v }))} />
          </ItemCard>
        ))}
        <AddButton label={tr ? "Proje ekle" : "Add project"} onClick={() => set("projects", [...data.projects, { id: uid(), name: "", link: "", desc: "" }])} />
      </Accordion>

      <Accordion title={tr ? "İlgi alanları" : "Interests"} icon={<Heart className="h-4 w-4" />}>
        <Area label={tr ? "Virgülle ayırın" : "Separate with commas"} rows={2} value={data.interests} onChange={(v) => set("interests", v)} placeholder={tr ? "Fotoğrafçılık, yürüyüş, satranç" : "Photography, hiking, chess"} />
      </Accordion>

      <Accordion title={tr ? "Referanslar" : "References"} icon={<Users className="h-4 w-4" />} count={data.references.length}>
        {data.references.map((r: CvReference, i) => (
          <ItemCard key={r.id} tr={tr} first={i === 0} last={i === data.references.length - 1} onUp={() => set("references", move(data.references, i, -1))} onDown={() => set("references", move(data.references, i, 1))} onRemove={() => set("references", data.references.filter((x) => x.id !== r.id))}>
            <Text label={tr ? "Ad soyad" : "Name"} value={r.name} onChange={(v) => set("references", patch(data.references, r.id, { name: v }))} />
            <Text label={tr ? "Unvan, kurum" : "Title, company"} value={r.role} onChange={(v) => set("references", patch(data.references, r.id, { role: v }))} />
            <Text label={tr ? "Telefon / e-posta" : "Phone / email"} value={r.contact} onChange={(v) => set("references", patch(data.references, r.id, { contact: v }))} />
          </ItemCard>
        ))}
        <AddButton label={tr ? "Referans ekle" : "Add reference"} onClick={() => set("references", [...data.references, { id: uid(), name: "", role: "", contact: "" }])} />
        <p className="text-[11px] text-slate-500">{tr ? "İsterseniz “Referanslar istek üzerine sunulur” yazmak yerine bu bölümü boş bırakın; PDF'e eklenmez." : "Leave this empty if you'd rather not list references; it won't appear in the PDF."}</p>
      </Accordion>

      <Accordion title={tr ? "Görünüm ve dil" : "Look & language"} icon={<Palette className="h-4 w-4" />}>
        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-slate-300">{tr ? "CV dili (başlıklar ve tarihler)" : "CV language (headings and dates)"}</span>
          <div className="inline-flex rounded-xl bg-white/[0.06] p-1">
            {(["tr", "en"] as CvLang[]).map((l) => (
              <button key={l} type="button" onClick={() => onChange({ ...data, settings: { ...data.settings, lang: l } })} className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold ${data.settings.lang === l ? "bg-sky-500 text-white" : "text-slate-300 hover:text-white"}`}>{l === "tr" ? "Türkçe" : "English"}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-slate-300">{tr ? "Vurgu rengi" : "Accent colour"}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-label={tr ? "Şablonun kendi rengi" : "Template colour"} onClick={() => onChange({ ...data, settings: { ...data.settings, accent: null } })} className={`flex h-8 items-center rounded-full px-3 text-[11px] font-semibold ${data.settings.accent === null ? "bg-sky-500 text-white" : "bg-white/[0.08] text-slate-300"}`}>{tr ? "Şablonun rengi" : "Default"}</button>
            {ACCENTS.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => onChange({ ...data, settings: { ...data.settings, accent: c } })} className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 ${data.settings.accent === c ? "ring-sky-300" : "ring-transparent"}`} style={{ background: c }} />
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-slate-300">{tr ? "Yazı boyutu" : "Text size"}</span>
          <div className="inline-flex rounded-xl bg-white/[0.06] p-1">
            {([["s", tr ? "Küçük" : "Small"], ["m", tr ? "Normal" : "Normal"], ["l", tr ? "Büyük" : "Large"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => onChange({ ...data, settings: { ...data.settings, size: k } })} className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold ${data.settings.size === k ? "bg-sky-500 text-white" : "text-slate-300 hover:text-white"}`}>{label}</button>
            ))}
          </div>
        </div>
      </Accordion>
    </fieldset>
  );
}
