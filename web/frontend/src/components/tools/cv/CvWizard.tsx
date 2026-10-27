/**
 * Adım adım CV sihirbazı — hiç bilmeyen biri için: her ekranda tek soru, bir sonraki adım tek tuş.
 * Aynı veri modelini düzenler (tam form ile birebir paylaşır); istenirse "Tüm formu göster"e geçilir.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, FileUp, GraduationCap, Linkedin, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Area, AddButton, CertsEditor, EducationEditor, PhotoField, ProjectsEditor, ReferencesEditor, SocialsEditor, GRADUATE_ORDER, Text, inputCls, patch } from "./CvForm";
import { PhoneField } from "./CvFields";
import { BulletPicker, SkillPicker, SummaryPicker } from "./CvPhrasePicker";
import { LANG_LEVELS, uid, type CvData } from "./cvModel";
import { PROFESSIONS, matchProfession, professionById, professionSample, type Profession } from "./cvPhrases";
import { dateOrderIssue, emailIssue, phoneIssue } from "./cvValidate";
import { SuggestInput } from "./CvSuggestInput";
import { suggestLanguages, suggestSkills, suggestTitles } from "./cvVocabulary";
import { cvStrength } from "./cvScore";
import type { CvTemplate } from "./cvTemplates";

type Props = {
  data: CvData;
  onChange: (d: CvData) => void;
  tpl: CvTemplate;
  tr: boolean;
  aiComingSoon?: boolean;
  aiLocked?: boolean;
  onAiLocked?: () => void;
  disabled: boolean;
  onFullForm: () => void;
  onDownload: () => void;
  onOpenLinkedin: () => void;
  onOpenDesign: () => void;
};

/** Herkes için aynı adımlar: projeler, sertifikalar, ek bilgiler ve referanslar da burada sorulur (hepsi isteğe bağlı). */
const STEPS = ["start", "you", "work", "edu", "projects", "skills", "certs", "more", "refs", "summary", "done"] as const;
type Step = (typeof STEPS)[number];

