/**
 * CV ANALİZİ — tamamı cihazda, saf fonksiyonlar (yapay zekâ ve sunucu YOK).
 *
 *  1) consistencyChecks  → tarih/boşluk/eksik alan tutarlılığı (kesin, hesapla bulunur)
 *  2) qualityChecks      → madde yazımı: rakam, zayıf ifade, uzunluk (kural tabanlı rehber)
 *  3) matchJob           → ilan metniyle anahtar kelime eşleştirme (yaklaşık; Türkçe için gövde kırpma)
 *  4) atsXray            → ÜRETİLEN PDF'ten çıkarılan metnin okuma sırası ve alan tanıma denetimi
 *
 * DÜRÜSTLÜK: Bunlar rehberdir. Gerçek bir başvuru sisteminin (ATS) puanı ya da işe alımcının
 * kararı DEĞİLDİR; arayüzde de böyle yazılır. Kesin hesaplananlar (tarih boşluğu gibi) ile
 * sezgisel olanlar (zayıf ifade, anahtar kelime eşleşmesi) ayrı etiketlenir (`kind`).
 */
import { buildModel, type CvData, type CvLang } from "./cvModel";

export type Level = "ok" | "warn" | "bad" | "info";
export type Check = {
  id: string;
  level: Level;
  /** "exact": hesapla kesin bulundu · "heuristic": kural/sezgi tabanlı */
  kind: "exact" | "heuristic";
  tr: string;
  en: string;
  /** Düzeltme önerisi */
  fixTr?: string;
  fixEn?: string;
};

const chk = (id: string, level: Level, kind: Check["kind"], tr: string, en: string, fixTr?: string, fixEn?: string): Check => ({ id, level, kind, tr, en, fixTr, fixEn });

// ── Metin yardımcıları ─────────────────────────────────────────────────────

const lc = (s: string) => s.toLocaleLowerCase("tr");

/** CV'nin düz metni (PDF'e girecek içerik, sırayla). */
export function cvPlainText(d: CvData): string {
  const m = buildModel(d, "export");
  const out: string[] = [];
  const f = (x: { t: string } | null | undefined) => (x ? x.t : "");
  out.push(f(m.name), f(m.title), f(m.email), f(m.phone), f(m.city), f(m.website), f(m.linkedin));
  for (const k of m.order) {
    if (k === "summary") out.push(f(m.summary));
    if (k === "experience") for (const e of m.experience) out.push(f(e.role), f(e.company), f(e.location), ...e.bullets.map((b) => b.t));
    if (k === "education") for (const e of m.education) out.push(f(e.school), f(e.degree), ...e.bullets.map((b) => b.t));
    if (k === "skills") out.push(...m.skills.map((s) => f(s.name)));
    if (k === "languages") out.push(...m.languages.map((l) => f(l.name)));
    if (k === "certs") for (const c of m.certs) out.push(f(c.name), f(c.issuer));
    if (k === "projects") for (const p of m.projects) out.push(f(p.name), f(p.desc));
    if (k === "interests") out.push(...m.interests.map((i) => i.t));
    if (k === "references") for (const r of m.references) out.push(f(r.name), f(r.role));
    if (k.startsWith("custom:")) for (const c of m.custom.filter((x) => x.key === k)) for (const it of c.items) out.push(f(it.title), f(it.subtitle), f(it.desc));
  }
  return out.filter(Boolean).join("\n");
}

// ── 1) Tutarlılık (kesin) ──────────────────────────────────────────────────

/** "2020-03" → ay indeksi (yıl*12+ay). Geçersizse null. */
function monthIdx(v: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v.trim());
  if (m) return Number(m[1]) * 12 + Number(m[2]) - 1;
  const y = /^(\d{4})$/.exec(v.trim());
  if (y) return Number(y[1]) * 12;
  return null;
}

const nowIdx = (now: Date) => now.getFullYear() * 12 + now.getMonth();

export type Span = { start: number; end: number; label: string };

