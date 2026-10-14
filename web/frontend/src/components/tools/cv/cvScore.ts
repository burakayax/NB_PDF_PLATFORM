/**
 * Canlı "CV gücü": doluluk × kalite.
 * scoreOf() yalnızca bulunan hataları düşer; neredeyse boş bir CV'de hata da az olduğundan 100 çıkıyordu.
 * Burada önce CV'nin ne kadar DOLU olduğu ölçülür, kalite puanı onu çarpar.
 */
import { consistencyChecks, qualityChecks, scoreOf } from "./cvAnalysis";
import type { CvData } from "./cvModel";

export type Missing = { id: string; tr: string; en: string; pts: number };

const has = (s: string) => s.trim().length > 0;

export function completeness(d: CvData): { value: number; missing: Missing[] } {
  const exp = d.experience.filter((e) => has(e.role) || has(e.company));
  const expDesc = exp.some((e) => has(e.desc));
  const edu = d.education.filter((e) => has(e.school) || has(e.degree));
  const skills = d.skills.filter((s) => has(s.name));
  const rows: { id: string; ok: boolean; pts: number; tr: string; en: string }[] = [
    { id: "name", ok: has(d.name), pts: 8, tr: "Adınızı ve soyadınızı yazın.", en: "Enter your full name." },
    { id: "title", ok: has(d.title), pts: 7, tr: "Hedef pozisyonunuzu (unvan) yazın.", en: "Add your target job title." },
    { id: "email", ok: has(d.email), pts: 7, tr: "E-posta adresinizi ekleyin; işveren size ulaşabilsin.", en: "Add your email so employers can reach you." },
    { id: "phone", ok: has(d.phone), pts: 5, tr: "Telefon numaranızı ekleyin.", en: "Add your phone number." },
    { id: "city", ok: has(d.city), pts: 3, tr: "Yaşadığınız şehri ekleyin.", en: "Add your city." },
    { id: "summary", ok: has(d.summary), pts: 12, tr: "Kendinizi anlatan 2-3 cümlelik bir özet yazın.", en: "Write a 2–3 sentence profile summary." },
    { id: "exp", ok: exp.length > 0, pts: 20, tr: "En az bir iş deneyimi ekleyin (staj da olur).", en: "Add at least one job (an internship counts)." },
    { id: "expdesc", ok: expDesc, pts: 13, tr: "Deneyimlerinizin altına ne yaptığınızı maddelerle yazın.", en: "Describe what you did under each job." },
    { id: "edu", ok: edu.length > 0, pts: 10, tr: "Eğitim bilginizi ekleyin.", en: "Add your education." },
    { id: "skills", ok: skills.length >= 3, pts: 10, tr: "En az 3 beceri ekleyin.", en: "Add at least 3 skills." },
    { id: "lang", ok: d.languages.some((l) => has(l.name)), pts: 5, tr: "Bildiğiniz yabancı dilleri ekleyin.", en: "Add the languages you speak." },
  ];
  const total = rows.reduce((a, r) => a + r.pts, 0);
  const got = rows.filter((r) => r.ok).reduce((a, r) => a + r.pts, 0);
  const missing = rows.filter((r) => !r.ok).sort((a, b) => b.pts - a.pts).map(({ id, tr, en, pts }) => ({ id, tr, en, pts }));
  return { value: Math.round((got / total) * 100), missing };
}

export function cvStrength(d: CvData) {
  const c = completeness(d);
  const quality = scoreOf([...consistencyChecks(d), ...qualityChecks(d)]).value;
  const value = Math.round((c.value * quality) / 100);
  const label =
    value >= 85 ? { tr: "Güçlü", en: "Strong" } :
    value >= 65 ? { tr: "İyi, geliştirilebilir", en: "Good, can improve" } :
    value >= 35 ? { tr: "Yolun ortasında", en: "Halfway there" } :
    { tr: "Yeni başladı", en: "Just started" };
  return { value, label, missing: c.missing, filled: c.value };
}
