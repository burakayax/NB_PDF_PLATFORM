/**
 * CV Yapay Zekâ Asistanı — istemci tarafı: ne gönderildiği, sonuçların CV'ye uygulanması,
 * belgeden içe aktarma. Sunucu uçları: POST /api/ai/cv/:mode (bkz. web/api cv-assist.service).
 */
import { unzipSync, strFromU8 } from "fflate";
import { getSaasApiBase } from "../../../api/saasBase";
import type { AiError, AiQuota } from "../../../api/ai";
import { extractPdfText } from "../../../lib/pdfText";
import { fmtMonth, normalizeCv, uid, type CvData } from "./cvModel";
import { totalExperienceYears } from "./cvAnalysis";

export type CvAiMode = "summary" | "bullets" | "tailor" | "coverLetter" | "parse";

export async function callCvAi<T>(mode: CvAiMode, body: Record<string, unknown>, token: string | null, lang: "tr" | "en"): Promise<{ result: T; quota?: AiQuota }> {
  const res = await fetch(`${getSaasApiBase()}/api/ai/cv/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: "include",
    body: JSON.stringify({ ...body, lang }),
  });
  const data = (await res.json().catch(() => ({}))) as { result?: T; quota?: AiQuota; message?: string; error?: string };
  if (!res.ok) {
    const err = new Error(data.message || "Yapay zekâ isteği başarısız.") as AiError;
    err.status = res.status;
    err.code = data.error;
    if (data.quota) err.quota = data.quota;
    throw err;
  }
  return { result: data.result as T, quota: data.quota };
}

// ── Gönderilen veri (şeffaflık) ────────────────────────────────────────────

const dateText = (a: string, b: string, cur: boolean, lang: "tr" | "en") => {
  const s = fmtMonth(a, lang);
  const e = cur ? (lang === "tr" ? "Devam ediyor" : "Present") : fmtMonth(b, lang);
  return [s, e].filter(Boolean).join(" – ");
};

/**
 * Yapay zekâya GİDEN CV metni. Ad, e-posta, telefon, adres, web, LinkedIn, doğum tarihi
 * ve fotoğraf ASLA dahil edilmez; yalnızca deneyim/eğitim/beceri içeriği. Kullanıcıya olduğu
 * gibi gösterilir (arayüzde "Yapay zekâya ne gidiyor?").
 */
export function cvTextForAi(d: CvData): string {
  const out: string[] = [];
  if (d.title.trim()) out.push(`Unvan: ${d.title.trim()}`);
  if (d.summary.trim()) out.push(`Özet: ${d.summary.trim()}`);
  const lang = d.settings.lang;
  for (const e of d.experience) {
    const head = [e.role, e.company].filter(Boolean).join(" · ");
    if (!head && !e.desc.trim()) continue;
    out.push(`\nDeneyim: ${head}${dateText(e.start, e.end, e.current, lang) ? ` (${dateText(e.start, e.end, e.current, lang)})` : ""}`);
    for (const l of e.desc.split(/\r?\n/).map((x) => x.replace(/^[\s•\-–*]+/, "").trim()).filter(Boolean)) out.push(`- ${l}`);
  }
  for (const e of d.education) if (e.school || e.degree) out.push(`\nEğitim: ${[e.degree, e.school].filter(Boolean).join(", ")}`);
  const skills = d.skills.map((s) => s.name.trim()).filter(Boolean);
  if (skills.length) out.push(`\nBeceriler: ${skills.join(", ")}`);
  const langs = d.languages.map((l) => [l.name, l.level].filter(Boolean).join(" ")).filter(Boolean);
  if (langs.length) out.push(`Diller: ${langs.join(", ")}`);
  const certs = d.certs.map((c) => c.name).filter(Boolean);
  if (certs.length) out.push(`Sertifikalar: ${certs.join(", ")}`);
  return out.join("\n").trim();
}

export function aiYears(d: CvData): number | null {
  const y = totalExperienceYears(d);
  return y > 0 ? y : null;
}

// ── Sonuçları CV'ye uygulama ───────────────────────────────────────────────

const lines = (s: string) => s.split(/\r?\n/);

/** Bir deneyimin açıklamasında, satırı (özgün metne göre) yenisiyle değiştirir. */
export function replaceBullet(desc: string, original: string, improved: string): string {
  const norm = (x: string) => x.replace(/^[\s•\-–*]+/, "").trim().toLocaleLowerCase("tr");
  let hit = false;
  const out = lines(desc).map((l) => {
    if (!hit && norm(l) === norm(original)) { hit = true; return improved; }
    return l;
  });
  return out.join("\n");
}

export type TailorResult = {
  summary: string;
  summaryAdded: string[];
  bullets: { where: string; original: string; improved: string; why: string; added: string[] }[];
  emphasize: string[];
  askUser: string[];
};

/** Uyarlama sonucunu CV'nin KOPYASINA uygular (özgün CV bozulmaz). */
export function applyTailor(d: CvData, r: TailorResult, pick: { summary: boolean; bullets: boolean[] }): CvData {
  const c = structuredClone(d);
  if (pick.summary && r.summary) c.summary = r.summary;
  r.bullets.forEach((b, i) => {
    if (!pick.bullets[i]) return;
    for (const e of c.experience) {
      const next = replaceBullet(e.desc, b.original, b.improved);
      if (next !== e.desc) { e.desc = next; break; }
    }
  });
  return c;
}

// ── Belgeden içe aktarma ───────────────────────────────────────────────────

/** DOCX → düz metin (word/document.xml'den). Yeni kütüphane gerekmez (fflate zaten var). */
export async function docxToText(file: File): Promise<string> {
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (f) => f.name === "word/document.xml" });
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("docx");
  return strFromU8(xml)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ImportRead = { text: string; scanned: boolean };

/** PDF / DOCX / TXT dosyasından metni CİHAZDA okur. */
export async function readCvFile(file: File): Promise<ImportRead> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return { text: await docxToText(file), scanned: false };
  if (name.endsWith(".txt") || file.type === "text/plain") return { text: (await file.text()).trim(), scanned: false };
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const r = await extractPdfText(file);
    return { text: r.text, scanned: r.likelyScanned };
  }
  throw new Error("type");
}

export type ParsedCv = {
  name: string; title: string; email: string; phone: string; city: string; website: string; linkedin: string; birth: string; license: string; summary: string;
  experience: { company: string; role: string; location: string; start: string; end: string; current: boolean; desc: string }[];
  education: { school: string; degree: string; location: string; start: string; end: string; current: boolean; desc: string }[];
  skills: string[];
  languages: { name: string; level: string }[];
  certs: { name: string; issuer: string; date: string }[];
  projects: { name: string; link: string; desc: string }[];
  interests: string;
  other: { title: string; items: { title: string; subtitle: string; date: string; desc: string }[] }[];
};

/** Ayrıştırılmış belgeyi yeni bir CV verisine çevirir. */
export function parsedToCv(p: ParsedCv, base: CvData): CvData {
  return normalizeCv({
    ...base,
    name: p.name, title: p.title, email: p.email, phone: p.phone, city: p.city, website: p.website, linkedin: p.linkedin, birth: p.birth, license: p.license, summary: p.summary,
    photo: null,
    experience: p.experience.map((e) => ({ id: uid(), ...e })),
    education: p.education.map((e) => ({ id: uid(), ...e })),
    skills: p.skills.map((name) => ({ id: uid(), name, level: 0 })),
    languages: p.languages.map((l) => ({ id: uid(), ...l })),
    certs: p.certs.map((c) => ({ id: uid(), ...c })),
    projects: p.projects.map((x) => ({ id: uid(), ...x })),
    references: [],
    interests: p.interests,
    customSections: p.other.map((s) => ({ id: uid(), title: s.title, items: s.items.map((i) => ({ id: uid(), ...i })) })),
  });
}