/** Deneyim aralıkları (ay indeksi). Başlangıcı olmayanlar atlanır; "halen" → bugün. */
export function experienceSpans(d: CvData, now = new Date()): Span[] {
  const out: Span[] = [];
  for (const e of d.experience) {
    const s = monthIdx(e.start);
    if (s === null) continue;
    const en = e.current ? nowIdx(now) : monthIdx(e.end);
    if (en === null) continue;
    out.push({ start: s, end: en, label: [e.role, e.company].filter(Boolean).join(" · ") || "—" });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Birleşik (örtüşmeler tek sayılır) toplam deneyim süresi, yıl. */
export function totalExperienceYears(d: CvData, now = new Date()): number {
  const spans = experienceSpans(d, now).filter((s) => s.end >= s.start);
  let months = 0;
  let curS = -1;
  let curE = -1;
  for (const s of spans) {
    if (curS < 0) { curS = s.start; curE = s.end; continue; }
    if (s.start <= curE + 1) curE = Math.max(curE, s.end);
    else { months += curE - curS + 1; curS = s.start; curE = s.end; }
  }
  if (curS >= 0) months += curE - curS + 1;
  return Math.round((months / 12) * 10) / 10;
}

const fmtIdx = (i: number, lang: CvLang) => {
  const mo = ((i % 12) + 12) % 12;
  const y = Math.floor(i / 12);
  const names = lang === "tr" ? ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[mo]} ${y}`;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function consistencyChecks(d: CvData, now = new Date()): Check[] {
  const out: Check[] = [];
  const lang = d.settings.lang;

  // Zorunlu alanlar
  const missing: { k: string; tr: string; en: string }[] = [];
  if (!d.name.trim()) missing.push({ k: "name", tr: "ad soyad", en: "full name" });
  if (!d.title.trim()) missing.push({ k: "title", tr: "unvan/hedef pozisyon", en: "job title" });
  if (!d.email.trim()) missing.push({ k: "email", tr: "e-posta", en: "email" });
  if (!d.phone.trim()) missing.push({ k: "phone", tr: "telefon", en: "phone" });
  if (!d.city.trim()) missing.push({ k: "city", tr: "şehir", en: "city" });
  if (missing.length) out.push(chk("contact-missing", missing.some((m) => ["name", "email", "phone"].includes(m.k)) ? "bad" : "warn", "exact", `Eksik bilgi: ${missing.map((m) => m.tr).join(", ")}.`, `Missing: ${missing.map((m) => m.en).join(", ")}.`, "İşe alımcının size ulaşabilmesi için ad, e-posta ve telefon şart.", "Recruiters need your name, email and phone to reach you."));
  else out.push(chk("contact-ok", "ok", "exact", "Ad, unvan ve iletişim bilgileri tam.", "Name, title and contact details are complete."));

  if (d.email.trim() && !EMAIL_RE.test(d.email.trim())) out.push(chk("email-format", "bad", "exact", `E-posta adresi geçersiz görünüyor: ${d.email.trim()}`, `Email looks invalid: ${d.email.trim()}`, "Yazım hatası olmadığından emin olun.", "Check for typos."));
  const digits = d.phone.replace(/\D/g, "");
  if (d.phone.trim() && (digits.length < 10 || digits.length > 15)) out.push(chk("phone-format", "warn", "exact", `Telefon numarası ${digits.length} haneli; olağan aralık 10–15.`, `Phone has ${digits.length} digits; typical range is 10–15.`, "Ülke kodunu da yazın (ör. +90 5xx xxx xx xx).", "Include the country code (e.g. +90 5xx xxx xx xx)."));

  // Deneyim tarih mantığı
  const nIdx = nowIdx(now);
  d.experience.forEach((e, i) => {
    const label = [e.role, e.company].filter(Boolean).join(" · ") || `#${i + 1}`;
    const s = monthIdx(e.start);
    const en = e.current ? nIdx : monthIdx(e.end);
    if (!e.start && (e.role || e.company)) out.push(chk(`exp-nostart-${e.id}`, "warn", "exact", `“${label}” için başlangıç tarihi yok.`, `“${label}” has no start date.`, "Tarihsiz deneyimler sistemler tarafından sıralanamaz.", "Undated experience can't be ordered by systems."));
    if (s !== null && en !== null && en < s) out.push(chk(`exp-order-${e.id}`, "bad", "exact", `“${label}”: bitiş tarihi başlangıçtan önce.`, `“${label}”: end date is before start date.`, "Tarihleri düzeltin.", "Fix the dates."));
    if (s !== null && s > nIdx) out.push(chk(`exp-future-${e.id}`, "warn", "exact", `“${label}”: başlangıç tarihi gelecekte.`, `“${label}”: start date is in the future.`));
    if (s !== null && !e.current && !e.end) out.push(chk(`exp-noend-${e.id}`, "warn", "exact", `“${label}”: bitiş tarihi yok ve “hâlâ çalışıyorum” işaretli değil.`, `“${label}”: no end date and “currently here” isn't ticked.`));
  });

  // Boşluklar
  const spans = experienceSpans(d, now).filter((x) => x.end >= x.start);
  let prevEnd = -1;
  let prevLabel = "";
  for (const sp of spans) {
    if (prevEnd >= 0 && sp.start - prevEnd - 1 >= 6) {
      const gap = sp.start - prevEnd - 1;
      out.push(chk(`gap-${sp.start}`, "info", "exact", `${gap} aylık boşluk: ${fmtIdx(prevEnd + 1, "tr")} – ${fmtIdx(sp.start - 1, "tr")} (“${prevLabel}” ile “${sp.label}” arası).`, `${gap}-month gap: ${fmtIdx(prevEnd + 1, "en")} – ${fmtIdx(sp.start - 1, "en")} (between “${prevLabel}” and “${sp.label}”).`, "Boşluk sorun değildir; ama kısa bir açıklama (eğitim, aile, proje, serbest çalışma) sorulmadan cevap verir. Özel bölüm olarak ekleyebilirsiniz.", "A gap isn't a problem, but a short note (study, family, project, freelance) answers the question before it's asked."));
    }
    if (sp.end > prevEnd) { prevEnd = sp.end; prevLabel = sp.label; }
  }

  // Özet uzunluğu
  const sl = d.summary.trim().length;
  if (sl === 0) out.push(chk("summary-none", "info", "exact", "Profil özeti yok.", "No profile summary.", "2–4 cümlelik bir özet, ilk bakışta kim olduğunuzu anlatır.", "A 2–4 sentence summary tells people who you are at a glance."));
  else if (sl < 80) out.push(chk("summary-short", "warn", "exact", `Özet çok kısa (${sl} karakter).`, `Summary is very short (${sl} characters).`, "Deneyim yılınızı, alanınızı ve hedefinizi söyleyin.", "State your years of experience, field and goal."));
  else if (sl > 700) out.push(chk("summary-long", "warn", "exact", `Özet uzun (${sl} karakter).`, `Summary is long (${sl} characters).`, "En fazla 3–4 cümleye indirin; ayrıntılar deneyim bölümünde olsun.", "Cut to 3–4 sentences; keep detail in the experience section."));
  else out.push(chk("summary-ok", "ok", "exact", `Özet uygun uzunlukta (${sl} karakter).`, `Summary length is good (${sl} characters).`));

  // Beceri yinelenmesi
  const seen = new Set<string>();
  const dup: string[] = [];
  for (const s of d.skills) {
    const k = lc(s.name.trim());
    if (!k) continue;
    if (seen.has(k)) dup.push(s.name.trim());
    seen.add(k);
  }
  if (dup.length) out.push(chk("skill-dup", "warn", "exact", `Yinelenen beceri: ${[...new Set(dup)].join(", ")}.`, `Duplicate skill: ${[...new Set(dup)].join(", ")}.`));
  if (d.skills.filter((s) => s.name.trim()).length > 20) out.push(chk("skill-many", "warn", "exact", "20'den fazla beceri listelenmiş.", "More than 20 skills listed.", "İlana en uygun 8–12 beceriyi bırakın; uzun listeler yüzeysel görünür.", "Keep the 8–12 most relevant; long lists look shallow."));

  // Eğitim tarihi
  d.education.forEach((e) => {
    const s = monthIdx(e.start);
    const en = e.current ? nIdx : monthIdx(e.end);
    if (s !== null && en !== null && en < s) out.push(chk(`edu-order-${e.id}`, "bad", "exact", `“${e.school || "Eğitim"}”: bitiş tarihi başlangıçtan önce.`, `“${e.school || "Education"}”: end date is before start date.`));
  });

  // Sıra ipucu: deneyim yeniden eskiye mi?
  const starts = d.experience.map((e) => monthIdx(e.start)).filter((x): x is number => x !== null);
  if (starts.length >= 2 && starts.some((v, i) => i > 0 && v > starts[i - 1])) {
    out.push(chk("exp-sort", "info", "exact", "Deneyimler en yeniden en eskiye sıralı değil.", "Experience isn't listed newest-first.", "Okuyucular ve başvuru sistemleri en yeni işi en üstte bekler. Maddeleri ▲▼ ile taşıyın.", "Readers and systems expect the latest job first. Move items with ▲▼."));
  }
  return out;
}

