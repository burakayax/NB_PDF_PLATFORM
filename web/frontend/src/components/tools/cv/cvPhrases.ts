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

/** Bir meslek için tam örnek CV (kurgusal kişi). Kullanıcı üzerine yazıp kendi bilgisini girer. */
export function professionSample(id: string, lang: CvLang): CvData {
  const p = professionById(id) ?? PROFESSIONS[PROFESSIONS.length - 1];
  const tr = lang === "tr";
  const title = p.title[lang] || (tr ? "Pozisyon" : "Job title");
  return normalizeCv({
    name: tr ? "Ayşe Demir" : "Alex Morgan",
    title,
    email: tr ? "ayse.demir@ornek.com" : "alex.morgan@example.com",
    phone: tr ? "+90 532 000 00 00" : "+1 555 010 0000",
    city: tr ? "İstanbul" : "London",
    summary: p.summary[lang][0],
    experience: [
      { id: uid(), company: tr ? "Örnek Şirket A.Ş." : "Sample Company Ltd.", role: title, location: tr ? "İstanbul" : "London", start: "2021-02", end: "", current: true, desc: p.bullets[lang].slice(0, 3).join("\n") },
      { id: uid(), company: tr ? "Birinci Firma" : "First Employer", role: title, location: tr ? "Ankara" : "Manchester", start: "2018-06", end: "2021-01", current: false, desc: p.bullets[lang].slice(3, 5).join("\n") },
    ],
    education: [{ id: uid(), school: tr ? "Örnek Üniversitesi" : "Sample University", degree: tr ? "Lisans" : "Bachelor's degree", location: "", start: "2014-09", end: "2018-06", current: false, desc: "" }],
    skills: p.skills[lang].slice(0, 6).map((name, i) => ({ id: uid(), name, level: i < 2 ? 5 : 4 })),
    languages: [{ id: uid(), name: tr ? "Türkçe" : "English", level: tr ? "Ana dil" : "Native" }, { id: uid(), name: tr ? "İngilizce" : "Spanish", level: tr ? "Orta-üstü (B2)" : "Intermediate (B1)" }],
    settings: { ...normalizeCv({}).settings, lang },
  });
}
