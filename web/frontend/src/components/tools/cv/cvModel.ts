/**
 * CV OLUŞTUR — veri modeli, örnek veri ve "görünüm modeli".
 *
 * Kullanıcının girdiği HAM veri (CvData) şablonlara doğrudan verilmez; önce
 * `buildModel` ile görünüm modeline çevrilir. Böylece tek kural iki yerde çalışır:
 *
 *  • mode "draft"   → boş bırakılan her alan SOLUK bir yer tutucu olarak görünür
 *                     (canlı önizleme: kullanıcı neyi doldurabileceğini görsün)
 *  • mode "export"  → boş alan ve boş bölüm HİÇ üretilmez (PDF'te iz kalmaz)
 *  • mode "blank"   → her alan yer tutucu metinle dolu şablon (elle doldurmak için)
 */

export type CvLang = "tr" | "en";
export type CvSize = "s" | "m" | "l";

export type CvPhoto = { src: string; zoom: number; x: number; y: number };

export type CvExperience = { id: string; company: string; role: string; location: string; start: string; end: string; current: boolean; desc: string };
export type CvEducation = { id: string; school: string; degree: string; location: string; start: string; end: string; current: boolean; desc: string };
export type CvSkill = { id: string; name: string; level: number };
export type CvLanguageItem = { id: string; name: string; level: string };
export type CvCert = { id: string; name: string; issuer: string; date: string };
export type CvProject = { id: string; name: string; link: string; desc: string };
export type CvReference = { id: string; name: string; role: string; contact: string };

export type CvData = {
  name: string;
  title: string;
  email: string;
  phone: string;
  city: string;
  website: string;
  linkedin: string;
  birth: string;
  license: string;
  summary: string;
  photo: CvPhoto | null;
  showPhoto: boolean;
  experience: CvExperience[];
  education: CvEducation[];
  skills: CvSkill[];
  languages: CvLanguageItem[];
  certs: CvCert[];
  projects: CvProject[];
  references: CvReference[];
  interests: string;
  settings: { lang: CvLang; accent: string | null; size: CvSize };
};

let seq = 0;
export const uid = (): string => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export const EMPTY_CV: CvData = {
  name: "", title: "", email: "", phone: "", city: "", website: "", linkedin: "", birth: "", license: "", summary: "",
  photo: null, showPhoto: true,
  experience: [], education: [], skills: [], languages: [], certs: [], projects: [], references: [], interests: "",
  settings: { lang: "tr", accent: null, size: "m" },
};

/** Şablon vitrininde ve "örnekle doldur" düğmesinde kullanılan örnek içerik. */
export function sampleCv(lang: CvLang): CvData {
  const tr = lang === "tr";
  return {
    name: tr ? "Elif Yılmaz" : "Emma Carter",
    title: tr ? "Kıdemli Proje Yöneticisi" : "Senior Project Manager",
    email: tr ? "elif.yilmaz@ornek.com" : "emma.carter@example.com",
    phone: tr ? "+90 532 000 00 00" : "+1 555 010 0000",
    city: tr ? "İstanbul, Türkiye" : "London, UK",
    website: tr ? "elifyilmaz.com" : "emmacarter.com",
    linkedin: tr ? "linkedin.com/in/elifyilmaz" : "linkedin.com/in/emmacarter",
    birth: "",
    license: tr ? "B sınıfı" : "",
    summary: tr
      ? "10 yılı aşkın deneyime sahip, sonuç odaklı proje yöneticisi. Çok disiplinli ekipleri yöneterek bütçe ve takvim hedeflerinin üzerinde teslimatlar gerçekleştirdim. Veriye dayalı karar almayı ve açık iletişimi önemserim."
      : "Results-driven project manager with 10+ years of experience leading cross-functional teams to deliver ahead of budget and schedule. Committed to data-informed decisions and clear communication.",
    photo: null,
    showPhoto: true,
    experience: [
      {
        id: "e1", company: tr ? "Anadolu Teknoloji A.Ş." : "Northwind Technologies", role: tr ? "Kıdemli Proje Yöneticisi" : "Senior Project Manager",
        location: tr ? "İstanbul" : "London", start: "2020-03", end: "", current: true,
        desc: tr
          ? "12 kişilik ürün ekibini yönetti; teslim süresini %25 kısalttı\nYıllık 4 milyon TL bütçeli portföyü planladı ve raporladı\nSüreç iyileştirmeleriyle müşteri memnuniyetini %18 artırdı"
          : "Led a 12-person product team and cut delivery time by 25%\nPlanned and reported on a £3M annual portfolio\nRaised customer satisfaction by 18% through process improvements",
      },
      {
        id: "e2", company: tr ? "Marmara Danışmanlık" : "Contoso Consulting", role: tr ? "Proje Yöneticisi" : "Project Manager",
        location: tr ? "Ankara" : "Manchester", start: "2016-06", end: "2020-02", current: false,
        desc: tr
          ? "Kamu ve özel sektörden 20'den fazla projeyi başarıyla tamamladı\nPaydaş toplantılarını ve risk yönetimini koordine etti"
          : "Delivered 20+ public and private sector projects\nCoordinated stakeholder meetings and risk management",
      },
    ],
    education: [
      {
        id: "d1", school: tr ? "Orta Doğu Teknik Üniversitesi" : "University of Manchester", degree: tr ? "Endüstri Mühendisliği, Lisans" : "BSc Industrial Engineering",
        location: tr ? "Ankara" : "Manchester", start: "2012-09", end: "2016-06", current: false, desc: "",
      },
    ],
    skills: [
      { id: "s1", name: tr ? "Proje Yönetimi" : "Project Management", level: 5 },
      { id: "s2", name: "Agile / Scrum", level: 5 },
      { id: "s3", name: tr ? "Bütçe Yönetimi" : "Budgeting", level: 4 },
      { id: "s4", name: tr ? "Risk Analizi" : "Risk Analysis", level: 4 },
      { id: "s5", name: "Jira, MS Project", level: 4 },
    ],
    languages: [
      { id: "l1", name: tr ? "Türkçe" : "English", level: tr ? "Ana dil" : "Native" },
      { id: "l2", name: tr ? "İngilizce" : "Spanish", level: tr ? "İleri (C1)" : "Intermediate (B1)" },
    ],
    certs: [{ id: "c1", name: "PMP", issuer: "PMI", date: "2019-05" }],
    projects: [],
    references: [],
    interests: tr ? "Fotoğrafçılık, Yürüyüş, Satranç" : "Photography, Hiking, Chess",
    settings: { lang, accent: null, size: "m" },
  };
}