// ── 2) Kalite (rehber) ─────────────────────────────────────────────────────

const WEAK_TR = ["sorumluydum", "sorumlu idim", "sorumlu olarak", "görev aldım", "görev yaptım", "yardımcı oldum", "yardımcı olmak", "destek verdim", "çalıştım", "ilgilendim", "bulundum", "katkıda bulundum"];
const WEAK_EN = ["responsible for", "helped with", "helped to", "worked on", "duties included", "assisted with", "was involved in", "participated in", "tasked with"];

const IRREGULAR_EN = ["led", "built", "ran", "grew", "drove", "wrote", "won", "cut", "set", "made", "taught", "sold", "spent", "won", "chaired", "oversaw", "headed"];

function bulletLines(d: CvData): { text: string; where: string }[] {
  const out: { text: string; where: string }[] = [];
  for (const e of d.experience) {
    const where = [e.role, e.company].filter(Boolean).join(" · ") || "—";
    for (const raw of e.desc.split(/\r?\n/)) {
      const t = raw.replace(/^[\s•\-–*]+/, "").trim();
      if (t) out.push({ text: t, where });
    }
  }
  return out;
}

/** Eylemle bitiyor/başlıyor mu? Türkçede fiil sonda (yönettim/yönetti), İngilizcede başta (led/managed). */
export function startsOrEndsWithAction(text: string, lang: CvLang): boolean {
  const words = lc(text).replace(/[.;,!]+$/g, "").split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  if (lang === "tr") {
    const last = words[words.length - 1];
    return /(?:[dt][ıiuü](?:m|k|n|nız|niz|nuz|nüz)?|etti(?:m|k)?|ettim|tik|dik|dük|dık)$/.test(last) || /(?:mış|miş|muş|müş)$/.test(last);
  }
  const first = words[0];
  return /(?:ed|ied)$/.test(first) || IRREGULAR_EN.includes(first);
}