export function CvWizard({ data, onChange, tpl, tr, aiComingSoon, aiLocked, onAiLocked, disabled, onFullForm, onDownload, onOpenLinkedin, onOpenDesign }: Props) {
  const lang = data.settings.lang;
  const [i, setI] = useState(0);
  const [profId, setProfId] = useState<string>("");
  const [graduate, setGraduate] = useState(false);
  const [ownRole, setOwnRole] = useState("");
  const step: Step = STEPS[i];
  const set = <K extends keyof CvData>(k: K, v: CvData[K]) => onChange({ ...data, [k]: v });
  const prof: Profession | null = (profId && professionById(profId)) || matchProfession(`${data.title} ${data.experience[0]?.role ?? ""}`);

  const labels: Record<Step, string> = {
    start: tr ? "Başlangıç" : "Start", you: tr ? "Siz" : "You", work: tr ? "Deneyim" : "Work", edu: tr ? "Eğitim" : "Education",
    projects: tr ? "Projeler" : "Projects", skills: tr ? "Beceriler" : "Skills", certs: tr ? "Sertifikalar" : "Certificates", more: tr ? "Ek bilgiler" : "More details", refs: tr ? "Referanslar" : "References", summary: tr ? "Özet" : "Summary", done: tr ? "Bitti" : "Done",
  };

  // Adım kuralları: ilerlemeyi engellemez, yalnız nazikçe yönlendirir
  const emailBad = emailIssue(data.email), phoneBad = phoneIssue(data.phone);
  const canNext = step === "you" ? !!data.name.trim() : true;

  const next = () => setI((x) => Math.min(STEPS.length - 1, x + 1));
  const back = () => setI((x) => Math.max(0, x - 1));

  function chooseProfession(p: Profession) {
    setProfId(p.id);
    onChange({ ...data, title: data.title.trim() || p.title[lang], settings: { ...data.settings, order: graduate ? GRADUATE_ORDER : data.settings.order } });
  }
  function useOwnRole() {
    const t = ownRole.trim();
    if (!t) return;
    const found = matchProfession(t);
    setProfId(found ? found.id : "general");
    onChange({ ...data, title: t, settings: { ...data.settings, order: graduate ? GRADUATE_ORDER : data.settings.order } });
    setI((x) => Math.min(STEPS.length - 1, x + 1));
  }
  function loadSample() {
    if (!prof) return;
    const s = professionSample(prof.id, lang);
    onChange({ ...s, photo: data.photo, showPhoto: data.showPhoto, settings: { ...data.settings, order: graduate ? GRADUATE_ORDER : data.settings.order } });
    setI(STEPS.indexOf("done"));
  }
  function toggleGraduate(v: boolean) {
    setGraduate(v);
    onChange({ ...data, settings: { ...data.settings, order: v ? GRADUATE_ORDER : null } });
  }

  const score = useMemo(() => cvStrength(data), [data]);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_30px_80px_-40px_rgba(56,189,248,0.35)]">
      {/* İlerleme */}
      <div className="border-b border-white/10 px-5 pb-4 pt-5">
        <div className="flex items-center justify-between text-[12px] font-semibold uppercase tracking-wider text-sky-300/90">
          <span>{tr ? `Adım ${i + 1} / ${STEPS.length}` : `Step ${i + 1} of ${STEPS.length}`} · {labels[step]}</span>
          <button type="button" onClick={onFullForm} className="normal-case tracking-normal text-slate-400 underline-offset-2 hover:text-white hover:underline">{tr ? "Tüm formu göster" : "Show full form"}</button>
        </div>
        <div className="mt-3 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1}>
          {STEPS.map((s, n) => (
            <button key={s} type="button" onClick={() => setI(n)} aria-label={labels[s]} className={`h-1.5 flex-1 rounded-full transition ${n < i ? "bg-sky-400" : n === i ? "bg-gradient-to-r from-sky-400 to-indigo-400" : "bg-white/10 hover:bg-white/20"}`} />
          ))}
        </div>
        {step !== "start" && step !== "done" ? (
          <p className="mt-3 text-[12px] leading-relaxed text-slate-400">{tr ? "CV önizlemesinde soluk görünen alanlar henüz doldurmadıklarınızdır. Boş bıraktığınız her şey indirdiğiniz PDF'ten otomatik silinir." : "Faded areas in the CV preview are ones you haven't filled in yet. Anything you leave empty is removed from the PDF you download."}</p>
        ) : null}
      </div>

      <fieldset disabled={disabled} className="min-w-0 space-y-4 border-0 px-5 py-5">
        {step === "start" ? (
          <>
            <Head title={tr ? "Hangi alanda çalışıyorsunuz?" : "What field do you work in?"} sub={tr ? "Seçin; size uygun cümle ve beceri önerilerini hazırlayalım. Bulamazsanız “Diğer”i seçin." : "Pick one and we'll prepare matching phrase and skill suggestions. Choose “Other” if yours isn't listed."} />
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <p className="mb-2 text-[13px] font-bold text-white">{tr ? "Mesleğinizi yazın" : "Type your role"}</p>
              <SuggestInput value={ownRole} onChange={setOwnRole} suggest={(q) => suggestTitles(q, lang)} placeholder={tr ? "Ör. Pilot, Veteriner, Mobilyacı…" : "E.g. Pilot, Veterinarian, Carpenter…"} ariaLabel={tr ? "Meslek" : "Role"} tr={tr} className={inputCls} />
              <button type="button" disabled={!ownRole.trim()} onClick={useOwnRole} className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-sky-500/20 px-4 py-2.5 text-[13px] font-bold text-sky-100 ring-1 ring-sky-400/40 hover:bg-sky-500/30 disabled:opacity-40">{tr ? "Bu mesleği kullan" : "Use this role"}<ArrowRight className="h-4 w-4" /></button>
              <p className="mt-1.5 text-[12px] text-slate-500">{tr ? "Listeden de seçebilirsiniz. Yakın bir meslek bulursak oradan öneriler getiririz; bulamazsak genel öneriler gelir. Unvanınız yazdığınız gibi kalır." : "You can also pick from the list below. If we find a close match we'll bring its suggestions; otherwise you get general ones. Your title stays exactly as typed."}</p>
            </div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">{tr ? "ya da listeden seçin" : "or pick from the list"}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROFESSIONS.map((p) => (
                <button key={p.id} type="button" onClick={() => chooseProfession(p)} aria-pressed={profId === p.id} className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left text-[13.5px] font-semibold transition ${profId === p.id ? "border-sky-400 bg-sky-500/15 text-white ring-2 ring-sky-400/40" : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/25 hover:bg-white/[0.08]"}`}>
                  {tr ? p.label.tr : p.label.en}{profId === p.id ? <Check className="h-4 w-4 text-sky-300" /> : null}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
              <input type="checkbox" checked={graduate} onChange={(e) => toggleGraduate(e.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-400" />
              <span className="text-[13px] text-slate-200"><span className="inline-flex items-center gap-1.5 font-bold text-white"><GraduationCap className="h-4 w-4 text-sky-300" />{tr ? "Yeni mezunum / deneyimim az" : "I'm a recent graduate / little experience"}</span><span className="mt-0.5 block text-[12px] text-slate-400">{tr ? "Eğitim ve projeleriniz CV'de deneyimden önce gelir." : "Education and projects come before work experience."}</span></span>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={!prof} onClick={loadSample} className="flex items-center gap-2.5 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/[0.07] px-3.5 py-3 text-left text-[13px] font-semibold text-fuchsia-100 hover:bg-fuchsia-500/15 disabled:opacity-40"><Wand2 className="h-4 w-4 shrink-0" /><span>{tr ? "Bu mesleğin örnek CV'sini aç" : "Open a sample CV for this field"}<span className="block text-[12px] font-normal text-fuchsia-200/90">{tr ? "Hazır doldurulmuş; üzerine kendi bilgilerinizi yazın" : "Pre-filled; type your own details over it"}</span></span></button>
              <button type="button" onClick={onOpenLinkedin} className="flex items-center gap-2.5 rounded-xl border border-sky-400/25 bg-sky-500/[0.07] px-3.5 py-3 text-left text-[13px] font-semibold text-sky-100 hover:bg-sky-500/15"><Linkedin className="h-4 w-4 shrink-0" /><span>{tr ? "LinkedIn / eski CV'den aktar" : "Import from LinkedIn / old CV"}<span className="block text-[12px] font-normal text-sky-200/90">{tr ? "Dosyadan cihazınızda okunur, ücretsiz" : "Read on your device, free"}</span></span></button>
            </div>
          </>
        ) : null}

        {step === "you" ? (
          <>
            <Head title={tr ? "Sizi tanıyalım" : "Let's get to know you"} sub={tr ? "İşverenin sizinle iletişime geçeceği bilgiler." : "How an employer can reach you."} />
            <PhotoField data={data} onChange={onChange} tpl={tpl} disabled={disabled} tr={tr} aiComingSoon={aiComingSoon} aiLocked={aiLocked} onAiLocked={onAiLocked} />
            <Text label={tr ? "Ad soyad" : "Full name"} value={data.name} onChange={(v) => set("name", v)} autoComplete="name" />
            <Text label={tr ? "Unvan / hedef pozisyon" : "Job title / target role"} value={data.title} onChange={(v) => set("title", v)} placeholder={prof?.title[lang] || (tr ? "Ör. Muhasebe Uzmanı" : "E.g. Accountant")} suggest={(q) => suggestTitles(q, lang)} tr={tr} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label={tr ? "E-posta" : "Email"} type="email" value={data.email} onChange={(v) => set("email", v)} autoComplete="email" error={emailBad ? (tr ? emailBad.tr : emailBad.en) : null} />
              <Text label={tr ? "Şehir" : "City"} value={data.city} onChange={(v) => set("city", v)} placeholder={tr ? "Ör. İstanbul" : "E.g. London"} autoComplete="address-level2" />
            </div>
            <PhoneField label={tr ? "Telefon" : "Phone"} value={data.phone} onChange={(v) => set("phone", v)} city={data.city} tr={tr} error={phoneBad ? (tr ? phoneBad.tr : phoneBad.en) : null} />
            {!data.name.trim() ? <p className="text-[12px] text-amber-300/90">{tr ? "Devam etmek için adınızı yazın." : "Enter your name to continue."}</p> : null}
          </>
        ) : null}

        {step === "work" ? (
          <>
            <Head title={graduate ? (tr ? "Çalıştığınız yer var mı? (isteğe bağlı)" : "Any work experience? (optional)") : (tr ? "Nerelerde çalıştınız?" : "Where have you worked?")} sub={tr ? "En son işinizden başlayın. Deneyiminiz yoksa “Atla”ya basın." : "Start with your latest job. Press “Skip” if you have none."} />
            {data.experience.map((e) => (
              <div key={e.id} className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Text label={tr ? "Pozisyon" : "Job title"} value={e.role} onChange={(v) => set("experience", patch(data.experience, e.id, { role: v }))} />
                  <Text label={tr ? "Şirket" : "Company"} value={e.company} onChange={(v) => set("experience", patch(data.experience, e.id, { company: v }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Text label={tr ? "Başlangıç" : "Start"} type="month" tr={tr} value={e.start} onChange={(v) => set("experience", patch(data.experience, e.id, { start: v }))} />
                  <Text label={tr ? "Bitiş" : "End"} type="month" tr={tr} value={e.end} disabled={e.current} error={(() => { const x = dateOrderIssue(e.start, e.end, e.current); return x ? (tr ? x.tr : x.en) : null; })()} onChange={(v) => set("experience", patch(data.experience, e.id, { end: v }))} />
                </div>
                <label className="flex items-center gap-2 text-[12.5px] text-slate-300"><input type="checkbox" className="h-4 w-4 accent-sky-400" checked={e.current} onChange={(ev) => set("experience", patch(data.experience, e.id, { current: ev.target.checked }))} />{tr ? "Hâlâ çalışıyorum" : "I currently work here"}</label>
                <Area label={tr ? "Ne yaptınız?" : "What did you do?"} rows={4} value={e.desc} onChange={(v) => set("experience", patch(data.experience, e.id, { desc: v }))} hint={tr ? "Her satır bir madde olur." : "Each line becomes a bullet."} />
                <BulletPicker tr={tr} lang={lang} hint={`${e.role} ${data.title}`} current={e.desc} onAdd={(line) => set("experience", patch(data.experience, e.id, { desc: e.desc.trim() ? `${e.desc.replace(/\s+$/, "")}\n${line}` : line }))} />
                <button type="button" onClick={() => set("experience", data.experience.filter((x) => x.id !== e.id))} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-300 hover:text-red-200"><Trash2 className="h-3.5 w-3.5" />{tr ? "Bu işi sil" : "Delete this job"}</button>
              </div>
            ))}
            <AddButton label={data.experience.length ? (tr ? "Bir iş daha ekle" : "Add another job") : (tr ? "İş deneyimi ekle" : "Add a job")} onClick={() => set("experience", [...data.experience, { id: uid(), company: "", role: prof?.title[lang] ?? "", location: "", start: "", end: "", current: false, desc: "" }])} />
          </>
        ) : null}

        {step === "edu" ? (
          <>
            <Head title={tr ? "Nerede okudunuz?" : "Where did you study?"} sub={tr ? "Önce eğitim düzeyini seçin (Lise, Lisans…), sonra okulunuzu yazın. Diploma notu ve başarılar isteğe bağlıdır." : "Pick the level first (High school, Bachelor…), then enter your school. Grade and achievements are optional."} />
            {data.education.map((e) => (
              <div key={e.id} className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3.5">
                <EducationEditor e={e} data={data} set={set} tr={tr} />
                <button type="button" onClick={() => set("education", data.education.filter((x) => x.id !== e.id))} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-300 hover:text-red-200"><Trash2 className="h-3.5 w-3.5" />{tr ? "Bu okulu sil" : "Delete this school"}</button>
              </div>
            ))}
            <AddButton label={data.education.length ? (tr ? "Bir okul daha ekle" : "Add another school") : (tr ? "Okul ekle" : "Add a school")} onClick={() => set("education", [...data.education, { id: uid(), school: "", degree: "", location: "", start: "", end: "", current: false, desc: "", level: data.education.length ? "" : "bachelor", gpa: "", gpaScale: "4", honors: "" }])} />
          </>
        ) : null}

        {step === "projects" ? (
          <>
            <Head title={tr ? "Öne çıkan projeleriniz var mı?" : "Any standout projects?"} sub={tr ? "İş, okul, gönüllülük ya da kişisel çalışmalarınızdan gurur duyduklarınızı ekleyin. Yoksa “Atla”ya basın." : "Add work, school, volunteering or personal projects you are proud of. Press “Skip” if none."} />
            <ProjectsEditor data={data} set={set} tr={tr} />
          </>
        ) : null}

        {step === "skills" ? (
          <>
            <Head title={tr ? "Nelerde iyisiniz?" : "What are you good at?"} sub={tr ? "Önerilere tıklayın ya da kendiniz yazın. Yabancı dilleri de ekleyin." : "Tap suggestions or type your own. Add your languages too."} />
            <SkillPicker tr={tr} lang={lang} hint={`${data.title} ${data.experience[0]?.role ?? ""}`} have={data.skills.map((x) => x.name)} onAdd={(name) => set("skills", [...data.skills.filter((x) => x.name.trim()), { id: uid(), name, level: 0 }])} />
            {data.skills.map((s) => (
              <div key={s.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1"><SuggestInput value={s.name} onChange={(v) => set("skills", patch(data.skills, s.id, { name: v }))} suggest={(q) => suggestSkills(q, lang, data.skills.map((x) => x.name))} placeholder={tr ? "Beceri yazın, öneriler çıkar" : "Type a skill, suggestions appear"} ariaLabel={tr ? "Beceri" : "Skill"} tr={tr} className={inputCls} /></div>
                <button type="button" onClick={() => set("skills", data.skills.filter((x) => x.id !== s.id))} aria-label={tr ? "Sil" : "Delete"} className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <AddButton label={tr ? "Beceri ekle" : "Add a skill"} onClick={() => set("skills", [...data.skills, { id: uid(), name: "", level: 0 }])} />
            <div className="border-t border-white/10 pt-4">
              <p className="mb-2 text-[13px] font-bold text-white">{tr ? "Yabancı diller" : "Languages"}</p>
              <div className="space-y-2">
                {data.languages.map((l) => (
                  <div key={l.id} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1"><SuggestInput value={l.name} onChange={(v) => set("languages", patch(data.languages, l.id, { name: v }))} suggest={(q) => suggestLanguages(q, lang, data.languages.map((x) => x.name))} placeholder={tr ? "Dil yazın (ör. Alm…)" : "Type a language"} ariaLabel={tr ? "Dil" : "Language"} tr={tr} className={inputCls} /></div>
                    <select value={LANG_LEVELS[lang].includes(l.level) ? l.level : ""} onChange={(e) => set("languages", patch(data.languages, l.id, { level: e.target.value }))} className="w-44 shrink-0 rounded-xl border border-white/10 bg-slate-900/60 px-2 py-2.5 text-[13px] text-white" aria-label={tr ? "Seviye" : "Level"}>
                      <option value="">{tr ? "Seviye seçin" : "Level"}</option>
                      {LANG_LEVELS[lang].map((lv) => <option key={lv} value={lv}>{lv}</option>)}
                    </select>
                    <button type="button" onClick={() => set("languages", data.languages.filter((x) => x.id !== l.id))} aria-label={tr ? "Sil" : "Delete"} className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <div className="mt-2"><AddButton label={tr ? "Dil ekle" : "Add language"} onClick={() => set("languages", [...data.languages, { id: uid(), name: "", level: "" }])} /></div>
            </div>
          </>
        ) : null}

        {step === "certs" ? (
          <>
            <Head title={tr ? "Sertifika ya da belgeniz var mı?" : "Any certificates or licences?"} sub={tr ? "Mesleki belgeler, kurs sertifikaları, ehliyet dışı yeterlilikler (ör. forklift belgesi, dil sınavı, yazılım kursu). Yoksa “Atla”ya basın." : "Professional licences, course certificates, qualifications (e.g. forklift licence, language exam, coding course). Press “Skip” if none."} />
            <CertsEditor data={data} set={set} tr={tr} />
          </>
        ) : null}

        {step === "more" ? (
          <>
            <Head title={tr ? "Ek bilgiler" : "More details"} sub={tr ? "Hepsi isteğe bağlı: yalnızca CV'de görünmesini istediklerinizi doldurun." : "All optional: fill in only what you want on your CV."} />
            <SocialsEditor data={data} set={set} tr={tr} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label={tr ? "Doğum tarihi" : "Date of birth"} value={data.birth} onChange={(v) => set("birth", v)} placeholder={tr ? "GG.AA.YYYY" : "DD.MM.YYYY"} />
              <Text label={tr ? "Ehliyet" : "Driving licence"} value={data.license} onChange={(v) => set("license", v)} placeholder={tr ? "Ör. B sınıfı" : "E.g. Class B"} />
            </div>
            <Area label={tr ? "İlgi alanları" : "Interests"} rows={2} value={data.interests} onChange={(v) => set("interests", v)} placeholder={tr ? "Fotoğrafçılık, yürüyüş, satranç" : "Photography, hiking, chess"} hint={tr ? "Virgülle ayırın." : "Separate with commas."} />
          </>
        ) : null}

        {step === "refs" ? (
          <>
            <Head title={tr ? "Referans vermek ister misiniz?" : "Would you like to add references?"} sub={tr ? "Sizi tanıyan eski bir yönetici ya da hocanın bilgilerini ekleyebilirsiniz. İzinlerini almayı unutmayın. İstemezseniz “Atla”ya basın; bölüm CV'de görünmez." : "Add a former manager or teacher who knows your work. Ask for their permission first. Press “Skip” otherwise; the section won't appear."} />
            <ReferencesEditor data={data} set={set} tr={tr} />
          </>
        ) : null}

        {step === "summary" ? (
          <>
            <Head title={tr ? "Kendinizi anlatın" : "Tell us about yourself"} sub={tr ? "CV'nin en üstünde okunan kısım. İstediğiniz uzunlukta yazabilir ya da bir taslağı seçip kendinize göre düzenleyebilirsiniz." : "The first thing people read. Write as much as you like, or pick a draft and make it yours."} />
            <SummaryPicker tr={tr} lang={lang} hint={`${data.title} ${data.experience[0]?.role ?? ""}`} onPick={(t) => set("summary", t)} />
            <Area label={tr ? "Profil özeti" : "Profile summary"} rows={5} value={data.summary} onChange={(v) => set("summary", v)} hint={tr ? "Köşeli [X] yerine kendi bilginizi yazın." : "Replace [X] with your own details."} />
          </>
        ) : null}

        {step === "done" ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/30 to-sky-400/20 text-emerald-200 ring-1 ring-emerald-300/30"><Check className="h-8 w-8" /></div>
            <div>
              <p className="text-xl font-black text-white">{tr ? "CV'niz hazır!" : "Your CV is ready!"}</p>
              <p className="mt-1 text-[13px] text-slate-300">{tr ? `CV gücü: %${score.value} · ${score.label.tr}` : `CV strength: ${score.value}% · ${score.label.en}`}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={onDownload} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3 text-[14px] font-bold text-white shadow-[0_10px_28px_-10px_rgba(59,130,246,0.7)] hover:brightness-110 sm:col-span-2"><Download className="h-4 w-4" />{tr ? "PDF olarak indir" : "Download as PDF"}</button>
              <button type="button" onClick={onOpenDesign} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/10"><Sparkles className="h-4 w-4" />{tr ? "Renk ve yazı tipini ayarla" : "Adjust colour & font"}</button>
              <button type="button" onClick={onFullForm} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/10"><Plus className="h-4 w-4" />{tr ? "Her şeyi tek formda düzenle" : "Edit everything in one form"}</button>
            </div>
            <p className="text-[12px] text-slate-400"><FileUp className="mr-1 inline h-3.5 w-3.5" />{tr ? "Boş bıraktığınız alanlar PDF'e eklenmez." : "Anything left empty is left out of the PDF."}</p>
          </div>
        ) : null}
      </fieldset>

      {/* Alt gezinme */}
      <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/20 px-5 py-3.5">
        <button type="button" onClick={back} disabled={i === 0} className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-30"><ArrowLeft className="h-4 w-4" />{tr ? "Geri" : "Back"}</button>
        <div className="flex items-center gap-2">
          {step !== "done" && step !== "you" && step !== "start" ? <button type="button" onClick={next} className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-slate-400 hover:bg-white/10 hover:text-white">{tr ? "Atla" : "Skip"}</button> : null}
          {step !== "done" ? (
            <button type="button" onClick={next} disabled={!canNext} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-[13.5px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(59,130,246,0.7)] hover:brightness-110 disabled:opacity-40">{tr ? "Devam" : "Next"}<ArrowRight className="h-4 w-4" /></button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h3 className="text-[20px] font-black tracking-tight text-white">{title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{sub}</p>
    </div>
  );
}