// ── Etiketler ──────────────────────────────────────────────────────────────

export type Labels = {
  profile: string; experience: string; education: string; skills: string; languages: string; certs: string;
  projects: string; interests: string; references: string; contact: string; personal: string; present: string;
  birth: string; license: string;
};

export const LABELS: Record<CvLang, Labels> = {
  tr: {
    profile: "Profil", experience: "İş Deneyimi", education: "Eğitim", skills: "Beceriler", languages: "Yabancı Diller", certs: "Sertifikalar",
    projects: "Projeler", interests: "İlgi Alanları", references: "Referanslar", contact: "İletişim", personal: "Kişisel Bilgiler", present: "Devam ediyor",
    birth: "Doğum tarihi", license: "Ehliyet",
  },
  en: {
    profile: "Profile", experience: "Work Experience", education: "Education", skills: "Skills", languages: "Languages", certs: "Certifications",
    projects: "Projects", interests: "Interests", references: "References", contact: "Contact", personal: "Personal Details", present: "Present",
    birth: "Date of birth", license: "Driving licence",
  },
};

export const LANG_LEVELS: Record<CvLang, string[]> = {
  tr: ["Ana dil", "İleri (C1–C2)", "Orta-üstü (B2)", "Orta (B1)", "Başlangıç (A1–A2)"],
  en: ["Native", "Advanced (C1–C2)", "Upper-intermediate (B2)", "Intermediate (B1)", "Beginner (A1–A2)"],
};

const PH: Record<CvLang, Record<string, string>> = {
  tr: {
    name: "Adınız Soyadınız", title: "Unvanınız / Hedef pozisyon", email: "eposta@ornek.com", phone: "+90 5XX XXX XX XX", city: "Şehir, Ülke",
    website: "web-siteniz.com", linkedin: "linkedin.com/in/adiniz", birth: "GG.AA.YYYY", license: "Ehliyet sınıfı",
    summary: "Kendinizi iki-üç cümleyle tanıtın: deneyiminiz, güçlü yönleriniz ve hedefiniz.",
    company: "Şirket adı", role: "Pozisyon", location: "Şehir", dates: "Başlangıç – Bitiş", bullet: "Başarınızı rakamla anlatan bir madde ekleyin",
    school: "Okul / Üniversite", degree: "Bölüm, Derece", skill: "Beceri", language: "Dil", langLevel: "Seviye",
    cert: "Sertifika adı", issuer: "Veren kurum", project: "Proje adı", projectDesc: "Projeyi kısaca anlatın", refName: "Referans kişi", refRole: "Unvan, Kurum", refContact: "Telefon / e-posta",
    interest: "İlgi alanlarınız",
  },
  en: {
    name: "Your Full Name", title: "Job title / Target role", email: "email@example.com", phone: "+1 555 000 0000", city: "City, Country",
    website: "yourwebsite.com", linkedin: "linkedin.com/in/yourname", birth: "DD.MM.YYYY", license: "Licence class",
    summary: "Introduce yourself in two or three sentences: your experience, strengths and goal.",
    company: "Company name", role: "Job title", location: "City", dates: "Start – End", bullet: "Add an achievement with a number",
    school: "School / University", degree: "Major, Degree", skill: "Skill", language: "Language", langLevel: "Level",
    cert: "Certificate name", issuer: "Issuer", project: "Project name", projectDesc: "Describe the project briefly", refName: "Reference name", refRole: "Title, Company", refContact: "Phone / email",
    interest: "Your interests",
  },
};