export function qualityChecks(d: CvData): Check[] {
  const out: Check[] = [];
  const lang = d.settings.lang;
  const bullets = bulletLines(d);

  if (!d.experience.length) {
    out.push(chk("q-noexp", "info", "exact", "Deneyim bölümü boş; madde kalitesi ölçülemedi.", "No experience entered; bullet quality can't be measured."));
    return out;
  }
  if (!bullets.length) out.push(chk("q-nobullets", "warn", "exact", "Deneyimlerinizde açıklama maddesi yok.", "Your jobs have no bullet points.", "Her iş için 2–4 madde yazın: ne yaptınız ve sonucu ne oldu?", "Write 2–4 bullets per job: what you did and what came of it."));

  d.experience.forEach((e) => {
    const n = e.desc.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).length;
    const label = [e.role, e.company].filter(Boolean).join(" · ") || "—";
    if (n > 8) out.push(chk(`q-many-${e.id}`, "warn", "exact", `“${label}”: ${n} madde var; çok uzun olabilir.`, `“${label}”: ${n} bullets — likely too long.`, "En etkili 3–6 maddeyi bırakın.", "Keep the strongest 3–6."));
  });

  if (bullets.length) {
    const withNum = bullets.filter((b) => /\d/.test(b.text));
    const ratio = withNum.length / bullets.length;
    const pct = Math.round(ratio * 100);
    out.push(
      ratio >= 0.4
        ? chk("q-numbers", "ok", "heuristic", `Maddelerin %${pct}'i rakam içeriyor — somut anlatım.`, `${pct}% of bullets contain numbers — concrete.`)
        : chk("q-numbers", ratio >= 0.2 ? "warn" : "bad", "heuristic", `Maddelerin yalnızca %${pct}'i rakam içeriyor.`, `Only ${pct}% of bullets contain numbers.`, "Mümkün olan yerde ölçü ekleyin: kaç kişi, yüzde kaç, ne kadar sürede, ne kadar bütçe. Kesin sayı yoksa yaklaşık/aralık yazın; uydurmayın.", "Add measures where you can: how many, what percent, how fast, what budget. Use approximations if exact figures aren't known — never invent."),
    );

    const weakList = lang === "tr" ? WEAK_TR : WEAK_EN;
    const weak = bullets.filter((b) => weakList.some((w) => lc(b.text).includes(w)));
    if (weak.length) out.push(chk("q-weak", "warn", "heuristic", `${weak.length} maddede zayıf/pasif ifade var: “${weak[0].text.slice(0, 70)}${weak[0].text.length > 70 ? "…" : ""}”`, `${weak.length} bullet(s) use weak/passive phrasing: “${weak[0].text.slice(0, 70)}${weak[0].text.length > 70 ? "…" : ""}”`, "“Sorumluydum/çalıştım” yerine sonucu anlatan eylem fiili kullanın: “… yönettim, … %20 artırdım”.", "Replace “responsible for/worked on” with an action verb and an outcome: “Led …, grew … 20%”."));
    else out.push(chk("q-weak", "ok", "heuristic", "Zayıf ifade kalıbı bulunmadı.", "No weak phrasing patterns found."));

    const action = bullets.filter((b) => startsOrEndsWithAction(b.text, lang));
    const ar = Math.round((action.length / bullets.length) * 100);
    out.push(
      ar >= 60
        ? chk("q-action", "ok", "heuristic", `Maddelerin %${ar}'i eylemle ${lang === "tr" ? "bitiyor" : "başlıyor"}.`, `${ar}% of bullets ${lang === "tr" ? "end" : "start"} with an action.`)
        : chk("q-action", "warn", "heuristic", `Maddelerin yalnızca %${ar}'i ${lang === "tr" ? "eylemle bitiyor" : "eylemle başlıyor"}.`, `Only ${ar}% of bullets ${lang === "tr" ? "end" : "start"} with an action verb.`, lang === "tr" ? "Türkçede cümle fiille biter: “… ekibi yönettim”. Edilgen/isimleşmiş cümleler (“… çalışmaları”) etkiyi düşürür." : "Start bullets with a verb: “Led…, Built…, Reduced…”.", lang === "tr" ? "Turkish sentences end with the verb." : "Start bullets with a verb."),
    );

    const long = bullets.filter((b) => b.text.length > 240);
    const short = bullets.filter((b) => b.text.length < 25);
    if (long.length) out.push(chk("q-long", "warn", "exact", `${long.length} madde 240 karakterden uzun (2+ satır).`, `${long.length} bullet(s) exceed 240 characters (2+ lines).`, "Her maddeyi tek fikre indirin; uzun cümleler okunmadan geçilir.", "Cut each bullet to one idea; long sentences get skipped."));
    if (short.length) out.push(chk("q-short", "info", "exact", `${short.length} madde çok kısa (<25 karakter).`, `${short.length} bullet(s) are very short (<25 characters).`));

    const first = bullets.filter((b) => (lang === "tr" ? /^(ben|benim)\b/i : /^i\b/i).test(b.text.trim()));
    if (first.length) out.push(chk("q-first", "warn", "heuristic", `${first.length} madde “${lang === "tr" ? "ben" : "I"}” ile başlıyor.`, `${first.length} bullet(s) start with “${lang === "tr" ? "ben" : "I"}”.`, "CV'de birinci tekil şahıs zamiri gerekmez.", "First-person pronouns aren't needed in a CV."));
  }
  return out;
}

// ── Genel skor ─────────────────────────────────────────────────────────────

export type Score = { value: number; label: { tr: string; en: string } };

