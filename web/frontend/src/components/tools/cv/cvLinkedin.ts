/**
 * LinkedIn "PDF olarak kaydet" çıktısını CİHAZDA, kurallarla CV alanlarına ayırır (yapay zekâ yok, ücretsiz).
 * Heuristiktir: bölüm başlıklarına ve tarih satırlarına dayanır; kullanıcı sonucu kontrol etmelidir.
 */
import type { ParsedCv } from "./cvAi";

const HEAD: Record<string, string> = {
  contact: "contact", iletişim: "contact", iletisim: "contact",
  "top skills": "skills", "en önemli beceriler": "skills", "en onemli beceriler": "skills", skills: "skills", beceriler: "skills",
  languages: "languages", diller: "languages",
  certifications: "certs", sertifikalar: "certs", lisanslar: "certs", "licenses & certifications": "certs",
  summary: "summary", özet: "summary", ozet: "summary", about: "summary", hakkında: "summary",
  experience: "experience", deneyim: "experience",
  education: "education", eğitim: "education", egitim: "education",
  publications: "other", yayınlar: "other", "honors-awards": "other", "honors & awards": "other", ödüller: "other", projects: "projects", projeler: "projects",
};
const RIGHT = new Set(["summary", "experience", "education", "projects", "other"]);

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  ocak: "01", şubat: "02", subat: "02", mart: "03", nisan: "04", mayıs: "05", mayis: "05", haziran: "06", temmuz: "07", ağustos: "08", agustos: "08", eylül: "09", eylul: "09", ekim: "10", kasım: "11", kasim: "11", aralık: "12", aralik: "12",
  jan: "01", feb: "02", mar: "03", apr: "04", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const PRESENT = /(present|devam|günümüz|halen|şu an)/i;
const DATE_TOKEN = String.raw`(?:[A-Za-zÇĞİÖŞÜçğıöşü]+\.?\s+)?\d{4}`;
const RANGE = new RegExp(String.raw`^(${DATE_TOKEN})\s*[-–—]\s*(${DATE_TOKEN}|present|devam(?:\s+ediyor)?|günümüz|halen)`, "i");

function toYm(tok: string): string {
  const m = tok.trim().match(/^(?:([A-Za-zÇĞİÖŞÜçğıöşü]+)\.?\s+)?(\d{4})$/);
  if (!m) return "";
  const mon = m[1] ? MONTHS[m[1].toLocaleLowerCase("tr")] : undefined;
  return `${m[2]}-${mon ?? "01"}`;
}

function levelFrom(raw: string): string {
  const s = raw.toLocaleLowerCase("tr");
  if (/native|bilingual|ana dil|anadil/.test(s)) return "Ana dil";
  if (/full professional|tam profesyonel/.test(s)) return "İleri (C1–C2)";
  if (/professional working|profesyonel çalışma|mesleki/.test(s)) return "Orta-üstü (B2)";
  if (/limited working|sınırlı/.test(s)) return "Orta (B1)";
  if (/elementary|temel/.test(s)) return "Başlangıç (A1–A2)";
  return raw.trim();
}

