/**
 * Meslek kütüphanesi: hazır madde/özet/beceri önerileri ve meslek örnek CV'leri.
 * Tamamı cihazda, kural tabanlı (yapay zekâ yok) — ücretsiz kullanıcıya da açık.
 *
 * DÜRÜSTLÜK: Maddelerdeki [X] yer tutucuları kullanıcıya ait gerçek rakamla doldurulmalıdır.
 * Uydurma başarı üretmeyiz; `findPlaceholders` doldurulmamış yer tutucuyu yakalar.
 */
import { normalizeCv, uid, type CvData, type CvLang } from "./cvModel";

import { PROFESSIONS } from "./cvProfessionData.mjs";
import type { Profession } from "./cvProfessionData.mjs";

export { PROFESSIONS };
export type { Profession };

export const professionById = (id: string): Profession | undefined => PROFESSIONS.find((p) => p.id === id);

/** Unvan/pozisyon metninden en uygun mesleği bulur; yoksa null. */
export function matchProfession(text: string): Profession | null {
  const t = ` ${text.toLocaleLowerCase("tr")} `;
  if (!t.trim()) return null;
  let best: { p: Profession; n: number } | null = null;
  for (const p of PROFESSIONS) {
    let n = 0;
    for (const k of p.kw) if (k && t.includes(k)) n += k.length;
    if (n > 0 && (!best || n > best.n)) best = { p, n };
  }
  return best ? best.p : null;
}

/** Doldurulmamış [X] / [Teknoloji] yer tutucuları. */
export function findPlaceholders(text: string): string[] {
  return text.match(/\[[^\]\n]{1,24}\]/g) ?? [];
}

export function hasPlaceholders(d: CvData): boolean {
  const all = [d.summary, ...d.experience.map((e) => e.desc), ...d.projects.map((p) => p.desc), ...d.education.map((e) => e.desc)].join("\n");
  return findPlaceholders(all).length > 0;
}

/** Örnek CV kurgusal olduğundan yer tutucular ([X], [Teknoloji]…) gerçekçi örnek değerlerle doldurulur. */
function fillExampleValues(text: string, tr: boolean): string {
  return text
    .replace(/\[X\]/g, "25")
    .replace(/\[(Teknoloji|technology)\]/g, tr ? "React" : "React")
    .replace(/\[(Birim|unit)\]/g, tr ? "Finans" : "Finance");
}

/** Bir meslek için tam örnek CV (kurgusal kişi). Kullanıcı üzerine yazıp kendi bilgisini girer. */
export function professionSample(id: string, lang: CvLang): CvData {
  const base = professionById(id) ?? PROFESSIONS[PROFESSIONS.length - 1];
  const fx = (t: string) => fillExampleValues(t, lang === "tr");
  const p = { ...base, summary: { ...base.summary, [lang]: base.summary[lang].map(fx) }, bullets: { ...base.bullets, [lang]: base.bullets[lang].map(fx) } };
  const tr = lang === "tr";
  const title = p.title[lang] || (tr ? "Pozisyon" : "Job title");
  return normalizeCv({
    name: tr ? "Ayşe Demir" : "Alex Morgan",
    title,
    email: tr ? "ayse.demir@ornek.com" : "alex.morgan@example.com",
    phone: tr ? "+90 532 000 00 00" : "+1 555 010 0000",
    city: tr ? "İstanbul" : "London",
    website: tr ? "aysedemir.com" : "alexmorgan.com",
    linkedin: tr ? "linkedin.com/in/aysedemir" : "linkedin.com/in/alexmorgan",
    license: tr ? "B Sınıfı" : "",
    summary: p.summary[lang][0],
    experience: [
      { id: uid(), company: tr ? "Örnek Şirket A.Ş." : "Sample Company Ltd.", role: title, location: tr ? "İstanbul" : "London", start: "2021-02", end: "", current: true, desc: p.bullets[lang].slice(0, 4).join("\n") },
      { id: uid(), company: tr ? "Birinci Firma Ltd. Şti." : "First Employer Inc.", role: title, location: tr ? "Ankara" : "Manchester", start: "2018-06", end: "2021-01", current: false, desc: p.bullets[lang].slice(4, 7).join("\n") },
      { id: uid(), company: tr ? "Başlangıç Grup" : "Starter Group", role: tr ? `Asistan ${title}` : `Junior ${title}`, location: tr ? "İzmir" : "Leeds", start: "2016-07", end: "2018-05", current: false, desc: p.bullets[lang].slice(7, 9).join("\n") },
    ],
    education: [
      { id: uid(), school: tr ? "Örnek Üniversitesi" : "Sample University", degree: tr ? "Lisans" : "Bachelor's degree", location: tr ? "Ankara" : "Manchester", start: "2012-09", end: "2016-06", current: false, desc: "" },
      { id: uid(), school: tr ? "Örnek Anadolu Lisesi" : "Sample High School", degree: tr ? "Lise" : "High school diploma", location: tr ? "İstanbul" : "London", start: "2008-09", end: "2012-06", current: false, desc: "" },
    ],
    skills: p.skills[lang].slice(0, 8).map((name, i) => ({ id: uid(), name, level: i < 3 ? 5 : 4 })),
    languages: [
      { id: uid(), name: tr ? "Türkçe" : "English", level: tr ? "Ana dil" : "Native" },
      { id: uid(), name: tr ? "İngilizce" : "Spanish", level: tr ? "Orta-üstü (B2)" : "Intermediate (B1)" },
      { id: uid(), name: tr ? "Almanca" : "French", level: tr ? "Başlangıç (A1–A2)" : "Beginner (A1–A2)" },
    ],
    certs: [
      { id: uid(), name: tr ? "Mesleki Yeterlilik Belgesi" : "Professional Certificate", issuer: tr ? "Örnek Eğitim Kurumu" : "Sample Institute", date: "2020-06" },
      { id: uid(), name: tr ? "İleri Düzey Ofis Programları" : "Advanced Office Skills", issuer: tr ? "Örnek Akademi" : "Sample Academy", date: "2018-11" },
    ],
    projects: [{ id: uid(), name: tr ? "Süreç İyileştirme Projesi" : "Process Improvement Project", link: "", desc: p.bullets[lang].slice(9, 10).join(" ") }],
    references: [{ id: uid(), name: tr ? "Mehmet Kaya" : "Jordan Lee", role: tr ? "Departman Müdürü, Örnek Şirket A.Ş." : "Department Head, Sample Company Ltd.", contact: tr ? "mehmet.kaya@ornek.com" : "jordan.lee@example.com" }],
    interests: tr ? "Kitap okumak, Yürüyüş, Fotoğrafçılık" : "Reading, Hiking, Photography",
    settings: { ...normalizeCv({}).settings, lang },
  });
}