export const placeholder = (lang: CvLang, key: string): string => PH[lang][key] ?? key;

// ── Tarih biçimi ───────────────────────────────────────────────────────────

const MONTHS: Record<CvLang, string[]> = {
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** "2020-03" → "Mar 2020"; "2020" → "2020"; serbest metin olduğu gibi. */
export function fmtMonth(v: string, lang: CvLang): string {
  const m = /^(\d{4})-(\d{2})$/.exec(v.trim());
  if (m) return `${MONTHS[lang][Number(m[2]) - 1] ?? ""} ${m[1]}`.trim();
  return v.trim();
}

function dateRange(start: string, end: string, current: boolean, L: Labels, lang: CvLang): string {
  const s = fmtMonth(start, lang);
  const e = current ? L.present : fmtMonth(end, lang);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

// ── Görünüm modeli ─────────────────────────────────────────────────────────

/** Metin alanı: `g` = yer tutucu (soluk). null = hiç üretilmez. */
export type Fld = { t: string; g: boolean } | null;
export type BuildMode = "draft" | "export" | "blank";

export type MExperience = { company: Fld; role: Fld; location: Fld; dates: Fld; bullets: { t: string; g: boolean }[]; ghost: boolean };
export type MEducation = { school: Fld; degree: Fld; location: Fld; dates: Fld; bullets: { t: string; g: boolean }[]; ghost: boolean };

export type CvModel = {
  lang: CvLang;
  labels: Labels;
  mode: BuildMode;
  name: Fld; title: Fld; email: Fld; phone: Fld; city: Fld; website: Fld; linkedin: Fld; birth: Fld; license: Fld;
  summary: Fld;
  photo: { data: CvPhoto | null; ghost: boolean } | null;
  experience: MExperience[];
  education: MEducation[];
  skills: { name: Fld; level: number }[];
  languages: { name: Fld; level: Fld }[];
  certs: { name: Fld; issuer: Fld; date: Fld }[];
  projects: { name: Fld; link: Fld; desc: Fld }[];
  references: { name: Fld; role: Fld; contact: Fld }[];
  interests: { t: string; g: boolean }[];
  has: { contact: boolean; skills: boolean; languages: boolean; interests: boolean };
};

export function buildModel(d: CvData, mode: BuildMode): CvModel {
  const lang = d.settings.lang;
  const L = LABELS[lang];
  const ph = (k: string): string => placeholder(lang, k);
  const showGhost = mode !== "export";
  const allGhost = mode === "blank";

  /** Ham metin → alan. Dolu: gerçek değer. Boş: draft/blank'te yer tutucu, export'ta null. */
  const f = (raw: string, phKey: string): Fld => {
    const v = allGhost ? "" : raw.trim();
    if (v) return { t: v, g: false };
    return showGhost ? { t: ph(phKey), g: true } : null;
  };
  /** Sadece doluysa görünen alan (taslakta bile yer tutucu istemeyenler için değil — bunlar taslakta da gösterilir). */
  const bullets = (raw: string): { t: string; g: boolean }[] => {
    const lines = (allGhost ? "" : raw).split(/\r?\n/).map((s) => s.replace(/^[\s•\-–*]+/, "").trim()).filter(Boolean);
    if (lines.length) return lines.map((t) => ({ t, g: false }));
    return showGhost ? [{ t: ph("bullet"), g: true }] : [];
  };

  const exp = allGhost ? [] : d.experience;
  const edu = allGhost ? [] : d.education;

  const experience: MExperience[] = exp.map((e) => ({
    company: f(e.company, "company"), role: f(e.role, "role"), location: f(e.location, "location"),
    dates: (() => { const s = dateRange(e.start, e.end, e.current, L, lang); return s ? { t: s, g: false } : showGhost ? { t: ph("dates"), g: true } : null; })(),
    bullets: bullets(e.desc), ghost: false,
  }));
  if (!experience.length && showGhost) {
    experience.push({
      company: { t: ph("company"), g: true }, role: { t: ph("role"), g: true }, location: { t: ph("location"), g: true },
      dates: { t: ph("dates"), g: true }, bullets: [{ t: ph("bullet"), g: true }], ghost: true,
    });
  }

  const education: MEducation[] = edu.map((e) => ({
    school: f(e.school, "school"), degree: f(e.degree, "degree"), location: f(e.location, "location"),
    dates: (() => { const s = dateRange(e.start, e.end, e.current, L, lang); return s ? { t: s, g: false } : showGhost ? { t: ph("dates"), g: true } : null; })(),
    bullets: e.desc.trim() ? bullets(e.desc) : [], ghost: false,
  }));
  if (!education.length && showGhost) {
    education.push({ school: { t: ph("school"), g: true }, degree: { t: ph("degree"), g: true }, location: null, dates: { t: ph("dates"), g: true }, bullets: [], ghost: true });
  }

  const skillsRaw = allGhost ? [] : d.skills.filter((s) => s.name.trim());
  const skills = skillsRaw.map((s) => ({ name: { t: s.name.trim(), g: false } as Fld, level: s.level }));
  if (!skills.length && showGhost) for (let i = 0; i < 3; i++) skills.push({ name: { t: ph("skill"), g: true }, level: 0 });

  const langRaw = allGhost ? [] : d.languages.filter((s) => s.name.trim());
  const languages = langRaw.map((s) => ({ name: { t: s.name.trim(), g: false } as Fld, level: s.level.trim() ? ({ t: s.level.trim(), g: false } as Fld) : null }));
  if (!languages.length && showGhost) languages.push({ name: { t: ph("language"), g: true }, level: { t: ph("langLevel"), g: true } });

  const certRaw = allGhost ? [] : d.certs.filter((c) => c.name.trim());
  const certs = certRaw.map((c) => ({
    name: { t: c.name.trim(), g: false } as Fld,
    issuer: c.issuer.trim() ? ({ t: c.issuer.trim(), g: false } as Fld) : null,
    date: c.date.trim() ? ({ t: fmtMonth(c.date, lang), g: false } as Fld) : null,
  }));
  if (!certs.length && showGhost) certs.push({ name: { t: ph("cert"), g: true }, issuer: { t: ph("issuer"), g: true }, date: null });

  const projRaw = allGhost ? [] : d.projects.filter((p) => p.name.trim());
  const projects = projRaw.map((p) => ({
    name: { t: p.name.trim(), g: false } as Fld,
    link: p.link.trim() ? ({ t: p.link.trim(), g: false } as Fld) : null,
    desc: p.desc.trim() ? ({ t: p.desc.trim(), g: false } as Fld) : null,
  }));
  if (!projects.length && showGhost) projects.push({ name: { t: ph("project"), g: true }, link: null, desc: { t: ph("projectDesc"), g: true } });

  const refRaw = allGhost ? [] : d.references.filter((p) => p.name.trim());
  const references = refRaw.map((p) => ({
    name: { t: p.name.trim(), g: false } as Fld,
    role: p.role.trim() ? ({ t: p.role.trim(), g: false } as Fld) : null,
    contact: p.contact.trim() ? ({ t: p.contact.trim(), g: false } as Fld) : null,
  }));
  if (!references.length && showGhost) references.push({ name: { t: ph("refName"), g: true }, role: { t: ph("refRole"), g: true }, contact: { t: ph("refContact"), g: true } });

  const intRaw = allGhost ? [] : d.interests.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean);
  const interests = intRaw.length ? intRaw.map((t) => ({ t, g: false })) : showGhost ? [{ t: ph("interest"), g: true }] : [];

  const photo: CvModel["photo"] = !d.showPhoto ? null : d.photo && !allGhost ? { data: d.photo, ghost: false } : showGhost ? { data: null, ghost: true } : null;

  const m: CvModel = {
    lang, labels: L, mode,
    name: f(d.name, "name"), title: f(d.title, "title"), email: f(d.email, "email"), phone: f(d.phone, "phone"), city: f(d.city, "city"),
    website: f(d.website, "website"), linkedin: f(d.linkedin, "linkedin"),
    // Doğum tarihi ve ehliyet: yalnız doluysa (ya da taslak/boş şablonda ipucu olarak) görünür
    birth: f(d.birth, "birth"), license: f(d.license, "license"),
    summary: f(d.summary, "summary"),
    photo, experience, education, skills, languages, certs, projects, references, interests,
    has: { contact: false, skills: false, languages: false, interests: false },
  };
  m.has = {
    contact: !!(m.email || m.phone || m.city || m.website || m.linkedin || m.birth || m.license),
    skills: skills.length > 0, languages: languages.length > 0, interests: interests.length > 0,
  };
  return m;
}

/** Kullanıcı gerçekten bir şey girdi mi? (taslak koruma / "örnekle doldur" uyarısı için) */
export function isCvEmpty(d: CvData): boolean {
  return !d.name && !d.title && !d.summary && !d.email && !d.phone && !d.experience.length && !d.education.length && !d.skills.length && !d.photo;
}