const NOISE = /^(page\s+\d+\s+of\s+\d+|sayfa\s+\d+\s*\/?\s*\d*|\d+\s*\/\s*\d+)$/i;
const DURATION = /^\(?\d+\s*(yıl|yil|years?|yrs?|ay|months?|mos?)\b/i;

export type LinkedinParse = { parsed: ParsedCv; found: { experience: number; education: number; skills: number; languages: number } };

export function parseLinkedinText(raw: string): LinkedinParse {
  const lines = raw.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter((l) => l && !NOISE.test(l));

  // Başlık indeksleri
  const heads: { i: number; k: string }[] = [];
  lines.forEach((l, i) => {
    const k = HEAD[l.toLocaleLowerCase("tr").replace(/[:：]$/, "")];
    if (k) heads.push({ i, k });
  });

  const firstRight = heads.find((h) => RIGHT.has(h.k))?.i ?? lines.length;
  // Sağ sütun başlamadan hemen önceki 3 satır: Ad / Unvan / Konum
  const nbStart = Math.max(0, firstRight - 3);
  const nb = lines.slice(nbStart, firstRight);
  let name = "", title = "", city = "";
  if (nb.length === 3) [name, title, city] = nb;
  else if (nb.length === 2) [name, title] = nb;

  const sectionLines = (key: string, from?: number): string[] => {
    const hs = heads.filter((h) => h.k === key);
    if (!hs.length) return [];
    const h = hs[0];
    const next = heads.find((x) => x.i > h.i)?.i ?? lines.length;
    const limit = RIGHT.has(key) ? next : Math.min(next, nbStart > h.i ? nbStart : next);
    void from;
    return lines.slice(h.i + 1, Math.max(h.i + 1, limit));
  };

  // İletişim
  const contact = sectionLines("contact");
  const email = (lines.join(" ").match(/[^\s@()]+@[^\s@()]+\.[^\s@()]+/) ?? [""])[0];
  const phoneM = contact.find((l) => /\d{3}[\s-]?\d{3}/.test(l) && !/@|linkedin|http|www/i.test(l));
  const linkedin = (contact.join(" ").match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s()]+/i) ?? [""])[0].replace(/^https?:\/\//, "").replace(/^www\./, "");
  const website = contact.map((l) => l.match(/^(?:https?:\/\/)?(?:www\.)?(?!linkedin)[a-z0-9-]+\.[a-z.]{2,}(?:\/\S*)?/i)?.[0] ?? "").find((x) => x && !x.includes("@")) ?? "";

  const skills = sectionLines("skills").slice(0, 12);
  const languages = sectionLines("languages").map((l) => {
    const m = l.match(/^(.+?)\s*\((.+)\)\s*$/);
    return m ? { name: m[1].trim(), level: levelFrom(m[2]) } : { name: l, level: "" };
  });
  const certs = sectionLines("certs").filter((l) => l.length > 2).slice(0, 10).map((n) => ({ name: n, issuer: "", date: "" }));
  const summary = sectionLines("summary").join(" ").replace(/\s+/g, " ").trim();

  // Deneyim: tarih satırı bulunan her giriş. Rol = tarihten önceki satır, şirket = ondan önceki satır.
  const expRaw = sectionLines("experience");
  const experience: ParsedCv["experience"] = [];
  const dateIdx: number[] = [];
  expRaw.forEach((l, i) => { if (RANGE.test(l)) dateIdx.push(i); });
  dateIdx.forEach((di, n) => {
    const m = expRaw[di].match(RANGE)!;
    const role = expRaw[di - 1] ?? "";
    let company = expRaw[di - 2] ?? "";
    if (!company || DURATION.test(company) || (n > 0 && di - 2 <= dateIdx[n - 1] + 1)) company = n > 0 ? experience[n - 1].company : company;
    const endIdx = (dateIdx[n + 1] ?? expRaw.length) - 2;
    const body = expRaw.slice(di + 1, Math.max(di + 1, endIdx > di ? endIdx : expRaw.length)).filter((l) => !DURATION.test(l));
    const loc = body.length && body[0].length < 60 && !/[.!?]$/.test(body[0]) ? body.shift()! : "";
    const current = PRESENT.test(m[2]);
    experience.push({ company, role, location: loc, start: toYm(m[1]), end: current ? "" : toYm(m[2]), current, desc: body.join(" ").replace(/\s+/g, " ").trim() });
  });

  // Eğitim: "Okul" satırı + "Derece · (2012 - 2016)" satırı
  const eduRaw = sectionLines("education");
  const education: ParsedCv["education"] = [];
  for (let i = 0; i < eduRaw.length; i++) {
    const m = eduRaw[i].match(/^(.*?)(?:\s*[·•,]\s*)?\(?\s*(\d{4})\s*[-–—]\s*(\d{4}|present|devam\w*)?\s*\)?$/i);
    if (m && /\d{4}/.test(eduRaw[i])) {
      const degree = m[1].replace(/[·•,\s]+$/, "").trim();
      const school = eduRaw[i - 1] && !/\d{4}/.test(eduRaw[i - 1]) ? eduRaw[i - 1] : "";
      const endTok = m[3] ?? "";
      education.push({ school, degree, location: "", start: `${m[2]}-09`, end: /\d{4}/.test(endTok) ? `${endTok}-06` : "", current: !!endTok && !/\d{4}/.test(endTok), desc: "" });
    }
  }
  if (!education.length && eduRaw.length) education.push({ school: eduRaw[0], degree: eduRaw[1] ?? "", location: "", start: "", end: "", current: false, desc: "" });

  const parsed: ParsedCv = {
    name, title, email, phone: phoneM?.replace(/\s*\(.*\)\s*$/, "") ?? "", city, website, linkedin, birth: "", license: "", summary,
    experience, education, skills, languages, certs, projects: [], interests: "", other: [],
  };
  return { parsed, found: { experience: experience.length, education: education.length, skills: skills.length, languages: languages.length } };
}
