/** Form alanı uyarıları (kayıt anında, yazarken): e-posta, telefon, tarih sırası. Saf fonksiyonlar. */
import type { CvData } from "./cvModel";
import { phoneLooksIncomplete } from "./cvPhone";

export type FieldIssue = { tr: string; en: string };

export function emailIssue(v: string): FieldIssue | null {
  const s = v.trim();
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? null : { tr: "E-posta adresi eksik ya da hatalı görünüyor (ör. ad@ornek.com).", en: "This email looks incomplete or wrong (e.g. name@example.com)." };
}

export function phoneIssue(v: string): FieldIssue | null {
  const s = v.trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  // Ülke kodlu (alan tarafından biçimlenen) numaralarda ülkenin kendi uzunluğuna bakılır
  if (s.startsWith("+") && !/[a-zA-Z]/.test(s)) return phoneLooksIncomplete(s) ? { tr: "Telefon numarası eksik görünüyor; ülkenizin numara uzunluğunu kontrol edin.", en: "The phone number looks incomplete; check the length for your country." } : null;
  if (/[a-zA-Z]/.test(s) || digits.length < 10 || digits.length > 15) return { tr: "Telefon numarası eksik görünüyor; alan kodunu da yazın.", en: "The phone number looks incomplete; include the area code." };
  return null;
}

export function dateOrderIssue(start: string, end: string, current: boolean): FieldIssue | null {
  if (!start || !end || current) return null;
  return end < start ? { tr: "Bitiş tarihi başlangıçtan önce olamaz.", en: "The end date can't be before the start date." } : null;
}

export function linkIssue(v: string): FieldIssue | null {
  const s = v.trim();
  if (!s) return null;
  return /\s/.test(s) || !s.includes(".") ? { tr: "Adres hatalı görünüyor (ör. linkedin.com/in/adiniz).", en: "This address looks wrong (e.g. linkedin.com/in/yourname)." } : null;
}

export type IssueRow = { id: string; tr: string; en: string };

/** CV genelindeki alan uyarılarının toplu listesi (canlı puan göstergesi kullanır). */
export function collectFieldIssues(d: CvData): IssueRow[] {
  const out: IssueRow[] = [];
  const push = (id: string, i: FieldIssue | null) => { if (i) out.push({ id, ...i }); };
  push("email", emailIssue(d.email));
  push("phone", phoneIssue(d.phone));
  push("linkedin", linkIssue(d.linkedin));
  d.experience.forEach((e, i) => push(`exp-date-${i}`, dateOrderIssue(e.start, e.end, e.current)));
  d.education.forEach((e, i) => push(`edu-date-${i}`, dateOrderIssue(e.start, e.end, e.current)));
  return out;
}