/** Şeffaf skor: her bulgunun puana etkisi sabittir (bad −12, warn −6, info −1). */
export function scoreOf(checks: Check[]): Score {
  let v = 100;
  for (const c of checks) v -= c.level === "bad" ? 12 : c.level === "warn" ? 6 : c.level === "info" ? 1 : 0;
  v = Math.max(0, Math.min(100, v));
  const label = v >= 85 ? { tr: "Güçlü", en: "Strong" } : v >= 65 ? { tr: "İyi, geliştirilebilir", en: "Good, can improve" } : { tr: "Geliştirilmeli", en: "Needs work" };
  return { value: v, label };
}

// ── 3) İlan eşleştirici ────────────────────────────────────────────────────

const STOP_TR = new Set("ve veya ile için bir bu şu o da de ki mi mı mu mü gibi olarak olan olması olmak daha çok en her tüm bazı ama fakat ancak ise ya hem çünkü kadar sonra önce üzerinde içinde arasında karşı göre ait yeni iyi çalışma çalışan çalışmak aday adaylar adayın yapabilen yapmak etmek edebilen sahip sahibi tercihen tercih nitelikler özellikler aranan firma şirket pozisyon iş ilan başvuru yıl yıllık en az tecrübe tecrübeli deneyim deneyimli bilgi bilgisi bilgili konusunda alanında yönelik görev görevler sorumluluklar sorumlu ekip içerisinde ayrıca bunun bunu bunlar onlar ben biz sen siz".split(" "));
const STOP_EN = new Set("and or the a an to of in on for with as at by from is are be been being this that these those you your we our they their will can may must should would could have has had not no it its into over under about across within including such other more most least than then also etc per via who whom which what when where how all any each both either neither some many much very experience experienced years year work working role roles position job candidate candidates ability able strong good excellent".split(" "));

/** Küçük, kurallı gövde: Türkçede (ek sorunu) ilk 5 harf; İngilizcede yaygın ekleri at. Yaklaşık eşleşme içindir. */
export function stem(w: string, lang: CvLang): string {
  const t = lc(w);
  if (lang === "tr") return t.length >= 6 ? t.slice(0, 5) : t;
  return t.replace(/(ations|ation|ings|ing|ments|ment|ness|ies|ied|ed|es|s)$/, (m) => (m === "ies" || m === "ied" ? "y" : "")).replace(/(.)\1$/, "$1");
}

/** Sık kullanılan beceri/araç ifadeleri: ilanda geçiyorsa daha ağır sayılır. */
const LEXICON = [
  "excel", "word", "powerpoint", "outlook", "sap", "oracle", "python", "java", "javascript", "typescript", "react", "angular", "vue", "node.js", "c#", "c++", ".net", "php", "sql", "mysql", "postgresql", "mongodb", "aws", "azure", "docker", "kubernetes", "git", "linux", "power bi", "tableau", "looker", "scrum", "agile", "kanban", "jira", "confluence", "crm", "erp", "salesforce", "hubspot", "autocad", "solidworks", "photoshop", "illustrator", "figma", "indesign", "seo", "sem", "google ads", "google analytics", "meta ads", "sosyal medya", "e-ticaret", "muhasebe", "mali analiz", "bütçe", "bütçeleme", "finansal raporlama", "vergi", "tfrs", "logo", "mikro", "netsis", "tedarik zinciri", "lojistik", "ihracat", "ithalat", "satın alma", "stok yönetimi", "kalite yönetimi", "iso 9001", "iso 27001", "six sigma", "lean", "proje yönetimi", "pmp", "iş geliştirme", "müşteri ilişkileri", "satış", "pazarlama", "insan kaynakları", "işe alım", "bordro", "eğitim", "iş sağlığı ve güvenliği", "isg", "analiz", "raporlama", "sunum", "müzakere", "liderlik", "takım yönetimi", "ingilizce", "almanca", "project management", "business development", "customer success", "account management", "data analysis", "machine learning", "supply chain", "financial reporting", "stakeholder", "budgeting", "forecasting", "negotiation", "leadership", "recruiting", "payroll", "quality assurance", "ci/cd", "rest api", "graphql", "ux", "ui",
];

const REQ_HEAD = /(aranan|nitelik|gereklilik|beklenti|requirements?|qualifications?|what you|skills|yetkinlik|olmazsa)/i;

export type Keyword = { term: string; weight: number; present: boolean; hard: boolean };
export type MatchResult = {
  keywords: Keyword[];
  score: number;
  matched: Keyword[];
  missing: Keyword[];
  yearsAsked: number | null;
  yearsHave: number;
  titleHit: boolean | null;
};

function tokens(text: string): string[] {
  return (lc(text).match(/[a-zçğıöşü0-9][a-zçğıöşü0-9+#.\-/]*[a-zçğıöşü0-9+#]|[a-zçğıöşü0-9]/g) ?? []).map((t) => t.replace(/^[.\-/]+|[.\-/]+$/g, "")).filter(Boolean);
}

export function matchJob(d: CvData, adText: string, now = new Date()): MatchResult {
  const lang = d.settings.lang;
  const ad = adText.trim();
  const cv = cvPlainText(d);
  const cvLower = lc(cv);
  // CV gövde kümesi + kelime listesi
  const cvToks = tokens(cv);
  const cvStems = new Set(cvToks.map((t) => stem(t, lang)));
  const cvStemsOther = new Set(cvToks.map((t) => stem(t, lang === "tr" ? "en" : "tr")));

  const weights = new Map<string, { w: number; hard: boolean }>();
  const bump = (term: string, w: number, hard: boolean) => {
    const cur = weights.get(term);
    weights.set(term, { w: (cur?.w ?? 0) + w, hard: hard || (cur?.hard ?? false) });
  };

  // Gereksinim bölümü satırları (ağırlık artışı)
  const lines = ad.split(/\r?\n/);
  const reqLines = new Set<number>();
  let inReq = false;
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (!t) return;
    if (t.length < 60 && REQ_HEAD.test(t) && /[:：]?\s*$/.test(t)) { inReq = true; return; }
    if (t.length < 40 && /^[A-ZÇĞİÖŞÜ][^.]*:?$/.test(t) && !REQ_HEAD.test(t) && i > 0) inReq = false;
    if (inReq) reqLines.add(i);
  });

  const adLower = lc(ad);
  for (const term of LEXICON) {
    const re = new RegExp(`(^|[^a-zçğıöşü0-9])${term.replace(/[.+#/\-]/g, "\\$&")}([^a-zçğıöşü0-9]|$)`, "g");
    const hits = adLower.match(re);
    if (hits) bump(term, hits.length * 2, true);
  }

  const stop = (w: string) => STOP_TR.has(w) || STOP_EN.has(w) || w.length < 3 || /^\d+$/.test(w);
  lines.forEach((ln, i) => {
    const toks = tokens(ln);
    const boost = reqLines.has(i) ? 1.5 : 1;
    for (let k = 0; k < toks.length; k++) {
      const w = toks[k];
      if (stop(w)) continue;
      if (!LEXICON.includes(w)) bump(w, 1 * boost, false);
      const nx = toks[k + 1];
      if (nx && !stop(nx)) bump(`${w} ${nx}`, 1.2 * boost, false);
    }
  });

  // Aday terimler: tek kelimeler en az 2 geçiş ya da sözlükte; ikililer en az 2 geçiş
  const cand = [...weights.entries()]
    .filter(([term, v]) => (term.includes(" ") ? v.w >= 2.4 : v.hard || v.w >= 2))
    .map(([term, v]) => ({ term, weight: v.w, hard: v.hard }));
  // İkili varsa içindeki tek kelimeyi düşür (çift sayımı önle)
  const bigrams = cand.filter((c) => c.term.includes(" ") && !c.hard);
  const dropped = new Set(bigrams.flatMap((b) => b.term.split(" ")));
  let list = cand.filter((c) => c.term.includes(" ") || c.hard || !dropped.has(c.term));
  // Sözlük ifadelerinin parçaları çift sayılmasın
  const hardTerms = list.filter((c) => c.hard).map((c) => c.term);
  list = list.filter((c) => c.hard || !hardTerms.some((h) => h.includes(c.term) && c.term !== h));
  list.sort((a, b) => b.weight - a.weight);
  list = list.slice(0, 30);

  const present = (term: string): boolean => {
    if (cvLower.includes(term)) return true;
    const parts = term.split(" ");
    return parts.every((p) => cvStems.has(stem(p, lang)) || cvStemsOther.has(stem(p, lang === "tr" ? "en" : "tr")));
  };

  const keywords: Keyword[] = list.map((c) => ({ term: c.term, weight: Math.round(c.weight * 10) / 10, present: present(c.term), hard: c.hard }));
  const total = keywords.reduce((a, k) => a + k.weight, 0) || 1;
  const got = keywords.filter((k) => k.present).reduce((a, k) => a + k.weight, 0);

  // İstenen deneyim yılı
  let yearsAsked: number | null = null;
  const ym = /(\d{1,2})\s*\+?\s*(?:yıl|sene|years?|yrs?)/i.exec(ad);
  if (ym) yearsAsked = Number(ym[1]);

  // Unvan eşleşmesi: ilanın ilk anlamlı satırındaki kelimelerden herhangi biri CV unvanında/son rolünde geçiyor mu
  let titleHit: boolean | null = null;
  const firstLine = lines.find((l) => l.trim())?.trim() ?? "";
  if (firstLine && firstLine.length <= 90 && d.title.trim()) {
    const tt = tokens(firstLine).filter((w) => !stop(w));
    const mine = new Set(tokens(`${d.title} ${d.experience[0]?.role ?? ""}`).map((t) => stem(t, lang)));
    titleHit = tt.length > 0 && tt.some((w) => mine.has(stem(w, lang)));
  }

  return {
    keywords,
    score: Math.round((got / total) * 100),
    matched: keywords.filter((k) => k.present),
    missing: keywords.filter((k) => !k.present),
    yearsAsked,
    yearsHave: totalExperienceYears(d, now),
    titleHit,
  };
}

// ── 4) ATS röntgeni (üretilen PDF'in metni) ─────────────────────────────────

export type TextItem = { str: string; x: number; y: number; w: number; h: number; page: number };

export type XrayResult = {
  /** Çoğu ayrıştırıcının gördüğü: içerik akış sırası. */
  streamLines: string[];
  /** Bazı ayrıştırıcıların gördüğü: sayfada soldan sağa, yukarıdan aşağıya satır satır. */
  rowLines: string[];
  columns: number;
  checks: Check[];
  pages: number;
};

const HEAD_WORDS: { key: string; words: string[] }[] = [
  { key: "profile", words: ["profil", "özet", "hakkımda", "profile", "summary", "about"] },
  { key: "experience", words: ["iş deneyimi", "deneyim", "work experience", "experience", "employment"] },
  { key: "education", words: ["eğitim", "education"] },
  { key: "skills", words: ["beceriler", "yetenekler", "skills"] },
  { key: "languages", words: ["yabancı diller", "diller", "languages"] },
];

const DATE_RE = /((oca|şub|mar|nis|may|haz|tem|ağu|eyl|eki|kas|ara|jan|feb|apr|jun|jul|aug|sep|oct|nov|dec)[a-zçğıöşü]*\.?\s+)?(19|20)\d{2}/i;

/** Akış sırasındaki öğeleri satırlara böler: yeni satır = dikey konum belirgin değişince. */
function groupStream(items: TextItem[]): string[] {
  const lines: string[] = [];
  let cur = "";
  let lastY: number | null = null;
  let lastPage = -1;
  for (const it of items) {
    if (!it.str.trim()) continue;
    const newLine = lastY === null || it.page !== lastPage || Math.abs(it.y - lastY) > Math.max(3, it.h * 0.6);
    if (newLine && cur) { lines.push(cur.trim()); cur = ""; }
    cur += (cur ? " " : "") + it.str;
    lastY = it.y;
    lastPage = it.page;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

/** Satır satır (y sonra x) okuma: iki sütunlu sayfada sütunlar birbirine karışır. */
function groupRows(items: TextItem[]): string[] {
  const out: string[] = [];
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);
  for (const p of pages) {
    const its = items.filter((i) => i.page === p && i.str.trim());
    its.sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x));
    let cur = "";
    let lastY: number | null = null;
    for (const it of its) {
      if (lastY !== null && Math.abs(it.y - lastY) > Math.max(3, it.h * 0.6)) { out.push(cur.trim()); cur = ""; }
      cur += (cur ? " " : "") + it.str;
      lastY = it.y;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

/**
 * Kaç sütun var? Gerçek bir sütun, AYNI SOL KENARDAN başlayan çok sayıda metin satırıdır.
 * (Sağa yaslı tarihler farklı x'te biter/başlar ve tek sütunlu sayfada da sağda durur;
 * bunlar sütun sayılmaz.) Sol kenar kümesi ≥6 satır ve ≥5 ayrı dikey konumda olmalı.
 */
function countColumns(items: TextItem[]): number {
  const byPage = new Map<number, TextItem[]>();
  for (const it of items) if (it.str.trim().length >= 8) byPage.set(it.page, [...(byPage.get(it.page) ?? []), it]);
  let best = 1;
  for (const its of byPage.values()) {
    const bins = new Map<number, TextItem[]>();
    for (const i of its) {
      const k = Math.round(i.x / 4);
      bins.set(k, [...(bins.get(k) ?? []), i]);
    }
    const strong = [...bins.entries()]
      .filter(([, v]) => v.length >= 6 && new Set(v.map((i) => Math.round(i.y / 3))).size >= 5)
      .map(([k]) => k * 4)
      .sort((x, y) => x - y);
    if (!strong.length) continue;
    const minX = Math.min(...its.map((i) => i.x));
    const maxX = Math.max(...its.map((i) => i.x + i.w));
    const width = maxX - minX;
    if (width <= 0) continue;
    // En az iki ayrı sütun başlangıcı, birbirinden sayfa genişliğinin %20'sinden uzak
    const distinct: number[] = [];
    for (const x of strong) if (!distinct.some((d) => Math.abs(d - x) < width * 0.2)) distinct.push(x);
    if (distinct.length >= 2) best = Math.max(best, distinct.length);
  }
  return best;
}

export function atsXray(items: TextItem[], d: CvData, pages: number): XrayResult {
  const streamLines = groupStream(items);
  const rowLines = groupRows(items);
  const columns = countColumns(items);
  const all = streamLines.join("\n");
  const checks: Check[] = [];

  if (all.replace(/\s/g, "").length < 40) {
    checks.push(chk("x-text", "bad", "exact", "PDF'ten neredeyse hiç metin çıkarılamadı.", "Almost no text could be extracted from the PDF.", "Yazılar resim olarak kaydedilmiş olabilir.", "The text may have been saved as an image."));
    return { streamLines, rowLines, columns, checks, pages };
  }
  checks.push(chk("x-text", "ok", "exact", "Metin gerçek metin olarak çıkarıldı (resim değil).", "Text extracted as real text (not an image)."));

  // İlk satır ad mı
  const first = streamLines[0] ?? "";
  const nm = d.name.trim();
  if (nm) {
    checks.push(lc(first).includes(lc(nm)) ? chk("x-name", "ok", "exact", `Okunan ilk satır adınız: “${first}”.`, `First line read is your name: “${first}”.`) : chk("x-name", "bad", "exact", `Okunan ilk satır adınız değil: “${first.slice(0, 60)}”.`, `First line read isn't your name: “${first.slice(0, 60)}”.`, "Başvuru sistemleri adı ilk satırlardan alır. Adın şablonda en üstte olduğu bir düzen seçin.", "Systems take your name from the first lines. Pick a layout with the name at the top."));
  }

  // E-posta / telefon
  const emailHit = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/.exec(all);
  checks.push(emailHit ? chk("x-email", "ok", "exact", `E-posta tanındı: ${emailHit[0]}`, `Email recognised: ${emailHit[0]}`) : d.email.trim() ? chk("x-email", "bad", "exact", "E-posta metinde bulunamadı.", "Email wasn't found in the text.") : chk("x-email", "warn", "exact", "E-posta girilmemiş.", "No email entered."));
  const phoneHit = /(\+?\d[\d\s().-]{8,}\d)/.exec(all);
  checks.push(phoneHit ? chk("x-phone", "ok", "exact", `Telefon tanındı: ${phoneHit[0].trim()}`, `Phone recognised: ${phoneHit[0].trim()}`) : d.phone.trim() ? chk("x-phone", "bad", "exact", "Telefon metinde bulunamadı.", "Phone wasn't found in the text.") : chk("x-phone", "warn", "exact", "Telefon girilmemiş.", "No phone entered."));

  // Başlıklar
  const found: string[] = [];
  const notFound: string[] = [];
  const lcLines = streamLines.map((l) => lc(l));
  for (const h of HEAD_WORDS) {
    const wanted = (h.key === "profile" && d.summary.trim()) || (h.key === "experience" && d.experience.length) || (h.key === "education" && d.education.length) || (h.key === "skills" && d.skills.length) || (h.key === "languages" && d.languages.length);
    if (!wanted) continue;
    const hit = lcLines.some((l) => l.length <= 40 && h.words.some((w) => l === w || l.startsWith(w)));
    (hit ? found : notFound).push(h.key);
  }
  checks.push(notFound.length === 0 ? chk("x-heads", "ok", "heuristic", `Standart bölüm başlıkları tanındı (${found.length}).`, `Standard section headings recognised (${found.length}).`) : chk("x-heads", "warn", "heuristic", `Tanınmayan başlık(lar): ${notFound.join(", ")}.`, `Unrecognised heading(s): ${notFound.join(", ")}.`, "Sistemler “İş Deneyimi”, “Eğitim”, “Beceriler” gibi bilinen başlıkları arar.", "Systems look for familiar headings such as “Work Experience”, “Education”, “Skills”."));

  // Tarihler
  const dateLines = streamLines.filter((l) => DATE_RE.test(l)).length;
  if (d.experience.length) checks.push(dateLines >= d.experience.length ? chk("x-dates", "ok", "heuristic", `Tarih desenleri tanındı (${dateLines} satır).`, `Date patterns recognised (${dateLines} lines).`) : chk("x-dates", "warn", "heuristic", "Tarihler okunamadı ya da eksik.", "Dates weren't read or are missing.", "Her işe ay + yıl yazın (ör. Mar 2020 – Oca 2023).", "Give each job month + year (e.g. Mar 2020 – Jan 2023)."));

  // Karakter bozulması
  const bad = (all.match(/[�-]/g) ?? []).length;
  checks.push(bad === 0 ? chk("x-chars", "ok", "exact", "Karakterler bozulmadan çıktı (Türkçe karakterler dahil).", "Characters extracted intact (including Turkish letters).") : chk("x-chars", "bad", "exact", `${bad} bozuk karakter bulundu.`, `${bad} corrupted characters found.`));

  // Sütun / okuma sırası
  if (columns >= 2) {
    const same = streamLines.join("\n") === rowLines.join("\n");
    checks.push(chk("x-cols", "warn", "exact", `Sayfa ${columns} sütunlu${same ? "" : "; satır satır okuyan sistemlerde sütunlar karışır"}.`, `The page has ${columns} columns${same ? "" : "; systems that read row by row will interleave them"}.`, "Çoğu modern sistem akış sırasına bakar ve sorun çıkmaz; yine de en güvenli seçenek tek sütunlu bir şablondur (Sade, Net, Klasik Serif, Zarif, Zaman Çizgisi, Akademik).", "Most modern systems follow stream order and cope, but a single-column template is the safest (Plain, Clean, Classic Serif, Elegant, Timeline, Academic)."));
  } else checks.push(chk("x-cols", "ok", "exact", "Tek sütunlu düzen: okuma sırası sorunsuz.", "Single-column layout: reading order is straightforward."));

  checks.push(pages <= 2 ? chk("x-pages", "ok", "exact", `${pages} sayfa.`, `${pages} page(s).`) : chk("x-pages", "warn", "exact", `${pages} sayfa; çok uzun.`, `${pages} pages; quite long.`, "Çoğu başvuru için 1–2 sayfa yeterli.", "1–2 pages is enough for most applications."));
  return { streamLines, rowLines, columns, checks, pages };
}

/** Şablonun tek sütunlu (ATS açısından en güvenli) olup olmadığı — şablon rozeti için. */
export const isSingleColumnLayout = (layout: string): boolean => layout === "single" || layout === "timeline";
